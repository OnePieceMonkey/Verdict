// EVAL-01: builds the corpus reproducibly from the pinned KoSIT test suite.
//   pnpm corpus:build            build + verify ground truth and mutations against the verifier
//   pnpm corpus:build --no-verify  skip verifier checks (no running verifier needed)
// Output goes to eval/corpus/generated (gitignored). If a manifest exists already, the new
// hashes are compared with it, which proves byte-identical rebuilds.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { Decimal } from "decimal.js";
import { buildCii, deriveAmounts, readCii, type InvoiceInput } from "@verdict/core";
import { dressInvoice } from "../src/corpus/dress.ts";
import { CORPUS_DIR, holdoutIds, type CorpusSet, type Manifest, type ManifestEntry } from "../src/corpus/manifest.ts";
import { MUTATIONS, type Mutation } from "../src/corpus/mutations.ts";
import { printedFromDerived, renderInvoicePdf, type LayoutId, type NoiseOptions, type PrintedAmounts } from "../src/render/render-invoice.ts";
import { inScopeInstances } from "../src/scope.ts";
import { TESTSUITE } from "../src/testsuite.ts";
import { validateXRechnung } from "../src/verifier-client.ts";

const verify = !process.argv.includes("--no-verify");
const LAYOUTS: readonly LayoutId[] = ["classic", "modern", "compact"];
const NOISY: readonly { name: string; layout: LayoutId; noise: NoiseOptions }[] = [
  { name: "noisy-a", layout: "modern", noise: { numberFormat: "plain", dateFormat: "iso", labelVariant: 1, shuffleBlocks: true } },
  { name: "noisy-b", layout: "classic", noise: { dateFormat: "long", smallFont: true, splitPages: true } },
];
const MUTATION_BASES_PER_TYPE = 2;

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const invoiceIdOf = (file: string) => basename(file).replace(/(-INVOICE)?_uncefact\.xml$/, "").replace(/_test$/, "");

const previous: Manifest | undefined = existsSync(join(CORPUS_DIR, "manifest.json"))
  ? (JSON.parse(readFileSync(join(CORPUS_DIR, "manifest.json"), "utf8")) as Manifest)
  : undefined;
rmSync(CORPUS_DIR, { recursive: true, force: true });

const files = inScopeInstances();
const invoices = files.map((file, idx) => ({
  file,
  id: invoiceIdOf(file),
  invoice: dressInvoice(readCii(readFileSync(file, "utf8")).invoice, idx),
}));
const holdout = holdoutIds(invoices.map((i) => i.id));
const entries: ManifestEntry[] = [];
let verifyFailures = 0;

async function emit(args: {
  set: CorpusSet;
  name: string;
  src: (typeof invoices)[number];
  invoice: InvoiceInput;
  layout: LayoutId;
  noise: NoiseOptions;
  printed: PrintedAmounts;
  mutation?: Mutation;
}): Promise<void> {
  const isHoldout = holdout.has(args.src.id);
  const rel = join(isHoldout ? "holdout" : "", args.set, `${args.src.id}-${args.name}`);
  const pdf = await renderInvoicePdf(args.invoice, deriveAmounts(args.invoice), {
    layout: args.layout,
    noise: args.noise,
    printed: args.printed,
  });
  mkdirSync(dirname(join(CORPUS_DIR, rel)), { recursive: true });
  writeFileSync(join(CORPUS_DIR, `${rel}.pdf`), pdf);
  writeFileSync(join(CORPUS_DIR, `${rel}.json`), JSON.stringify({ invoice: args.invoice, printed: args.printed }, null, 2) + "\n");
  entries.push({
    id: `${args.set}/${args.src.id}-${args.name}`,
    set: args.set,
    holdout: isHoldout,
    source: basename(args.src.file),
    invoiceId: args.src.id,
    layout: args.layout,
    noise: { ...args.noise },
    ...(args.mutation
      ? {
          mutation: {
            id: args.mutation.id,
            expect: args.mutation.expect,
            detectedBy: args.mutation.detectedBy,
            acceptedAnyway: args.mutation.acceptedAnyway ?? false,
          },
        }
      : {}),
    pdf: `${rel}.pdf`,
    groundTruth: `${rel}.json`,
    sha256: sha256(pdf),
  });
}

// clean + noisy: every in-scope invoice; ground truth must be valid before any PDF exists.
for (const src of invoices) {
  if (verify) {
    const res = await validateXRechnung(buildCii(src.invoice));
    if (!res.valid) {
      verifyFailures++;
      console.log(`FAIL ground truth ${src.id} is not valid: ${res.errors.map((e) => e.ruleId).join(", ")}`);
    }
  }
  const printed = printedFromDerived(deriveAmounts(src.invoice));
  for (const layout of LAYOUTS) {
    await emit({ set: "clean", name: layout, src, invoice: src.invoice, layout, noise: {}, printed });
  }
  for (const n of NOISY) {
    await emit({ set: "noisy", name: n.name, src, invoice: src.invoice, layout: n.layout, noise: n.noise, printed });
  }
}

// mutated: each mutation on MUTATION_BASES_PER_TYPE non-holdout invoices (rotating bases).
const bases = invoices.filter((i) => !holdout.has(i.id));
for (const [k, m] of MUTATIONS.entries()) {
  const candidates = bases.filter((b) => !m.applicable || m.applicable(b.invoice));
  for (let j = 0; j < MUTATION_BASES_PER_TYPE; j++) {
    const src = candidates[(k * 3 + j) % candidates.length];
    if (!src) throw new Error(`no base invoice for mutation ${m.id}`);
    const mutated = m.apply(src.invoice);
    const printed = printedFor(m, deriveAmounts(src.invoice));
    if (verify) {
      const res = await validateXRechnung(buildCii(mutated));
      const hit = res.errors.some((e) => e.ruleId === m.detectedBy);
      const ok =
        m.detectedBy === "none"
          ? res.valid
          : hit && res.valid === (m.acceptedAnyway ?? false);
      if (!ok) {
        verifyFailures++;
        console.log(`FAIL mutation ${m.id} on ${src.id}: valid=${res.valid}, expected ${m.detectedBy}`);
      }
    }
    await emit({ set: "mutated", name: m.id, src, invoice: mutated, layout: "classic", noise: {}, printed, mutation: m });
  }
}

function printedFor(m: Mutation, derived: ReturnType<typeof deriveAmounts>): PrintedAmounts {
  const p = printedFromDerived(derived);
  if (m.printed === "grand-total-off") {
    return { ...p, grandTotal: new Decimal(p.grandTotal).add(1).toFixed(2) };
  }
  if (m.printed === "vat-amount-off") {
    return { ...p, taxTotal: new Decimal(p.taxTotal).add("0.10").toFixed(2) };
  }
  return p;
}

const manifest: Manifest = {
  testsuite: TESTSUITE.version,
  generator: "eval/scripts/corpus-build.ts",
  entries: entries.sort((a, b) => a.id.localeCompare(b.id)),
};
writeFileSync(join(CORPUS_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const count = (pred: (e: ManifestEntry) => boolean) => entries.filter(pred).length;
console.log(
  `corpus: clean ${count((e) => e.set === "clean" && !e.holdout)}, noisy ${count((e) => e.set === "noisy" && !e.holdout)}, ` +
    `mutated ${count((e) => e.set === "mutated")} (${MUTATIONS.length} types), holdout ${count((e) => e.holdout)} ` +
    `[holdout invoices: ${[...holdout].sort().join(", ")}]`,
);

if (previous) {
  const before = new Map(previous.entries.map((e) => [e.id, e.sha256]));
  const changed = entries.filter((e) => before.get(e.id) !== e.sha256).map((e) => e.id);
  console.log(changed.length === 0 ? "reproducible: all hashes identical to previous build" : `changed vs previous build: ${changed.length} (${changed.slice(0, 5).join(", ")})`);
}
if (verify) console.log(verifyFailures === 0 ? "verifier checks: all ok" : `verifier checks: ${verifyFailures} failed`);
process.exit(verifyFailures === 0 ? 0 : 1);
