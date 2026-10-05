"use client";
import { useEffect, useMemo, useState } from "react";
import type { Provenance } from "@verdict/core";
import { ArrowLeft, Download } from "lucide-react";
import { useRun } from "@/lib/use-run.ts";
import { euro, FactsPanel, VoidedList, type FocusTarget } from "./facts-panel.tsx";
import { Intake } from "./intake.tsx";
import { NeedsInput } from "./needs-input.tsx";
import { PdfSheet, type QuoteMark } from "./pdf-sheet.tsx";
import { RoutingSlip } from "./routing-slip.tsx";
import { RuleViolations } from "./rule-violations.tsx";
import { VerdictStamp, VoidMark } from "./verdict-stamp.tsx";
import { ZugferdButton } from "./zugferd-button.tsx";

interface Budget {
  readonly live: boolean;
  readonly spentUsd: string;
  readonly budgetUsd: string;
}

const download = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export function VerdictApp() {
  const { state, runUpload, runGallery, answer, reset, galleryAnswer } = useRun();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [tab, setTab] = useState<"document" | "facts" | "slip">("facts");

  useEffect(() => {
    fetch("/api/budget")
      .then((r) => r.json())
      .then(setBudget)
      .catch(() => setBudget({ live: false, spentUsd: "0", budgetUsd: "0" }));
  }, [state.phase]);

  const result = state.result;
  const provenance = useMemo(() => new Map<string, Provenance>(result?.provenance ?? []), [result]);
  const marks = useMemo<QuoteMark[]>(() => {
    const out: QuoteMark[] = [];
    for (const [, p] of provenance) if (p.kind === "evidence") out.push({ page: p.page, quote: p.quote, kind: "evidence" });
    if (focus) out.push({ page: focus.page, quote: focus.quote, kind: "active" });
    return out;
  }, [provenance, focus]);

  const idle = state.phase === "idle";
  const verifier = result?.verifier;
  const stampKind = result ? (result.state === "OUTPUT" ? "verified" : result.state === "NEEDS_INPUT" ? "returned" : "rejected") : null;
  // The stamp carries the run's own facts: date of the VALIDATE stamp, pinned configuration.
  const validateEvent = [...state.events].reverse().find((e) => e.type === "VALIDATE");
  const stampDate = validateEvent?.ts.slice(0, 10) ?? "";
  const xrVersion = /xrechnung-(\d+\.\d+\.\d+)/i.exec(verifier?.versions.configuration ?? "")?.[1];
  const reportHash = verifier?.reportHash?.slice(0, 10);
  const rejectedRules = new Set(verifier?.errors.filter((e) => e.severity === "error").map((e) => e.ruleId)).size;
  const printedTotal = result?.documentTotals.grandTotal;
  const totalDiffers = Boolean(result?.amounts && printedTotal && printedTotal !== result.amounts.grandTotal);
  const runCost = state.priorCostUsd + Number(result?.costUsd ?? 0);
  const runIterations = state.priorIterations + (result?.iterations ?? 0);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-office text-office-ink">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 md:px-6">
          <button type="button" onClick={reset} className="flex items-baseline gap-2" aria-label="Verdict, start over">
            <span className="font-stamp text-2xl leading-none font-bold tracking-[0.06em] text-white uppercase">Verdict</span>
          </button>
          <span className="hidden text-sm text-office-ink/80 lg:inline">
            PDF invoice to XRechnung. Nemotron proposes, the official validator decides.
          </span>
          <div className="ml-auto flex items-center gap-4 text-2xs">
            <span className="hidden text-sm text-office-ink md:inline">
              NVIDIA Nemotron on Nebius Token Factory · KoSIT validator {verifier?.versions.validator ?? "1.6.3"}
            </span>
            {budget && (
              <span className="font-mono text-office-ink" title="Model spend of this public demo today">
                {budget.live ? `$${budget.spentUsd} / $${budget.budgetUsd} today` : "live runs paused"}
              </span>
            )}
          </div>
        </div>
      </header>
      <div className="border-b border-office-2 bg-office px-4 pb-2.5 text-sm text-office-ink md:hidden">
        NVIDIA Nemotron on Nebius Token Factory proposes. KoSIT decides.
      </div>

      {/* Mobile: one work area at a time. Desktop: all three side by side. */}
      {!idle && (
        <nav className="flex border-b border-rule bg-sheet lg:hidden" aria-label="Work areas" role="tablist">
          {(["document", "facts", "slip"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              role="tab"
              aria-selected={tab === t}
              className={`flex-1 py-2.5 text-sm font-medium ${tab === t ? "border-b-2 border-stamp text-ink" : "text-ink-2"}`}
            >
              {t === "document" ? "Document" : t === "facts" ? "Facts" : "Routing slip"}
            </button>
          ))}
        </nav>
      )}

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 gap-6 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(16rem,0.75fr)] lg:gap-8">
        <div className={`${!idle && tab !== "document" ? "hidden lg:block" : ""} min-w-0`}>
          {idle ? (
            <>
              <Intake onFile={runUpload} onGallery={(id) => void runGallery(id)} live={budget?.live ?? false} />
              <div className="mt-8 lg:hidden">
                <Principles />
              </div>
            </>
          ) : (
            <div className="lg:sticky lg:top-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
                >
                  <ArrowLeft size={14} strokeWidth={1.75} aria-hidden /> New invoice
                </button>
                <span className="truncate text-sm text-ink-3">
                  {state.source?.kind === "gallery" ? `recorded run · ${state.source.title}` : state.source?.name}
                </span>
              </div>
              {state.pdfUrl && <PdfSheet url={state.pdfUrl} marks={marks} {...(focus ? { focusPage: focus.page } : {})} />}
            </div>
          )}
        </div>

        <div className={`${!idle && tab !== "facts" ? "hidden lg:block" : ""} ${idle ? "max-lg:order-first" : ""} min-w-0`}>
          {idle ? (
            <Explainer />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex min-h-[9.5rem] flex-wrap items-center gap-x-8 gap-y-4 border-b border-rule-strong pb-5">
                {stampKind && result ? (
                  <VerdictStamp
                    kind={stampKind}
                    hash={stampKind === "verified" ? reportHash : undefined}
                    lines={
                      stampKind === "verified"
                        ? [`KoSIT ${verifier?.versions.validator}${xrVersion ? ` · XRechnung ${xrVersion}` : ""}`, stampDate]
                        : stampKind === "returned"
                          ? ["Input needed", `${result.missing.length || result.openIssues.length} open point${(result.missing.length || result.openIssues.length) === 1 ? "" : "s"}`]
                          : [
                              `KoSIT ${verifier?.versions.validator ?? ""}${xrVersion ? ` · XRechnung ${xrVersion}` : ""}`,
                              `${rejectedRules} rule${rejectedRules === 1 ? "" : "s"} not met`,
                            ]
                    }
                  />
                ) : state.phase === "error" ? (
                  <p role="alert" className="text-sm text-void">
                    {state.error}
                  </p>
                ) : (
                  <p className="font-stamp text-xl font-semibold tracking-[0.08em] text-ink-3 uppercase">On its way through the office…</p>
                )}
                {result?.amounts && result.state === "OUTPUT" && (
                  <div>
                    <div className="text-sm text-ink-3">
                      <span className="font-mono text-2xs">BT-112</span> Total, computed from the lines
                    </div>
                    <div className="text-[2.5rem] leading-tight font-semibold tracking-[-0.025em] text-ink">
                      {euro(result.amounts.grandTotal)}
                    </div>
                    {totalDiffers && (
                      <div className="mt-1 flex items-center gap-2 text-sm text-ink-2">
                        <span>Printed:</span>
                        <span className="text-ink-3 line-through decoration-void decoration-[1.5px]">{euro(printedTotal)}</span>
                        <VoidMark label="Not used" />
                      </div>
                    )}
                  </div>
                )}
                {result && (
                  <div className="flex basis-full flex-col gap-2 text-sm">
                    <p className="max-w-[44ch] text-ink-2">
                      {result.state === "OUTPUT"
                        ? "Every field is quoted from the page or computed. The official KoSIT validator accepted the XRechnung."
                        : result.state === "NEEDS_INPUT"
                          ? "Some required facts are not on the document. Verdict asks instead of inventing them."
                          : "The official validator rejected the result, and nothing on the page can fix it. Verdict will not make anything up."}
                    </p>
                    <p className="text-sm text-ink-3">
                      {runIterations} repair round{runIterations === 1 ? "" : "s"} · model cost{" "}
                      <span className="font-mono text-2xs">${runCost.toFixed(4)}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.xml && (
                        <button
                          type="button"
                          onClick={() => download("xrechnung.xml", result.xml!, "application/xml")}
                          className="inline-flex h-9 items-center gap-1.5 bg-stamp px-3 font-semibold text-white hover:bg-ink focus-visible:bg-ink"
                        >
                          <Download size={14} strokeWidth={2} aria-hidden /> XRechnung
                        </button>
                      )}
                      {result.xml && (
                        <ZugferdButton
                          xml={result.xml}
                          prebuiltUrl={state.source?.kind === "gallery" ? `/gallery/${state.source.id}.zugferd.pdf` : undefined}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => download("audit.jsonl", result.auditJsonl, "application/jsonl")}
                        className="inline-flex h-9 items-center gap-1.5 border border-ink px-3 font-semibold text-ink hover:bg-ink hover:text-sheet focus-visible:bg-ink focus-visible:text-sheet"
                      >
                        <Download size={14} strokeWidth={2} aria-hidden /> Audit log
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {result?.state === "NEEDS_INPUT" && (
                <NeedsInput result={result} prefill={galleryAnswer()} onSubmit={answer} />
              )}
              {result && <VoidedList result={result} pages={state.pages} />}
              {result && <RuleViolations result={result} />}
              {result ? (
                <FactsPanel result={result} partial={result.invoice} provenance={provenance} onFocus={setFocus} />
              ) : (
                <FactsSkeleton />
              )}
            </div>
          )}
        </div>

        <aside className={`${!idle && tab !== "slip" ? "hidden lg:block" : ""} min-w-0`}>
          <div className="lg:sticky lg:top-6">
            <RoutingSlip
              events={state.events}
              running={state.phase === "running"}
              fileRef={state.events.find((e) => e.type === "INGEST")?.inputHash}
            />
          </div>
        </aside>
      </main>
    </div>
  );
}

function Explainer() {
  return (
    <div className="flex flex-col gap-5 pt-1">
      <h1 className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.025em] text-ink sm:text-[2.5rem]">
        An e-invoice is only valid when the official validator says so.
      </h1>
      <p className="max-w-[58ch] text-base text-ink-2 sm:hidden">
        Drop a PDF: Nemotron quotes every field from the page, the KoSIT validator decides, and missing facts are asked for.
      </p>
      <p className="hidden max-w-[58ch] text-base text-ink-2 sm:block">
        Verdict turns a PDF invoice into an XRechnung. NVIDIA Nemotron reads the page and proposes every field with a
        verbatim quote. Amounts are computed, never written by the model. The KoSIT reference validator has the last word,
        and facts that are not on the document are asked for, never invented.
      </p>
      <div className="hidden lg:block">
        <Principles />
      </div>
    </div>
  );
}

function Principles() {
  return (
      <dl className="grid max-w-[58ch] grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-rule-strong pt-4 text-sm">
        <dt className="font-stamp text-sm font-semibold tracking-[0.08em] text-ink uppercase">Quoted</dt>
        <dd className="text-ink-2">Every value is pinned to its place on the page. Hover a fact to see it.</dd>
        <dt className="font-stamp text-sm font-semibold tracking-[0.08em] text-ink uppercase">Computed</dt>
        <dd className="text-ink-2">Totals and VAT come from the lines; a printed total that disagrees is flagged, not copied.</dd>
        <dt className="font-stamp text-sm font-semibold tracking-[0.08em] text-ink uppercase">Refused</dt>
        <dd className="text-ink-2">Values that fail a check stay on record, struck through, instead of quietly disappearing.</dd>
        <dt className="font-stamp text-sm font-semibold tracking-[0.08em] text-ink uppercase">Signed</dt>
        <dd className="text-ink-2">Every station signs the routing slip into a hash chain you can verify yourself.</dd>
      </dl>
  );
}

function FactsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {[6, 8, 4].map((n, g) => (
        <div key={g}>
          <div className="mb-2 h-3 w-24 animate-pulse bg-rule" />
          {Array.from({ length: n }).map((_, i) => (
            <div key={i} className="grid grid-cols-[4.25rem_9rem_1fr] gap-3 border-b border-rule py-2">
              <div className="h-3 w-10 animate-pulse bg-rule/70" />
              <div className="h-3 w-20 animate-pulse bg-rule/70" />
              <div className="h-3 animate-pulse bg-rule/50" style={{ width: `${40 + ((i * 37) % 50)}%` }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
