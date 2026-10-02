import { checkEvidence } from "../evidence/evidence-check.ts";
import { InvoiceInput, type InvoiceInput as InvoiceInputT } from "../model/invoice.ts";
import {
  normalizeCountry,
  normalizeCurrency,
  normalizeDate,
  normalizeDecimal,
  normalizeUnit,
  normalizeVatCategory,
  type Normalized,
} from "../normalize/normalize.ts";
import type { Ev, EvValue, RawExtraction } from "./schema.ts";

export type Provenance =
  | { readonly kind: "evidence"; readonly page: number; readonly quote: string }
  | { readonly kind: "derived"; readonly rule: string; readonly inputs: readonly string[] }
  | { readonly kind: "user"; readonly enteredAt: string };

export interface RejectedFact {
  readonly path: string;
  readonly value: string;
  readonly reason: string;
}

export interface MissingFact {
  readonly path: string;
  readonly bt: string;
  readonly reason: string;
}

export interface Assembled {
  /** Present when every required fact is available and valid against the model schema. */
  readonly invoice?: InvoiceInputT;
  /** Best-effort model with whatever was found; used for repair and the input form. */
  readonly partial: unknown;
  readonly provenance: ReadonlyMap<string, Provenance>;
  readonly missing: readonly MissingFact[];
  readonly rejected: readonly RejectedFact[];
  readonly documentTotals: { lineTotal?: string | undefined; taxTotal?: string | undefined; grandTotal?: string | undefined };
  readonly numberFormat: "de" | "plain";
}

/** Model path → business term, for NEEDS_INPUT and reports. */
export const PATH_BT: Readonly<Record<string, string>> = {
  number: "BT-1", issueDate: "BT-2", currency: "BT-5", dueDate: "BT-9", buyerReference: "BT-10",
  orderReference: "BT-13", paymentTerms: "BT-20",
  "seller.name": "BT-27", "seller.id": "BT-29", "seller.legalRegistrationId": "BT-30", "seller.vatId": "BT-31",
  "seller.taxNumber": "BT-32", "seller.electronicAddress.value": "BT-34", "seller.address.line1": "BT-35",
  "seller.address.line2": "BT-36", "seller.address.city": "BT-37", "seller.address.postcode": "BT-38",
  "seller.address.countryCode": "BT-40", "seller.contact.name": "BT-41", "seller.contact.phone": "BT-42",
  "seller.contact.email": "BT-43", "buyer.name": "BT-44", "buyer.electronicAddress.value": "BT-49",
  "buyer.address.line1": "BT-50", "buyer.address.line2": "BT-51", "buyer.address.city": "BT-52",
  "buyer.address.postcode": "BT-53", "buyer.address.countryCode": "BT-55", "payment.iban": "BT-84",
  "payment.accountName": "BT-85",
};
const LINE_BT: Readonly<Record<string, string>> = {
  id: "BT-126", name: "BT-153", quantity: "BT-129", unitCode: "BT-130", netPrice: "BT-146",
  priceBaseQuantity: "BT-149", vatCategory: "BT-151", vatRate: "BT-152",
};
export function btOf(path: string): string {
  const line = /^lines\.(\d+)\.(\w+)/.exec(path);
  if (line) return `${LINE_BT[line[2]!] ?? line[2]} (line ${Number(line[1]) + 1})`;
  return PATH_BT[path] ?? path;
}

export function detectNumberFormat(pages: readonly string[]): "de" | "plain" {
  const text = pages.join("\n");
  const de = (text.match(/\d,\d{2}(?!\d)/g) ?? []).length;
  const plain = (text.match(/\d\.\d{2}(?!\d)/g) ?? []).length;
  return de >= plain ? "de" : "plain";
}

/**
 * Turns the raw model output into the semantic model. Each fact passes the evidence check,
 * then deterministic normalization; failures make the fact missing, never invented.
 */
export function assembleInvoice(raw: RawExtraction, pages: readonly string[]): Assembled {
  const numberFormat = detectNumberFormat(pages);
  const provenance = new Map<string, Provenance>();
  const rejected: RejectedFact[] = [];

  /** Evidence-checked raw value, or undefined. */
  const take = (path: string, ev: Ev): EvValue | undefined => {
    if (!ev || ev.value.trim() === "") return undefined;
    const verdict = checkEvidence(pages, { page: ev.page, quote: ev.quote }, ev.value);
    if (!verdict.ok) {
      rejected.push({ path, value: ev.value, reason: verdict.reason });
      return undefined;
    }
    return ev;
  };
  const accept = (path: string, ev: EvValue, value: string): string => {
    provenance.set(path, { kind: "evidence", page: ev.page, quote: ev.quote });
    return value;
  };
  const text = (path: string, ev: Ev): string | undefined => {
    const e = take(path, ev);
    return e ? accept(path, e, e.value.trim()) : undefined;
  };
  const norm = (path: string, ev: Ev, fn: (v: string) => Normalized): string | undefined => {
    const e = take(path, ev);
    if (!e) return undefined;
    const n = fn(e.value);
    if (!n.ok) {
      rejected.push({ path, value: e.value, reason: n.reason });
      return undefined;
    }
    return accept(path, e, n.value);
  };
  const dec = (v: string) => normalizeDecimal(v, numberFormat);
  const rate = (v: string) => normalizeDecimal(v.replace(/%/g, ""), numberFormat);
  const iban = (v: string): Normalized => {
    const t = v.replace(/\s/g, "").toUpperCase();
    return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(t) ? { ok: true, value: t } : { ok: false, reason: "not an IBAN" };
  };
  const electronic = (path: string, ev: Ev, leitwegAllowed: boolean) => {
    const value = text(path, ev);
    if (value === undefined) return undefined;
    // Scheme is derived from the value's shape, not extracted.
    const scheme = /@/.test(value) ? "EM" : leitwegAllowed && /^\d{2,12}(-[A-Z0-9]{1,30})?-\d{2}$/i.test(value) ? "0204" : undefined;
    if (!scheme) {
      rejected.push({ path, value, reason: "unknown electronic address scheme" });
      provenance.delete(path);
      return undefined;
    }
    provenance.set(path.replace(/value$/, "scheme"), { kind: "derived", rule: "electronic-address-scheme-from-format", inputs: [path] });
    return { scheme, value };
  };

  const { header: h, seller: s, buyer: b } = raw;
  const address = (prefix: string, p: RawExtraction["buyer"]) => ({
    line1: text(`${prefix}.address.line1`, p.street),
    line2: text(`${prefix}.address.line2`, p.addressLine2),
    city: text(`${prefix}.address.city`, p.city),
    postcode: text(`${prefix}.address.postcode`, p.postcode),
    countryCode: norm(`${prefix}.address.countryCode`, p.country, normalizeCountry),
  });

  const lines = raw.lines.map((l, i) => {
    const p = `lines.${i}`;
    const vatRate = norm(`${p}.vatRate`, l.vatRate, rate);
    const categoryEv = take(`${p}.vatCategory`, l.vatCategory);
    let vatCategory: string | undefined;
    const cat = normalizeVatCategory(categoryEv?.value, vatRate);
    if (cat.ok) {
      vatCategory = cat.value;
      if (categoryEv) provenance.set(`${p}.vatCategory`, { kind: "evidence", page: categoryEv.page, quote: categoryEv.quote });
      else provenance.set(`${p}.vatCategory`, { kind: "derived", rule: "standard-category-from-positive-rate", inputs: [`${p}.vatRate`] });
    } else if (categoryEv || vatRate !== undefined) {
      rejected.push({ path: `${p}.vatCategory`, value: categoryEv?.value ?? "", reason: cat.reason });
    }
    return {
      id: text(`${p}.id`, l.lineId),
      name: text(`${p}.name`, l.name),
      quantity: norm(`${p}.quantity`, l.quantity, dec),
      unitCode: norm(`${p}.unitCode`, l.unit, normalizeUnit),
      netPrice: norm(`${p}.netPrice`, l.netPrice, dec),
      priceBaseQuantity: norm(`${p}.priceBaseQuantity`, l.priceBaseQuantity, dec),
      vatCategory,
      // Category O carries no rate (BR-O-05).
      vatRate: vatCategory === "O" ? undefined : vatRate,
    };
  });

  const ibanValue = norm("payment.iban", raw.payment.iban, iban);
  const partial = {
    number: text("number", h.invoiceNumber),
    issueDate: norm("issueDate", h.issueDate, normalizeDate),
    typeCode: "380",
    currency: norm("currency", h.currency, normalizeCurrency) ?? currencyFromAmounts(pages, provenance),
    dueDate: norm("dueDate", h.dueDate, normalizeDate),
    buyerReference: text("buyerReference", h.buyerReference),
    orderReference: text("orderReference", h.orderReference),
    paymentTerms: text("paymentTerms", h.paymentTerms)?.replace(/\\n/g, "\n"),
    seller: {
      id: text("seller.id", s.sellerId),
      name: text("seller.name", s.name),
      legalRegistrationId: text("seller.legalRegistrationId", s.legalRegistrationId),
      vatId: text("seller.vatId", s.vatId),
      taxNumber: text("seller.taxNumber", s.taxNumber),
      electronicAddress: electronic("seller.electronicAddress.value", s.electronicAddress, false),
      address: address("seller", s),
      contact: {
        name: text("seller.contact.name", s.contactName),
        phone: text("seller.contact.phone", s.contactPhone),
        email: text("seller.contact.email", s.contactEmail),
      },
    },
    buyer: {
      name: text("buyer.name", b.name),
      electronicAddress: electronic("buyer.electronicAddress.value", b.electronicAddress, true),
      address: address("buyer", b),
    },
    payment: ibanValue
      ? { meansCode: "58", iban: ibanValue, accountName: text("payment.accountName", raw.payment.accountName) }
      : undefined,
    vatExemptions: raw.vatExemptions.flatMap((e, i) => {
      const category = norm(`vatExemptions.${i}.category`, e.category, (v) => normalizeVatCategory(v));
      const reason = text(`vatExemptions.${i}.reason`, e.reason);
      if (!reason) return [];
      const fromLines = lines.find((l) => l.vatCategory && l.vatCategory !== "S")?.vatCategory;
      const cat = category ?? fromLines;
      if (!cat) return [];
      if (!category) {
        provenance.set(`vatExemptions.${i}.category`, { kind: "derived", rule: "exemption-category-from-lines", inputs: ["lines"] });
      }
      return [{ category: cat, reason }];
    }),
    lines,
  };
  if (partial.payment) provenance.set("payment.meansCode", { kind: "derived", rule: "credit-transfer-from-iban", inputs: ["payment.iban"] });
  provenance.set("typeCode", { kind: "derived", rule: "mvp-commercial-invoice", inputs: [] });

  const cleaned = stripUndefined(partial);
  const parsed = InvoiceInput.safeParse(cleaned);
  const missing: MissingFact[] = parsed.success
    ? []
    : parsed.error.issues.map((i) => {
        const path = i.path.join(".");
        return { path, bt: btOf(path), reason: rejected.find((r) => r.path === path)?.reason ?? "not found on the document" };
      });

  const totals = raw.documentTotals;
  const documentTotals = stripUndefined({
    lineTotal: norm("documentTotals.lineTotal", totals.lineTotal, dec),
    taxTotal: norm("documentTotals.taxTotal", totals.taxTotal, dec),
    grandTotal: norm("documentTotals.grandTotal", totals.grandTotal, dec),
  });

  return {
    ...(parsed.success ? { invoice: parsed.data } : {}),
    partial: cleaned,
    provenance,
    missing,
    rejected,
    documentTotals,
    numberFormat,
  };
}

/** Amounts printed with € or EUR imply the currency; without either sign it stays missing. */
function currencyFromAmounts(pages: readonly string[], provenance: Map<string, Provenance>): string | undefined {
  if (!/€|\bEUR\b/.test(pages.join("\n"))) return undefined;
  provenance.set("currency", { kind: "derived", rule: "eur-sign-on-document", inputs: [] });
  return "EUR";
}

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
