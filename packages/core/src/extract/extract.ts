import type { TokenFactoryClient, ChatResult } from "../llm/token-factory-client.ts";
import { EXTRACTION_SCHEMA, EXTRACTION_SYSTEM_PROMPT, type RawExtraction } from "./schema.ts";

export interface ExtractionCall {
  readonly raw: RawExtraction;
  /** One entry per model call (at most two: first try and one retry, EXT-02). */
  readonly calls: readonly ChatResult[];
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly calls: readonly ChatResult[],
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

export function pagesToPrompt(pages: readonly string[]): string {
  return pages.map((p, i) => `--- page ${i + 1} ---\n${p}`).join("\n\n");
}

/**
 * Calls the extraction model with constrained decoding. Invalid JSON gets exactly one
 * retry; a second failure is an error state, never a partially guessed result.
 */
export async function extractRaw(
  client: TokenFactoryClient,
  model: string,
  pages: readonly string[],
): Promise<ExtractionCall> {
  const calls: ChatResult[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.chat({
      model,
      maxTokens: 6000,
      jsonSchema: { name: "invoice_extraction", schema: EXTRACTION_SCHEMA },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: pagesToPrompt(pages) },
      ],
    });
    calls.push(res);
    const parsed = tryParse(res.content);
    if (parsed) return { raw: parsed, calls };
  }
  throw new ExtractionError("extraction returned invalid JSON twice", calls);
}

function tryParse(content: string): RawExtraction | undefined {
  try {
    const v = JSON.parse(content) as RawExtraction;
    return v && typeof v === "object" && "header" in v && Array.isArray(v.lines) ? v : undefined;
  } catch {
    return undefined;
  }
}
