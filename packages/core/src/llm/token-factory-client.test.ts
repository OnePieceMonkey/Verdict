import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { costUsd } from "./pricing.ts";
import { BudgetExceededError, CostLedger, TokenFactoryClient } from "./token-factory-client.ts";

const MODEL = "nvidia/nemotron-3-super-120b-a12b";

function fakeFetch(promptTokens: number, completionTokens: number): typeof fetch {
  return async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
      }),
      { status: 200 },
    );
}

describe("costUsd", () => {
  it("computes cost from pinned per-million prices without float drift", () => {
    // 1M in * 0.30 + 1M out * 0.90
    expect(costUsd(MODEL, 1_000_000, 1_000_000).toFixed(2)).toBe("1.20");
    expect(costUsd(MODEL, 63, 34).toFixed(8)).toBe("0.00004950");
  });

  it("refuses models without a pinned price", () => {
    expect(() => costUsd("vendor/unknown", 1, 1)).toThrow(/No pinned price/);
  });
});

describe("TokenFactoryClient", () => {
  it("records the cost of each call in the ledger", async () => {
    const client = new TokenFactoryClient({
      apiKey: "test",
      baseUrl: "http://fake",
      dailyBudgetUsd: "2.00",
      fetchImpl: fakeFetch(1000, 500),
    });
    const res = await client.chat({ model: MODEL, messages: [{ role: "user", content: "hi" }] });
    expect(res.content).toBe('{"ok":true}');
    expect(res.costUsd).toBe("0.00075000");
    expect(client.ledger.spentToday().toFixed(8)).toBe("0.00075000");
  });

  it("blocks calls once the daily budget is spent", async () => {
    const ledger = new CostLedger();
    ledger.add(new Decimal("2.00"));
    const client = new TokenFactoryClient({
      apiKey: "test",
      baseUrl: "http://fake",
      dailyBudgetUsd: "2.00",
      ledger,
      fetchImpl: fakeFetch(1, 1),
    });
    await expect(
      client.chat({ model: MODEL, messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toBeInstanceOf(BudgetExceededError);
  });

  it("starts a fresh budget on a new UTC day", () => {
    const ledger = new CostLedger();
    ledger.add(new Decimal("1.50"), new Date("2026-10-02T23:59:00Z"));
    expect(ledger.spentToday(new Date("2026-10-03T00:01:00Z")).toNumber()).toBe(0);
  });
});
