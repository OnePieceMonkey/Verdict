"use client";
import type { Provenance } from "@verdict/core";
import type { RunResultView } from "@/lib/run-protocol.ts";
import { FIELD_GROUPS, labelFor, valueAt } from "@/lib/field-groups.ts";
import { VoidMark } from "./verdict-stamp.tsx";

export interface FocusTarget {
  readonly path: string;
  readonly page: number;
  readonly quote: string;
}

export const euro = (v: string | undefined) => {
  if (v === undefined) return "–";
  const [int, frac = "00"] = v.split(".");
  const grouped = (int ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${grouped},${frac.padEnd(2, "0").slice(0, 2)} €`;
};

function ProvenanceChip({ p }: { p: Provenance | undefined }) {
  if (!p) return <span className="font-mono text-2xs text-ink-3">—</span>;
  if (p.kind === "evidence") return <span className="font-mono text-2xs text-ink-2">p.{p.page}</span>;
  if (p.kind === "user") return <span className="font-mono text-2xs text-tab-ink">you</span>;
  return <span className="font-mono text-2xs text-office" title={p.rule}>calc</span>;
}

export function FactsPanel({
  result,
  partial,
  provenance,
  onFocus,
}: {
  result: RunResultView;
  partial: unknown;
  provenance: ReadonlyMap<string, Provenance>;
  onFocus: (target: FocusTarget | null) => void;
}) {
  const lines = ((partial as { lines?: Record<string, string>[] })?.lines ?? []) as Record<string, string | undefined>[];
  const missing = new Set(result.missing.map((m) => m.path));
  const focus = (path: string) => {
    const p = provenance.get(path);
    onFocus(p?.kind === "evidence" ? { path, page: p.page, quote: p.quote } : null);
  };

  return (
    <div className="flex flex-col gap-8">
      {FIELD_GROUPS.map((g) => (
        <section key={g.title} aria-labelledby={`g-${g.title}`}>
          <h3 id={`g-${g.title}`} className="mb-1.5 font-stamp text-sm font-semibold tracking-[0.12em] text-ink-2 uppercase">
            {g.title}
          </h3>
          <dl className="border-t border-rule-strong">
            {g.fields.map((f) => {
              const value = valueAt(partial, f.path);
              const isMissing = missing.has(f.path) || (f.path.endsWith("electronicAddress.value") && missing.has(f.path.replace(/\.value$/, "")));
              if (value === undefined && !isMissing) return null;
              const p = provenance.get(f.path);
              return (
                <div
                  key={f.path}
                  tabIndex={p?.kind === "evidence" ? 0 : -1}
                  onMouseEnter={() => focus(f.path)}
                  onMouseLeave={() => onFocus(null)}
                  onFocus={() => focus(f.path)}
                  onBlur={() => onFocus(null)}
                  className={[
                    "group grid grid-cols-[3.5rem_1fr_2rem] items-baseline gap-x-3 border-b border-rule py-1.5 text-sm outline-none sm:grid-cols-[4.25rem_minmax(0,9rem)_1fr_2.25rem]",
                    p?.kind === "evidence" ? "cursor-default hover:bg-stamp-wash focus-visible:bg-stamp-wash" : "",
                    isMissing ? "bg-tab-wash" : "",
                  ].join(" ")}
                >
                  <dt className="contents">
                    <span className="font-mono text-2xs text-ink-3">{f.bt}</span>
                    <span className="text-ink-2 max-sm:col-start-2 max-sm:row-start-1 max-sm:text-2xs">{f.label}</span>
                  </dt>
                  <dd className={`min-w-0 break-words max-sm:col-start-2 ${isMissing ? "font-medium text-tab-ink" : "text-ink"}`}>
                    {isMissing ? "Not on the document" : <span className="whitespace-pre-line">{value}</span>}
                  </dd>
                  <dd className="text-right max-sm:col-start-3 max-sm:row-start-1">{isMissing ? null : <ProvenanceChip p={p} />}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}

      {lines.length > 0 && (
        <section aria-labelledby="g-lines">
          <h3 id="g-lines" className="mb-1.5 font-stamp text-sm font-semibold tracking-[0.12em] text-ink-2 uppercase">
            Lines
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-t border-rule-strong text-sm">
              <thead>
                <tr className="border-b border-rule text-left font-mono text-2xs text-ink-3">
                  <th className="py-1.5 pr-2 font-normal">BT-126</th>
                  <th className="py-1.5 pr-2 font-normal">BT-153 Item</th>
                  <th className="py-1.5 pr-2 text-right font-normal">BT-129</th>
                  <th className="py-1.5 pr-2 font-normal">BT-130</th>
                  <th className="py-1.5 pr-2 text-right font-normal">BT-146</th>
                  <th className="py-1.5 pr-2 font-normal">VAT</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const p = provenance.get(`lines.${i}.name`);
                  return (
                    <tr
                      key={i}
                      tabIndex={0}
                      onMouseEnter={() => focus(`lines.${i}.name`)}
                      onMouseLeave={() => onFocus(null)}
                      onFocus={() => focus(`lines.${i}.name`)}
                      onBlur={() => onFocus(null)}
                      className="border-b border-rule align-baseline outline-none hover:bg-stamp-wash focus-visible:bg-stamp-wash"
                      title={p?.kind === "evidence" ? `“${p.quote}”` : undefined}
                    >
                      <td className="py-1.5 pr-2 font-mono text-2xs text-ink-2">{l.id ?? "–"}</td>
                      <td className="py-1.5 pr-2">{l.name ?? <span className="text-tab-ink">missing</span>}</td>
                      <td className="py-1.5 pr-2 text-right">{l.quantity ?? "–"}</td>
                      <td className="py-1.5 pr-2 font-mono text-2xs">{l.unitCode ?? "–"}</td>
                      <td className="py-1.5 pr-2 text-right">{l.netPrice ? euro(l.netPrice) : "–"}</td>
                      <td className="py-1.5 pr-2 font-mono text-2xs">
                        {l.vatCategory ?? "–"}
                        {l.vatRate ? ` ${l.vatRate} %` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result.amounts && (
        <section aria-labelledby="g-totals" className="border-t-2 border-ink pt-3">
          <h3 id="g-totals" className="sr-only">
            Totals
          </h3>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="font-stamp text-sm font-semibold tracking-[0.12em] text-ink-2 uppercase">Totals</div>
            <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 font-mono text-sm text-ink-2">
              <dt>BT-106 net</dt>
              <dd className="text-right">{euro(result.amounts.lineTotal)}</dd>
              <dt>BT-110 VAT</dt>
              <dd className="text-right">{euro(result.amounts.taxTotal)}</dd>
              <dt>BT-112 total</dt>
              <dd className="text-right font-semibold text-ink">{euro(result.amounts.grandTotal)}</dd>
            </dl>
          </div>
        </section>
      )}

    </div>
  );
}

const canonWord = (w: string) => w.normalize("NFKC").toLowerCase().replace(/[.,;:()"„“]/g, "");

/** Plain-language reasons for the guards' machine codes. */
function reasonText(code: string): string {
  if (code === "quote-not-on-page") return "Its quote is not on the page word for word";
  if (code === "value-not-in-quote") return "The value is not inside its own quote";
  if (code === "page-out-of-range") return "Cites a page that does not exist";
  if (code === "empty-quote") return "No quote from the page";
  if (code.startsWith("same evidence already used for ")) return `Already used as ${code.slice("same evidence already used for ".length)}`;
  if (code.startsWith("evidence: ")) return reasonText(code.slice(10));
  if (code === "city without letters") return "A city needs letters; this looks like a postcode";
  return code.charAt(0).toUpperCase() + code.slice(1);
}

function fieldName(path: string): { label: string; bt: string } {
  const line = /^lines\.(\d+)\.(\w+)/.exec(path);
  if (line) return { label: `Line ${Number(line[1]) + 1}: ${line[2]}`, bt: "" };
  const known = labelFor(path);
  return known.bt ? known : { label: path, bt: "" };
}

/**
 * Refused facts and voided patches stay on record. Only the words that are not on the page are
 * struck and marked, so a one-word misreading does not look like a refused paragraph.
 */
/**
 * Word-by-word comparison with the page: finds where the value's word sequence best lines up
 * with the page and returns the first value word that differs, plus the page's word there.
 */
function divergence(words: readonly string[], pageWords: readonly string[]): { at: number; page?: string } | null {
  const v = words.map(canonWord);
  let best: { at: number; page?: string } | null = null;
  let bestLen = -1;
  pageWords.forEach((pw, k) => {
    if (pw !== v[0]) return;
    let n = 0;
    while (n < v.length && pageWords[k + n] === v[n]) n++;
    if (n > bestLen) {
      bestLen = n;
      const pageWord = pageWords[k + n];
      best = n >= v.length ? null : { at: n, ...(pageWord !== undefined ? { page: pageWord } : {}) };
    }
  });
  return bestLen < 0 ? { at: 0 } : best;
}

export function VoidedList({ result, pages }: { result: RunResultView; pages: readonly string[] }) {
  const pageWords = pages.join(" ").split(/\s+/).map(canonWord).filter(Boolean);
  const rows = [
    ...result.rejectedFacts.map((r) => ({ path: r.path, value: r.value, why: r.reason })),
    ...result.patchesRejected.map((r) => ({
      path: r.patch.path.replace(/^\//, "").replaceAll("/", "."),
      value: r.patch.value,
      why: r.reason,
    })),
  ];
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="g-void">
      <h3 id="g-void" className="mb-1.5 font-stamp text-sm font-semibold tracking-[0.12em] text-void uppercase">
        Refused, not hidden
      </h3>
      <ul className="border-t border-void/40">
        {rows.map((r, i) => {
          const { label, bt } = fieldName(r.path);
          const words = (r.value || "").split(/\s+/).filter(Boolean);
          const notOnPage = r.why === "quote-not-on-page" || r.why === "evidence: quote-not-on-page";
          const diff = notOnPage || r.why === "value-not-in-quote" ? divergence(words, pageWords) : null;
          const at = diff ? diff.at : -1;
          return (
            <li key={i} className="grid grid-cols-[1fr_auto] items-start gap-3 border-b border-void/20 py-2 text-sm">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-ink">{label}</span>
                  {bt && <span className="font-mono text-2xs text-ink-3">{bt}</span>}
                  <span className="text-ink-2">· {reasonText(r.why)}</span>
                </div>
                <p className="mt-0.5 text-ink-3">
                  {at >= 0 ? (
                    <>
                      {at > 4 && "… "}
                      {words.slice(Math.max(0, at - 4), at).join(" ")}{" "}
                      <mark className="bg-void-wash px-0.5 font-medium text-void line-through decoration-void decoration-[1.5px]">
                        {words[at]}
                      </mark>{" "}
                      {words.slice(at + 1, at + 4).join(" ")}
                      {at + 4 < words.length && " …"}
                      <span className="ml-2 text-2xs text-ink-3">
                        {diff?.page ? `the page prints “${diff.page}”` : "not on the page"}
                      </span>
                    </>
                  ) : (
                    <span className="line-clamp-2 line-through decoration-void decoration-[1.5px]">{r.value || "(empty)"}</span>
                  )}
                </p>
              </div>
              <VoidMark />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
