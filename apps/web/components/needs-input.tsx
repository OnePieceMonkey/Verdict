"use client";
import { useState } from "react";
import type { UserInput } from "@verdict/core";
import type { RunResultView } from "@/lib/run-protocol.ts";
import { labelFor } from "@/lib/field-groups.ts";

/** UI-04: ask only for the facts that are really missing, then re-validate with provenance "user". */
export function NeedsInput({
  result,
  prefill,
  onSubmit,
}: {
  result: RunResultView;
  prefill: readonly UserInput[] | null;
  onSubmit: (inputs: UserInput[]) => void;
}) {
  const asks = result.missing.map((m) => ({
    path: m.path.endsWith("electronicAddress") ? `${m.path}.value` : m.path,
    reason: m.reason,
  }));
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(asks.map((a) => [a.path, prefill?.find((p) => p.path === a.path)?.value ?? ""])),
  );

  if (asks.length === 0) {
    return (
      <div className="bg-tab-wash p-4 text-sm text-tab-ink">
        <p className="font-medium">The document contradicts itself here, so Verdict stopped instead of guessing.</p>
        <ul className="mt-2 list-disc pl-5">
          {result.openIssues.map((i) => (
            <li key={i.id + i.location}>{i.message}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form
      className="bg-tab-wash p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(asks.map((a) => ({ path: a.path, value: (values[a.path] ?? "").trim() })));
      }}
    >
      <p className="text-sm text-tab-ink">
        {asks.length === 1 ? "One fact is" : `${asks.length} facts are`} required for an XRechnung but not printed on the document.
        Verdict will not invent {asks.length === 1 ? "it" : "them"}.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {asks.map((a) => {
          const { label, bt } = labelFor(a.path);
          return (
            <label key={a.path} className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink">
                {label} <span className="font-mono text-2xs text-ink-3">{bt}</span>
              </span>
              <input
                required
                value={values[a.path] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [a.path]: e.target.value }))}
                className="h-10 border border-tab-ink/40 bg-sheet px-3 font-mono text-sm text-ink outline-none focus:border-stamp focus:ring-2 focus:ring-stamp/25"
                placeholder={a.path === "buyerReference" ? "e.g. 04011000-12345-03" : ""}
              />
            </label>
          );
        })}
      </div>
      <button
        type="submit"
        className="mt-4 h-10 bg-ink px-4 text-sm font-semibold text-sheet transition-colors hover:bg-stamp focus-visible:bg-stamp disabled:opacity-50"
      >
        Validate again
      </button>
    </form>
  );
}
