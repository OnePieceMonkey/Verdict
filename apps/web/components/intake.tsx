"use client";
import { useEffect, useRef, useState } from "react";
import { FileUp } from "lucide-react";

export interface GalleryCaseSummary {
  readonly id: string;
  readonly title: string;
  readonly story: string;
  readonly state: string;
  readonly followUpState?: string;
}

const MAX_MB = 5;

/** In-tray: drop a PDF, or take one of the recorded runs from the tray. */
export function Intake({
  onFile,
  onGallery,
  live,
}: {
  onFile: (file: File) => void;
  onGallery: (id: string) => void;
  live: boolean;
}) {
  const [cases, setCases] = useState<GalleryCaseSummary[]>([]);
  const [drag, setDrag] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/gallery/index.json")
      .then((r) => r.json())
      .then((d: { cases: GalleryCaseSummary[] }) => setCases(d.cases))
      .catch(() => setCases([]));
  }, []);

  const take = (file: File | undefined) => {
    if (!file) return;
    if (file.type && file.type !== "application/pdf") return setProblem("Only PDF files are supported.");
    if (file.size > MAX_MB * 1024 * 1024) return setProblem(`The file is larger than ${MAX_MB} MB.`);
    setProblem(null);
    onFile(file);
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          take(e.dataTransfer.files[0]);
        }}
        className={[
          "flex min-h-64 flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-10 text-center transition-colors",
          drag ? "border-stamp bg-stamp-wash" : "border-rule-strong bg-sheet",
          live ? "" : "opacity-60",
        ].join(" ")}
      >
        <FileUp aria-hidden className={drag ? "text-stamp" : "text-ink-3"} size={28} strokeWidth={1.5} />
        <p className="text-base font-medium text-ink">Drop a PDF invoice here</p>
        <p className="max-w-[26ch] text-sm text-ink-2">
          Text-based PDF, up to {MAX_MB} MB and 5 pages. The file is processed in memory and not stored.
        </p>
        <button
          type="button"
          disabled={!live}
          onClick={() => input.current?.click()}
          className="mt-1 h-10 bg-ink px-4 text-sm font-semibold text-sheet transition-colors hover:bg-stamp focus-visible:bg-stamp disabled:cursor-not-allowed disabled:bg-ink-3"
        >
          Choose a file
        </button>
        <input
          ref={input}
          type="file"
          accept="application/pdf"
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          onChange={(e) => take(e.target.files?.[0])}
        />
        {!live && <p className="text-sm text-void">Today’s demo budget is used up. The recorded runs below still work.</p>}
        {problem && (
          <p role="alert" className="text-sm text-void">
            {problem}
          </p>
        )}
      </div>

      <section aria-labelledby="tray">
        <h2 id="tray" className="mb-1.5 font-stamp text-sm font-semibold tracking-[0.12em] text-ink-2 uppercase">
          Recorded runs
        </h2>
        <p className="mb-2 text-sm text-ink-2">Real runs on synthetic invoices, replayed with their original timing.</p>
        <ul className="border-t border-rule-strong">
          {cases.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onGallery(c.id)}
                className="grid w-full grid-cols-[1fr_auto] items-baseline gap-3 border-b border-rule py-2.5 text-left transition-colors hover:bg-stamp-wash focus-visible:bg-stamp-wash"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{c.title}</span>
                  <span className="block text-2xs leading-snug text-ink-2">{c.story}</span>
                </span>
                <OutcomeTag state={c.followUpState ? `${c.state}→${c.followUpState}` : c.state} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function OutcomeTag({ state }: { state: string }) {
  const verified = state.endsWith("OUTPUT");
  const asks = state.startsWith("NEEDS_INPUT");
  return (
    <span
      className={[
        "shrink-0 border-[1.5px] px-1.5 font-stamp text-2xs leading-4 font-bold tracking-[0.12em] uppercase",
        asks ? "border-tab-ink bg-tab text-tab-ink" : verified ? "border-stamp text-stamp" : "border-void text-void",
      ].join(" ")}
    >
      {asks && verified ? "asks · verified" : asks ? "asks" : verified ? "verified" : "rejected"}
    </span>
  );
}
