import { describe, expect, it } from "vitest";
import { AuditLog, sha256, verifyAuditLog } from "./audit-log.ts";

const fixedClock = () => new Date("2026-10-02T12:00:00.000Z");

function sampleLog() {
  const log = new AuditLog(fixedClock);
  const xml = new TextEncoder().encode("<rsm:CrossIndustryInvoice/>");
  log.append({ type: "INGEST", actor: { kind: "core", version: "0.1.0" }, data: { upload: sha256("pdf-bytes") } });
  log.append({
    type: "EXTRACT",
    actor: { kind: "model", model: "nvidia/nemotron-3-super-120b-a12b" },
    data: { promptHash: sha256("prompt"), promptTokens: 1200, completionTokens: 300, costUsd: "0.000630" },
  });
  log.append({
    type: "VALIDATE",
    actor: { kind: "verifier", version: "1.6.3", config: "xrechnung-3.0.2-validator-configuration-2026-08-31" },
    data: { valid: true, errorCount: 0 },
  });
  log.append({ type: "OUTPUT", actor: { kind: "core", version: "0.1.0" }, data: { files: { "invoice.xml": sha256(xml) } } });
  return { jsonl: log.toJsonl(), files: new Map([["invoice.xml", xml]]) };
}

describe("audit log", () => {
  it("verifies an untouched chain and its output files", () => {
    const { jsonl, files } = sampleLog();
    expect(verifyAuditLog(jsonl, files)).toEqual({ ok: true, events: 4 });
  });

  it("is deterministic for the same events and clock", () => {
    expect(sampleLog().jsonl).toBe(sampleLog().jsonl);
  });

  it("detects a modified event", () => {
    const { jsonl } = sampleLog();
    const tampered = jsonl.replace('"valid":true', '"valid":false');
    expect(verifyAuditLog(tampered)).toMatchObject({ ok: false, seq: 2, reason: "event content does not match its hash" });
  });

  it("detects a deleted event", () => {
    const lines = sampleLog().jsonl.trim().split("\n");
    lines.splice(1, 1);
    expect(verifyAuditLog(lines.join("\n"))).toMatchObject({ ok: false, seq: 1 });
  });

  it("detects a re-hashed event because the next link breaks", () => {
    const lines = sampleLog().jsonl.trim().split("\n");
    const ev = JSON.parse(lines[2]!) as Record<string, unknown>;
    ev.data = { valid: false, errorCount: 3 };
    // An attacker recomputes this event's own hash, but cannot fix the following prevHash.
    lines[2] = JSON.stringify({ ...ev, hash: "sha256:" + "f".repeat(64) });
    expect(verifyAuditLog(lines.join("\n")).ok).toBe(false);
  });

  it("detects a modified output file", () => {
    const { jsonl } = sampleLog();
    const files = new Map([["invoice.xml", new TextEncoder().encode("<tampered/>")]]);
    expect(verifyAuditLog(jsonl, files)).toMatchObject({ ok: false, reason: "file invoice.xml was modified" });
  });
});
