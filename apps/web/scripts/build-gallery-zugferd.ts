// Pre-builds the ZUGFeRD PDF for every recorded gallery run that ends verified, so the demo
// gallery serves it instantly. Same path as /api/zugferd: KoSIT re-check, Mustang build and
// validation in the verifier. No model call.
//   pnpm --filter @verdict/web gallery:zugferd   (needs the verifier: docker compose up -d verifier)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { RunEvent, RunResultView } from "../lib/run-protocol.ts";

const OUT = resolve(import.meta.dirname, "../public/gallery");
const url = process.env.VERIFIER_URL || "http://localhost:8081";
const secret = process.env.VERIFIER_SECRET;
if (!secret) throw new Error("VERIFIER_SECRET is missing");

type Recording = { id: string; run: { event: RunEvent }[]; followUp?: { event: RunEvent }[] };
const finalResult = (events: { event: RunEvent }[] | undefined): RunResultView | undefined =>
  (events?.find((e) => e.event.type === "result")?.event as { result: RunResultView } | undefined)?.result;

for (const file of readdirSync(OUT).filter((f) => f.endsWith(".json") && f !== "index.json").sort()) {
  const rec = JSON.parse(readFileSync(join(OUT, file), "utf8").split("\n")[0]!) as Recording;
  const result = finalResult(rec.followUp) ?? finalResult(rec.run);
  if (result?.state !== "OUTPUT" || !result.xml) {
    console.log(`skip ${rec.id}: ${result?.state ?? "no result"}`);
    continue;
  }
  const res = await fetch(`${url}/v1/zugferd/combine`, {
    method: "POST",
    headers: { "X-Verifier-Secret": secret, "Content-Type": "application/xml" },
    body: result.xml,
  });
  if (res.status !== 200 || res.headers.get("X-Zugferd-Validation") !== "valid") throw new Error(`${rec.id}: combine answered ${res.status}`);
  const pdf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(OUT, `${rec.id}.zugferd.pdf`), pdf);
  console.log(`ok   ${rec.id}: ${pdf.length} bytes`);
}
