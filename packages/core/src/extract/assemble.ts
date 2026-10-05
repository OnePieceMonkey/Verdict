import { canonical, checkEvidence } from "../evidence/evidence-check.ts";
import { cityFollowsPostcode, EvidenceRoles, shapeProblem, sharedAddressLosers, type AddressKey } from "../plausibility/shape.ts";
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
  readonly documentTotals: {
    lineTotal?: string | undefined;
    taxTotal?: string | undefined;
    grandTotal?: string | undefined;
    /** Printed line totals by line index (undefined where not printed or not evidenced). */
    lines?: readonly (string | undefined)[] | undefined;
  };
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
  const roles = new EvidenceRoles();

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
    if (!e) return undefined;
    const value = e.value.trim();
    const shape = shapeProblem(path, value);
    if (shape) {
      rejected.push({ path, value, reason: shape });
      return undefined;
    }
    // Line rows share one quote by design; only header/party facts are role-checked.
    const owner = path.startsWith("lines.") ? undefined : roles.claim(path, value, e.quote);
    if (owner) {
      rejected.push({ path, value, reason: `same evidence already used for ${btOf(owner)}` });
      return undefined;
    }
    return accept(path, e, value);
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
  const lost = new Set(sharedAddressLosers(pages, s, b).map(([party, key]) => `${party}.${key}`));
  const other = (prefix: string) => (prefix === "seller" ? "buyer" : "seller");
  /** Address evidence, unless the same printed line belongs to the other party. */
  const own = (prefix: string, key: AddressKey, path: string, ev: Ev): Ev => {
    if (!ev || !lost.has(`${prefix}.${key}`)) return ev;
    rejected.push({ path, value: ev.value, reason: `the quoted line belongs to the ${other(prefix)}'s address` });
    return null;
  };
  const address = (prefix: string, p: RawExtraction["buyer"]) => {
    const a = {
      line1: text(`${prefix}.address.line1`, own(prefix, "street", `${prefix}.address.line1`, p.street)),
      line2: text(`${prefix}.address.line2`, own(prefix, "addressLine2", `${prefix}.address.line2`, p.addressLine2)),
      city: text(`${prefix}.address.city`, own(prefix, "city", `${prefix}.address.city`, p.city)),
      postcode: text(`${prefix}.address.postcode`, own(prefix, "postcode", `${prefix}.address.postcode`, p.postcode)),
      countryCode: norm(`${prefix}.address.countryCode`, p.country, normalizeCountry),
    };
    if (a.city && a.postcode && (a.countryCode ?? "DE") === "DE" && !cityFollowsPostcode(pages, a.postcode, a.city)) {
      rejected.push({ path: `${prefix}.address.city`, value: a.city, reason: "city is not printed next to the postcode" });
      provenance.delete(`${prefix}.address.city`);
      a.city = undefined;
    }
    return a;
  };

  const lines = raw.lines.map((l, i) => {
    const p = `lines.${i}`;
    // Each line value is evidenced by the row quote of its line.
    const rowEv = (v: string | null): Ev => (v === null ? null : { value: v, quote: l.rowQuote, page: l.page });
    const vatRate = norm(`${p}.vatRate`, rowEv(l.vatRate), rate);
    const categoryEv = take(`${p}.vatCategory`, rowEv(l.vatCategory));
    let vatCategory: string | undefined;
    const cat = normalizeVatCategory(categoryEv?.value.replace(/[()]/g, ""), vatRate);
    if (cat.ok) {
      vatCategory = cat.value;
      if (categoryEv) provenance.set(`${p}.vatCategory`, { kind: "evidence", page: categoryEv.page, quote: categoryEv.quote });
      else provenance.set(`${p}.vatCategory`, { kind: "derived", rule: "standard-category-from-positive-rate", inputs: [`${p}.vatRate`] });
    } else if (categoryEv || vatRate !== undefined) {
      rejected.push({ path: `${p}.vatCategory`, value: categoryEv?.value ?? "", reason: cat.reason });
    }
    return {
      id: text(`${p}.id`, rowEv(l.lineId)),
      name: text(`${p}.name`, rowEv(l.name))?.replace(/\\n|\n/g, " ").replace(/\s+/g, " "),
      quantity: norm(`${p}.quantity`, rowEv(l.quantity), dec),
      unitCode: norm(`${p}.unitCode`, rowEv(l.unit), normalizeUnit),
      netPrice: norm(`${p}.netPrice`, rowEv(l.netPrice), dec),
      priceBaseQuantity: norm(`${p}.priceBaseQuantity`, rowEv(l.priceBaseQuantity), dec),
      vatCategory,
      // Category O carries no rate (BR-O-05).
      vatRate: vatCategory === "O" ? undefined : vatRate,
    };
  });

  // Claim evidence for the primary fields first, so a value printed as a name or an
  // electronic address cannot be taken over by a secondary field (reference, account holder).
  const sellerName = text("seller.name", s.name);
  /** A seller identifier (BT-29) that only repeats the company name is not an identifier. */
  const notTheName = (id: string | undefined): string | undefined => {
    if (!id || !sellerName || canonical(id) !== canonical(sellerName)) return id;
    rejected.push({ path: "seller.id", value: id, reason: "repeats the seller name" });
    provenance.delete("seller.id");
    return undefined;
  };
  const buyerName = text("buyer.name", b.name);
  const sellerEa = electronic("seller.electronicAddress.value", own("seller", "electronicAddress", "seller.electronicAddress.value", s.electronicAddress), false);
  const buyerEa = electronic("buyer.electronicAddress.value", own("buyer", "electronicAddress", "buyer.electronicAddress.value", b.electronicAddress), true);
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
      id: notTheName(text("seller.id", s.sellerId)),
      name: sellerName,
      legalRegistrationId: text("seller.legalRegistrationId", s.legalRegistrationId),
      vatId: text("seller.vatId", s.vatId),
      taxNumber: text("seller.taxNumber", s.taxNumber),
      electronicAddress: sellerEa,
      address: address("seller", s),
      contact: {
        name: text("seller.contact.name", s.contactName),
        phone: text("seller.contact.phone", s.contactPhone),
        email: text("seller.contact.email", s.contactEmail),
      },
    },
    buyer: {
      name: buyerName,
      electronicAddress: buyerEa,
      address: address("buyer", b),
    },
    payment: ibanValue
      ? { meansCode: "58", iban: ibanValue, accountName: text("payment.accountName", raw.payment.accountName) }
      : undefined,
    vatExemptions: raw.vatExemptions.flatMap((e, i) => {
      const category = norm(`vatExemptions.${i}.category`, e.category, (v) => normalizeVatCategory(v));
      const reason = text(`vatExemptions.${i}.reason`, e.reason);
      let reasonCode = text(`vatExemptions.${i}.reasonCode`, e.reasonCode)?.replace(/[()]/g, "");
      // BT-121 is a VATEX code; a bare category letter or label is not one.
      if (reasonCode && !/^VATEX-[A-Z0-9-]+$/i.test(reasonCode)) {
        rejected.push({ path: `vatExemptions.${i}.reasonCode`, value: reasonCode, reason: "not a VATEX exemption code" });
        provenance.delete(`vatExemptions.${i}.reasonCode`);
        reasonCode = undefined;
      }
      if (!reason && !reasonCode) return [];
      const fromLines = lines.find((l) => l.vatCategory && l.vatCategory !== "S")?.vatCategory;
      const cat = category ?? fromLines;
      if (!cat) return [];
      if (!category) {
        provenance.set(`vatExemptions.${i}.category`, { kind: "derived", rule: "exemption-category-from-lines", inputs: ["lines"] });
      }
      return [{ category: cat, ...(reason ? { reason } : {}), ...(reasonCode ? { reasonCode } : {}) }];
    }),
    lines,
  };
  // BR-O-10: category O ("not subject to VAT") carries its own exemption code, VATEX-EU-O.
  // It follows from the category alone, so it is derived rather than asked for.
  if (lines.some((l) => l.vatCategory === "O") && !partial.vatExemptions.some((e) => e.category === "O")) {
    const i = partial.vatExemptions.length;
    partial.vatExemptions.push({ category: "O", reasonCode: "VATEX-EU-O" });
    provenance.set(`vatExemptions.${i}.category`, { kind: "derived", rule: "exemption-category-from-lines", inputs: ["lines"] });
    provenance.set(`vatExemptions.${i}.reasonCode`, { kind: "derived", rule: "category-o-exemption-code", inputs: ["lines"] });
  }
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
    lines: raw.lines.map((l, i) =>
      norm(`documentTotals.lines.${i}`, l.lineAmount === null ? null : { value: l.lineAmount, quote: l.rowQuote, page: l.page }, dec),
    ),
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
