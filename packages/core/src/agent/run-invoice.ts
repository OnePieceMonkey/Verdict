import { Decimal } from "decimal.js";
import { AuditLog, sha256, type AuditActor } from "../audit/audit-log.ts";
import { buildCii } from "../cii/build.ts";
import { deriveAmounts } from "../derive/derive.ts";
import { assembleInvoice, btOf, type MissingFact, type Provenance } from "../extract/assemble.ts";
import { extractRaw, pagesToPrompt } from "../extract/extract.ts";
import { EXTRACTION_SYSTEM_PROMPT } from "../extract/schema.ts";
import type { ChatResult, TokenFactoryClient } from "../llm/token-factory-client.ts";
import { InvoiceInput, type InvoiceInput as InvoiceInputT } from "../model/invoice.ts";
import { applyPatches, guardPatches, type AcceptedPatch, type RejectedPatch } from "../repair/patch-guard.ts";
import { planRepair, REPAIR_SYSTEM_PROMPT, type RepairIssue } from "../repair/repair.ts";

export const CORE_VERSION = "0.1.0";

/** Minimal verifier contract so core does not depend on the HTTP client. */
export interface VerifierVerdict {
  readonly valid: boolean;
  readonly errors: readonly { readonly ruleId: string; readonly severity: string; readonly message: string; readonly location: string }[];
  readonly reportHash: string | null;
  readonly versions: { readonly validator: string; readonly configuration: string };
}

export type RunState = "OUTPUT" | "NEEDS_INPUT" | "FAILED";

export interface UserInput {
  /** Model path, e.g. "buyerReference" or "seller.contact.phone". */
  readonly path: string;
  readonly value: string;
}

export interface RunOptions {
  readonly client: TokenFactoryClient;
  readonly models: { readonly extract: string; readonly repair: string };
  readonly validate: (xml: string) => Promise<VerifierVerdict>;
  readonly pages: readonly string[];
  readonly uploadHash: string;
  readonly maxIterations?: number;
  readonly userInputs?: readonly UserInput[];
  readonly now?: () => Date;
  readonly onStep?: (step: string, detail: Record<string, unknown>) => void;
}

export interface RunResult {
  readonly state: RunState;
  readonly invoice?: InvoiceInputT;
  readonly partial: unknown;
  readonly xml?: string;
  readonly verifier?: VerifierVerdict;
  readonly missing: readonly MissingFact[];
  readonly openIssues: readonly RepairIssue[];
  readonly warnings: readonly string[];
  readonly iterations: number;
  readonly patchesApplied: readonly AcceptedPatch[];
  readonly patchesRejected: readonly RejectedPatch[];
  readonly provenance: ReadonlyMap<string, Provenance>;
  readonly fieldsWithoutProvenance: readonly string[];
  readonly audit: AuditLog;
  readonly costUsd: string;
}

const core: AuditActor = { kind: "core", version: CORE_VERSION };

/**
 * The agent loop (docs/SRS.md §4) for a document with a text layer:
 * EXTRACT → EVIDENCE_CHECK/NORMALIZE → DERIVE → CONSISTENCY_CHECK → BUILD_CII → VALIDATE,
 * with up to 3 REPAIR_PLAN/PATCH_GUARD rounds, ending in OUTPUT or NEEDS_INPUT.
 */
export async function runInvoice(opts: RunOptions): Promise<RunResult> {
  const audit = new AuditLog(opts.now);
  const maxIterations = opts.maxIterations ?? 3;
  const step = (name: string, detail: Record<string, unknown>) => opts.onStep?.(name, detail);
  let cost = new Decimal(0);
  const modelEvent = (type: "EXTRACT" | "REPAIR_PLAN", call: ChatResult, prompt: string) => {
    cost = cost.add(call.costUsd);
    // AUD-02: model id, prompt hash, tokens and cost; never invoice contents.
    audit.append({
      type,
      actor: { kind: "model", model: call.model },
      data: {
        promptHash: sha256(prompt),
        promptTokens: call.promptTokens,
        completionTokens: call.completionTokens,
        costUsd: call.costUsd,
        latencyMs: call.latencyMs,
      },
    });
  };

  audit.append({ type: "INGEST", actor: core, inputHash: opts.uploadHash, data: { pages: opts.pages.length } });
  step("INGEST", { pages: opts.pages.length });

  const extraction = await extractRaw(opts.client, opts.models.extract, opts.pages);
  for (const call of extraction.calls) modelEvent("EXTRACT", call, EXTRACTION_SYSTEM_PROMPT + pagesToPrompt(opts.pages));
  step("EXTRACT", { calls: extraction.calls.length });

  const assembled = assembleInvoice(extraction.raw, opts.pages);
  audit.append({
    type: "EVIDENCE_CHECK",
    actor: core,
    data: { accepted: assembled.provenance.size, rejected: assembled.rejected.map((r) => ({ path: r.path, reason: r.reason })) },
  });
  step("EVIDENCE_CHECK", { rejected: assembled.rejected.length });

  const provenance = new Map(assembled.provenance);
  let partial: unknown = assembled.partial;
  for (const input of opts.userInputs ?? []) {
    partial = setPath(partial, input.path, input.value);
    provenance.set(input.path, { kind: "user", enteredAt: (opts.now ?? (() => new Date()))().toISOString() });
  }
  if (opts.userInputs?.length) {
    audit.append({ type: "USER_INPUT", actor: { kind: "user" }, data: { fields: opts.userInputs.map((u) => btOf(u.path)) } });
  }

  const warnings = assembled.rejected.map((r) => `${btOf(r.path)}: ${r.reason}`);
  const applied: AcceptedPatch[] = [];
  const rejectedPatches: RejectedPatch[] = [];
  let lastIssueCount = Number.POSITIVE_INFINITY;
  let verifier: VerifierVerdict | undefined;
  let xml: string | undefined;
  let iterations = 0;

  for (;;) {
    const parsed = InvoiceInput.safeParse(partial);
    let issues: RepairIssue[];
    let missing: MissingFact[] = [];

    if (parsed.success) {
      const invoice = parsed.data;
      const amounts = deriveAmounts(invoice);
      audit.append({ type: "DERIVE", actor: core, data: { lines: amounts.lines.length, vatGroups: amounts.vatBreakdown.length } });
      const consistency = checkConsistency(assembled.documentTotals, amounts);
      warnings.push(...consistency);
      audit.append({ type: "CONSISTENCY_CHECK", actor: core, data: { warnings: consistency.length } });
      xml = buildCii(invoice, amounts);
      audit.append({ type: "BUILD_CII", actor: core, outputHash: sha256(xml), data: {} });
      verifier = await opts.validate(xml);
      audit.append({
        type: "VALIDATE",
        actor: { kind: "verifier", version: verifier.versions.validator, config: verifier.versions.configuration },
        inputHash: sha256(xml),
        data: { valid: verifier.valid, errorCount: verifier.errors.filter((e) => e.severity === "error").length, reportHash: verifier.reportHash },
      });
      step("VALIDATE", { valid: verifier.valid, iteration: iterations });
      if (verifier.valid && verifier.reportHash) {
        const withoutProvenance = leafPaths(invoice).filter((p) => !provenance.has(p));
        audit.append({ type: "OUTPUT", actor: core, data: { files: { "xrechnung.xml": sha256(xml) }, fieldsWithoutProvenance: withoutProvenance.length } });
        step("OUTPUT", {});
        return result("OUTPUT", { invoice, missing: [], openIssues: [], withoutProvenance });
      }
      issues = verifier.errors
        .filter((e) => e.severity === "error")
        .map((e) => ({ id: e.ruleId, message: e.message, location: e.location }));
    } else {
      missing = parsed.error.issues.map((i) => {
        const path = i.path.join(".");
        return { path, bt: btOf(path), reason: assembled.missing.find((m) => m.path === path)?.reason ?? "not found on the document" };
      });
      issues = missing.map((m) => ({ id: "MISSING", message: `${m.bt} is required but ${m.reason}`, location: `/${m.path.replaceAll(".", "/")}` }));
    }

    // REP-03: at most maxIterations rounds, and only while the number of issues goes down.
    if (iterations >= maxIterations || issues.length >= lastIssueCount) {
      return needsInput(missing, issues);
    }
    lastIssueCount = issues.length;
    iterations++;

    const plan = await planRepair(opts.client, opts.models.repair, issues, partial, opts.pages);
    modelEvent("REPAIR_PLAN", plan.call, REPAIR_SYSTEM_PROMPT);
    const guarded = guardPatches(plan.patches, opts.pages, assembled.numberFormat);
    audit.append({
      type: "PATCH_GUARD",
      actor: core,
      data: {
        accepted: guarded.accepted.map((p) => p.path),
        rejected: guarded.rejected.map((r) => ({ path: r.patch.path, reason: r.reason })),
        unresolvable: plan.unresolvable.map((u) => u.issue),
      },
    });
    step("REPAIR", { iteration: iterations, accepted: guarded.accepted.length, rejected: guarded.rejected.length });
    applied.push(...guarded.accepted);
    rejectedPatches.push(...guarded.rejected);
    if (guarded.accepted.length === 0) return needsInput(missing, issues);
    partial = applyPatches(partial, guarded.accepted);
    for (const p of guarded.accepted) {
      provenance.set(p.path.replace(/^\//, "").replaceAll("/", "."), { kind: "evidence", page: p.page, quote: p.quote });
    }
  }

  function needsInput(missing: MissingFact[], issues: RepairIssue[]): RunResult {
    audit.append({
      type: "NEEDS_INPUT",
      actor: core,
      data: { missing: missing.map((m) => m.bt), openIssues: issues.map((i) => i.id) },
    });
    step("NEEDS_INPUT", { missing: missing.length, issues: issues.length });
    return result("NEEDS_INPUT", { missing, openIssues: issues, withoutProvenance: [] });
  }

  function result(
    state: RunState,
    r: { invoice?: InvoiceInputT; missing: MissingFact[]; openIssues: RepairIssue[]; withoutProvenance: string[] },
  ): RunResult {
    return {
      state,
      ...(r.invoice ? { invoice: r.invoice } : {}),
      partial,
      ...(xml && state === "OUTPUT" ? { xml } : {}),
      ...(verifier ? { verifier } : {}),
      missing: r.missing,
      openIssues: r.openIssues,
      warnings,
      iterations,
      patchesApplied: applied,
      patchesRejected: rejectedPatches,
      provenance,
      fieldsWithoutProvenance: r.withoutProvenance,
      audit,
      costUsd: cost.toFixed(6),
    };
  }
}

/** CORE-03: printed totals that differ from the computed ones become warnings, never values. */
export function checkConsistency(
  printed: { lineTotal?: string | undefined; taxTotal?: string | undefined; grandTotal?: string | undefined },
  derived: { lineTotal: string; taxTotal: string; grandTotal: string },
): string[] {
  const out: string[] = [];
  const cmp = (bt: string, p: string | undefined, d: string) => {
    if (p !== undefined && !new Decimal(p).equals(d)) out.push(`${bt}: printed ${p}, computed ${d}`);
  };
  cmp("BT-106", printed.lineTotal, derived.lineTotal);
  cmp("BT-110", printed.taxTotal, derived.taxTotal);
  cmp("BT-112", printed.grandTotal, derived.grandTotal);
  return out;
}

function leafPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => leafPaths(v, prefix ? `${prefix}.${i}` : String(i)));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k));
  }
  return value === undefined ? [] : [prefix];
}

function setPath(model: unknown, path: string, value: string): unknown {
  const out = structuredClone(model ?? {}) as Record<string, unknown>;
  const keys = path.split(".");
  let node: Record<string, unknown> = out;
  for (const k of keys.slice(0, -1)) {
    if (node[k] === undefined || node[k] === null) node[k] = /^\d+$/.test(keys[keys.indexOf(k) + 1] ?? "") ? [] : {};
    node = node[k] as Record<string, unknown>;
  }
  const leaf = keys.at(-1);
  if (leaf !== undefined) node[leaf] = value;
  return out;
}
