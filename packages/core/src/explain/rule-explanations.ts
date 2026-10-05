// Browser-safe: no Node imports, so the web client can import it via "@verdict/core/rule-explanations".

/**
 * EXP-01: plain-language explanations for the validator rules that occur in the corpus and in
 * typical German invoices. Written from the rule texts in the XRechnung 3.0.2 configuration
 * (2026-08-31); the validator's own message is always shown next to it as the source of truth.
 */
export interface RuleExplanation {
  /** What the rule demands, in one or two sentences. */
  readonly en: string;
  readonly de: string;
  /** What has to change on the invoice (or what to enter) to satisfy the rule. */
  readonly fix: string;
}

/** Official specification the table entries are written from. */
export const RULE_SOURCE = {
  title: "XRechnung 3.0.2 validator configuration (KoSIT)",
  url: "https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/tag/v2026-08-31",
} as const;

export const RULE_EXPLANATIONS: Readonly<Record<string, RuleExplanation>> = {
  "BR-02": {
    en: "Every invoice needs an invoice number (BT-1).",
    de: "Jede Rechnung braucht eine Rechnungsnummer (BT-1).",
    fix: "Print the invoice number on the document.",
  },
  "BR-03": {
    en: "Every invoice needs an issue date (BT-2).",
    de: "Jede Rechnung braucht ein Rechnungsdatum (BT-2).",
    fix: "Print the invoice date on the document.",
  },
  "BR-06": {
    en: "The seller's name (BT-27) is mandatory.",
    de: "Der Name des Verkäufers (BT-27) ist Pflicht.",
    fix: "Print the seller's company name.",
  },
  "BR-07": {
    en: "The buyer's name (BT-44) is mandatory.",
    de: "Der Name des Käufers (BT-44) ist Pflicht.",
    fix: "Print the buyer's name.",
  },
  "BR-16": {
    en: "An invoice must contain at least one invoice line (BG-25).",
    de: "Eine Rechnung muss mindestens eine Rechnungsposition (BG-25) enthalten.",
    fix: "List at least one item or service with quantity, unit price and line amount.",
  },
  "BR-62": {
    en: "The seller's electronic address (BT-34) must say which kind of address it is, for example an e-mail address (scheme EM).",
    de: "Die elektronische Adresse des Verkäufers (BT-34) braucht eine Schema-Kennung, zum Beispiel EM für E-Mail.",
    fix: "Provide the seller's electronic address, usually the e-mail address that receives e-invoices.",
  },
  "BR-63": {
    en: "The buyer's electronic address (BT-49) must say which kind of address it is, for example an e-mail address (scheme EM).",
    de: "Die elektronische Adresse des Käufers (BT-49) braucht eine Schema-Kennung, zum Beispiel EM für E-Mail.",
    fix: "Provide the buyer's electronic address, usually the e-mail address that receives e-invoices.",
  },
  "BR-CO-10": {
    en: "The sum of line net amounts (BT-106) must equal the total of all invoice line amounts (BT-131).",
    de: "Die Summe der Nettobeträge (BT-106) muss der Summe aller Positionsbeträge (BT-131) entsprechen.",
    fix: "Check the line amounts; the printed sum does not match them.",
  },
  "BR-CO-13": {
    en: "The total without VAT (BT-109) must equal the line total minus document allowances plus document charges.",
    de: "Der Nettogesamtbetrag (BT-109) muss Positionssumme minus Nachlässe plus Zuschläge auf Belegebene sein.",
    fix: "Check the net total and any document-level discounts or surcharges.",
  },
  "BR-CO-14": {
    en: "The total VAT amount (BT-110) must equal the sum of the VAT amounts per category (BT-117).",
    de: "Die Umsatzsteuer gesamt (BT-110) muss der Summe der Steuerbeträge je Kategorie (BT-117) entsprechen.",
    fix: "Check the VAT breakdown; the categories do not add up to the printed VAT total.",
  },
  "BR-CO-15": {
    en: "The total with VAT (BT-112) must equal the total without VAT (BT-109) plus the total VAT (BT-110).",
    de: "Der Bruttobetrag (BT-112) muss Nettobetrag (BT-109) plus Umsatzsteuer (BT-110) sein.",
    fix: "Check the gross total; it is not net plus VAT.",
  },
  "BR-CO-26": {
    en: "The buyer must be able to identify the seller automatically: at least one of seller identifier (BT-29), registration number (BT-30) or VAT ID (BT-31) is required.",
    de: "Der Käufer muss den Verkäufer automatisch erkennen können: Kennung (BT-29), Registernummer (BT-30) oder USt-IdNr. (BT-31) ist Pflicht.",
    fix: "Print the seller's VAT ID (USt-IdNr.) or commercial register number.",
  },
  "BR-CL-04": {
    en: "The currency must be an ISO 4217 code such as EUR, not a symbol like €.",
    de: "Die Währung muss ein ISO-4217-Code wie EUR sein, kein Symbol wie €.",
    fix: "Verdict maps € and common currency words to ISO codes; if this remains, the printed currency is not one it recognizes.",
  },
  "BR-CL-23": {
    en: "Units of measure must be UN/ECE Recommendation 20 codes (for example H87 for piece, HUR for hour), not words like \"Stück\".",
    de: "Mengeneinheiten müssen Codes nach UN/ECE-Empfehlung 20 sein (etwa H87 für Stück, HUR für Stunde), keine Wörter.",
    fix: "Verdict maps common German unit words to these codes; if this remains, the printed unit is not one it recognizes.",
  },
  "BR-S-02": {
    en: "A line taxed at the standard rate (category S) requires the seller's VAT ID, tax registration or tax representative.",
    de: "Eine Position mit Regelsteuersatz (Kategorie S) verlangt USt-IdNr., Steuernummer oder Fiskalvertreter des Verkäufers.",
    fix: "Print the seller's VAT ID (USt-IdNr.) or tax number (Steuernummer).",
  },
  "BR-S-08": {
    en: "For each standard VAT rate, the taxable amount in the VAT breakdown must equal the sum of the lines at that rate.",
    de: "Je Regelsteuersatz muss die Bemessungsgrundlage der Summe der Positionen mit diesem Satz entsprechen.",
    fix: "Check which lines carry which VAT rate.",
  },
  "BR-S-09": {
    en: "The VAT amount for a standard-rate category must equal its taxable amount times the rate, rounded to two decimals.",
    de: "Der Steuerbetrag je Regelsteuersatz muss Bemessungsgrundlage mal Satz sein, auf zwei Stellen gerundet.",
    fix: "Check the VAT amount; it is not the taxable amount times the rate.",
  },
  "BR-DE-1": {
    en: "An XRechnung must contain payment instructions (BG-16), for example the seller's IBAN for a bank transfer.",
    de: "Eine XRechnung muss Zahlungsanweisungen (BG-16) enthalten, etwa die IBAN des Verkäufers für eine Überweisung.",
    fix: "Enter the IBAN the buyer should pay to.",
  },
  "BR-DE-2": {
    en: "The seller contact group (BG-6) is mandatory in an XRechnung.",
    de: "Die Gruppe Verkäuferkontakt (BG-6) ist in der XRechnung Pflicht.",
    fix: "Provide a contact person, phone number and e-mail address of the seller.",
  },
  "BR-DE-3": {
    en: "The seller's city (BT-37) is mandatory in an XRechnung.",
    de: "Der Ort des Verkäufers (BT-37) ist in der XRechnung Pflicht.",
    fix: "Enter the seller's city.",
  },
  "BR-DE-4": {
    en: "The seller's postcode (BT-38) is mandatory in an XRechnung.",
    de: "Die Postleitzahl des Verkäufers (BT-38) ist in der XRechnung Pflicht.",
    fix: "Enter the seller's postcode.",
  },
  "BR-DE-5": {
    en: "A seller contact point (BT-41), such as a name or department, is mandatory in an XRechnung.",
    de: "Eine Kontaktstelle des Verkäufers (BT-41), etwa Name oder Abteilung, ist in der XRechnung Pflicht.",
    fix: "Enter a contact person or department of the seller.",
  },
  "BR-DE-6": {
    en: "A seller contact phone number (BT-42) is mandatory in an XRechnung.",
    de: "Eine Telefonnummer des Verkäuferkontakts (BT-42) ist in der XRechnung Pflicht.",
    fix: "Enter the seller's phone number.",
  },
  "BR-DE-7": {
    en: "A seller contact e-mail address (BT-43) is mandatory in an XRechnung.",
    de: "Eine E-Mail-Adresse des Verkäuferkontakts (BT-43) ist in der XRechnung Pflicht.",
    fix: "Enter the seller's e-mail address.",
  },
  "BR-DE-8": {
    en: "The buyer's city (BT-52) is mandatory in an XRechnung.",
    de: "Der Ort des Käufers (BT-52) ist in der XRechnung Pflicht.",
    fix: "Enter the buyer's city.",
  },
  "BR-DE-9": {
    en: "The buyer's postcode (BT-53) is mandatory in an XRechnung.",
    de: "Die Postleitzahl des Käufers (BT-53) ist in der XRechnung Pflicht.",
    fix: "Enter the buyer's postcode.",
  },
  "BR-DE-15": {
    en: "The buyer reference (BT-10) is mandatory. For public-sector buyers in Germany this is the Leitweg-ID that routes the invoice to the right office.",
    de: "Die Käuferreferenz (BT-10) ist Pflicht. Bei öffentlichen Auftraggebern ist das die Leitweg-ID.",
    fix: "Enter the Leitweg-ID or the reference the buyer gave you.",
  },
  "BR-DE-21": {
    en: "The specification identifier (BT-24) must name the XRechnung standard.",
    de: "Die Spezifikationskennung (BT-24) muss den XRechnung-Standard benennen.",
    fix: "Nothing to do on the paper invoice; Verdict sets this identifier.",
  },
  "BR-DE-TMP-32": {
    en: "Warning only: an invoice should state the delivery or service date (BT-72) or a service period (BG-14).",
    de: "Nur ein Hinweis: Eine Rechnung sollte ein Liefer-/Leistungsdatum (BT-72) oder einen Leistungszeitraum (BG-14) angeben.",
    fix: "Optional: print the delivery date or service period. The XRechnung is valid without it.",
  },
};
