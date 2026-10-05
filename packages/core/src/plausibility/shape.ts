import { canonical } from "../evidence/evidence-check.ts";

/**
 * Deterministic shape checks for free-text fields that the validator accepts as any string.
 * They catch role mix-ups such as a postcode extracted as city. Keys are model paths.
 */
const LETTER = /[A-Za-zÄÖÜäöüß]/;
const POSTCODE_CITY_LINE = /^\d{4,5}\s+\S/;

export function shapeProblem(path: string, value: string): string | undefined {
  const v = value.trim();
  if (/\.address\.city$/.test(path)) {
    if (!LETTER.test(v)) return "city without letters";
  } else if (/\.address\.postcode$/.test(path)) {
    if (!/\d/.test(v) || v.length > 10) return "postcode without digits";
  } else if (/\.address\.line[12]$/.test(path)) {
    if (POSTCODE_CITY_LINE.test(v)) return "street line looks like 'postcode city'";
  } else if (/\.vatId$/.test(path)) {
    const id = v.replace(/[\s.-]/g, "");
    if (!/^[A-Z]{2}[0-9A-Z+*]{2,13}$/i.test(id) || !/\d/.test(id)) return "not a VAT identifier";
  } else if (/contact\.email$/.test(path)) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "not an e-mail address";
  } else if (/contact\.phone$/.test(path)) {
    if ((v.match(/\d/g) ?? []).length < 5) return "phone number with fewer than 5 digits";
  } else if (/contact\.name$|\.name$/.test(path) && !/^lines\./.test(path)) {
    if (!LETTER.test(v)) return "name without letters";
  }
  return undefined;
}

/** Kind of a field: the role a value plays, independent of seller/buyer. */
export function fieldKind(path: string): string {
  if (/electronicAddress/.test(path)) return "electronic-address";
  if (/contact\.email$/.test(path)) return "email";
  if (/contact\.name$/.test(path)) return "person-name";
  if (/accountName$/.test(path)) return "account-name";
  if (/(^|\.)name$/.test(path)) return "party-name";
  return path.split(".").at(-1) ?? path;
}

/**
 * One piece of evidence serves one kind of role: the same value with the same quote may not
 * back fields of different kinds (the electronic address is not the contact e-mail, the
 * buyer name is not the buyer reference, the company name is not the account holder).
 * Same-kind reuse is fine: seller and buyer can share a city.
 */
export class EvidenceRoles {
  readonly #used = new Map<string, string>();

  /** Returns the path that already uses this evidence in another role, else claims it. */
  claim(path: string, value: string, quote: string): string | undefined {
    const key = `${canonical(value)}\u0000${canonical(quote)}`;
    const owner = this.#used.get(key);
    if (owner !== undefined && fieldKind(owner) !== fieldKind(path)) return owner;
    if (owner === undefined) this.#used.set(key, path);
    return undefined;
  }
}

/** German addresses print "postcode city"; a city that never follows its postcode was not printed as city. */
export function cityFollowsPostcode(pages: readonly string[], postcode: string, city: string): boolean {
  const text = canonical(pages.join("\n"));
  return text.includes(canonical(`${postcode} ${city}`));
}

type AddressEv = { readonly value: string; readonly quote: string; readonly page: number } | null;
export interface PartyAddressRaw {
  readonly name: AddressEv;
  readonly street: AddressEv;
  readonly addressLine2: AddressEv;
  readonly city: AddressEv;
  readonly postcode: AddressEv;
  readonly electronicAddress: AddressEv;
}
export type AddressKey = "street" | "addressLine2" | "city" | "postcode" | "electronicAddress";
const ADDRESS_KEYS: readonly AddressKey[] = ["street", "addressLine2", "city", "postcode", "electronicAddress"];

/** Index of the first page line (across all pages) that contains the quote's first line. */
function lineIndex(pages: readonly string[], ev: AddressEv): number | undefined {
  if (!ev) return undefined;
  const head = canonical(ev.quote.split(/\n|\\n/)[0] ?? "");
  if (!head) return undefined;
  const lines = pages.flatMap((p) => p.split("\n")).map(canonical);
  const i = lines.findIndex((l) => l.includes(head));
  return i < 0 ? undefined : i;
}

/** How often a text is printed across all pages (canonical comparison). */
export const occurrences = (pages: readonly string[], quote: string): number => {
  const text = canonical(pages.join("\n"));
  const q = canonical(quote);
  if (!q) return 0;
  let n = 0;
  for (let i = text.indexOf(q); i >= 0; i = text.indexOf(q, i + 1)) n++;
  return n;
};

/** Indexes of all page lines that contain the text (canonical), across all pages. */
function linesWith(pages: readonly string[], text: string | undefined): number[] {
  const t = text ? canonical(text) : "";
  if (!t) return [];
  const lines = pages.flatMap((p) => p.split("\n")).map(canonical);
  return lines.flatMap((l, i) => (l.includes(t) ? [i] : []));
}

/** Distance from a line to the nearest printed name or street of a party. */
function distanceToParty(pages: readonly string[], at: number | undefined, p: PartyAddressRaw, anchors: readonly ("name" | "street")[]): number {
  if (at === undefined) return Number.POSITIVE_INFINITY;
  const ls = anchors.flatMap((a) => linesWith(pages, p[a]?.value));
  return ls.length ? Math.min(...ls.map((l) => Math.abs(l - at))) : Number.POSITIVE_INFINITY;
}

/**
 * Seller and buyer may share a city, but not one printed line. A line that is printed once
 * belongs to the party whose name or street is printed closest to it:
 *  - both parties quote the same line, or claim the same value: the farther party loses it;
 *  - only one party claims it, but it sits inside the other party's address block: it loses it.
 * The losing fact then counts as missing instead of copied. Returns the losing [party, key] pairs.
 */
export function sharedAddressLosers(
  pages: readonly string[],
  seller: PartyAddressRaw,
  buyer: PartyAddressRaw,
): readonly (readonly ["seller" | "buyer", AddressKey])[] {
  const losers: (readonly ["seller" | "buyer", AddressKey])[] = [];
  for (const key of ADDRESS_KEYS) {
    // The street is itself an anchor, so it is placed by the party name alone.
    const anchors = key === "street" ? (["name"] as const) : (["name", "street"] as const);
    const s = seller[key];
    const b = buyer[key];
    if (s && b) {
      const sameLine = canonical(s.quote) === canonical(b.quote) && occurrences(pages, s.quote) === 1;
      const sameValue = canonical(s.value) === canonical(b.value) && occurrences(pages, s.value) === 1;
      if (!sameLine && !sameValue) continue;
      const at = lineIndex(pages, sameLine ? s : { ...s, quote: s.value });
      const ds = distanceToParty(pages, at, seller, anchors);
      const db = distanceToParty(pages, at, buyer, anchors);
      if (ds >= db) losers.push(["seller", key]);
      if (db >= ds) losers.push(["buyer", key]);
      continue;
    }
    const mine = s ?? b;
    if (!mine || occurrences(pages, mine.value) !== 1) continue;
    const party = s ? "seller" : "buyer";
    const at = lineIndex(pages, { ...mine, quote: mine.value });
    const own = distanceToParty(pages, at, s ? seller : buyer, anchors);
    const other = distanceToParty(pages, at, s ? buyer : seller, anchors);
    if (other < own) losers.push([party, key]);
  }
  return losers;
}
