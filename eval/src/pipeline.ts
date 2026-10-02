import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assembleInvoice,
  buildCii,
  deriveAmounts,
  extractRaw,
  InvoiceInput,
  TokenFactoryClient,
  type InvoiceInput as InvoiceInputT,
} from "@verdict/core";
import { extractPageTexts } from "./render/extract-text.ts";
import { CORPUS_DIR, type ManifestEntry } from "./corpus/manifest.ts";
import { validateXRechnung, type VerifierResult } from "./verifier-client.ts";

export type PipelineState = "OUTPUT" | "NEEDS_INPUT" | "FAILED";

export interface PipelineResult {
  readonly state: PipelineState;
  /** The model the pipeline ended with (extracted + repaired), if any. */
  readonly invoice?: InvoiceInputT;
  readonly verifier?: VerifierResult;
  readonly missingFields: readonly string[];
  readonly warnings: readonly string[];
  readonly iterations: number;
  readonly fieldsWithoutProvenance: number;
  readonly costUsd: string;
  readonly error?: string;
}

/** A pipeline turns one corpus PDF into a result. Phase 3 plugs in the real agent loop. */
export type Pipeline = (entry: ManifestEntry, pdf: Buffer) => Promise<PipelineResult>;

export interface GroundTruthFile {
  readonly invoice: InvoiceInputT;
  readonly printed: unknown;
}

export function loadGroundTruth(entry: ManifestEntry): GroundTruthFile {
  return JSON.parse(readFileSync(join(CORPUS_DIR, entry.groundTruth), "utf8")) as GroundTruthFile;
}

/**
 * Dummy pipeline for EVAL-04: "extracts" by reading the ground truth, then runs the real
 * deterministic core and the real verifier. Proves the harness end-to-end without an LLM.
 */
export const groundTruthPipeline: Pipeline = async (entry) => {
  const { invoice } = loadGroundTruth(entry);
  const parsed = InvoiceInput.safeParse(invoice);
  if (!parsed.success) {
    return {
      state: "NEEDS_INPUT",
      invoice,
      missingFields: parsed.error.issues.map((i) => i.path.join(".")),
      warnings: [],
      iterations: 0,
      fieldsWithoutProvenance: 0,
      costUsd: "0",
    };
  }
  const xml = buildCii(parsed.data, deriveAmounts(parsed.data));
  const verifier = await validateXRechnung(xml);
  return {
    state: verifier.valid ? "OUTPUT" : "FAILED",
    invoice: parsed.data,
    verifier,
    missingFields: [],
    warnings: [],
    iterations: 0,
    fieldsWithoutProvenance: 0,
    costUsd: "0",
  };
};

/** Every leaf path of the model, e.g. "seller.address.city" or "lines.0.quantity". */
export function leafPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => leafPaths(v, prefix ? `${prefix}.${i}` : String(i)));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k));
  }
  return value === undefined ? [] : [prefix];
}

/**
 * Phase 3 pipeline without repair yet: text layer -> Nemotron extraction (constrained JSON)
 * -> evidence check -> normalization -> derivation -> CII -> verifier.
 */
export function llmPipeline(model = process.env.MODEL_EXTRACT || "nvidia/nemotron-3-super-120b-a12b"): Pipeline {
  const client = TokenFactoryClient.fromEnv();
  return async (_entry, pdf) => {
    const pages = await extractPageTexts(pdf);
    const before = client.ledger.spentToday();
    const { raw } = await extractRaw(client, model, pages);
    const assembled = assembleInvoice(raw, pages);
    const costUsd = client.ledger.spentToday().minus(before).toFixed(6);
    const base = {
      warnings: assembled.rejected.map((r) => `${r.path}: ${r.reason}`),
      iterations: 0,
      costUsd,
    };
    if (!assembled.invoice) {
      return {
        ...base,
        state: "NEEDS_INPUT",
        invoice: assembled.partial as InvoiceInputT,
        missingFields: assembled.missing.map((m) => m.bt),
        fieldsWithoutProvenance: 0,
      };
    }
    const invoice = assembled.invoice;
    const withoutProvenance = leafPaths(invoice).filter((p) => !assembled.provenance.has(p) && !p.endsWith(".meansCode")).length;
    const verifier = await validateXRechnung(buildCii(invoice, deriveAmounts(invoice)));
    return {
      ...base,
      state: verifier.valid ? "OUTPUT" : "FAILED",
      invoice,
      verifier,
      missingFields: [],
      fieldsWithoutProvenance: withoutProvenance,
    };
  };
}
