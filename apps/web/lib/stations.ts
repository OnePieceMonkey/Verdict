import type { AuditEvent } from "@verdict/core";

/** Routing-slip stations: each audit event type signs off under its own initials. */
export interface Station {
  readonly label: string;
  readonly initials: string;
  readonly actor: "model" | "core" | "verifier" | "user";
}

export const STATIONS: Readonly<Record<AuditEvent["type"], Station>> = {
  INGEST: { label: "Received", initials: "IN", actor: "core" },
  EXTRACT: { label: "Read by Nemotron Super", initials: "NEM·S", actor: "model" },
  EVIDENCE_CHECK: { label: "Quotes checked", initials: "EVD", actor: "core" },
  NORMALIZE: { label: "Normalized", initials: "NRM", actor: "core" },
  DERIVE: { label: "Amounts computed", initials: "CALC", actor: "core" },
  CONSISTENCY_CHECK: { label: "Totals cross-checked", initials: "CHK", actor: "core" },
  BUILD_CII: { label: "XRechnung written", initials: "CII", actor: "core" },
  VALIDATE: { label: "Official KoSIT validator", initials: "KoSIT", actor: "verifier" },
  REPAIR_PLAN: { label: "Repaired by Nemotron Ultra", initials: "NEM·U", actor: "model" },
  PATCH_GUARD: { label: "Patch guard", initials: "PG", actor: "core" },
  NEEDS_INPUT: { label: "Returned for your input", initials: "RTN", actor: "core" },
  USER_INPUT: { label: "Your answers recorded", initials: "YOU", actor: "user" },
  OUTPUT: { label: "Issued", initials: "OUT", actor: "core" },
};

/** The stations a clean run passes, shown greyed out before anything runs. */
export const IDLE_ROUTE: readonly AuditEvent["type"][] = [
  "INGEST",
  "EXTRACT",
  "EVIDENCE_CHECK",
  "DERIVE",
  "CONSISTENCY_CHECK",
  "BUILD_CII",
  "VALIDATE",
  "OUTPUT",
];

/** One-line facts for a station, read from the audit event data (never invoice contents). */
export function stationNote(e: AuditEvent): string | null {
  const d = e.data as Record<string, unknown>;
  switch (e.type) {
    case "INGEST":
      return `${d.pages} page${d.pages === 1 ? "" : "s"} · ${short(e.inputHash)}`;
    case "EXTRACT":
      if (d.reused) return "previous reading reused";
      return `${d.promptTokens} → ${d.completionTokens} tokens · $${fmtCost(d.costUsd)}`;
    case "REPAIR_PLAN":
      return `${d.promptTokens} → ${d.completionTokens} tokens · $${fmtCost(d.costUsd)}`;
    case "EVIDENCE_CHECK": {
      const rejected = (d.rejected as unknown[] | undefined)?.length ?? 0;
      return `${d.accepted} quoted · ${rejected} refused`;
    }
    case "PATCH_GUARD": {
      const a = (d.accepted as unknown[] | undefined)?.length ?? 0;
      const r = (d.rejected as unknown[] | undefined)?.length ?? 0;
      return `${a} accepted · ${r} voided`;
    }
    case "DERIVE":
      return `${d.lines} line${d.lines === 1 ? "" : "s"} · ${d.vatGroups} VAT group${d.vatGroups === 1 ? "" : "s"}`;
    case "CONSISTENCY_CHECK": {
      const lines = Number(d.lineMismatches ?? 0);
      const totals = Number(d.totalWarnings ?? 0);
      if (lines > 0) return `${lines} line${lines === 1 ? "" : "s"} contradict the page`;
      return totals > 0 ? `printed total differs` : "all lines match the page";
    }
    case "BUILD_CII":
      return short(e.outputHash);
    case "VALIDATE":
      return d.valid ? `accepted · report ${short(String(d.reportHash ?? ""))}` : `${d.errorCount} rule violation${d.errorCount === 1 ? "" : "s"}`;
    case "NEEDS_INPUT": {
      const m = (d.missing as unknown[] | undefined)?.length ?? 0;
      return m > 0 ? `${m} fact${m === 1 ? "" : "s"} not on the document` : "could not be resolved from the document";
    }
    case "USER_INPUT":
      return (d.fields as string[] | undefined)?.join(", ") ?? null;
    case "OUTPUT":
      return "audit chain closed";
    default:
      return null;
  }
}

const short = (hash: string | undefined) => (hash ? hash.replace(/^sha256:/, "").slice(0, 10) : "");
const fmtCost = (v: unknown) => Number(v ?? 0).toFixed(5);
