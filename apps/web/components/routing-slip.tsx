"use client";
import type { AuditEvent } from "@verdict/core";
import { IDLE_ROUTE, STATIONS, stationNote } from "@/lib/stations.ts";

const fmtDuration = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`);
const clock = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour12: false });

type Tone = "stamp" | "void" | "tab" | "office" | "ink";

function toneOf(e: AuditEvent): Tone {
  const d = e.data as { valid?: boolean; lineMismatches?: number };
  if (e.type === "VALIDATE") return d.valid ? "stamp" : "void";
  if (e.type === "NEEDS_INPUT") return "tab";
  if (e.type === "REJECTED") return "void";
  if (e.type === "USER_INPUT") return "tab";
  if (e.type === "CONSISTENCY_CHECK" && Number(d.lineMismatches ?? 0) > 0) return "void";
  return STATIONS[e.type].actor === "model" ? "office" : "ink";
}

const SIGN: Record<Tone, string> = {
  stamp: "border-stamp text-stamp",
  void: "border-void text-void",
  tab: "border-tab-ink bg-tab text-tab-ink",
  office: "border-office text-office",
  ink: "border-ink-2 text-ink-2",
};
const BAR: Record<Tone, string> = {
  stamp: "bg-stamp",
  void: "bg-void",
  tab: "bg-tab",
  office: "bg-office",
  ink: "bg-ink-2",
};

/**
 * The run as a German routing slip (Laufzettel): a ruled form with one row per station, the
 * station's own sign-off initials, and how long it really took. A resumed run (after the user
 * answered a question) continues on the same slip below a divider; nothing is erased.
 */
export function RoutingSlip({
  events,
  running,
  fileRef,
}: {
  events: readonly AuditEvent[];
  running: boolean;
  /** Upload hash, shown as the file reference at the head of the slip. */
  fileRef?: string | undefined;
}) {
  // An audit event is written when its station finishes, so a station took from the previous
  // stamp to its own. A new pass (seq restarts at 0) starts its own clock.
  const durations = events.map((e, i) => {
    const prev = events[i - 1];
    return prev && e.seq > 0 ? new Date(e.ts).getTime() - new Date(prev.ts).getTime() : 0;
  });
  const longest = Math.max(1, ...durations);
  const total = durations.reduce((a, b) => a + b, 0);

  return (
    <section aria-label="Routing slip" className="flex h-full flex-col">
      <header className="border-b-2 border-ink pb-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-stamp text-base font-bold tracking-[0.12em] text-ink uppercase">Routing slip</h2>
          <span className="text-sm text-ink-2">
            {events.length ? `${events.length} stamps · ${fmtDuration(total)}` : "Awaiting an invoice"}
          </span>
        </div>
        {fileRef && (
          <div className="mt-1 flex items-baseline gap-2 text-2xs text-ink-3">
            <span>File ref.</span>
            <span className="font-mono text-ink-2">{fileRef.replace(/^sha256:/, "").slice(0, 16)}</span>
          </div>
        )}
      </header>

      <div className="grid grid-cols-[1fr_3.75rem_4.25rem] gap-x-3 border-b border-rule-strong py-1.5 font-stamp text-2xs font-semibold tracking-[0.1em] text-ink-3 uppercase">
        <span>Station</span>
        <span className="text-center">Signed</span>
        <span className="text-right">Took</span>
      </div>

      <ol>
        {events.length === 0
          ? IDLE_ROUTE.map((type) => (
              <li key={type} className="grid grid-cols-[1fr_3.75rem_4.25rem] items-center gap-x-3 border-b border-rule py-2.5 text-ink-3">
                <span className="text-sm">{STATIONS[type].label}</span>
                <span className="inline-flex h-6 items-center justify-center border border-dashed border-rule-strong font-stamp text-2xs tracking-wider">
                  {STATIONS[type].initials}
                </span>
                <span />
              </li>
            ))
          : events.map((e, i) => {
              const s = STATIONS[e.type];
              const tone = toneOf(e);
              const note = stationNote(e);
              return (
                <li key={`${i}-${e.seq}`} className="slip-in">
                  {e.seq === 0 && i > 0 && (
                    <div className="mt-3 border-t-2 border-dashed border-tab-ink/50 bg-tab-wash px-2 py-1 font-stamp text-2xs font-semibold tracking-[0.1em] text-tab-ink uppercase">
                      Returned · answered by you · second pass
                    </div>
                  )}
                  <div className="grid grid-cols-[1fr_3.75rem_4.25rem] items-start gap-x-3 border-b border-rule py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink" title={clock(e.ts)}>
                        {s.label}
                      </div>
                      {note && <p className="mt-0.5 text-2xs text-ink-2">{note}</p>}
                      {durations[i]! > 0 && (
                        <div
                          aria-hidden
                          className={`mt-1.5 h-1 ${BAR[tone]}`}
                          style={{ width: `${Math.max(1.5, (durations[i]! / longest) * 100)}%` }}
                        />
                      )}
                    </div>
                    <span
                      className={`mt-0.5 inline-flex h-6 -rotate-2 items-center justify-center border-[1.5px] font-stamp text-2xs font-bold tracking-wider ${SIGN[tone]}`}
                    >
                      {s.initials}
                    </span>
                    <span className="mt-0.5 text-right font-mono text-2xs text-ink-2">
                      {durations[i]! > 0 ? fmtDuration(durations[i]!) : "–"}
                    </span>
                  </div>
                </li>
              );
            })}
        {running && (
          <li className="grid grid-cols-[1fr_3.75rem_4.25rem] items-center gap-x-3 py-2.5 text-ink-3">
            <span className="text-sm">At the next desk</span>
            <span className="inline-flex h-6 animate-pulse items-center justify-center border border-dashed border-rule-strong" />
            <span />
          </li>
        )}
      </ol>
    </section>
  );
}
