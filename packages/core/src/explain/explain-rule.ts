import type { TokenFactoryClient } from "../llm/token-factory-client.ts";
import { RULE_EXPLANATIONS } from "./rule-explanations.ts";

export interface ExplanationSource {
  readonly title: string;
  readonly url: string;
}

/** EXP-02: an explanation for a rule the local table does not cover, generated at run time. */
export interface Explanation {
  readonly ruleId: string;
  readonly text: string;
  readonly fix: string;
  readonly model: string;
  readonly costUsd: string;
  /** Web pages the model was given; empty when the search found nothing or is not configured. */
  readonly sources: readonly ExplanationSource[];
}

export interface SearchResult extends ExplanationSource {
  readonly content: string;
}
export type WebSearch = (query: string) => Promise<readonly SearchResult[]>;

/** Tavily search, top three results. Any failure yields no sources rather than no explanation. */
export function tavilySearch(apiKey: string, fetchImpl: typeof fetch = fetch, timeoutMs = 8000): WebSearch {
  return async (query) => {
    const res = await fetchImpl("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, max_results: 3, search_depth: "basic" }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`Tavily ${res.status}`);
    const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    return (data.results ?? [])
      .filter((r) => typeof r.url === "string" && r.url.startsWith("https://"))
      .slice(0, 3)
      .map((r) => ({ title: (r.title ?? r.url!).slice(0, 160), url: r.url!, content: (r.content ?? "").slice(0, 700) }));
  };
}

export const EXPLAIN_SCHEMA = {
  type: "object",
  properties: {
    meaning: { type: "string", description: "What the rule demands, at most two short sentences." },
    fix: { type: "string", description: "What has to change on the invoice, one sentence." },
  },
  required: ["meaning", "fix"],
  additionalProperties: false,
} as const;

export const EXPLAIN_SYSTEM_PROMPT = `You explain e-invoice validation rules (EN 16931, German XRechnung) to the owner of a small business.
Use only the validator message and the numbered sources you are given. If the sources do not cover the rule, explain from the validator message alone.
Never invent business term numbers (BT-, BG-) that do not appear in the message or the sources.
Plain English, no jargon beyond the business term names. "meaning": at most two short sentences. "fix": one sentence.`;

export interface ExplainerOptions {
  readonly client: TokenFactoryClient;
  readonly model: string;
  readonly search?: WebSearch | undefined;
  /** Model calls per run at most; further unknown rules stay unexplained. */
  readonly maxPerRun?: number;
}

export type Explainer = (
  errors: readonly { readonly ruleId: string; readonly severity: string; readonly message: string }[],
) => Promise<Explanation[]>;

/**
 * Explains validator errors that the local table (EXP-01) does not cover. Results are cached per
 * rule ID for the life of the process, so each unknown rule costs one model call at most. Every
 * failure (budget, network, malformed output) leaves the rule unexplained; the run never fails
 * because of an explanation.
 */
export function createExplainer(opts: ExplainerOptions): Explainer {
  const cache = new Map<string, Promise<Explanation | null>>();
  const maxPerRun = opts.maxPerRun ?? 3;

  const explainOne = async (ruleId: string, message: string): Promise<Explanation | null> => {
    const results = opts.search
      ? await opts.search(`XRechnung EN 16931 rule ${ruleId} ${message.slice(0, 200)}`).catch(() => [])
      : [];
    const sourcesText = results.length
      ? results.map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.content}`).join("\n\n")
      : "(no sources found)";
    const res = await opts.client.chat({
      model: opts.model,
      messages: [
        { role: "system", content: EXPLAIN_SYSTEM_PROMPT },
        { role: "user", content: `Rule: ${ruleId}\nValidator message: ${message}\n\nSources:\n${sourcesText}` },
      ],
      jsonSchema: { name: "rule_explanation", schema: EXPLAIN_SCHEMA },
      maxTokens: 400,
    });
    const parsed = JSON.parse(res.content) as { meaning?: unknown; fix?: unknown };
    if (typeof parsed.meaning !== "string" || typeof parsed.fix !== "string" || !parsed.meaning.trim()) return null;
    return {
      ruleId,
      text: parsed.meaning.trim().slice(0, 400),
      fix: parsed.fix.trim().slice(0, 300),
      model: res.model,
      costUsd: res.costUsd,
      sources: results.map(({ title, url }) => ({ title, url })),
    };
  };

  return async (errors) => {
    const unknown = new Map<string, string>();
    for (const e of errors) {
      if (e.severity !== "error" || RULE_EXPLANATIONS[e.ruleId] || unknown.has(e.ruleId)) continue;
      unknown.set(e.ruleId, e.message);
    }
    const picked = [...unknown].slice(0, maxPerRun);
    const out = await Promise.all(
      picked.map(([ruleId, message]) => {
        let pending = cache.get(ruleId);
        if (!pending) {
          pending = explainOne(ruleId, message).catch(() => null);
          cache.set(ruleId, pending);
          // Only successes stay cached, so a budget or network failure is retried next time.
          void pending.then((r) => r ?? cache.delete(ruleId));
        }
        return pending;
      }),
    );
    return out.filter((e): e is Explanation => e !== null);
  };
}
