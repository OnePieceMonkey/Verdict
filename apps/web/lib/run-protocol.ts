import type { AuditEvent, MissingFact, Provenance, RejectedFact, RawExtraction, RunState } from "@verdict/core";

/**
 * Server-sent events of one run. The UI draws the run sheet from `audit` events (each carries
 * its timestamp), and the result view from the final `result`.
 */
export type RunEvent =
  | { readonly type: "start"; readonly pages: readonly string[]; readonly uploadHash: string }
  | { readonly type: "audit"; readonly event: AuditEvent }
  | { readonly type: "result"; readonly result: RunResultView }
  | { readonly type: "error"; readonly message: string };

export interface RunResultView {
  readonly state: RunState;
  readonly invoice: unknown;
  readonly provenance: readonly (readonly [string, Provenance])[];
  readonly missing: readonly MissingFact[];
  readonly openIssues: readonly { readonly id: string; readonly message: string; readonly location: string }[];
  readonly warnings: readonly string[];
  readonly rejectedFacts: readonly RejectedFact[];
  readonly patchesApplied: readonly { path: string; value: string; normalized: string; quote: string; page: number }[];
  readonly patchesRejected: readonly { patch: { path: string; value: string; quote: string; page: number }; reason: string }[];
  readonly verifier: {
    readonly valid: boolean;
    readonly errors: readonly { ruleId: string; severity: string; message: string; location: string }[];
    readonly reportHash: string | null;
    readonly versions: { validator: string; configuration: string };
  } | null;
  readonly amounts: { readonly lineTotal: string; readonly taxTotal: string; readonly grandTotal: string } | null;
  readonly documentTotals: { readonly lineTotal?: string | undefined; readonly taxTotal?: string | undefined; readonly grandTotal?: string | undefined };
  readonly xml: string | null;
  readonly auditJsonl: string;
  readonly iterations: number;
  readonly costUsd: string;
  readonly extraction: RawExtraction;
  readonly models: { readonly extract: string; readonly repair: string };
}
