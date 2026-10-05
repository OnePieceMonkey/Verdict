import type { InvoiceInput } from "@verdict/core";

/**
 * Document-level mutations for the set "mutated" (EVAL-03). Each one changes what is
 * printed on the PDF, and states what a correct pipeline must do with it:
 *  - needs-input: the fact is not on the document, so the pipeline must ask, never invent
 *  - warning: the document is inconsistent, derived amounts win, a warning is shown
 *  - normalize: the fact is printed in a non-standard form and must be normalized
 *  - rejected: the document lacks something only its issuer may state; the run must end
 *    rejected, with no XRechnung and nothing asked or invented
 * `detectedBy` is the rule the verifier reports when the mutated model is built as-is
 * (checked against the real verifier on 2026-10-02, see corpus build).
 */
export type Expectation =
  | { readonly kind: "needs-input"; readonly fields: readonly string[] }
  | { readonly kind: "warning"; readonly fields: readonly string[] }
  | { readonly kind: "normalize"; readonly fields: readonly string[] }
  | { readonly kind: "rejected"; readonly fields: readonly string[] };

export interface Mutation {
  readonly id: string;
  readonly description: string;
  readonly expect: Expectation;
  /** Rule ID the verifier must report for the mutated model, or "none" if it stays valid. */
  readonly detectedBy: string;
  /**
   * The verifier reports `detectedBy` but still answers ACCEPTABLE, because the XRechnung
   * configuration tolerates some code list errors. Our normalization has to catch these.
   */
  readonly acceptedAnyway?: boolean;
  readonly apply: (invoice: InvoiceInput) => InvoiceInput;
  /** Optional change to printed amounts only (the model stays correct). */
  readonly printed?: "grand-total-off" | "vat-amount-off";
  /** Mutation is applicable to this invoice. */
  readonly applicable?: (invoice: InvoiceInput) => boolean;
}

const clone = (i: InvoiceInput): InvoiceInput => structuredClone(i);

export const MUTATIONS: readonly Mutation[] = [
  {
    id: "missing-buyer-reference",
    description: "Leitweg-ID / buyer reference not printed",
    expect: { kind: "needs-input", fields: ["BT-10"] },
    detectedBy: "BR-DE-15",
    apply: (i) => {
      const m = clone(i);
      // The model requires BT-10; an empty string marks "not on the document".
      m.buyerReference = "";
      return m;
    },
  },
  {
    id: "missing-seller-tax-ids",
    description: "Neither VAT ID nor tax number nor seller identifiers printed",
    expect: { kind: "needs-input", fields: ["BT-31", "BT-32"] },
    detectedBy: "BR-CO-26",
    applicable: (i) => i.lines.every((l) => l.vatCategory === "S"),
    apply: (i) => {
      const m = clone(i);
      delete m.seller.vatId;
      delete m.seller.taxNumber;
      delete m.seller.id;
      delete m.seller.legalRegistrationId;
      return m;
    },
  },
  {
    id: "missing-iban",
    description: "Bank details missing although payment by transfer is requested",
    expect: { kind: "needs-input", fields: ["BT-84"] },
    detectedBy: "BR-DE-1",
    applicable: (i) => i.payment !== undefined,
    apply: (i) => {
      const m = clone(i);
      delete m.payment;
      return m;
    },
  },
  {
    id: "missing-seller-phone",
    description: "Seller contact phone not printed",
    expect: { kind: "needs-input", fields: ["BT-42"] },
    detectedBy: "BR-DE-6",
    apply: (i) => {
      const m = clone(i);
      m.seller.contact.phone = "";
      return m;
    },
  },
  {
    id: "missing-seller-email",
    description: "Seller contact e-mail not printed",
    expect: { kind: "needs-input", fields: ["BT-43"] },
    detectedBy: "BR-DE-7",
    apply: (i) => {
      const m = clone(i);
      m.seller.contact.email = "";
      return m;
    },
  },
  {
    id: "missing-buyer-electronic-address",
    description: "Buyer electronic address (e-mail / Leitweg routing) not printed",
    expect: { kind: "needs-input", fields: ["BT-49"] },
    detectedBy: "BR-63",
    apply: (i) => {
      const m = clone(i);
      m.buyer.electronicAddress.value = "";
      return m;
    },
  },
  {
    id: "missing-seller-electronic-address",
    description: "Seller electronic address not printed",
    expect: { kind: "needs-input", fields: ["BT-34"] },
    detectedBy: "BR-62",
    apply: (i) => {
      const m = clone(i);
      m.seller.electronicAddress.value = "";
      return m;
    },
  },
  {
    id: "missing-seller-city",
    description: "Seller city not printed",
    expect: { kind: "needs-input", fields: ["BT-37"] },
    detectedBy: "BR-DE-3",
    apply: (i) => {
      const m = clone(i);
      m.seller.address.city = "";
      return m;
    },
  },
  {
    id: "missing-buyer-city",
    description: "Buyer city not printed",
    expect: { kind: "needs-input", fields: ["BT-52"] },
    detectedBy: "BR-DE-8",
    apply: (i) => {
      const m = clone(i);
      m.buyer.address.city = "";
      return m;
    },
  },
  {
    id: "exempt-without-reason",
    description: "All lines VAT-exempt (category E, 0 %) but the document never says why",
    expect: { kind: "rejected", fields: ["BT-120"] },
    detectedBy: "BR-E-10",
    applicable: (i) => i.lines.every((l) => l.vatCategory === "S") && i.vatExemptions.length === 0,
    apply: (i) => {
      const m = clone(i);
      m.lines.forEach((l) => {
        l.vatCategory = "E";
        l.vatRate = "0";
      });
      return m;
    },
  },
  {
    id: "grand-total-off",
    description: "Printed grand total differs from the line sum by 1.00",
    expect: { kind: "warning", fields: ["BT-112"] },
    detectedBy: "none",
    printed: "grand-total-off",
    apply: clone,
  },
  {
    id: "vat-amount-off",
    description: "Printed VAT amount differs by 0.10 from the computed one",
    expect: { kind: "warning", fields: ["BT-110"] },
    detectedBy: "none",
    printed: "vat-amount-off",
    apply: clone,
  },
  {
    id: "unit-as-german-word",
    description: "Units printed as German words (Stück, Stunde) instead of UN/ECE codes",
    expect: { kind: "normalize", fields: ["BT-130"] },
    detectedBy: "BR-CL-23",
    acceptedAnyway: true,
    apply: (i) => {
      const m = clone(i);
      m.lines.forEach((l, n) => (l.unitCode = n % 2 === 0 ? "Stück" : "Stunde"));
      return m;
    },
  },
  {
    id: "invalid-currency-symbol",
    description: "Currency printed only as the € sign",
    expect: { kind: "normalize", fields: ["BT-5"] },
    detectedBy: "BR-CL-04",
    apply: (i) => {
      const m = clone(i);
      (m as { currency: string }).currency = "€";
      return m;
    },
  },
];
