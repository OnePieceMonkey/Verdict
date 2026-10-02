import { createHash } from "node:crypto";
import {
  BudgetExceededError,
  deriveAmounts,
  extractPageTexts,
  runInvoice,
  type RawExtraction,
  type TokenFactoryClient,
  type UserInput,
  type VerifierVerdict,
} from "@verdict/core";
import type { RunEvent, RunResultView } from "./run-protocol.ts";
import { MAX_PAGES } from "./limits.ts";

export class UserFacingError extends Error {}

/**
 * Runs one invoice through the agent loop and emits RunEvents as they happen.
 * No server-only imports here: the gallery builder runs this file outside Next.js.
 * Nothing is persisted (NFR-03): the PDF lives only in memory for the duration of the call.
 */
export interface RunDeps {
  readonly client: TokenFactoryClient;
  readonly models: { readonly extract: string; readonly repair: string };
  readonly validate: (xml: string) => Promise<VerifierVerdict>;
}

/** Shared by the API route and the gallery builder, so both produce identical event streams. */
export async function executeRun(
  deps: RunDeps,
  pdf: Uint8Array,
  emit: (event: RunEvent) => void,
  resume?: { extraction: RawExtraction; userInputs: readonly UserInput[] },
): Promise<void> {
  const uploadHash = `sha256:${createHash("sha256").update(pdf).digest("hex")}`;
  let pages: string[];
  try {
    pages = await extractPageTexts(Buffer.from(pdf));
  } catch {
    throw new UserFacingError("This file could not be read as a PDF.");
  }
  if (pages.length > MAX_PAGES) throw new UserFacingError(`Please upload at most ${MAX_PAGES} pages.`);
  if (pages.every((p) => p.trim().length < 20)) {
    throw new UserFacingError(
      "This PDF has no text layer (probably a scan). This build reads text-based PDFs only.",
    );
  }
  emit({ type: "start", pages, uploadHash });

  try {
    const run = await runInvoice({
      client: deps.client,
      models: deps.models,
      validate: deps.validate,
      pages,
      uploadHash,
      onAudit: (event) => emit({ type: "audit", event }),
      ...(resume ? { extraction: resume.extraction, userInputs: resume.userInputs } : {}),
    });
    const amounts = run.invoice ? deriveAmounts(run.invoice) : null;
    const view: RunResultView = {
      state: run.state,
      invoice: run.invoice ?? run.partial,
      provenance: [...run.provenance.entries()],
      missing: run.missing,
      openIssues: run.openIssues,
      warnings: run.warnings,
      rejectedFacts: run.rejectedFacts,
      patchesApplied: run.patchesApplied,
      patchesRejected: run.patchesRejected,
      verifier: run.verifier
        ? {
            valid: run.verifier.valid,
            errors: run.verifier.errors,
            reportHash: run.verifier.reportHash,
            versions: run.verifier.versions,
          }
        : null,
      amounts: amounts ? { lineTotal: amounts.lineTotal, taxTotal: amounts.taxTotal, grandTotal: amounts.grandTotal } : null,
      documentTotals: run.documentTotals,
      xml: run.xml ?? null,
      auditJsonl: run.audit.toJsonl(),
      iterations: run.iterations,
      costUsd: run.costUsd,
      extraction: run.extraction,
      models: deps.models,
    };
    emit({ type: "result", result: view });
  } catch (e) {
    if (e instanceof BudgetExceededError) {
      throw new UserFacingError("Today's model budget for this public demo is used up. The example gallery still works.");
    }
    throw e;
  }
}
