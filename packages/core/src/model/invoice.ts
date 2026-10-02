import { z } from "zod";

/**
 * Semantic invoice model (MVP subset of EN 16931, see docs/SRS.md §3).
 *
 * `InvoiceInput` holds only facts that appear on a document. Everything that can be
 * computed (line net amounts, VAT breakdown, totals) lives in `DerivedAmounts` and is
 * produced by `deriveAmounts`; it is never extracted.
 *
 * Amounts, quantities and rates are decimal strings. Never JavaScript numbers.
 */

export const DecimalString = z.string().regex(/^-?\d+(\.\d+)?$/, "decimal string expected");
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD expected");

/** UNCL 5305 categories supported in the MVP. */
export const VatCategory = z.enum(["S", "Z", "E", "AE", "K", "G", "O"]);
export type VatCategory = z.infer<typeof VatCategory>;

export const Address = z.object({
  line1: z.string().min(1).optional(), // BT-35 / BT-50 (optional in EN 16931)
  line2: z.string().optional(), // BT-36 / BT-51
  city: z.string().min(1), // BT-37 / BT-52
  postcode: z.string().min(1), // BT-38 / BT-53
  countryCode: z.string().length(2), // BT-40 / BT-55
});

export const ElectronicAddress = z.object({
  scheme: z.string().min(1), // e.g. EM (e-mail), 0204 (Leitweg-ID)
  value: z.string().min(1),
});

export const Seller = z.object({
  id: z.string().optional(), // BT-29
  name: z.string().min(1), // BT-27
  legalRegistrationId: z.string().optional(), // BT-30
  vatId: z.string().optional(), // BT-31
  taxNumber: z.string().optional(), // BT-32
  electronicAddress: ElectronicAddress, // BT-34
  address: Address, // BG-5
  contact: z.object({
    name: z.string().min(1), // BT-41
    phone: z.string().min(1), // BT-42
    email: z.string().min(1), // BT-43
  }), // BG-6
});

export const Buyer = z.object({
  name: z.string().min(1), // BT-44
  electronicAddress: ElectronicAddress, // BT-49
  address: Address, // BG-8
});

export const InvoiceLine = z.object({
  id: z.string().min(1), // BT-126
  name: z.string().min(1), // BT-153
  quantity: DecimalString, // BT-129
  unitCode: z.string().min(1), // BT-130 (UN/ECE Rec 20/21)
  netPrice: DecimalString, // BT-146
  priceBaseQuantity: DecimalString.optional(), // BT-149
  vatCategory: VatCategory, // BT-151
  vatRate: DecimalString.optional(), // BT-152, absent for category O
});

export const CreditTransfer = z.object({
  meansCode: z.literal("58"), // BT-81, MVP: SEPA credit transfer only
  iban: z.string().min(1), // BT-84
  accountName: z.string().optional(), // BT-85
});

export const VatExemption = z.object({
  category: VatCategory,
  reason: z.string().optional(), // BT-120
  reasonCode: z.string().optional(), // BT-121
});

export const InvoiceInput = z.object({
  number: z.string().min(1), // BT-1
  issueDate: IsoDate, // BT-2
  typeCode: z.literal("380"), // BT-3, MVP: commercial invoice only
  currency: z.literal("EUR"), // BT-5
  dueDate: IsoDate.optional(), // BT-9
  buyerReference: z.string().min(1), // BT-10 (Leitweg-ID or other routing reference)
  orderReference: z.string().optional(), // BT-13
  paymentTerms: z.string().optional(), // BT-20, line breaks are significant (#SKONTO# syntax)
  seller: Seller,
  buyer: Buyer,
  payment: CreditTransfer.optional(), // BG-16
  vatExemptions: z.array(VatExemption).default([]), // BT-120/121 per category
  lines: z.array(InvoiceLine).min(1), // BG-25
});

export type InvoiceInput = z.infer<typeof InvoiceInput>;
export type InvoiceLine = z.infer<typeof InvoiceLine>;

/** Totals as printed on the document. Used only for the consistency check, never copied. */
export const DocumentTotals = z.object({
  lineTotal: DecimalString.optional(), // BT-106
  taxBasisTotal: DecimalString.optional(), // BT-109
  taxTotal: DecimalString.optional(), // BT-110
  grandTotal: DecimalString.optional(), // BT-112
  duePayable: DecimalString.optional(), // BT-115
});
export type DocumentTotals = z.infer<typeof DocumentTotals>;
