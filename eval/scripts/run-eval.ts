// EVAL-04: runs a pipeline over one corpus set and writes a JSON and a Markdown report.
//   pnpm eval --set clean|noisy|mutated [--pipeline ground-truth]
// The holdout split is refused unless EVAL_ALLOW_HOLDOUT=1 (phase 5 only, EVAL-05).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { Decimal } from "decimal.js";
import { deriveAmounts, InvoiceInput, normalizeCurrency } from "@verdict/core";
import { CORPUS_DIR, type CorpusSet, type Manifest, type ManifestEntry } from "../src/corpus/manifest.ts";
import { flattenFacts, termOf } from "../src/fields.ts";
import { agentPipeline, groundTruthPipeline, llmPipeline, loadGroundTruth, type Pipeline, type PipelineResult } from "../src/pipeline.ts";

const { values } = parseArgs({
  options: {
    set: { type: "string" },
    pipeline: { type: "string", default: "ground-truth" },
    limit: { type: "string" },
    holdout: { type: "boolean", default: false },
  },
});
const set = values.set as CorpusSet | undefined;
if (!set || !["clean", "noisy", "mutated"].includes(set)) throw new Error("--set clean|noisy|mutated required");
if (values.holdout && process.env.EVAL_ALLOW_HOLDOUT !== "1") {
  throw new Error("holdout is locked until phase 5 (set EVAL_ALLOW_HOLDOUT=1 deliberately)");
}

const PIPELINES: Record<string, () => Pipeline> = { "ground-truth": () => groundTruthPipeline, llm: () => llmPipeline(), agent: () => agentPipeline() };
const pipelineName = values.pipeline ?? "ground-truth";
const makePipeline = PIPELINES[pipelineName];
if (!makePipeline) throw new Error(`unknown pipeline ${pipelineName}`);
const pipeline = makePipeline();

const manifest = JSON.parse(readFileSync(join(CORPUS_DIR, "manifest.json"), "utf8")) as Manifest;
const entries = manifest.entries
  .filter((e) => e.set === set && e.holdout === values.holdout)
  .slice(0, values.limit ? Number(values.limit) : undefined);
if (entries.length === 0) throw new Error(`no entries for set ${set}; run pnpm corpus:build`);

interface Row {
  readonly id: string;
  readonly state: PipelineResult["state"];
  readonly expected: string;
  readonly asExpected: boolean;
  readonly valid: boolean;
  readonly iterations: number;
  readonly fieldsWithoutProvenance: number;
  readonly costUsd: string;
  readonly ms: number;
  readonly fieldsTotal: number;
  readonly fieldsCorrect: number;
  readonly fieldsInvented: number;
  /** BT-112 and BT-115 of the output equal those of the ground truth (kill-gate criterion). */
  readonly totalsCorrect: boolean;
  readonly missingFields: readonly string[];
  readonly inventedKeys: readonly string[];
  readonly wrongKeys: readonly string[];
  readonly openIssues: readonly string[];
  readonly error?: string;
}

const perTerm = new Map<string, { total: number; correct: number }>();
const rows: Row[] = [];

for (const entry of entries) {
  const pdf = readFileSync(join(CORPUS_DIR, entry.pdf));
  const t0 = performance.now();
  let res: PipelineResult;
  try {
    res = await pipeline(entry, pdf);
  } catch (e) {
    res = { state: "FAILED", missingFields: [], warnings: [], iterations: 0, fieldsWithoutProvenance: 0, costUsd: "0", error: String(e) };
  }
  const ms = Math.round(performance.now() - t0);

  const truth = flattenFacts(loadGroundTruth(entry).invoice);
  const got = res.invoice ? flattenFacts(res.invoice) : new Map<string, string>();
  let correct = 0;
  for (const [key, want] of truth) {
    const t = perTerm.get(termOf(key)) ?? { total: 0, correct: 0 };
    t.total++;
    if (got.get(key) === want) {
      t.correct++;
      correct++;
    }
    perTerm.set(termOf(key), t);
  }
  const inventedKeys = [...got.keys()].filter((k) => !truth.has(k));
  const invented = inventedKeys.length;
  const wrongKeys = [...truth.keys()].filter((k) => got.has(k) && got.get(k) !== truth.get(k));

  // The currency mutation prints "€" in the ground truth; its amounts are still EUR amounts.
  const gtInvoice = loadGroundTruth(entry).invoice as { currency?: string };
  const gtCurrency = gtInvoice.currency !== undefined ? normalizeCurrency(gtInvoice.currency) : undefined;
  // Mutations remove required facts from the ground truth (that is the point), so its amounts are
  // derived from its lines without requiring the whole model to be complete.
  const gtForAmounts = { ...gtInvoice, ...(gtCurrency?.ok ? { currency: gtCurrency.value } : {}) } as InvoiceInput;
  const outParsed = res.invoice ? InvoiceInput.safeParse(res.invoice) : undefined;
  let totalsCorrect = false;
  if (outParsed?.success && res.state === "OUTPUT") {
    const a = deriveAmounts(gtForAmounts);
    const b = deriveAmounts(outParsed.data);
    totalsCorrect = a.grandTotal === b.grandTotal && a.duePayable === b.duePayable;
  }

  const expected = expectedState(entry);
  rows.push({
    id: entry.id,
    state: res.state,
    expected,
    // A crash also reports FAILED; it must never count as an expected rejection.
    asExpected: res.state === expected && !res.error,
    valid: res.verifier?.valid ?? false,
    iterations: res.iterations,
    fieldsWithoutProvenance: res.fieldsWithoutProvenance,
    costUsd: res.costUsd,
    ms,
    fieldsTotal: truth.size,
    fieldsCorrect: correct,
    fieldsInvented: invented,
    totalsCorrect,
    missingFields: res.missingFields,
    inventedKeys: inventedKeys.map((k) => `${k}=${got.get(k)}`),
    wrongKeys: wrongKeys.map((k) => `${k}: ${got.get(k)} (truth ${truth.get(k)})`),
    openIssues: res.openIssues ?? [],
    ...(res.error ? { error: res.error } : {}),
  });
}

function expectedState(entry: ManifestEntry): PipelineResult["state"] {
  const kind = entry.mutation?.expect.kind;
  return kind === "needs-input" ? "NEEDS_INPUT" : kind === "rejected" ? "FAILED" : "OUTPUT";
}

const pct = (a: number, b: number) => (b === 0 ? "–" : `${((100 * a) / b).toFixed(1)} %`);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] ?? 0) : 0;
};
const summary = {
  set,
  pipeline: pipelineName,
  holdout: values.holdout,
  documents: rows.length,
  validOutputs: rows.filter((r) => r.state === "OUTPUT" && r.valid).length,
  /** Kill-gate count: valid, BT-112/BT-115 correct, no field without provenance. */
  killGatePass: rows.filter((r) => r.state === "OUTPUT" && r.valid && r.totalsCorrect && r.fieldsWithoutProvenance === 0).length,
  asExpected: rows.filter((r) => r.asExpected).length,
  fieldAccuracy: pct(rows.reduce((s, r) => s + r.fieldsCorrect, 0), rows.reduce((s, r) => s + r.fieldsTotal, 0)),
  fieldsInvented: rows.reduce((s, r) => s + r.fieldsInvented, 0),
  fieldsWithoutProvenance: rows.reduce((s, r) => s + r.fieldsWithoutProvenance, 0),
  meanIterations: (rows.reduce((s, r) => s + r.iterations, 0) / rows.length).toFixed(2),
  totalCostUsd: rows.reduce((s, r) => s.add(r.costUsd), new Decimal(0)).toFixed(4),
  medianMs: median(rows.map((r) => r.ms)),
};
const terms = [...perTerm.entries()]
  .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
  .map(([term, t]) => ({ term, ...t, accuracy: pct(t.correct, t.total) }));

const outDir = resolve(import.meta.dirname, "../results");
mkdirSync(outDir, { recursive: true });
const base = join(outDir, `${set}${values.holdout ? "-holdout" : ""}-${pipelineName}`);
writeFileSync(`${base}.json`, JSON.stringify({ summary, terms, rows }, null, 2) + "\n");

const md = [
  `# Eval: ${set}${values.holdout ? " (holdout)" : ""} · pipeline ${pipelineName}`,
  "",
  "| Metric | Value |",
  "|---|---|",
  `| Documents | ${summary.documents} |`,
  `| Valid XRechnung (verifier ACCEPTABLE) | ${summary.validOutputs} (${pct(summary.validOutputs, summary.documents)}) |`,
  `| Kill-gate pass (valid, BT-112/115 correct, full provenance) | ${summary.killGatePass} (${pct(summary.killGatePass, summary.documents)}) |`,
  `| Outcome as expected | ${summary.asExpected} (${pct(summary.asExpected, summary.documents)}) |`,
  `| Field accuracy | ${summary.fieldAccuracy} |`,
  `| Invented fields | ${summary.fieldsInvented} |`,
  `| Fields without provenance | ${summary.fieldsWithoutProvenance} |`,
  `| Mean repair iterations | ${summary.meanIterations} |`,
  `| Total cost | ${summary.totalCostUsd} USD |`,
  `| Median runtime | ${summary.medianMs} ms |`,
  "",
  "## Field accuracy per business term",
  "",
  "| BT | Correct | Total | Accuracy |",
  "|---|---|---|---|",
  ...terms.map((t) => `| ${t.term} | ${t.correct} | ${t.total} | ${t.accuracy} |`),
  "",
  "## Documents not as expected",
  "",
  ...(rows.some((r) => !r.asExpected)
    ? ["| Document | State | Expected |", "|---|---|---|", ...rows.filter((r) => !r.asExpected).map((r) => `| ${r.id} | ${r.state} | ${r.expected} |`)]
    : ["None."]),
  "",
].join("\n");
writeFileSync(`${base}.md`, md);

console.log(JSON.stringify(summary));
console.log(`report: ${base}.md`);
