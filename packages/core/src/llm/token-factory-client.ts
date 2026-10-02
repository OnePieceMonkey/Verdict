import { Decimal } from "decimal.js";
import { costUsd } from "./pricing.ts";

export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface ChatRequest {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  /** JSON Schema for constrained decoding. The model then can only return matching JSON. */
  readonly jsonSchema?: { readonly name: string; readonly schema: object };
  readonly maxTokens?: number;
  /** Nemotron reasoning traces cost tokens and latency; off unless a step needs them. */
  readonly thinking?: boolean;
}

export interface ChatResult {
  readonly model: string;
  readonly content: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly costUsd: string;
  readonly latencyMs: number;
}

export class BudgetExceededError extends Error {
  constructor(spent: Decimal, budget: Decimal) {
    super(`Daily model budget exhausted: spent ${spent.toFixed(4)} USD of ${budget.toFixed(2)} USD`);
    this.name = "BudgetExceededError";
  }
}

/** Running spend per UTC day. In-memory on purpose: the app has no database. */
export class CostLedger {
  #day = "";
  #spent = new Decimal(0);

  spentToday(now = new Date()): Decimal {
    this.#roll(now);
    return this.#spent;
  }

  add(amount: Decimal, now = new Date()): void {
    this.#roll(now);
    this.#spent = this.#spent.add(amount);
  }

  #roll(now: Date): void {
    const day = now.toISOString().slice(0, 10);
    if (day !== this.#day) {
      this.#day = day;
      this.#spent = new Decimal(0);
    }
  }
}

export interface TokenFactoryClientOptions {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly dailyBudgetUsd: string;
  readonly ledger?: CostLedger;
  readonly fetchImpl?: typeof fetch;
}

/** The single entry point for every model call (rule 8: cost guard). */
export class TokenFactoryClient {
  readonly #opts: TokenFactoryClientOptions;
  readonly #budget: Decimal;
  readonly ledger: CostLedger;

  constructor(opts: TokenFactoryClientOptions) {
    if (!opts.apiKey) throw new Error("NEBIUS_API_KEY is missing");
    this.#opts = opts;
    this.#budget = new Decimal(opts.dailyBudgetUsd);
    this.ledger = opts.ledger ?? new CostLedger();
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): TokenFactoryClient {
    return new TokenFactoryClient({
      apiKey: env.NEBIUS_API_KEY ?? "",
      baseUrl: env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1",
      dailyBudgetUsd: env.DAILY_BUDGET_USD || "2.00",
    });
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const spent = this.ledger.spentToday();
    if (spent.gte(this.#budget)) throw new BudgetExceededError(spent, this.#budget);

    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      max_tokens: req.maxTokens ?? 2000,
      chat_template_kwargs: { enable_thinking: req.thinking ?? false },
    };
    if (req.jsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: { name: req.jsonSchema.name, strict: true, schema: req.jsonSchema.schema },
      };
    }

    const doFetch = this.#opts.fetchImpl ?? fetch;
    const t0 = performance.now();
    const res = await doFetch(`${this.#opts.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.#opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const latencyMs = Math.round(performance.now() - t0);
    if (!res.ok) {
      // Never echo request headers here; they carry the API key.
      throw new Error(`Token Factory ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      choices: { message: { content: string | null } }[];
      usage: { prompt_tokens: number; completion_tokens: number };
    };
    const { prompt_tokens: promptTokens, completion_tokens: completionTokens } = data.usage;
    const cost = costUsd(req.model, promptTokens, completionTokens);
    this.ledger.add(cost);

    return {
      model: req.model,
      content: data.choices[0]?.message.content ?? "",
      promptTokens,
      completionTokens,
      costUsd: cost.toFixed(8),
      latencyMs,
    };
  }
}
