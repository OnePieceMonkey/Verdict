import { COUNTRY_CODES, UNIT_CODES, VAT_CATEGORY_CODES } from "./codelists.generated.ts";

/**
 * Deterministic normalization of printed values into EN 16931 code lists and formats (EXT-04).
 * Never guesses: anything ambiguous or unknown returns `{ ok: false }` with a reason, and the
 * field ends up missing (NEEDS_INPUT) instead of carrying an invented value.
 */
export type Normalized = { readonly ok: true; readonly value: string } | { readonly ok: false; readonly reason: string };

const ok = (value: string): Normalized => ({ ok: true, value });
const fail = (reason: string): Normalized => ({ ok: false, reason });
const key = (s: string) => s.trim().toLowerCase().replace(/\.$/, "").replace(/\s+/g, " ");

/** German and English unit words → UN/ECE Rec 20/21 codes. */
const UNIT_WORDS: Readonly<Record<string, string>> = {
  stück: "H87", stk: "H87", st: "H87", piece: "H87", pcs: "H87",
  stunde: "HUR", stunden: "HUR", std: "HUR", h: "HUR", hour: "HUR", hours: "HUR",
  minute: "MIN", minuten: "MIN", min: "MIN",
  tag: "DAY", tage: "DAY", day: "DAY", days: "DAY",
  woche: "WEE", wochen: "WEE",
  monat: "MON", monate: "MON", month: "MON",
  jahr: "ANN", jahre: "ANN", year: "ANN",
  kilogramm: "KGM", kg: "KGM", gramm: "GRM", g: "GRM", tonne: "TNE", t: "TNE",
  meter: "MTR", m: "MTR", kilometer: "KMT", km: "KMT", zentimeter: "CMT", cm: "CMT",
  quadratmeter: "MTK", "m²": "MTK", qm: "MTK", kubikmeter: "MTQ", "m³": "MTQ",
  liter: "LTR", l: "LTR",
  pauschale: "LS", pauschal: "LS", pausch: "LS", "lump sum": "LS",
  einheit: "C62", eh: "C62",
  packung: "XPK", paket: "XPK", karton: "XCT", palette: "XPX", rolle: "XRO", satz: "SET",
};

export function normalizeUnit(raw: string): Normalized {
  const t = raw.trim();
  if (UNIT_CODES.has(t)) return ok(t);
  if (UNIT_CODES.has(t.toUpperCase())) return ok(t.toUpperCase());
  const mapped = UNIT_WORDS[key(t)];
  return mapped ? ok(mapped) : fail(`unknown unit "${raw}"`);
}

const COUNTRY_WORDS: Readonly<Record<string, string>> = {
  deutschland: "DE", germany: "DE", "bundesrepublik deutschland": "DE",
  österreich: "AT", austria: "AT", schweiz: "CH", switzerland: "CH",
  frankreich: "FR", niederlande: "NL", belgien: "BE", luxemburg: "LU", italien: "IT",
  spanien: "ES", polen: "PL", tschechien: "CZ", dänemark: "DK",
};

export function normalizeCountry(raw: string): Normalized {
  const t = raw.trim();
  if (COUNTRY_CODES.has(t.toUpperCase()) && t.length === 2) return ok(t.toUpperCase());
  const mapped = COUNTRY_WORDS[key(t)];
  return mapped ? ok(mapped) : fail(`unknown country "${raw}"`);
}

const VAT_WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/reverse charge|steuerschuldnerschaft des leistungsempfängers|§ ?13b/i, "AE"],
  [/innergemeinschaftliche (lieferung|leistung)|intra-community/i, "K"],
  [/ausfuhr|export/i, "G"],
  [/nicht steuerbar|not subject to vat|außerhalb des anwendungsbereichs/i, "O"],
  [/steuerfrei|umsatzsteuerbefreit|exempt|§ ?4 ustg|§ ?19 ustg|kleinunternehmer/i, "E"],
  [/nullsatz|zero rated/i, "Z"],
];

/**
 * VAT category from a printed code or wording. A bare positive rate without a category
 * means the standard category S; a bare 0 % is ambiguous (Z, E, O, AE, K, G) and fails.
 */
export function normalizeVatCategory(raw: string | undefined, rate?: string): Normalized {
  const t = (raw ?? "").trim();
  if (VAT_CATEGORY_CODES.has(t.toUpperCase()) && t.length <= 2) return ok(t.toUpperCase());
  for (const [re, code] of VAT_WORDS) if (re.test(t)) return ok(code);
  if (rate !== undefined) {
    const r = Number.parseFloat(rate);
    if (r > 0) return ok("S");
    return fail("0 % without a category is ambiguous");
  }
  return fail(`unknown VAT category "${raw ?? ""}"`);
}

export function normalizeCurrency(raw: string): Normalized {
  const t = raw.trim();
  if (/^(eur|€|euro)$/i.test(t)) return ok("EUR");
  return /^[A-Z]{3}$/.test(t) ? ok(t) : fail(`unknown currency "${raw}"`);
}

const MONTHS: Readonly<Record<string, string>> = {
  januar: "01", jänner: "01", februar: "02", märz: "03", april: "04", mai: "05", juni: "06",
  juli: "07", august: "08", september: "09", oktober: "10", november: "11", dezember: "12",
};

export function normalizeDate(raw: string): Normalized {
  const t = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return validDate(m[1]!, m[2]!, m[3]!);
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (m) return validDate(m[3]!, m[2]!.padStart(2, "0"), m[1]!.padStart(2, "0"));
  m = /^(\d{1,2})\.\s*([a-zäöü]+)\s+(\d{4})$/i.exec(t);
  if (m) {
    const month = MONTHS[m[2]!.toLowerCase()];
    if (month) return validDate(m[3]!, month, m[1]!.padStart(2, "0"));
  }
  return fail(`unrecognized date "${raw}"`);
}

function validDate(y: string, mo: string, d: string): Normalized {
  const iso = `${y}-${mo}-${d}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso ? ok(iso) : fail(`invalid date ${iso}`);
}

/**
 * Printed number → decimal string. `format` is the document-wide convention
 * ("de": 1.234,56 ; "plain": 1234.56). Without it, only unambiguous inputs are accepted.
 */
export function normalizeDecimal(raw: string, format?: "de" | "plain"): Normalized {
  let t = raw.trim().replace(/\s|€|eur/gi, "").replace(/^\+/, "");
  const neg = /^-|-$/.test(t);
  t = t.replace(/^-|-$/g, "");
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return fail(`not a number "${raw}"`);

  const hasDot = t.includes(".");
  const hasComma = t.includes(",");
  let normalized: string;
  if (hasDot && hasComma) {
    // The separator that comes last is the decimal separator.
    normalized = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (hasComma) {
    if ((t.match(/,/g) ?? []).length > 1) normalized = t.replace(/,/g, ""); // 1,234,567
    else normalized = t.replace(",", ".");
  } else if (hasDot) {
    const parts = t.split(".");
    const thousandsLike = parts.length > 2 || (parts[1]?.length === 3 && format === "de");
    if (parts.length > 2 && format !== "de") return fail(`ambiguous number "${raw}"`);
    if (parts[1]?.length === 3 && format === undefined) return fail(`ambiguous number "${raw}"`);
    normalized = thousandsLike ? t.replace(/\./g, "") : t;
  } else {
    normalized = t;
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return fail(`not a number "${raw}"`);
  return ok(neg && normalized !== "0" ? `-${normalized}` : normalized);
}
