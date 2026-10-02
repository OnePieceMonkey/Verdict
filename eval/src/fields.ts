import type { InvoiceInput } from "@verdict/core";

/**
 * Flattens an invoice into business-term keys for field-level accuracy.
 * Line fields are keyed by position: "BT-129#2" is the quantity of the third line.
 * Only extracted facts are listed; derived amounts are not compared here.
 */
export function flattenFacts(input: InvoiceInput | unknown): Map<string, string> {
  // Partial models (NEEDS_INPUT) may lack whole sub-objects; read them defensively.
  const inv = withDefaults(input);
  const out = new Map<string, string>();
  const put = (bt: string, v: string | undefined) => {
    if (v !== undefined && v !== "") out.set(bt, normalize(v));
  };
  put("BT-1", inv.number);
  put("BT-2", inv.issueDate);
  put("BT-5", inv.currency);
  put("BT-9", inv.dueDate);
  put("BT-10", inv.buyerReference);
  put("BT-13", inv.orderReference);
  put("BT-20", inv.paymentTerms);

  const s = inv.seller;
  put("BT-27", s.name);
  put("BT-29", s.id);
  put("BT-30", s.legalRegistrationId);
  put("BT-31", s.vatId);
  put("BT-32", s.taxNumber);
  put("BT-34", s.electronicAddress.value);
  put("BT-35", s.address.line1);
  put("BT-36", s.address.line2);
  put("BT-37", s.address.city);
  put("BT-38", s.address.postcode);
  put("BT-40", s.address.countryCode);
  put("BT-41", s.contact.name);
  put("BT-42", s.contact.phone);
  put("BT-43", s.contact.email);

  const b = inv.buyer;
  put("BT-44", b.name);
  put("BT-49", b.electronicAddress.value);
  put("BT-50", b.address.line1);
  put("BT-51", b.address.line2);
  put("BT-52", b.address.city);
  put("BT-53", b.address.postcode);
  put("BT-55", b.address.countryCode);

  put("BT-84", inv.payment?.iban);
  put("BT-85", inv.payment?.accountName);
  for (const e of inv.vatExemptions) {
    put(`BT-120[${e.category}]`, e.reason);
    put(`BT-121[${e.category}]`, e.reasonCode);
  }

  inv.lines.forEach((l, i) => {
    put(`BT-126#${i}`, l.id);
    put(`BT-153#${i}`, l.name);
    put(`BT-129#${i}`, decimal(l.quantity));
    put(`BT-130#${i}`, l.unitCode);
    put(`BT-146#${i}`, decimal(l.netPrice));
    put(`BT-149#${i}`, l.priceBaseQuantity === undefined ? undefined : decimal(l.priceBaseQuantity));
    put(`BT-151#${i}`, l.vatCategory);
    put(`BT-152#${i}`, l.vatRate === undefined ? undefined : decimal(l.vatRate));
  });
  return out;
}

type Deep = InvoiceInput;
function withDefaults(input: unknown): Deep {
  const i = (input ?? {}) as Partial<Deep> & Record<string, unknown>;
  const party = (p: unknown) => {
    const o = (p ?? {}) as Record<string, unknown>;
    return { ...o, electronicAddress: o.electronicAddress ?? {}, address: o.address ?? {}, contact: o.contact ?? {} };
  };
  return { ...i, seller: party(i.seller), buyer: party(i.buyer), vatExemptions: i.vatExemptions ?? [], lines: i.lines ?? [] } as unknown as Deep;
}

/** "BT-129#2" -> "BT-129" for per-term aggregation. */
export const termOf = (key: string): string => key.replace(/[#[].*$/, "");

const normalize = (v: string): string => v.replace(/\s+/g, " ").trim();
/** Compares decimals by value: "1.50" equals "1.5". */
function decimal(v: string): string;
function decimal(v: string | undefined): string | undefined;
function decimal(v: string | undefined): string | undefined {
  if (v === undefined) return undefined;
  const [int, frac = ""] = v.split(".");
  const f = frac.replace(/0+$/, "");
  return f ? `${int}.${f}` : (int ?? v);
}
