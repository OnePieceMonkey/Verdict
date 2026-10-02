// CORE-02: ground truth model -> deterministic CII builder -> verifier must say ACCEPTABLE.
// No LLM involved. Requires a running verifier (docker compose up verifier).
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { buildCii, readCii } from "@verdict/core";
import { inScopeInstances } from "../src/scope.ts";
import { validateXRechnung } from "../src/verifier-client.ts";

let failures = 0;
const files = inScopeInstances();
for (const file of files) {
  const { invoice } = readCii(readFileSync(file, "utf8"));
  const xml = buildCii(invoice);
  if (buildCii(invoice) !== xml) throw new Error(`builder not deterministic for ${basename(file)}`);
  const res = await validateXRechnung(xml);
  if (!res.valid) {
    failures++;
    const errs = res.errors.filter((e) => e.severity === "error");
    console.log(`FAIL ${basename(file)}: ${res.acceptRecommendation}`);
    for (const e of errs) console.log(`     ${e.ruleId}: ${e.message.slice(0, 110)}`);
  }
}
console.log(`roundtrip: ${files.length - failures}/${files.length} valid`);
process.exit(failures === 0 ? 0 : 1);
