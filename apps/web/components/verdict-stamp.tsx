"use client";

export type StampKind = "verified" | "rejected" | "returned";

const STYLES: Record<StampKind, { color: string; title: string; rot: string }> = {
  verified: { color: "text-stamp border-stamp", title: "Verified", rot: "-4deg" },
  rejected: { color: "text-void border-void", title: "Rejected", rot: "3deg" },
  returned: { color: "text-tab-ink border-tab-ink", title: "Returned", rot: "-3deg" },
};

/**
 * The signature move: the verdict is pressed onto the sheet like an office inspection stamp,
 * double-ruled, condensed caps, with the validator version, date and report hash.
 */
export function VerdictStamp({
  kind,
  lines,
  hash,
}: {
  kind: StampKind;
  /** Small caps lines under the title, e.g. validator version and date. */
  lines: readonly string[];
  /** Report hash, set exactly as on the routing slip (lowercase mono). */
  hash?: string | undefined;
}) {
  const s = STYLES[kind];
  return (
    <div
      role="status"
      className={`stamp-press inline-block border-[3px] p-[3px] mix-blend-multiply ${s.color}`}
      style={{ ["--stamp-rot" as string]: s.rot, transform: `rotate(${s.rot})` }}
    >
      <div className={`border-[1.5px] px-5 py-2.5 text-center ${s.color}`}>
        <div className="font-stamp text-[2.25rem] leading-none font-bold tracking-[0.08em] uppercase sm:text-[2.75rem]">{s.title}</div>
        {lines.map((l) => (
          <div key={l} className="mt-1 font-stamp text-xs font-semibold tracking-[0.14em] uppercase">
            {l}
          </div>
        ))}
        {hash && <div className="mt-1 font-mono text-2xs tracking-normal">report {hash}</div>}
      </div>
    </div>
  );
}

/** A small VOID stamp for refused values and patches. Nothing disappears; it is cancelled. */
export function VoidMark({ label = "Void" }: { label?: string }) {
  return (
    <span className="inline-block -rotate-3 border-[1.5px] border-void px-1.5 font-stamp text-2xs leading-4 font-bold tracking-[0.12em] text-void uppercase">
      {label}
    </span>
  );
}
