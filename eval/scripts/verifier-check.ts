// VER-01 acceptance check against a running verifier (docker compose up verifier).
// 1) every CII instance of the pinned test suite must be valid
// 2) each mutation of a known-good invoice must be rejected with the expected rule ID
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { ciiInstances } from "../src/testsuite.ts";
import { validateXRechnung } from "../src/verifier-client.ts";

interface Mutation {
  readonly name: string;
  readonly expectRule: string;
  readonly apply: (xml: string) => string;
}

const replaceOnce = (xml: string, from: RegExp, to: string): string => {
  if (!from.test(xml)) throw new Error(`mutation anchor not found: ${from}`);
  return xml.replace(from, to);
};

const MUTATIONS: readonly Mutation[] = [
  {
    name: "invalid currency code",
    expectRule: "BR-CL-04",
    apply: (x) => replaceOnce(x, /<ram:InvoiceCurrencyCode>EUR</, "<ram:InvoiceCurrencyCode>XYZ<"),
  },
  {
    name: "grand total does not add up",
    expectRule: "BR-CO-15",
    apply: (x) =>
      replaceOnce(x, /<ram:GrandTotalAmount>([\d.]+)</, "<ram:GrandTotalAmount>999999.99<"),
  },
  {
    name: "missing buyer reference (Leitweg-ID)",
    expectRule: "BR-DE-15",
    apply: (x) => replaceOnce(x, /<ram:BuyerReference>[^<]*<\/ram:BuyerReference>/, ""),
  },
  {
    name: "invalid VAT category code",
    expectRule: "BR-CL-18",
    apply: (x) => replaceOnce(x, /<ram:CategoryCode>S</, "<ram:CategoryCode>Q<"),
  },
];

const files = ciiInstances();
if (files.length === 0) throw new Error("no CII instances found; run `pnpm testsuite:fetch` first");

let failures = 0;
let versions = "";
const t0 = performance.now();

for (const file of files) {
  const res = await validateXRechnung(readFileSync(file, "utf8"));
  versions = `${res.versions.validator} / ${res.versions.configuration}`;
  // The official acceptMatch decides. Some suite instances are ACCEPTABLE despite
  // error-level code list messages, because the XRechnung configuration tolerates them.
  if (!res.valid || !res.reportHash) {
    failures++;
    const errs = res.errors.filter((e) => e.severity === "error").map((e) => e.ruleId);
    console.log(`FAIL positive ${basename(file)}: ${res.acceptRecommendation} ${errs.join(", ")}`);
  }
}
console.log(`positive: ${files.length - failures}/${files.length} valid`);

const base = files.find((f) => basename(f) === "01.01a-INVOICE_uncefact.xml");
if (!base) throw new Error("base instance 01.01a missing");
const baseXml = readFileSync(base, "utf8");
let mutationFailures = 0;
for (const m of MUTATIONS) {
  const res = await validateXRechnung(m.apply(baseXml));
  const hit = res.errors.find((e) => e.ruleId === m.expectRule && e.severity !== "information");
  // A rejection without error details would be useless for repair, so it counts as a failure.
  const ok = !res.valid && hit !== undefined && hit.location.length > 0 && res.reportHash !== null;
  if (!ok) mutationFailures++;
  console.log(
    `${ok ? "ok  " : "FAIL"} mutation "${m.name}" -> ${res.acceptRecommendation}, ` +
      `expected ${m.expectRule}${hit ? " found" : " missing"}`,
  );
}

const seconds = ((performance.now() - t0) / 1000).toFixed(1);
console.log(`validator: ${versions} | ${files.length + MUTATIONS.length} checks in ${seconds}s`);
process.exit(failures + mutationFailures === 0 ? 0 : 1);
