// UI-06: records real runs on synthetic corpus PDFs as replayable event streams.
// The gallery works without an API key or budget because it replays these recordings.
//   pnpm --filter @verdict/web gallery:build   (needs NEBIUS_API_KEY and a running verifier)
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createExplainer, tavilySearch, TokenFactoryClient, type UserInput } from "@verdict/core";
import { executeRun } from "../lib/run-core.ts";
import type { RunEvent, RunResultView } from "../lib/run-protocol.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const CORPUS = join(ROOT, "eval/corpus/generated");
const OUT = resolve(import.meta.dirname, "../public/gallery");

interface GalleryCase {
  readonly id: string;
  readonly corpus: string;
  readonly title: string;
  readonly story: string;
  /** A follow-up run that answers the questions of a NEEDS_INPUT run (synthetic values). */
  readonly answer?: readonly UserInput[];
}

const CASES: readonly GalleryCase[] = [
  { id: "clean", corpus: "clean/01.01a-classic", title: "A clean invoice", story: "Every field quoted from the page, totals computed, KoSIT accepts it." },
  { id: "seven-lines", corpus: "clean/01.06a-classic", title: "Seven line items", story: "Seven line items. Nemotron Ultra repairs three fields behind the patch guard; every amount is computed from the lines." },
  { id: "noisy-layout", corpus: "noisy/01.12a-noisy-a", title: "Unusual layout", story: "Plain number format, ISO dates and shuffled blocks still end in a valid e-invoice." },
  { id: "unit-word", corpus: "mutated/01.08a-unit-as-german-word", title: "Units printed as words", story: "\"Stück\" is not a unit code. KoSIT reports it as an error yet still accepts the invoice; Verdict normalizes it to H87." },
  { id: "total-off", corpus: "mutated/01.01a-grand-total-off", title: "Printed total is wrong", story: "The document adds up to 1.00 less than it claims. Verdict trusts the lines, computes the total and flags the difference." },
  {
    id: "missing-leitweg",
    corpus: "mutated/01.01a-missing-buyer-reference",
    title: "Leitweg-ID missing",
    story: "The buyer reference is not printed. Verdict asks for it instead of inventing one.",
    answer: [{ path: "buyerReference", value: "04011000-12345-03" }],
  },
  {
    id: "missing-iban",
    corpus: "mutated/01.08a-missing-iban",
    title: "Bank details missing",
    story: "Payment by transfer, but no IBAN on the page. Verdict stops and asks.",
    // Public test IBAN, not a real account.
    answer: [{ path: "payment.iban", value: "DE02 1203 0000 0000 2020 51" }],
  },
  {
    id: "borrowed-city",
    corpus: "mutated/01.08a-missing-seller-city",
    title: "Seller city missing",
    story: "Seller and buyer share a postcode, but only the buyer's city is printed. Verdict refuses to borrow it and asks.",
    answer: [{ path: "seller.address.city", value: "Musterstadt" }],
  },
  {
    id: "exempt-no-reason",
    corpus: "mutated/01.06a-exempt-without-reason",
    title: "VAT-exempt, no reason given",
    story: "No VAT charged and no word on why. Only the seller can state that, so the validator rejects it and Verdict does not make one up.",
  },
];

const validate = async (xml: string) => {
  const res = await fetch(`${process.env.VERIFIER_URL || "http://localhost:8081"}/v1/validate/xrechnung`, {
    method: "POST",
    headers: { "X-Verifier-Secret": process.env.VERIFIER_SECRET ?? "", "Content-Type": "application/xml" },
    body: xml,
  });
  if (!res.ok) throw new Error(`verifier ${res.status}`);
  return (await res.json()) as Awaited<ReturnType<Parameters<typeof executeRun>[0]["validate"]>>;
};

async function record(deps: Parameters<typeof executeRun>[0], pdf: Uint8Array, resume?: Parameters<typeof executeRun>[3]) {
  const events: { at: number; event: RunEvent }[] = [];
  const t0 = performance.now();
  await executeRun(deps, pdf, (event) => events.push({ at: Math.round(performance.now() - t0), event }), resume);
  const result = events.find((e) => e.event.type === "result")?.event as { result: RunResultView } | undefined;
  return { events, result: result?.result };
}

const galleryClient = TokenFactoryClient.fromEnv();
const deps = {
  client: galleryClient,
  models: {
    extract: process.env.MODEL_EXTRACT || "nvidia/nemotron-3-super-120b-a12b",
    repair: process.env.MODEL_REPAIR || "nvidia/Nemotron-3-Ultra-550b-a55b",
  },
  validate,
  explain: createExplainer({
    client: galleryClient,
    model: process.env.MODEL_EXPLAIN || "nvidia/nemotron-3-super-120b-a12b",
    search: process.env.TAVILY_API_KEY ? tavilySearch(process.env.TAVILY_API_KEY) : undefined,
  }),
};

// --only <id> re-records one case and keeps the others.
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : undefined;
mkdirSync(OUT, { recursive: true });
type IndexRow = { id: string; title: string; story: string; state: string; followUpState?: string };
const previous: IndexRow[] = only
  ? (JSON.parse(readFileSync(join(OUT, "index.json"), "utf8")) as { cases: IndexRow[] }).cases
  : [];
const index: IndexRow[] = [];
for (const c of CASES) {
  if (only && c.id !== only) {
    const kept = previous.find((p) => p.id === c.id);
    if (kept) index.push(kept);
    continue;
  }
  const pdf = readFileSync(join(CORPUS, `${c.corpus}.pdf`));
  copyFileSync(join(CORPUS, `${c.corpus}.pdf`), join(OUT, `${c.id}.pdf`));
  const first = await record(deps, pdf);
  let followUp: Awaited<ReturnType<typeof record>> | undefined;
  if (c.answer && first.result?.state === "NEEDS_INPUT") {
    followUp = await record(deps, pdf, { extraction: first.result.extraction, userInputs: c.answer });
  }
  writeFileSync(
    join(OUT, `${c.id}.json`),
    JSON.stringify({ id: c.id, title: c.title, story: c.story, pdf: `${c.id}.pdf`, synthetic: true, run: first.events, ...(followUp ? { answer: c.answer, followUp: followUp.events } : {}) }) + "\n",
  );
  index.push({
    id: c.id,
    title: c.title,
    story: c.story,
    state: first.result?.state ?? "ERROR",
    ...(followUp ? { followUpState: followUp.result?.state ?? "ERROR" } : {}),
  });
  console.log(`${c.id}: ${first.result?.state ?? "ERROR"}${followUp ? ` -> ${followUp.result?.state}` : ""} (${first.result?.costUsd ?? "?"} USD)`);
}
writeFileSync(join(OUT, "index.json"), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), cases: index }, null, 2) + "\n");
console.log(`spent: ${deps.client.ledger.spentToday().toFixed(4)} USD`);
