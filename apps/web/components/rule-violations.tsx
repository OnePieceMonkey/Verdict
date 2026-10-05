"use client";
import { RULE_EXPLANATIONS } from "@verdict/core/rule-explanations";
import { RULE_FIELDS } from "@verdict/core/rule-fields";
import { labelFor } from "@/lib/field-groups.ts";
import type { RunResultView } from "@/lib/run-protocol.ts";

const shortModel = (id: string) => id.split("/").pop()?.replace(/^NVIDIA-/, "") ?? id;

/**
 * The validator's rejections, each explained in plain English (EXP-01 table, or EXP-02 generated
 * by Nemotron with the web sources it was given). The validator's own wording stays underneath as
 * the evidence the explanation has to answer to.
 */
export function RuleViolations({ result }: { result: RunResultView }) {
  if (!result.verifier || result.verifier.valid) return null;
  const errors = result.verifier.errors.filter((e) => e.severity === "error");
  if (errors.length === 0) return null;

  return (
    <ul className="border-t border-void/40 text-sm">
      {errors.map((e) => {
        const field = RULE_FIELDS[e.ruleId];
        const table = RULE_EXPLANATIONS[e.ruleId];
        const generated = result.explanations?.find((x) => x.ruleId === e.ruleId);
        const text = field
          ? `${labelFor(field).label} is required but not on the document. Asked above.`
          : (table?.en ?? generated?.text ?? "Rule violation reported by the KoSIT validator.");
        // For a missing fact the headline says what is asked; the table then says why the rule exists.
        const fix = field ? table?.en : (table?.fix ?? generated?.fix);
        return (
          <li key={e.ruleId + e.location} className="border-b border-void/20 py-2">
            <div className="text-ink">
              <span className="mr-2 font-mono text-2xs text-void">{e.ruleId}</span>
              {text}
            </div>
            {fix && <p className="mt-0.5 text-ink-2">{fix}</p>}
            {!table && !field && generated && (
              <p className="mt-1 text-2xs text-ink-3">
                Explained by <span className="font-mono">{shortModel(generated.model)}</span>
                {generated.sources.length > 0 && (
                  <>
                    {" "}from{" "}
                    {generated.sources.map((s, i) => (
                      <span key={s.url}>
                        {i > 0 && ", "}
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-stamp underline">
                          {new URL(s.url).hostname.replace(/^www\./, "")}
                        </a>
                      </span>
                    ))}
                  </>
                )}
                . Check it against the validator's wording below.
              </p>
            )}
            {/* The validator's own wording stays as evidence, without its duplicated rule prefix. */}
            <p className="mt-0.5 text-2xs text-ink-3">{e.message.replace(/^\[[^\]]+\]\s*-?\s*/, "")}</p>
          </li>
        );
      })}
    </ul>
  );
}
