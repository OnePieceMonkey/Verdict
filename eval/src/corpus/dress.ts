import type { InvoiceInput } from "@verdict/core";

/**
 * Replaces the bracket placeholders of the KoSIT test suite ("[Seller name]", "[…]") with
 * fictional but realistic values, so rendered PDFs read like real invoices.
 * Deterministic: the same invoice index always gets the same values. All names are invented;
 * any resemblance to real organisations is unintended.
 */

const SELLERS = [
  "Nordwind Fachverlag GmbH",
  "Brückner & Söhne Haustechnik KG",
  "Lindenhof Seminare e. V.",
  "Kranich Bürosysteme GmbH",
  "Elbtal Medienservice UG",
  "Hagedorn Laborbedarf GmbH",
  "Weißdorn IT-Dienste GmbH",
  "Auerbach Gebäudereinigung OHG",
] as const;
const BUYERS = [
  "Stadtverwaltung Birkenfeld",
  "Landesamt für Statistik Musterland",
  "Kreisverwaltung Ahornhain",
  "Gemeinde Lerchenau",
  "Zentrale Vergabestelle Eichstedt",
  "Hochschule Tannenberg",
] as const;
const STREETS = ["Hafenstraße 12", "Am Markt 3", "Lindenallee 47", "Industriering 8", "Kirchweg 21", "Bahnhofstraße 5a"] as const;
const LINE2 = ["Gebäude B", "3. OG", "Postfach 1120", "Hinterhaus"] as const;
const CITIES = ["Birkenfeld", "Ahornhain", "Lerchenau", "Eichstedt", "Tannenberg", "Musterstadt"] as const;
const PEOPLE = ["Jana Wiesner", "Tobias Hartung", "Leonie Brandt", "Murat Yilmaz", "Sofia Lehmann", "Paul Neumann"] as const;
const REGISTRATIONS = ["HRB 48213 Amtsgericht Birkenfeld", "HRA 1172 Amtsgericht Eichstedt", "VR 5530 Amtsgericht Tannenberg"] as const;
const ITEMS = ["Fachzeitschrift Verwaltung digital", "Seminar: Vergaberecht kompakt", "Ausgabe 2026", "Jahresabo"] as const;

const pick = <T>(pool: readonly T[], seed: number, salt: number): T => {
  const v = pool[(seed * 7 + salt * 13) % pool.length];
  if (v === undefined) throw new Error("empty pool");
  return v;
};

const isPlaceholder = (s: string | undefined): boolean => s !== undefined && /^\[[^\]]*\]$|^…$|^\[…\]$/.test(s.trim());

/** Replaces inline placeholders inside free text ("Zeitschrift [...]", "bis zum …"). */
function dressText(s: string, seed: number): string {
  return s
    .replace(/\[(?:\.\.\.|…)\]/g, pick(ITEMS, seed, 1))
    .replace(/…/g, pick(ITEMS, seed, 2));
}

export function dressInvoice(invoice: InvoiceInput, seed: number): InvoiceInput {
  const d: InvoiceInput = structuredClone(invoice);
  const seller = pick(SELLERS, seed, 0);

  if (isPlaceholder(d.seller.name)) d.seller.name = seller;
  if (isPlaceholder(d.seller.legalRegistrationId)) d.seller.legalRegistrationId = pick(REGISTRATIONS, seed, 1);
  if (isPlaceholder(d.seller.address.line1)) d.seller.address.line1 = pick(STREETS, seed, 2);
  if (isPlaceholder(d.seller.address.line2)) d.seller.address.line2 = pick(LINE2, seed, 3);
  if (isPlaceholder(d.seller.address.city)) d.seller.address.city = pick(CITIES, seed, 4);
  if (isPlaceholder(d.seller.contact.name)) d.seller.contact.name = pick(PEOPLE, seed, 5);
  if (/\[|…/.test(d.seller.contact.phone)) d.seller.contact.phone = `+49 30 ${4400 + (seed % 90)}${100 + seed}-0`;

  if (isPlaceholder(d.buyer.name)) d.buyer.name = pick(BUYERS, seed, 6);
  if (isPlaceholder(d.buyer.address.line1)) d.buyer.address.line1 = pick(STREETS, seed, 7);
  if (isPlaceholder(d.buyer.address.line2)) d.buyer.address.line2 = pick(LINE2, seed, 8);
  if (isPlaceholder(d.buyer.address.city)) d.buyer.address.city = pick(CITIES, seed, 9);

  if (d.payment && isPlaceholder(d.payment.accountName)) d.payment.accountName = d.seller.name;
  if (d.paymentTerms) d.paymentTerms = dressText(d.paymentTerms, seed);
  for (const line of d.lines) {
    line.id = dressText(line.id, seed);
    line.name = dressText(line.name, seed);
  }
  return d;
}
