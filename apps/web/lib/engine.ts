import "server-only";
import { createExplainer, tavilySearch, TokenFactoryClient, type Explainer } from "@verdict/core";

/** One client per server process, so the daily budget ledger is shared by all requests. */
let client: TokenFactoryClient | undefined;
export function engineClient(): TokenFactoryClient {
  client ??= TokenFactoryClient.fromEnv();
  return client;
}

export const MODELS = {
  extract: process.env.MODEL_EXTRACT || "nvidia/nemotron-3-super-120b-a12b",
  repair: process.env.MODEL_REPAIR || "nvidia/Nemotron-3-Ultra-550b-a55b",
};

export const DAILY_BUDGET_USD = process.env.DAILY_BUDGET_USD || "2.00";

/** EXP-02: one explainer per process, so its per-rule cache is shared by all requests. */
let explainer: Explainer | undefined;
export function engineExplainer(): Explainer {
  const tavilyKey = process.env.TAVILY_API_KEY;
  explainer ??= createExplainer({
    client: engineClient(),
    model: process.env.MODEL_EXPLAIN || "nvidia/nemotron-3-super-120b-a12b",
    search: tavilyKey ? tavilySearch(tavilyKey) : undefined,
  });
  return explainer;
}
