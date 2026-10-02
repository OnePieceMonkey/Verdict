import { basename } from "node:path";
import { ciiInstances } from "./testsuite.ts";

/**
 * Test suite instances inside the MVP scope (decided 2026-10-02):
 * commercial invoice 380, EUR, no allowances/charges, no prepaid or rounding amounts,
 * no tax currency, payment by SEPA credit transfer (58) or no payment means.
 * Excluded: 01.17a (rounding), 01.18a (384), 01.19a (PayPal 68), 01.20a (389),
 * 01.21a and 02.0x/03.07a/comprehensive/cvd (allowances, tax currency), 03.01a/03.04a
 * (prepaid), 03.02a/03.03a (card 48), 03.05a (direct debit 59), extension/*.
 */
export const IN_SCOPE = [
  "01.01a-INVOICE_uncefact.xml",
  "01.02a-INVOICE_uncefact.xml",
  "01.03a-INVOICE_uncefact.xml",
  "01.04a-INVOICE_uncefact.xml",
  "01.05a-INVOICE_uncefact.xml",
  "01.06a-INVOICE_uncefact.xml",
  "01.07a-INVOICE_uncefact.xml",
  "01.08a-INVOICE_uncefact.xml",
  "01.09a-INVOICE_uncefact.xml",
  "01.10a-INVOICE_uncefact.xml",
  "01.11a-INVOICE_uncefact.xml",
  "01.12a-INVOICE_uncefact.xml",
  "01.13a-INVOICE_uncefact.xml",
  "01.14a-INVOICE_uncefact.xml",
  "01.15a-INVOICE_uncefact.xml",
  "02.06a-INVOICE_uncefact.xml",
  "03.06a-INVOICE_uncefact.xml",
  "01.05_minimal_test_uncefact.xml",
  "01.06_minimal_test_uncefact.xml",
] as const;

export function inScopeInstances(): string[] {
  const all = ciiInstances();
  return IN_SCOPE.map((name) => {
    const hit = all.find((f) => basename(f) === name);
    if (!hit) throw new Error(`in-scope instance missing from test suite: ${name}`);
    return hit;
  });
}
