// Turns an InvoiceInput plus printed amounts into pre-formatted strings for the layouts.
// Every field is guarded at runtime: corpus mutations delete fields (even required ones)
// to simulate missing facts, and a deleted field must simply not be printed.

import type { InvoiceInput } from "@verdict/core";
import {
  formatAmount,
  formatDate,
  formatDecimal,
  formatRate,
  formatUnit,
  labelsFor,
  unitLabel,
  type DateFormat,
  type Labels,
  type NumberFormat,
} from "./format.ts";

export interface PrintedVat {
  readonly category: string;
  readonly rate: string;
  readonly taxableAmount: string;
  readonly taxAmount: string;
}

export interface PrintedAmounts {
  readonly lineNet: readonly string[];
  readonly vatBreakdown: readonly PrintedVat[];
  readonly lineTotal: string;
  readonly taxTotal: string;
  readonly grandTotal: string;
}

export interface Fact {
  readonly label: string;
  readonly value: string;
}

export interface PrintLine {
  readonly pos: string;
  readonly name: string;
  readonly quantity: string;
  readonly unit: string;
  readonly price: string;
  readonly priceBase: string | undefined;
  readonly vat: string;
  readonly net: string;
}

export interface PrintVatRow {
  readonly label: string;
  readonly taxable: string;
  readonly tax: string;
}

export interface PrintFacts {
  readonly labels: Labels;
  readonly meta: readonly Fact[];
  readonly sellerName: string | undefined;
  readonly sellerAddress: readonly string[];
  readonly sellerContact: readonly Fact[];
  readonly sellerElectronic: Fact | undefined;
  readonly sellerLegal: readonly Fact[];
  readonly buyerName: string | undefined;
  readonly buyerAddress: readonly string[];
  readonly buyerElectronic: Fact | undefined;
  readonly bank: readonly Fact[];
  readonly paymentTerms: Fact | undefined;
  readonly exemptions: readonly string[];
  readonly lines: readonly PrintLine[];
  readonly vat: readonly PrintVatRow[];
  readonly lineTotal: Fact;
  readonly taxTotal: Fact;
  readonly grandTotal: Fact;
}

export interface FactOptions {
  readonly numberFormat: NumberFormat;
  readonly dateFormat: DateFormat;
  readonly labelVariant: 0 | 1;
}

const text = (v: unknown): string | undefined => (typeof v === "string" && v.length > 0 ? v : undefined);

function fact(label: string, value: string | undefined): Fact[] {
  return value === undefined ? [] : [{ label, value }];
}

interface LooseAddress {
  line1?: string;
  line2?: string;
  postcode?: string;
  city?: string;
  countryCode?: string;
}

function addressLines(a: LooseAddress | undefined): string[] {
  if (a === undefined) return [];
  const cityLine = [text(a.postcode), text(a.city)].filter((s) => s !== undefined).join(" ");
  return [text(a.line1), text(a.line2), text(cityLine), text(a.countryCode)].filter(
    (s): s is string => s !== undefined,
  );
}

function electronic(
  label: string,
  scheme: string,
  e: { scheme?: string; value?: string } | undefined,
): Fact | undefined {
  const value = text(e?.value);
  if (value === undefined) return undefined;
  const s = text(e?.scheme);
  return { label, value: s === undefined ? value : `${value} (${scheme}: ${s})` };
}

/** Text for a line's VAT column, e.g. "19 % (S)" or "nicht steuerbar (O)". */
function lineVat(category: string | undefined, rate: string | undefined, L: Labels, nf: NumberFormat): string {
  const cat = category === undefined ? "" : ` (${category})`;
  if (category === "O") return `${L.notTaxable}${cat}`;
  if (rate !== undefined) return `${formatRate(rate, nf)}${cat}`;
  return category ?? "";
}

export function buildFacts(invoice: InvoiceInput, printed: PrintedAmounts, o: FactOptions): PrintFacts {
  const L = labelsFor(o.labelVariant);
  const nf = o.numberFormat;
  const date = (v: unknown) => {
    const s = text(v);
    return s === undefined ? undefined : formatDate(s, o.dateFormat);
  };

  const meta: Fact[] = [
    ...fact(L.number, text(invoice.number)),
    ...fact(L.issueDate, date(invoice.issueDate)),
    ...fact(L.dueDate, date(invoice.dueDate)),
    ...fact(L.buyerReference, text(invoice.buyerReference)),
    ...fact(L.orderReference, text(invoice.orderReference)),
    ...fact(L.currency, text(invoice.currency)),
  ];

  const seller = invoice.seller as Partial<InvoiceInput["seller"]> | undefined;
  const contact = seller?.contact as Partial<InvoiceInput["seller"]["contact"]> | undefined;
  const buyer = invoice.buyer as Partial<InvoiceInput["buyer"]> | undefined;

  const sellerContact: Fact[] = [
    ...fact(L.contact, text(contact?.name)),
    ...fact(L.phone, text(contact?.phone)),
    ...fact(L.email, text(contact?.email)),
  ];
  const sellerLegal: Fact[] = [
    ...fact(L.vatId, text(seller?.vatId)),
    ...fact(L.taxNumber, text(seller?.taxNumber)),
    ...fact(L.legalRegistrationId, text(seller?.legalRegistrationId)),
    ...fact(L.sellerId, text(seller?.id)),
  ];

  const payment = invoice.payment as Partial<NonNullable<InvoiceInput["payment"]>> | undefined;
  const bank: Fact[] = [
    ...fact(L.iban, text(payment?.iban)),
    ...fact(L.accountName, text(payment?.accountName)),
  ];

  const exemptions = (invoice.vatExemptions ?? []).flatMap((e) => {
    const reason = text(e.reason);
    const code = text(e.reasonCode);
    if (reason === undefined && code === undefined) return [];
    const body = [reason, code === undefined ? undefined : `(${code})`].filter((s) => s !== undefined).join(" ");
    return [`${L.exemption} (${e.category}): ${body}`];
  });

  const lines: PrintLine[] = (invoice.lines ?? []).map((l, i) => {
    const net = printed.lineNet[i];
    if (net === undefined) throw new Error(`printed.lineNet has no entry for line ${i + 1}`);
    const unitCode = text(l.unitCode);
    const base = text(l.priceBaseQuantity);
    const baseUnit = unitCode === undefined ? "" : ` ${unitLabel(unitCode) ?? unitCode}`;
    return {
      pos: text(l.id) ?? "",
      name: text(l.name) ?? "",
      quantity: text(l.quantity) === undefined ? "" : formatDecimal(l.quantity, nf),
      unit: unitCode === undefined ? "" : formatUnit(unitCode),
      price: text(l.netPrice) === undefined ? "" : formatAmount(l.netPrice, nf),
      priceBase: base === undefined ? undefined : `${L.per} ${formatDecimal(base, nf)}${baseUnit}`,
      vat: lineVat(text(l.vatCategory), text(l.vatRate), L, nf),
      net: formatAmount(net, nf),
    };
  });

  const vat: PrintVatRow[] = printed.vatBreakdown.map((v) => ({
    label: v.category === "O" ? `${L.notTaxable} (O)` : `${L.vatShort} ${formatRate(v.rate, nf)} (${v.category})`,
    taxable: formatAmount(v.taxableAmount, nf),
    tax: formatAmount(v.taxAmount, nf),
  }));

  const terms = text(invoice.paymentTerms);

  return {
    labels: L,
    meta,
    sellerName: text(seller?.name),
    sellerAddress: addressLines(seller?.address as LooseAddress | undefined),
    sellerContact,
    sellerElectronic: electronic(L.electronicAddress, L.scheme, seller?.electronicAddress),
    sellerLegal,
    buyerName: text(buyer?.name),
    buyerAddress: addressLines(buyer?.address as LooseAddress | undefined),
    buyerElectronic: electronic(L.electronicAddress, L.scheme, buyer?.electronicAddress),
    bank,
    paymentTerms: terms === undefined ? undefined : { label: L.paymentTerms, value: terms },
    exemptions,
    lines,
    vat,
    lineTotal: { label: L.lineTotal, value: formatAmount(printed.lineTotal, nf) },
    taxTotal: { label: L.taxTotal, value: formatAmount(printed.taxTotal, nf) },
    grandTotal: { label: L.grandTotal, value: formatAmount(printed.grandTotal, nf) },
  };
}
