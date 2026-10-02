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
