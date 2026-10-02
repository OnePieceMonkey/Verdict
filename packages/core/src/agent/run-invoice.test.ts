import { describe, expect, it } from "vitest";
import { verifyAuditLog } from "../audit/audit-log.ts";
import { TokenFactoryClient } from "../llm/token-factory-client.ts";
import { runInvoice, type VerifierVerdict } from "./run-invoice.ts";

const PAGE = [
  "Muster Werkzeuge GmbH · Industriestr. 1 · 12345 Musterstadt · DE",
  "Stadtverwaltung Birkenfeld",
  "Am Markt 3",
  "54321 Birkenfeld",
  "DE",
  "Elektronische Adresse: rechnung@birkenfeld.example (Schema: EM)",
  "Rechnungsnummer R-2026-0042",
  "Rechnungsdatum 01.10.2026",
  "Pos. Bezeichnung Menge Einheit Einzelpreis USt Betrag",
  "1 Prüfgerät 2 Stk. (H87) 100,00 € 19 % (S) 200,00 €",
  "Rechnungsbetrag 238,00 €",
  "Ansprechpartner: Jana Wiesner",
  "Telefon: +49 30 4411-0",
  "E-Mail: jana@muster.example",
  "Elektronische Adresse: rechnung@muster.example (Schema: EM)",
  "IBAN: DE79000000001234567890",
  "USt-IdNr.: DE123456789",
].join("\n");

const ev = (value: string, quote: string) => ({ value, quote, page: 1 });
const RAW = {
  header: {
    invoiceNumber: ev("R-2026-0042", "Rechnungsnummer R-2026-0042"),
    issueDate: ev("01.10.2026", "Rechnungsdatum 01.10.2026"),
    dueDate: null,
    buyerReference: null, // not printed: must end in NEEDS_INPUT, never be invented
    orderReference: null,
    currency: null,
    paymentTerms: null,
  },
  seller: {
    name: ev("Muster Werkzeuge GmbH", "Muster Werkzeuge GmbH · Industriestr. 1"),
    street: ev("Industriestr. 1", "Muster Werkzeuge GmbH · Industriestr. 1 · 12345 Musterstadt"),
    addressLine2: null,
    city: ev("Musterstadt", "12345 Musterstadt"),
    postcode: ev("12345", "12345 Musterstadt"),
    country: ev("DE", "12345 Musterstadt · DE"),
    electronicAddress: ev("rechnung@muster.example", "Elektronische Adresse: rechnung@muster.example"),
    sellerId: null,
    legalRegistrationId: null,
    vatId: ev("DE123456789", "USt-IdNr.: DE123456789"),
    taxNumber: null,
    contactName: ev("Jana Wiesner", "Ansprechpartner: Jana Wiesner"),
    contactPhone: ev("+49 30 4411-0", "Telefon: +49 30 4411-0"),
    contactEmail: ev("jana@muster.example", "E-Mail: jana@muster.example"),
  },
  buyer: {
    name: ev("Stadtverwaltung Birkenfeld", "Stadtverwaltung Birkenfeld"),
    street: ev("Am Markt 3", "Am Markt 3"),
    addressLine2: null,
    city: ev("Birkenfeld", "54321 Birkenfeld"),
    postcode: ev("54321", "54321 Birkenfeld"),
    country: ev("DE", "54321 Birkenfeld\nDE"),
    electronicAddress: ev("rechnung@birkenfeld.example", "Elektronische Adresse: rechnung@birkenfeld.example"),
  },
  payment: { iban: ev("DE79000000001234567890", "IBAN: DE79000000001234567890"), accountName: null },
  vatExemptions: [],
  lines: [
    {
      rowQuote: "1 Prüfgerät 2 Stk. (H87) 100,00 € 19 % (S) 200,00 €",
      page: 1,
      lineId: "1",
      name: "Prüfgerät",
      quantity: "2",
      unit: "Stk. (H87)",
      netPrice: "100,00 €",
      priceBaseQuantity: null,
      vatCategory: "(S)",
      vatRate: "19 %",
      lineAmount: "200,00 €",
    },
  ],
  documentTotals: { lineTotal: null, taxTotal: null, grandTotal: ev("238,00 €", "Rechnungsbetrag 238,00 €") },
};

/** Fake Token Factory: extraction returns RAW, repair finds nothing on the document. */
function fakeClient(): TokenFactoryClient {
  return new TokenFactoryClient({
    apiKey: "test",
    baseUrl: "http://fake",
    dailyBudgetUsd: "1.00",
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { response_format?: { json_schema?: { name: string } } };
      const isRepair = body.response_format?.json_schema?.name === "repair_plan";
      const content = isRepair
        ? JSON.stringify({ patches: [], unresolvable: [{ issue: "MISSING", reason: "Leitweg-ID not printed" }] })
        : JSON.stringify(RAW);
      return new Response(
        JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1000, completion_tokens: 200 } }),
      );
    },
  });
}

const validVerifier = async (): Promise<VerifierVerdict> => ({
  valid: true,
  errors: [],
  reportHash: "abc",
  versions: { validator: "1.6.3", configuration: "test" },
});

const base = () => ({
  client: fakeClient(),
  models: { extract: "nvidia/nemotron-3-super-120b-a12b", repair: "nvidia/Nemotron-3-Ultra-550b-a55b" },
  validate: validVerifier,
  pages: [PAGE],
  uploadHash: "sha256:upload",
  now: () => new Date("2026-10-02T12:00:00Z"),
});

describe("runInvoice", () => {
  it("asks for a missing buyer reference instead of inventing it", async () => {
    const run = await runInvoice(base());
    expect(run.state).toBe("NEEDS_INPUT");
    expect(run.missing.map((m) => m.bt)).toEqual(["BT-10"]);
    expect(verifyAuditLog(run.audit.toJsonl()).ok).toBe(true);
  });

  it("finishes with user input, marked with provenance 'user', and a verifiable audit log", async () => {
    const run = await runInvoice({ ...base(), userInputs: [{ path: "buyerReference", value: "04011000-12345-03" }] });
    expect(run.state).toBe("OUTPUT");
    expect(run.invoice?.buyerReference).toBe("04011000-12345-03");
    expect(run.provenance.get("buyerReference")?.kind).toBe("user");
    expect(run.fieldsWithoutProvenance).toEqual([]);
    expect(run.audit.events.map((e) => e.type)).toContain("USER_INPUT");
    const xml = new TextEncoder().encode(run.xml ?? "");
    expect(verifyAuditLog(run.audit.toJsonl(), new Map([["xrechnung.xml", xml]])).ok).toBe(true);
  });

  it("never outputs when a line amount contradicts quantity × price", async () => {
    const raw = structuredClone(RAW);
    raw.lines[0]!.quantity = "20"; // misread quantity; the printed line amount stays 200,00 €
    const run = await runInvoice({
      ...base(),
      client: new TokenFactoryClient({
        apiKey: "test",
        baseUrl: "http://fake",
        dailyBudgetUsd: "1.00",
        fetchImpl: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { response_format?: { json_schema?: { name: string } } };
          if (body.response_format?.json_schema?.name === "repair_plan") return fakeRepairNone();
          return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(raw) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
        },
      }),
      userInputs: [{ path: "buyerReference", value: "04011000-12345-03" }],
    });
    // "20" occurs inside "200,00", so the evidence check passes; the per-line consistency
    // check is what must stop the run.
    expect(run.state).toBe("NEEDS_INPUT");
    expect(run.openIssues[0]?.id).toBe("LINE-MISMATCH");
  });
});

function fakeRepairNone(): Response {
  const content = JSON.stringify({ patches: [], unresolvable: [{ issue: "LINE-MISMATCH", reason: "cannot decide" }] });
  return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
}
