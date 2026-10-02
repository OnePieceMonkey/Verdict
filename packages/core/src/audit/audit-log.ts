import { createHash } from "node:crypto";
import canonicalize from "canonicalize";

/**
 * Hash-chained audit log (AUD-01, docs/SRS.md §6). One JSON event per line;
 * hash = sha256(JCS(event without "hash")), each event links to the previous hash.
 * This is a traceability record for the demo, not a GoBD archive.
 */
export type AuditEventType =
  | "INGEST"
  | "EXTRACT"
  | "EVIDENCE_CHECK"
  | "NORMALIZE"
  | "DERIVE"
  | "CONSISTENCY_CHECK"
  | "BUILD_CII"
  | "VALIDATE"
  | "REPAIR_PLAN"
  | "PATCH_GUARD"
  | "NEEDS_INPUT"
  | "USER_INPUT"
  | "OUTPUT";

export type AuditActor =
  | { readonly kind: "core"; readonly version: string }
  | { readonly kind: "model"; readonly model: string }
  | { readonly kind: "verifier"; readonly version: string; readonly config: string }
  | { readonly kind: "user" };

export interface AuditEvent {
  readonly seq: number;
  readonly ts: string;
  readonly type: AuditEventType;
  readonly actor: AuditActor;
  readonly inputHash?: string;
  readonly outputHash?: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly prevHash: string;
  readonly hash: string;
}

export const GENESIS_HASH = `sha256:${"0".repeat(64)}`;

export const sha256 = (data: string | Uint8Array): string =>
  `sha256:${createHash("sha256").update(data).digest("hex")}`;

function eventHash(event: Omit<AuditEvent, "hash">): string {
  const jcs = canonicalize(event);
  if (jcs === undefined) throw new Error("event is not canonicalizable");
  return sha256(jcs);
}

export class AuditLog {
  readonly #events: AuditEvent[] = [];
  readonly #now: () => Date;
  readonly #onAppend: ((event: AuditEvent) => void) | undefined;

  constructor(now: () => Date = () => new Date(), onAppend?: (event: AuditEvent) => void) {
    this.#now = now;
    this.#onAppend = onAppend;
  }

  append(entry: {
    type: AuditEventType;
    actor: AuditActor;
    data?: Record<string, unknown>;
    inputHash?: string;
    outputHash?: string;
  }): AuditEvent {
    const prev = this.#events.at(-1);
    const base = {
      seq: this.#events.length,
      ts: this.#now().toISOString(),
      type: entry.type,
      actor: entry.actor,
      ...(entry.inputHash ? { inputHash: entry.inputHash } : {}),
      ...(entry.outputHash ? { outputHash: entry.outputHash } : {}),
      data: entry.data ?? {},
      prevHash: prev?.hash ?? GENESIS_HASH,
    };
    const event: AuditEvent = { ...base, hash: eventHash(base) };
    this.#events.push(event);
    this.#onAppend?.(event);
    return event;
  }

  get events(): readonly AuditEvent[] {
    return this.#events;
  }

  toJsonl(): string {
    return this.#events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  }
}

export type AuditVerdict =
  | { readonly ok: true; readonly events: number }
  | { readonly ok: false; readonly seq: number; readonly reason: string };

/**
 * Verifies the chain and, optionally, output files against the hashes recorded in the
 * final OUTPUT event (data.files: { name: "sha256:..." }).
 */
export function verifyAuditLog(jsonl: string, files?: ReadonlyMap<string, Uint8Array>): AuditVerdict {
  const lines = jsonl.split("\n").filter((l) => l.trim() !== "");
  let prevHash = GENESIS_HASH;
  let last: AuditEvent | undefined;
  for (const [i, line] of lines.entries()) {
    let event: AuditEvent;
    try {
      event = JSON.parse(line) as AuditEvent;
    } catch {
      return { ok: false, seq: i, reason: "line is not valid JSON" };
    }
    if (event.seq !== i) return { ok: false, seq: i, reason: `sequence gap (found ${event.seq})` };
    if (event.prevHash !== prevHash) return { ok: false, seq: i, reason: "prevHash does not match previous event" };
    const { hash, ...rest } = event;
    if (eventHash(rest) !== hash) return { ok: false, seq: i, reason: "event content does not match its hash" };
    prevHash = hash;
    last = event;
  }
  if (!last) return { ok: false, seq: 0, reason: "empty log" };
  if (files) {
    const recorded = (last.data.files ?? {}) as Record<string, string>;
    for (const [name, content] of files) {
      if (recorded[name] === undefined) return { ok: false, seq: last.seq, reason: `file ${name} not recorded` };
      if (recorded[name] !== sha256(content)) return { ok: false, seq: last.seq, reason: `file ${name} was modified` };
    }
  }
  return { ok: true, events: lines.length };
}
