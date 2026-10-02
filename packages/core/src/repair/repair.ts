import type { ChatResult, TokenFactoryClient } from "../llm/token-factory-client.ts";
import { pagesToPrompt } from "../extract/extract.ts";
import type { ProposedPatch } from "./patch-guard.ts";

/** A problem the repair model is asked to fix: a validator finding or a missing fact. */
export interface RepairIssue {
  readonly id: string; // rule ID (e.g. "BR-DE-15") or "MISSING"
  readonly message: string;
  /** JSON pointer of the affected model field when known, else the validator XPath. */
  readonly location: string;
}

export interface RepairPlan {
  readonly patches: readonly ProposedPatch[];
  readonly unresolvable: readonly { readonly issue: string; readonly reason: string }[];
  readonly call: ChatResult;
}

const REPAIR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["patches", "unresolvable"],
  properties: {
    patches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["op", "path", "value", "quote", "page"],
        properties: {
          op: { type: "string", enum: ["add", "replace"] },
          path: { type: "string" },
          value: { type: "string" },
          quote: { type: "string" },
          page: { type: "integer" },
        },
      },
    },
    unresolvable: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["issue", "reason"],
        properties: { issue: { type: "string" }, reason: { type: "string" } },
      },
    },
  },
} as const;

export const REPAIR_SYSTEM_PROMPT = `You repair the semantic model of a German invoice so that it becomes a valid XRechnung.

You get: the issues (validator rule violations or missing facts), the current model as JSON, and the document text per page.

Rules:
- Fix an issue only with a fact that is printed on the document. Every patch needs a verbatim "quote" from the given page that contains the value.
- Use JSON pointers into the model, e.g. "/seller/contact/phone", "/buyerReference", "/lines/0/unitCode", "/payment/iban".
- "value" is the value as printed; it is normalized afterwards. Do not compute, convert or invent anything.
- Never patch computed amounts (line totals, VAT amounts, invoice totals); they are derived automatically.
- If the document does not contain the needed fact, do not patch: list the issue in "unresolvable" with a short reason (e.g. "Leitweg-ID not printed on the document").`;

/** REP-01: one repair round with the repair model (text layer only in this build). */
export async function planRepair(
  client: TokenFactoryClient,
  model: string,
  issues: readonly RepairIssue[],
  currentModel: unknown,
  pages: readonly string[],
): Promise<RepairPlan> {
  const user = [
    "Issues:",
    ...issues.map((i) => `- [${i.id}] ${i.message} (at ${i.location})`),
    "",
    "Current model:",
    JSON.stringify(currentModel, null, 1),
    "",
    "Document:",
    pagesToPrompt(pages),
  ].join("\n");
  const call = await client.chat({
    model,
    maxTokens: 3000,
    jsonSchema: { name: "repair_plan", schema: REPAIR_SCHEMA },
    messages: [
      { role: "system", content: REPAIR_SYSTEM_PROMPT },
      { role: "user", content: user },
    ],
  });
  let parsed: { patches: ProposedPatch[]; unresolvable: { issue: string; reason: string }[] };
  try {
    parsed = JSON.parse(call.content) as typeof parsed;
  } catch {
    // A broken plan repairs nothing; the loop then ends in NEEDS_INPUT.
    parsed = { patches: [], unresolvable: issues.map((i) => ({ issue: i.id, reason: "repair model returned invalid JSON" })) };
  }
  return { patches: parsed.patches ?? [], unresolvable: parsed.unresolvable ?? [], call };
}
