import { deriveAmounts, type DerivedAmounts } from "../derive/derive.ts";
import type { InvoiceInput } from "../model/invoice.ts";
import { BUSINESS_PROCESS, CII_NS, XRECHNUNG_GUIDELINE } from "./namespaces.ts";

/**
 * Deterministic CII builder (rule 1: the LLM never writes XML).
 * Element order follows the UN/CEFACT D16B schema; the same input always yields
 * byte-identical output.
 */
export function buildCii(invoice: InvoiceInput, amounts: DerivedAmounts = deriveAmounts(invoice)): string {
  const w = new XmlWriter();
  w.raw('<?xml version="1.0" encoding="UTF-8"?>');
  w.open(
    "rsm:CrossIndustryInvoice",
    Object.entries(CII_NS).map(([p, uri]) => [`xmlns:${p}`, uri] as const),
  );

  w.open("rsm:ExchangedDocumentContext");
  w.open("ram:BusinessProcessSpecifiedDocumentContextParameter");
  w.leaf("ram:ID", BUSINESS_PROCESS);
  w.close();
  w.open("ram:GuidelineSpecifiedDocumentContextParameter");
  w.leaf("ram:ID", XRECHNUNG_GUIDELINE);
  w.close();
  w.close();

  w.open("rsm:ExchangedDocument");
  w.leaf("ram:ID", invoice.number);
  w.leaf("ram:TypeCode", invoice.typeCode);
  w.open("ram:IssueDateTime");
  w.leaf("udt:DateTimeString", compactDate(invoice.issueDate), [["format", "102"]]);
  w.close();
  w.close();

  w.open("rsm:SupplyChainTradeTransaction");

  invoice.lines.forEach((line, i) => {
    const net = amounts.lines[i]?.netAmount;
    if (net === undefined) throw new Error(`no derived net amount for line ${line.id}`);
    w.open("ram:IncludedSupplyChainTradeLineItem");
    w.open("ram:AssociatedDocumentLineDocument");
    w.leaf("ram:LineID", line.id);
    w.close();
    w.open("ram:SpecifiedTradeProduct");
    w.leaf("ram:Name", line.name);
    w.close();
    w.open("ram:SpecifiedLineTradeAgreement");
    w.open("ram:NetPriceProductTradePrice");
    w.leaf("ram:ChargeAmount", line.netPrice);
    if (line.priceBaseQuantity) w.leaf("ram:BasisQuantity", line.priceBaseQuantity, [["unitCode", line.unitCode]]);
    w.close();
    w.close();
    w.open("ram:SpecifiedLineTradeDelivery");
    w.leaf("ram:BilledQuantity", line.quantity, [["unitCode", line.unitCode]]);
    w.close();
    w.open("ram:SpecifiedLineTradeSettlement");
    w.open("ram:ApplicableTradeTax");
    w.leaf("ram:TypeCode", "VAT");
    w.leaf("ram:CategoryCode", line.vatCategory);
    if (line.vatRate !== undefined) w.leaf("ram:RateApplicablePercent", line.vatRate);
    w.close();
    w.open("ram:SpecifiedTradeSettlementLineMonetarySummation");
    w.leaf("ram:LineTotalAmount", net);
    w.close();
    w.close();
    w.close();
  });

  const { seller, buyer } = invoice;
  w.open("ram:ApplicableHeaderTradeAgreement");
  w.leaf("ram:BuyerReference", invoice.buyerReference);
  w.open("ram:SellerTradeParty");
  if (seller.id) w.leaf("ram:ID", seller.id);
  w.leaf("ram:Name", seller.name);
  if (seller.legalRegistrationId) {
    w.open("ram:SpecifiedLegalOrganization");
    w.leaf("ram:ID", seller.legalRegistrationId);
    w.close();
  }
  w.open("ram:DefinedTradeContact");
  w.leaf("ram:PersonName", seller.contact.name);
  w.open("ram:TelephoneUniversalCommunication");
  w.leaf("ram:CompleteNumber", seller.contact.phone);
  w.close();
  w.open("ram:EmailURIUniversalCommunication");
  w.leaf("ram:URIID", seller.contact.email);
  w.close();
  w.close();
  writeAddress(w, seller.address);
  w.open("ram:URIUniversalCommunication");
  w.leaf("ram:URIID", seller.electronicAddress.value, [["schemeID", seller.electronicAddress.scheme]]);
  w.close();
  if (seller.taxNumber) {
    w.open("ram:SpecifiedTaxRegistration");
    w.leaf("ram:ID", seller.taxNumber, [["schemeID", "FC"]]);
    w.close();
  }
  if (seller.vatId) {
    w.open("ram:SpecifiedTaxRegistration");
    w.leaf("ram:ID", seller.vatId, [["schemeID", "VA"]]);
    w.close();
  }
  w.close();
  w.open("ram:BuyerTradeParty");
  w.leaf("ram:Name", buyer.name);
  writeAddress(w, buyer.address);
  w.open("ram:URIUniversalCommunication");
  w.leaf("ram:URIID", buyer.electronicAddress.value, [["schemeID", buyer.electronicAddress.scheme]]);
  w.close();
  w.close();
  if (invoice.orderReference) {
    w.open("ram:BuyerOrderReferencedDocument");
    w.leaf("ram:IssuerAssignedID", invoice.orderReference);
    w.close();
  }
  w.close();

  w.empty("ram:ApplicableHeaderTradeDelivery");

  w.open("ram:ApplicableHeaderTradeSettlement");
  w.leaf("ram:InvoiceCurrencyCode", invoice.currency);
  if (invoice.payment) {
    w.open("ram:SpecifiedTradeSettlementPaymentMeans");
    w.leaf("ram:TypeCode", invoice.payment.meansCode);
    w.open("ram:PayeePartyCreditorFinancialAccount");
    w.leaf("ram:IBANID", invoice.payment.iban);
    if (invoice.payment.accountName) w.leaf("ram:AccountName", invoice.payment.accountName);
    w.close();
    w.close();
  }
  for (const v of amounts.vatBreakdown) {
    const exemption = invoice.vatExemptions.find((e) => e.category === v.category);
    w.open("ram:ApplicableTradeTax");
    w.leaf("ram:CalculatedAmount", v.taxAmount);
    w.leaf("ram:TypeCode", "VAT");
    if (exemption?.reason) w.leaf("ram:ExemptionReason", exemption.reason);
    w.leaf("ram:BasisAmount", v.taxableAmount);
    w.leaf("ram:CategoryCode", v.category);
    if (exemption?.reasonCode) w.leaf("ram:ExemptionReasonCode", exemption.reasonCode);
    w.leaf("ram:RateApplicablePercent", v.rate);
    w.close();
  }
  if (invoice.paymentTerms || invoice.dueDate) {
    w.open("ram:SpecifiedTradePaymentTerms");
    if (invoice.paymentTerms) w.leaf("ram:Description", terminateSkontoLines(invoice.paymentTerms));
    if (invoice.dueDate) {
      w.open("ram:DueDateDateTime");
      w.leaf("udt:DateTimeString", compactDate(invoice.dueDate), [["format", "102"]]);
      w.close();
    }
    w.close();
  }
  w.open("ram:SpecifiedTradeSettlementHeaderMonetarySummation");
  w.leaf("ram:LineTotalAmount", amounts.lineTotal);
  w.leaf("ram:TaxBasisTotalAmount", amounts.taxBasisTotal);
  w.leaf("ram:TaxTotalAmount", amounts.taxTotal, [["currencyID", invoice.currency]]);
  w.leaf("ram:GrandTotalAmount", amounts.grandTotal);
  w.leaf("ram:DuePayableAmount", amounts.duePayable);
  w.close();
  w.close();

  w.close(); // SupplyChainTradeTransaction
  w.close(); // CrossIndustryInvoice
  return w.toString();
}

function writeAddress(w: XmlWriter, a: InvoiceInput["seller"]["address"]): void {
  w.open("ram:PostalTradeAddress");
  w.leaf("ram:PostcodeCode", a.postcode);
  if (a.line1) w.leaf("ram:LineOne", a.line1);
  if (a.line2) w.leaf("ram:LineTwo", a.line2);
  w.leaf("ram:CityName", a.city);
  w.leaf("ram:CountryID", a.countryCode);
  w.close();
}

/** XRechnung BR-DE-18: every #SKONTO# line, including the last one, ends with a line break. */
const terminateSkontoLines = (terms: string): string =>
  /^#SKONTO#/m.test(terms) && !terms.endsWith("\n") ? `${terms}\n` : terms;

const compactDate = (iso: string): string => iso.replaceAll("-", "");

type Attrs = readonly (readonly [string, string])[];

class XmlWriter {
  readonly #out: string[] = [];
  readonly #stack: string[] = [];

  raw(s: string): void {
    this.#out.push(s);
  }
  open(name: string, attrs: Attrs = []): void {
    this.#out.push(`${this.#indent()}<${name}${fmtAttrs(attrs)}>`);
    this.#stack.push(name);
  }
  close(): void {
    const name = this.#stack.pop();
    if (!name) throw new Error("XmlWriter: close without open");
    this.#out.push(`${this.#indent()}</${name}>`);
  }
  leaf(name: string, value: string, attrs: Attrs = []): void {
    this.#out.push(`${this.#indent()}<${name}${fmtAttrs(attrs)}>${escapeXml(value)}</${name}>`);
  }
  empty(name: string): void {
    this.#out.push(`${this.#indent()}<${name}/>`);
  }
  toString(): string {
    if (this.#stack.length) throw new Error(`XmlWriter: unclosed ${this.#stack.join(" > ")}`);
    return this.#out.join("\n") + "\n";
  }
  #indent(): string {
    return "  ".repeat(this.#stack.length);
  }
}

const fmtAttrs = (attrs: Attrs): string =>
  attrs.map(([k, v]) => ` ${k}="${escapeXml(v)}"`).join("");

function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
