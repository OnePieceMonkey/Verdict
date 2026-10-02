import { Decimal } from "decimal.js";

export interface ModelPrice {
  /** USD per 1M input tokens */
  readonly inputPerMTok: string;
  /** USD per 1M output tokens */
  readonly outputPerMTok: string;
}

/**
 * Token Factory list prices, pinned from GET /v1/models on 2026-10-02.
 * Pinned instead of fetched so cost numbers in eval reports stay reproducible.
 */
export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B": { inputPerMTok: "0.06", outputPerMTok: "0.24" },
  "nvidia/Nemotron-3_5-Lightning": { inputPerMTok: "0.06", outputPerMTok: "0.24" },
  "nvidia/nemotron-3-super-120b-a12b": { inputPerMTok: "0.30", outputPerMTok: "0.90" },
  "nvidia/Nemotron-3-Ultra-550b-a55b": { inputPerMTok: "1.00", outputPerMTok: "3.00" },
};

export function costUsd(model: string, promptTokens: number, completionTokens: number): Decimal {
  const price = MODEL_PRICES[model];
  // Unknown price means the budget guard cannot work, so refuse instead of guessing.
  if (!price) throw new Error(`No pinned price for model "${model}"`);
  const perToken = (perM: string) => new Decimal(perM).div(1_000_000);
  return perToken(price.inputPerMTok)
    .mul(promptTokens)
    .add(perToken(price.outputPerMTok).mul(completionTokens));
}
