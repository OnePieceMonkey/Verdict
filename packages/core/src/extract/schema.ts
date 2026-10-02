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
  vatExemptions: { type: "array", items: obj({ category: Ev, reason: Ev }) },
  lines: {
    type: "array",
    items: obj({
      lineId: Ev,
      name: Ev,
      quantity: Ev,
      unit: Ev,
      netPrice: Ev,
      priceBaseQuantity: Ev,
      vatCategory: Ev,
      vatRate: Ev,
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
  readonly vatExemptions: readonly { readonly category: Ev; readonly reason: Ev }[];
  readonly lines: readonly {
    readonly lineId: Ev;
    readonly name: Ev;
    readonly quantity: Ev;
    readonly unit: Ev;
    readonly netPrice: Ev;
    readonly priceBaseQuantity: Ev;
    readonly vatCategory: Ev;
    readonly vatRate: Ev;
  }[];
  readonly documentTotals: { readonly lineTotal: Ev; readonly taxTotal: Ev; readonly grandTotal: Ev };
}

export const EXTRACTION_SYSTEM_PROMPT = `You read German invoices from their text layer and extract facts for an EN 16931 e-invoice.

Rules:
- Copy every value exactly as printed (same spelling, same number and date format). Do not convert, translate, compute or reformat anything.
- "quote" is a short verbatim snippet from the page that contains the value, ideally label plus value (e.g. "Rechnung Nr. R-2026-0042"). "page" is the 1-based page number where the quote appears.
- If a fact is not printed on the document, return null for it. Never guess, never infer from other fields, never fill in defaults.
- buyerReference is the "Leitweg-ID" or "Käuferreferenz" / "Ihre Referenz" field. orderReference is the buyer's order number ("Bestellnummer", "Ihre Bestellung").
- electronicAddress is the party's electronic invoicing address (often an e-mail address or a Leitweg-ID labeled as such), not the phone number.
- sellerId is a seller identifier printed as such (e.g. "Lieferantennummer", "Kreditorennummer"); legalRegistrationId is a commercial register entry (e.g. "HRB 12345 Amtsgericht ...", "VR ...").
- vatId is the USt-IdNr. (starts with a country code, e.g. "DE 123456789"); taxNumber is the Steuernummer (e.g. "123/456/7890").
- lines: one entry per invoice line in document order. lineId is the position number or line identifier as printed. unit is the unit as printed (code or word). netPrice is the unit price before VAT. priceBaseQuantity only if the price refers to a quantity other than 1 (e.g. "je 100 Stück" -> "100"). vatCategory is a printed category code or wording (e.g. "S", "nicht steuerbar", "steuerfrei"); vatRate is the printed percentage.
- vatExemptions: printed reasons why VAT is not charged (e.g. "als gemeinnützig anerkannt"), with the category they belong to if printed.
- documentTotals are the totals exactly as printed; they are only used for a consistency check.
- paymentTerms: copy the full payment terms text, keep line breaks as "\\n".`;
