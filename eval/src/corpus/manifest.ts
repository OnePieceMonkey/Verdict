import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { Expectation } from "./mutations.ts";

export const CORPUS_DIR = resolve(import.meta.dirname, "../../corpus/generated");

export type CorpusSet = "clean" | "noisy" | "mutated";

/**
 * Holdout (EVAL-05): ~20 % of the in-scope invoices, chosen by the lowest
 * sha256("verdict-holdout-v1:<id>") so nobody hand-picks easy or hard cases.
 * Never evaluated before phase 5.
 */
export const HOLDOUT_SALT = "verdict-holdout-v1";
export const HOLDOUT_COUNT = 4;

export function holdoutIds(invoiceIds: readonly string[]): Set<string> {
  const ranked = invoiceIds
    .map((id) => [createHash("sha256").update(`${HOLDOUT_SALT}:${id}`).digest("hex"), id] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return new Set(ranked.slice(0, HOLDOUT_COUNT).map(([, id]) => id));
}

export interface ManifestEntry {
  /** Unique, stable id, e.g. "clean/01.01a-classic". */
  readonly id: string;
  readonly set: CorpusSet;
  readonly holdout: boolean;
  /** Test suite instance this document was rendered from. */
  readonly source: string;
  /** Short invoice id, e.g. "01.01a". */
  readonly invoiceId: string;
  readonly layout: string;
  readonly noise: Record<string, unknown>;
  readonly mutation?: { readonly id: string; readonly expect: Expectation; readonly detectedBy: string; readonly acceptedAnyway: boolean };
  /** Path of the PDF, relative to CORPUS_DIR. */
  readonly pdf: string;
  /** Path of the ground-truth JSON (what is printed on the PDF), relative to CORPUS_DIR. */
  readonly groundTruth: string;
  readonly sha256: string;
}

export interface Manifest {
  readonly testsuite: string;
  readonly generator: string;
  readonly entries: readonly ManifestEntry[];
}
