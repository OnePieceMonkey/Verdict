// OPS-03 smoke test: one extraction-style and one repair-style call through the central client.
// Synthetic input only. Prints usage and cost, never the API key.
import { TokenFactoryClient } from "../src/index.ts";

const client = TokenFactoryClient.fromEnv();
const extractModel = process.env.MODEL_EXTRACT || "nvidia/nemotron-3-super-120b-a12b";
const repairModel = process.env.MODEL_REPAIR || "nvidia/Nemotron-3-Ultra-550b-a55b";

const pageText = [
  "Muster Werkzeuge GmbH · Industriestr. 1 · 12345 Musterstadt",
  "Rechnung Nr. R-2026-0042 · Datum: 01.10.2026",
  "An: Beispiel AG, Hauptstr. 5, 10115 Berlin",
  "Gesamtbetrag brutto: 1.190,00 EUR",
].join("\n");

const extraction = await client.chat({
  model: extractModel,
  messages: [
    {
      role: "system",
      content:
        "Extract invoice fields. BT-1 invoice number, BT-2 issue date (YYYY-MM-DD), BT-27 seller name, " +
        "BT-44 buyer name, BT-112 total incl. VAT as decimal string. quote must be copied verbatim from the text.",
    },
    { role: "user", content: pageText },
  ],
  jsonSchema: {
    name: "extraction",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["fields"],
      properties: {
        fields: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["bt", "value", "quote"],
            properties: {
              bt: { type: "string", enum: ["BT-1", "BT-2", "BT-27", "BT-44", "BT-112"] },
              value: { type: "string" },
              quote: { type: "string" },
            },
          },
        },
      },
    },
  },
});

const fields = (JSON.parse(extraction.content) as { fields: { bt: string; value: string; quote: string }[] }).fields;
const unverifiable = fields.filter((f) => !pageText.includes(f.quote));

const repair = await client.chat({
  model: repairModel,
  messages: [
    {
      role: "system",
      content:
        'You fix e-invoice validation errors. Answer only with JSON {"patches":[{"op":"replace","path":string,"value":string,"quote":string}]}. ' +
        "Every value must be backed by a verbatim quote from the document text. If the document does not contain the fact, return an empty patches array.",
    },
    {
      role: "user",
      content: `Validator error: [BR-CL-04] Invoice currency code MUST be coded using ISO code list 4217 alpha-3. Current value at /currency: "EURO".\nDocument text:\n${pageText}`,
    },
  ],
});

const rows = [extraction, repair].map((r) => ({
  model: r.model,
  promptTokens: r.promptTokens,
  completionTokens: r.completionTokens,
  costUsd: r.costUsd,
  latencyMs: r.latencyMs,
}));
console.table(rows);
console.log("extracted fields:", fields.length, "| quotes not found verbatim:", unverifiable.length);
console.log("repair answer:", repair.content.trim());
console.log("spent today (this process):", client.ledger.spentToday().toFixed(6), "USD");
