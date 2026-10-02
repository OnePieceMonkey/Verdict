// Renderer contract: deterministic bytes, every value quotable from the text layer,
// deleted fields leave no label behind.
import { deriveAmounts, type InvoiceInput } from "@verdict/core";
import { describe, expect, it } from "vitest";
import { extractPageTexts } from "@verdict/core";
import {
  formatAmount,
  labelsFor,
  renderInvoicePdf,
  type LayoutId,
  type NoiseOptions,
} from "./render-invoice.ts";

// Synthetic data only (fictitious company, .example domains, Bundesbank test IBAN).
const fixture: InvoiceInput = {
  number: "RE-2026-0042",
  issueDate: "2026-04-04",
  typeCode: "380",
  currency: "EUR",
  dueDate: "2026-05-04",
  buyerReference: "04011000-12345-34",
  orderReference: "PO-7781",
  paymentTerms: "#SKONTO#TAGE=14#PROZENT=2.00#\n#SKONTO#TAGE=30#PROZENT=0.00#\n",
  seller: {
    id: "LIEF-0815",
    name: "Beispiel Büromöbel GmbH",
    legalRegistrationId: "HRB 12345, Amtsgericht Musterstadt",
    vatId: "DE999999999",
    taxNumber: "12/345/67890",
    electronicAddress: { scheme: "EM", value: "rechnung@bueromoebel.example" },
    address: { line1: "Musterstraße 12", city: "Musterstadt", postcode: "12345", countryCode: "DE" },
    contact: { name: "Erika Beispiel", phone: "+49 30 1234567", email: "erika@bueromoebel.example" },
  },
  buyer: {
    name: "Stadtverwaltung Testhausen – Amt für Digitales",
    electronicAddress: { scheme: "0204", value: "04011000-12345-34" },
    address: { line1: "Rathausplatz 1", line2: "Zimmer 3.14", city: "Testhausen", postcode: "54321", countryCode: "DE" },
  },
  payment: { meansCode: "58", iban: "DE02120300000000202051", accountName: "Beispiel Büromöbel GmbH" },
  vatExemptions: [],
  lines: [
    { id: "1", name: "Bürostuhl „Ergo“ [Modell 2026]", quantity: "4", unitCode: "H87", netPrice: "249.90", vatCategory: "S", vatRate: "19" },
    { id: "2", name: "Fachbuch Ergonomie … am Arbeitsplatz", quantity: "2", unitCode: "XPP", netPrice: "39.80", vatCategory: "S", vatRate: "7" },
    { id: "3", name: "Kabelbinder schwarz, 200 mm", quantity: "500", unitCode: "C62", netPrice: "4.90", priceBaseQuantity: "100", vatCategory: "S", vatRate: "19" },
  ],
};

const LAYOUTS: readonly LayoutId[] = ["classic", "modern", "compact"];
const NOISE: readonly NoiseOptions[] = [
  {},
  { numberFormat: "plain", dateFormat: "iso", labelVariant: 1, shuffleBlocks: true },
  { smallFont: true, splitPages: true, dateFormat: "long" },
];

const squash = (s: string): string => s.replace(/\s+/g, " ");

async function render(invoice: InvoiceInput, layout: LayoutId, noise: NoiseOptions = {}) {
  const pdf = await renderInvoicePdf(invoice, deriveAmounts(invoice), { layout, noise });
  const pages = await extractPageTexts(pdf);
  return { pdf, pages, text: pages.join("\n") };
}

describe("renderInvoicePdf", () => {
  for (const layout of LAYOUTS) {
    for (const noise of NOISE) {
      it(`${layout} ${JSON.stringify(noise)}: deterministic and quotable`, async () => {
        const a = await render(fixture, layout, noise);
        const b = await renderInvoicePdf(fixture, deriveAmounts(fixture), { layout, noise });
        expect(a.pdf.equals(b)).toBe(true);

        const nf = noise.numberFormat ?? "de";
        const expected = [
          fixture.number,
          fixture.payment?.iban ?? "",
          fixture.buyerReference,
          fixture.seller.vatId ?? "",
          "#SKONTO#TAGE=14#PROZENT=2.00#",
          "#SKONTO#TAGE=30#PROZENT=0.00#",
          ...fixture.lines.map((l) => l.unitCode),
          formatAmount(deriveAmounts(fixture).grandTotal, nf),
        ];
        for (const s of expected) expect(a.text, s).toContain(s);
        // Long descriptions may wrap inside their table cell; compare them whitespace-normalized.
        const flat = squash(a.text);
        for (const l of fixture.lines) expect(flat, l.name).toContain(squash(l.name));

        if (noise.splitPages) {
          expect(a.pages.length).toBeGreaterThanOrEqual(2);
          for (const l of fixture.lines) {
            expect(squash(a.pages[0] ?? "")).not.toContain(l.name);
            expect(squash(a.pages[1] ?? "")).toContain(l.name);
          }
        }
      });
    }
  }

  it("shuffleBlocks changes the text-layer order of the header blocks", async () => {
    for (const layout of LAYOUTS) {
      const plain = await render(fixture, layout);
      const shuffled = await render(fixture, layout, { shuffleBlocks: true });
      const order = (t: string) => t.indexOf(fixture.number) < t.indexOf(fixture.buyer.name);
      expect(order(plain.text)).not.toBe(order(shuffled.text));
    }
  });

  it("paginates long line tables", async () => {
    const lines = Array.from({ length: 45 }, (_, i) => ({
      id: String(i + 1),
      name: `Position Nummer ${i + 1}`,
      quantity: "1",
      unitCode: "H87",
      netPrice: "10.00",
      vatCategory: "S" as const,
      vatRate: "19",
    }));
    const inv: InvoiceInput = { ...fixture, lines };
    for (const layout of LAYOUTS) {
      const { pages, text } = await render(inv, layout);
      expect(pages.length).toBeGreaterThanOrEqual(2);
      for (const l of lines) expect(text).toContain(l.name);
      expect(text).toContain(formatAmount(deriveAmounts(inv).grandTotal, "de"));
    }
  });

  it("keeps the payment-terms line breaks", async () => {
    const { text } = await render(fixture, "classic");
    expect(text).toContain("#SKONTO#TAGE=14#PROZENT=2.00#\n#SKONTO#TAGE=30#PROZENT=0.00#");
  });

  it("prints 'nicht steuerbar' for category O lines", async () => {
    const inv: InvoiceInput = {
      ...fixture,
      lines: [{ id: "1", name: "Durchlaufender Posten", quantity: "1", unitCode: "LS", netPrice: "10.00", vatCategory: "O" }],
    };
    for (const layout of LAYOUTS) {
      const { text } = await render(inv, layout);
      expect(text).toContain("nicht steuerbar");
      expect(text).not.toContain("0 % (O)");
    }
  });

  it("does not print labels of deleted optional fields", async () => {
    const { orderReference: _o, dueDate: _d, ...rest } = fixture;
    const stripped: InvoiceInput = rest;
    for (const layout of LAYOUTS) {
      for (const variant of [0, 1] as const) {
        const L = labelsFor(variant);
        const full = await render(fixture, layout, { labelVariant: variant });
        expect(full.text).toContain(L.orderReference);
        expect(full.text).toContain(L.dueDate);

        const { text } = await render(stripped, layout, { labelVariant: variant });
        expect(text).not.toContain(L.orderReference);
        expect(text).not.toContain(L.dueDate);
        expect(text).not.toContain(fixture.orderReference ?? "");
      }
    }
  });

  it("does not print a deleted payment block", async () => {
    const { payment: _p, ...rest } = fixture;
    for (const layout of LAYOUTS) {
      const { text } = await render(rest, layout);
      expect(text).not.toContain("IBAN");
    }
  });
});
