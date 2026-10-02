/**
 * JSON schema the extraction model must follow (constrained decoding on Token Factory).
 * Every fact is an `Ev`: the value as printed, a verbatim quote and the 1-based page.
 * Values are raw on purpose; normalization happens deterministically afterwards.
 */
const Ev = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["value", "quote", "page"],
      properties: { value: { type: "string" }, quote: { type: "string" }, page: { type: "integer" } },
    },
    { type: "null" },
  ],
} as const;

const NullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;

const obj = (props: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(props),
  properties: props,
});

const party = {
  name: Ev,
  street: Ev,
  addressLine2: Ev,
  city: Ev,
  postcode: Ev,
  country: Ev,
  electronicAddress: Ev,
};

export const EXTRACTION_SCHEMA = obj({
  header: obj({
    invoiceNumber: Ev,
    issueDate: Ev,
    dueDate: Ev,
    buyerReference: Ev,
    orderReference: Ev,
    currency: Ev,
    paymentTerms: Ev,
  }),
  seller: obj({
    ...party,
    sellerId: Ev,
    legalRegistrationId: Ev,
    vatId: Ev,
    taxNumber: Ev,
    contactName: Ev,
    contactPhone: Ev,
    contactEmail: Ev,
  }),
  buyer: obj(party),
  payment: obj({ iban: Ev, accountName: Ev }),
  vatExemptions: { type: "array", items: obj({ category: Ev, reason: Ev, reasonCode: Ev }) },
  // One quote per invoice line (the whole printed row); every value must occur inside it.
  // Per-field quotes repeated the row eight times and truncated long invoices.
  lines: {
    type: "array",
    items: obj({
      rowQuote: { type: "string" },
      page: { type: "integer" },
      lineId: NullableString,
      name: NullableString,
      quantity: NullableString,
      unit: NullableString,
      netPrice: NullableString,
      priceBaseQuantity: NullableString,
      vatCategory: NullableString,
      vatRate: NullableString,
      lineAmount: NullableString,
    }),
  },
  documentTotals: obj({ lineTotal: Ev, taxTotal: Ev, grandTotal: Ev }),
});

export interface EvValue {
  readonly value: string;
  readonly quote: string;
  readonly page: number;
}
export type Ev = EvValue | null;

interface PartyRaw {
  readonly name: Ev;
  readonly street: Ev;
  readonly addressLine2: Ev;
  readonly city: Ev;
  readonly postcode: Ev;
  readonly country: Ev;
  readonly electronicAddress: Ev;
}

export interface RawLine {
  readonly rowQuote: string;
  readonly page: number;
  readonly lineId: string | null;
  readonly name: string | null;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly netPrice: string | null;
  readonly priceBaseQuantity: string | null;
  readonly vatCategory: string | null;
  readonly vatRate: string | null;
  /** Printed line total; only used for the per-line consistency check. */
  readonly lineAmount: string | null;
}

export interface RawExtraction {
  readonly header: {
    readonly invoiceNumber: Ev;
    readonly issueDate: Ev;
    readonly dueDate: Ev;
    readonly buyerReference: Ev;
    readonly orderReference: Ev;
    readonly currency: Ev;
    readonly paymentTerms: Ev;
  };
  readonly seller: PartyRaw & {
    readonly sellerId: Ev;
    readonly legalRegistrationId: Ev;
    readonly vatId: Ev;
    readonly taxNumber: Ev;
    readonly contactName: Ev;
    readonly contactPhone: Ev;
    readonly contactEmail: Ev;
  };
  readonly buyer: PartyRaw;
  readonly payment: { readonly iban: Ev; readonly accountName: Ev };
  readonly vatExemptions: readonly { readonly category: Ev; readonly reason: Ev; readonly reasonCode: Ev }[];
  readonly lines: readonly RawLine[];
  readonly documentTotals: { readonly lineTotal: Ev; readonly taxTotal: Ev; readonly grandTotal: Ev };
}

export const EXTRACTION_SYSTEM_PROMPT = `You read German invoices from their text layer and extract facts for an EN 16931 e-invoice.

Rules:
- Copy every value exactly as printed (same spelling, same number and date format). Do not convert, translate, compute or reformat anything.
- "quote" is a short verbatim snippet from the page that contains the value, ideally label plus value (e.g. "Rechnung Nr. R-2026-0042"). "page" is the 1-based page number where the quote appears.
- If a fact is not printed on the document, return null for it. Never guess, never infer from other fields, never fill in defaults.
- buyerReference is the "Leitweg-ID" or "Käuferreferenz" / "Ihre Referenz" field. orderReference is the buyer's order number ("Bestellnummer", "Ihre Bestellung").
- street is only the street and house number (or "Postfach ..."); any additional address line ("Gebäude B", "3. OG") goes to addressLine2, even when printed on the same line after a comma. city is the place name printed right after the postcode.
- electronicAddress is the party's electronic invoicing address (often an e-mail address or a Leitweg-ID labeled as such), not the phone number.
- sellerId is a seller identifier printed as such (e.g. "Lieferantennummer", "Kreditorennummer"); legalRegistrationId is a commercial register entry (e.g. "HRB 12345 Amtsgericht ...", "VR ...").
- vatId is the USt-IdNr. (starts with a country code, e.g. "DE 123456789"); taxNumber is the Steuernummer (e.g. "123/456/7890").
- lines: one entry per invoice line in document order. "rowQuote" is the complete printed row of that line, verbatim, including wrapped continuation lines (use "\\n" between them); "page" is its page. All other line values are plain strings copied from inside rowQuote, or null. lineAmount is the printed total of that line ("Betrag"). The position number column can wrap: a value split over two text lines still belongs to lineId, never to quantity. lineId is the position number or line identifier as printed in the position column ("Pos."); never use a quantity or price as lineId. unit is the unit exactly as printed, including a unit code in parentheses if one is printed (e.g. "Stk. (H87)"). netPrice is the unit price before VAT. priceBaseQuantity only if the price refers to a quantity other than 1 (e.g. "je 100 Stück" -> "100"). vatCategory is a printed category code or wording (e.g. "S", "nicht steuerbar", "steuerfrei"); vatRate is the printed percentage.
- vatExemptions: printed reasons why VAT is not charged (e.g. "als gemeinnützig anerkannt"), with the category they belong to if printed. reasonCode is a printed exemption code such as "VATEX-EU-O" (without brackets); do not put codes into reason.
- Every fact belongs to one field. Do not reuse a value printed for one purpose to fill another field (e.g. the electronic address is not the contact e-mail, the company name is not the account holder unless printed as such).
- documentTotals are the totals exactly as printed; they are only used for a consistency check.
- paymentTerms: copy the full payment terms text, keep line breaks as "\\n".`;
