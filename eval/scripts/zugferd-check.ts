// VER-06 check: CII from ground truth -> /v1/zugferd/combine -> Mustang says valid, and a plain
// PDF without embedded XML is reported invalid. Needs the verifier (docker compose up verifier)
// and a built corpus (pnpm corpus:build).
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildCii, deriveAmounts, InvoiceInput } from "@verdict/core";

const url = process.env.VERIFIER_URL || "http://localhost:8081";
const secret = process.env.VERIFIER_SECRET;
if (!secret) throw new Error("VERIFIER_SECRET is missing");
const headers = { "X-Verifier-Secret": secret };

const dir = resolve(import.meta.dirname, "../corpus/generated/clean");
const picks = readdirSync(dir).filter((f) => f.endsWith("-classic.json")).sort().slice(0, 4);
if (picks.length === 0) throw new Error("no corpus found; run pnpm corpus:build first");

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log(`FAIL ${msg}`);
};

for (const file of picks) {
  const invoice = InvoiceInput.parse(JSON.parse(readFileSync(join(dir, file), "utf8")).invoice);
  const xml = buildCii(invoice, deriveAmounts(invoice));
  const t0 = performance.now();
  const res = await fetch(`${url}/v1/zugferd/combine`, { method: "POST", headers: { ...headers, "Content-Type": "application/xml" }, body: xml });
  const ms = Math.round(performance.now() - t0);
  if (res.status !== 200 || res.headers.get("X-Zugferd-Validation") !== "valid") {
    fail(`${file}: combine answered ${res.status}`);
    continue;
  }
  const pdf = new Uint8Array(await res.arrayBuffer());
  const check = (await (await fetch(`${url}/v1/zugferd/validate`, { method: "POST", headers, body: pdf })).json()) as { valid: boolean; messages: string[] };
  if (!check.valid) fail(`${file}: Mustang reports ${check.messages.slice(0, 3).join("; ")}`);
  else console.log(`ok   ${file}: ZUGFeRD PDF/A-3, ${pdf.length} bytes, ${ms} ms`);
}

// A plain PDF (no embedded XML, not PDF/A-3) must not pass.
const plain = readFileSync(join(dir, picks[0]!.replace(/\.json$/, ".pdf")));
const negative = (await (await fetch(`${url}/v1/zugferd/validate`, { method: "POST", headers, body: plain })).json()) as { valid: boolean };
if (negative.valid) fail("a plain PDF was reported as valid ZUGFeRD");
else console.log("ok   plain PDF rejected");

if (failures > 0) process.exit(1);
console.log("zugferd check passed");
