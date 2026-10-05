import { describe, expect, it } from "vitest";
import { TokenFactoryClient } from "../llm/token-factory-client.ts";
import { createExplainer, type WebSearch } from "./explain-rule.ts";
import { RULE_EXPLANATIONS } from "./rule-explanations.ts";

const MODEL = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";

function client(content: string | (() => string), calls: { n: number }): TokenFactoryClient {
  return new TokenFactoryClient({
    apiKey: "test",
    baseUrl: "http://fake",
    dailyBudgetUsd: "2.00",
    fetchImpl: async () => {
      calls.n++;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: typeof content === "string" ? content : content() } }],
          usage: { prompt_tokens: 300, completion_tokens: 60 },
        }),
        { status: 200 },
      );
    },
  });
}

const ANSWER = JSON.stringify({ meaning: "The rule needs a payee name.", fix: "Print the payee name." });
const err = (ruleId: string, severity = "error") => ({ ruleId, severity, message: `[${ruleId}] something` });

describe("createExplainer", () => {
  it("leaves rules from the local table to the table and calls no model", async () => {
    const calls = { n: 0 };
    const explain = createExplainer({ client: client(ANSWER, calls), model: MODEL });
    expect(RULE_EXPLANATIONS["BR-DE-15"]).toBeDefined();
    expect(await explain([err("BR-DE-15")])).toEqual([]);
    expect(calls.n).toBe(0);
  });

  it("explains an unknown rule once, with the search results as sources, then serves it from cache", async () => {
    const calls = { n: 0 };
    const queries: string[] = [];
    const search: WebSearch = async (q) => {
      queries.push(q);
      return [{ title: "XRechnung spec", url: "https://example.org/spec", content: "BT-59 payee name" }];
    };
    const explain = createExplainer({ client: client(ANSWER, calls), model: MODEL, search });
    const [first] = await explain([err("BR-17"), err("BR-17")]);
    expect(first).toMatchObject({
      ruleId: "BR-17",
      text: "The rule needs a payee name.",
      fix: "Print the payee name.",
      model: MODEL,
      sources: [{ title: "XRechnung spec", url: "https://example.org/spec" }],
    });
    await explain([err("BR-17")]);
    expect(calls.n).toBe(1);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("BR-17");
  });

  it("ignores warnings and caps model calls per run", async () => {
    const calls = { n: 0 };
    const explain = createExplainer({ client: client(ANSWER, calls), model: MODEL, maxPerRun: 2 });
    const out = await explain([err("BR-90", "warning"), err("BR-91"), err("BR-92"), err("BR-93")]);
    expect(out.map((e) => e.ruleId)).toEqual(["BR-91", "BR-92"]);
    expect(calls.n).toBe(2);
  });

  it("does not cache a failure, so the next run tries again", async () => {
    const calls = { n: 0 };
    let reply = "not json";
    const explain = createExplainer({ client: client(() => reply, calls), model: MODEL });
    expect(await explain([err("BR-17")])).toEqual([]);
    await new Promise((r) => setTimeout(r, 0));
    reply = ANSWER;
    expect(await explain([err("BR-17")])).toHaveLength(1);
    expect(calls.n).toBe(2);
  });

  it("still explains when the search fails", async () => {
    const calls = { n: 0 };
    const search: WebSearch = async () => {
      throw new Error("offline");
    };
    const explain = createExplainer({ client: client(ANSWER, calls), model: MODEL, search });
    const [e] = await explain([err("BR-17")]);
    expect(e?.sources).toEqual([]);
  });
});
