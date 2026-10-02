// Pure string formatting for the PDF renderer. Money and quantities stay decimal strings:
// formatting is done by string manipulation so no float artifacts can reach the page.

export type NumberFormat = "de" | "plain";
export type DateFormat = "de" | "iso" | "long";
export type LabelVariant = 0 | 1;

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

/** "1234.5" -> "1.234,5" (de) or "1234.5" (plain). Non-decimal input is returned unchanged. */
export function formatDecimal(value: string, format: NumberFormat): string {
  const m = DECIMAL.exec(value);
  if (!m || format === "plain") return value;
  const [, sign = "", int = "", frac] = m;
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac === undefined ? `${sign}${grouped}` : `${sign}${grouped},${frac}`;
}

/** Monetary amount with currency: "1.234,56 €" (de) or "1234.56 EUR" (plain). */
export function formatAmount(value: string, format: NumberFormat): string {
  return format === "de" ? `${formatDecimal(value, format)} €` : `${value} EUR`;
}

export function formatRate(rate: string, format: NumberFormat): string {
  return `${formatDecimal(rate, format)} %`;
}

const MONTHS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

/** ISO date "2016-04-04" -> "04.04.2016" | "2016-04-04" | "4. April 2016". */
export function formatDate(iso: string, format: DateFormat): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m || format === "iso") return iso;
  const [, y = "", mo = "", d = ""] = m;
  if (format === "de") return `${d}.${mo}.${y}`;
  const month = MONTHS_DE[Number(mo) - 1];
  return month === undefined ? iso : `${Number(d)}. ${month} ${y}`;
}

/** Human labels for common UN/ECE Rec 20/21 unit codes. Unknown codes print as the code only. */
const UNIT_LABELS: Readonly<Record<string, string>> = {
  H87: "Stk.",
  C62: "Stk.",
  XPP: "Stk.",
  EA: "Stk.",
  HUR: "Std.",
  MIN: "Min.",
  DAY: "Tag",
  WEE: "Woche",
  MON: "Monat",
  ANN: "Jahr",
  KGM: "kg",
  GRM: "g",
  TNE: "t",
  MTR: "m",
  CMT: "cm",
  MMT: "mm",
  KMT: "km",
  MTK: "m²",
  MTQ: "m³",
  LTR: "l",
  MLT: "ml",
  KWH: "kWh",
  LS: "pauschal",
  SET: "Set",
  PR: "Paar",
  XBX: "Karton",
  XPK: "Packung",
};

export function unitLabel(code: string): string | undefined {
  return UNIT_LABELS[code];
}

/** "Stk. (H87)" when a label is known, otherwise just the code. The code itself is always printed. */
export function formatUnit(code: string): string {
  const label = unitLabel(code);
  return label === undefined ? code : `${label} (${code})`;
}

export interface Labels {
  readonly title: string;
  readonly number: string;
  readonly issueDate: string;
  readonly dueDate: string;
  readonly buyerReference: string;
  readonly orderReference: string;
  readonly currency: string;
  readonly paymentTerms: string;
  readonly seller: string;
  readonly buyer: string;
  readonly from: string;
  readonly to: string;
  readonly address: string;
  readonly sellerId: string;
  readonly legalRegistrationId: string;
  readonly vatId: string;
  readonly taxNumber: string;
  readonly electronicAddress: string;
  readonly scheme: string;
  readonly contact: string;
  readonly phone: string;
  readonly email: string;
  readonly bank: string;
  readonly iban: string;
  readonly accountName: string;
  readonly exemption: string;
  readonly pos: string;
  readonly name: string;
  readonly quantity: string;
  readonly unit: string;
  readonly price: string;
  readonly vat: string;
  readonly lineAmount: string;
  readonly per: string;
  readonly notTaxable: string;
  readonly vatBreakdown: string;
  readonly vatShort: string;
  readonly taxableBase: string;
  readonly lineTotal: string;
  readonly taxTotal: string;
  readonly grandTotal: string;
  readonly page: string;
  readonly of: string;
}

const LABELS_0: Labels = {
  title: "Rechnung",
  number: "Rechnungsnummer",
  issueDate: "Rechnungsdatum",
  dueDate: "Fälligkeitsdatum",
  buyerReference: "Leitweg-ID / Käuferreferenz",
  orderReference: "Bestellnummer",
  currency: "Währung",
  paymentTerms: "Zahlungsbedingungen",
  seller: "Verkäufer",
  buyer: "Käufer",
  from: "Von",
  to: "An",
  address: "Anschrift",
  sellerId: "Verkäufer-Kennung",
  legalRegistrationId: "Handelsregister",
  vatId: "USt-IdNr.",
  taxNumber: "Steuernummer",
  electronicAddress: "Elektronische Adresse",
  scheme: "Schema",
  contact: "Ansprechpartner",
  phone: "Telefon",
  email: "E-Mail",
  bank: "Bankverbindung",
  iban: "IBAN",
  accountName: "Kontoinhaber",
  exemption: "Grund der Steuerbefreiung",
  pos: "Pos.",
  name: "Bezeichnung",
  quantity: "Menge",
  unit: "Einheit",
  price: "Einzelpreis",
  vat: "USt",
  lineAmount: "Betrag",
  per: "je",
  notTaxable: "nicht steuerbar",
  vatBreakdown: "USt-Aufschlüsselung",
  vatShort: "USt",
  taxableBase: "auf",
  lineTotal: "Summe netto",
  taxTotal: "Umsatzsteuer",
  grandTotal: "Rechnungsbetrag",
  page: "Seite",
  of: "von",
};

const LABELS_1: Labels = {
  title: "Rechnung",
  number: "Rechnung Nr.",
  issueDate: "Datum",
  dueDate: "Zahlbar bis",
  buyerReference: "Käuferreferenz (Leitweg-ID)",
  orderReference: "Ihre Bestellung",
  currency: "Rechnungswährung",
  paymentTerms: "Zahlungskonditionen",
  seller: "Rechnungssteller",
  buyer: "Rechnungsempfänger",
  from: "Absender",
  to: "Empfänger",
  address: "Adresse",
  sellerId: "Lieferanten-ID",
  legalRegistrationId: "Registereintrag",
  vatId: "Umsatzsteuer-ID",
  taxNumber: "St.-Nr.",
  electronicAddress: "E-Rechnungsadresse",
  scheme: "Schema",
  contact: "Kontakt",
  phone: "Tel.",
  email: "Mail",
  bank: "Zahlung an",
  iban: "IBAN",
  accountName: "Zahlungsempfänger",
  exemption: "Hinweis zur Umsatzsteuer",
  pos: "Nr.",
  name: "Leistung",
  quantity: "Anzahl",
  unit: "ME",
  price: "Preis je Einheit",
  vat: "MwSt.",
  lineAmount: "Gesamt",
  per: "je",
  notTaxable: "nicht steuerbar",
  vatBreakdown: "Steueraufstellung",
  vatShort: "MwSt.",
  taxableBase: "auf",
  lineTotal: "Nettobetrag",
  taxTotal: "zzgl. MwSt.",
  grandTotal: "Gesamtbetrag (brutto)",
  page: "Seite",
  of: "von",
};

export function labelsFor(variant: LabelVariant): Labels {
  return variant === 1 ? LABELS_1 : LABELS_0;
}
