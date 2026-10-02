import { Decimal } from "decimal.js";
import { DAILY_BUDGET_USD, engineClient } from "@/lib/engine.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** UI-07: today's spend against the daily budget of the public demo. */
export function GET(): Response {
  let spent = new Decimal(0);
  try {
    spent = engineClient().ledger.spentToday();
  } catch {
    // No API key configured: the live path is off, the gallery still works.
    return Response.json({ live: false, spentUsd: "0", budgetUsd: DAILY_BUDGET_USD, remainingUsd: "0" });
  }
  const budget = new Decimal(DAILY_BUDGET_USD);
  return Response.json({
    live: spent.lt(budget),
    spentUsd: spent.toFixed(4),
    budgetUsd: budget.toFixed(2),
    remainingUsd: Decimal.max(0, budget.minus(spent)).toFixed(4),
  });
}
