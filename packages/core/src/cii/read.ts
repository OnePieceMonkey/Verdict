import { DOMParser } from "@xmldom/xmldom";
import * as xpath from "xpath";
import {
  DocumentTotals,
  InvoiceInput,
  type DocumentTotals as DocumentTotalsT,
  type InvoiceInput as InvoiceInputT,
} from "../model/invoice.ts";
import { CII_NS } from "./namespaces.ts";

const select = xpath.useNamespaces(CII_NS);

export interface ReadResult {
  readonly invoice: InvoiceInputT;
  readonly documentTotals: DocumentTotalsT;
}

/**
 * Reads the MVP subset of a CII (UN/CEFACT) XRechnung into the semantic model.
 * Used to turn the public KoSIT test suite into ground truth. Fields outside the MVP
 * subset are ignored on purpose; `parse` fails loudly if a required fact is missing.
 */
export function readCii(xml: string): ReadResult {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const root = doc.documentElement;
  if (!root) throw new Error("empty XML document");

  const text = (path: string, ctx: Node = root as unknown as Node): string | undefined => {
    const v = select(`string(${path})`, ctx) as string;
    const t = v.replace(/\s+/g, " ").trim();
    return t === "" ? undefined : t;
  };
  // Keeps line breaks (needed for the XRechnung #SKONTO# payment terms syntax).
  const multiline = (path: string): string | undefined => {
    const v = select(`string(${path})`, root as unknown as Node) as string;
    const t = v
      .split(/\r?\n/)
      .map((l) => l.replace(/[ \t]+/g, " ").trim())
      .filter((l) => l !== "")
      .join("\n");
    return t === "" ? undefined : t;
  };
  const nodes = (path: string, ctx: Node = root as unknown as Node): Node[] =>
    select(path, ctx) as Node[];
  const date = (raw: string | undefined): string | undefined =>
    raw && /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
  const required = (v: string | undefined, what: string): string => {
    if (v === undefined) throw new Error(`missing ${what}`);
    return v;
  };

  const tx = "/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction";
  const agreement = `${tx}/ram:ApplicableHeaderTradeAgreement`;
  const settlement = `${tx}/ram:ApplicableHeaderTradeSettlement`;
  const sellerP = `${agreement}/ram:SellerTradeParty`;
  const buyerP = `${agreement}/ram:BuyerTradeParty`;

  const address = (party: string) => ({
    line1: text(`${party}/ram:PostalTradeAddress/ram:LineOne`),
    line2: text(`${party}/ram:PostalTradeAddress/ram:LineTwo`),
    city: text(`${party}/ram:PostalTradeAddress/ram:CityName`),
    postcode: text(`${party}/ram:PostalTradeAddress/ram:PostcodeCode`),
    countryCode: text(`${party}/ram:PostalTradeAddress/ram:CountryID`),
  });
  const electronicAddress = (party: string) => ({
    scheme: text(`${party}/ram:URIUniversalCommunication/ram:URIID/@schemeID`),
    value: text(`${party}/ram:URIUniversalCommunication/ram:URIID`),
  });

  const lines = nodes(`${tx}/ram:IncludedSupplyChainTradeLineItem`).map((n) => ({
    id: text("ram:AssociatedDocumentLineDocument/ram:LineID", n),
    name: text("ram:SpecifiedTradeProduct/ram:Name", n),
    quantity: text("ram:SpecifiedLineTradeDelivery/ram:BilledQuantity", n),
    unitCode: text("ram:SpecifiedLineTradeDelivery/ram:BilledQuantity/@unitCode", n),
    netPrice: text("ram:SpecifiedLineTradeAgreement/ram:NetPriceProductTradePrice/ram:ChargeAmount", n),
    priceBaseQuantity: text(
      "ram:SpecifiedLineTradeAgreement/ram:NetPriceProductTradePrice/ram:BasisQuantity",
      n,
    ),
    vatCategory: text("ram:SpecifiedLineTradeSettlement/ram:ApplicableTradeTax/ram:CategoryCode", n),
    vatRate: text(
      "ram:SpecifiedLineTradeSettlement/ram:ApplicableTradeTax/ram:RateApplicablePercent",
      n,
    ),
  }));

  const vatExemptions = nodes(`${settlement}/ram:ApplicableTradeTax`)
    .map((n) => ({
      category: text("ram:CategoryCode", n),
      reason: text("ram:ExemptionReason", n),
      reasonCode: text("ram:ExemptionReasonCode", n),
    }))
    .filter((e) => e.reason !== undefined || e.reasonCode !== undefined);

  // MVP: only the first SEPA credit transfer account is modelled.
  const transfer = nodes(`${settlement}/ram:SpecifiedTradeSettlementPaymentMeans[ram:TypeCode='58']`)[0];
  const payment = transfer
    ? {
        meansCode: "58",
        iban: text("ram:PayeePartyCreditorFinancialAccount/ram:IBANID", transfer),
        accountName: text("ram:PayeePartyCreditorFinancialAccount/ram:AccountName", transfer),
      }
    : undefined;

  const raw = {
    number: required(text("/rsm:CrossIndustryInvoice/rsm:ExchangedDocument/ram:ID"), "BT-1"),
    issueDate: date(
      text("/rsm:CrossIndustryInvoice/rsm:ExchangedDocument/ram:IssueDateTime/udt:DateTimeString"),
    ),
    typeCode: text("/rsm:CrossIndustryInvoice/rsm:ExchangedDocument/ram:TypeCode"),
    currency: text(`${settlement}/ram:InvoiceCurrencyCode`),
    dueDate: date(
      text(`${settlement}/ram:SpecifiedTradePaymentTerms/ram:DueDateDateTime/udt:DateTimeString`),
    ),
    buyerReference: text(`${agreement}/ram:BuyerReference`),
    orderReference: text(`${agreement}/ram:BuyerOrderReferencedDocument/ram:IssuerAssignedID`),
    paymentTerms: multiline(`${settlement}/ram:SpecifiedTradePaymentTerms/ram:Description`),
    seller: {
      id: text(`${sellerP}/ram:ID`),
      name: text(`${sellerP}/ram:Name`),
      legalRegistrationId: text(`${sellerP}/ram:SpecifiedLegalOrganization/ram:ID`),
      vatId: text(`${sellerP}/ram:SpecifiedTaxRegistration/ram:ID[@schemeID='VA']`),
      taxNumber: text(`${sellerP}/ram:SpecifiedTaxRegistration/ram:ID[@schemeID='FC']`),
      electronicAddress: electronicAddress(sellerP),
      address: address(sellerP),
      contact: {
        name: text(`${sellerP}/ram:DefinedTradeContact/ram:PersonName`),
        phone: text(`${sellerP}/ram:DefinedTradeContact/ram:TelephoneUniversalCommunication/ram:CompleteNumber`),
        email: text(`${sellerP}/ram:DefinedTradeContact/ram:EmailURIUniversalCommunication/ram:URIID`),
      },
    },
    buyer: {
      name: text(`${buyerP}/ram:Name`),
      electronicAddress: electronicAddress(buyerP),
      address: address(buyerP),
    },
    payment,
    vatExemptions,
    lines,
  };

  const totalsPath = `${settlement}/ram:SpecifiedTradeSettlementHeaderMonetarySummation`;
  const documentTotals = {
    lineTotal: text(`${totalsPath}/ram:LineTotalAmount`),
    taxBasisTotal: text(`${totalsPath}/ram:TaxBasisTotalAmount`),
    taxTotal: text(`${totalsPath}/ram:TaxTotalAmount`),
    grandTotal: text(`${totalsPath}/ram:GrandTotalAmount`),
    duePayable: text(`${totalsPath}/ram:DuePayableAmount`),
  };

  return {
    invoice: InvoiceInput.parse(stripUndefined(raw)),
    documentTotals: DocumentTotals.parse(stripUndefined(documentTotals)),
  };
}

/** zod with exactOptionalPropertyTypes rejects explicit `undefined`; drop those keys. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)]),
    ) as T;
  }
  return value;
}
