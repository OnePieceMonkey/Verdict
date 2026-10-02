import { describe, expect, it } from "vitest";
import { checkEvidence } from "./evidence-check.ts";

const pages = [
  "Nordwind Fachverlag GmbH · Hafenstraße 12\nRechnung Nr. R-2026-0042\nDatum: 01.10.2026",
  "IBAN: DE79 0000 0000 1234 5678 90\nGesamtbetrag 1.190,00 EUR",
];

describe("checkEvidence", () => {
  it("accepts a verbatim quote on the cited page", () => {
    expect(checkEvidence(pages, { page: 1, quote: "Rechnung Nr. R-2026-0042" }, "R-2026-0042")).toEqual({ ok: true });
  });

  it("tolerates whitespace, case and line breaks", () => {
    expect(checkEvidence(pages, { page: 1, quote: "rechnung  nr.\nR-2026-0042" }).ok).toBe(true);
    expect(checkEvidence(pages, { page: 2, quote: "IBAN: DE7900000000123456789 0" }).ok).toBe(true);
  });

  it("treats a literal \\n in a quote as a line break", () => {
    expect(checkEvidence(pages, { page: 1, quote: "Rechnung Nr. R-2026-0042\\nDatum: 01.10.2026" }).ok).toBe(true);
  });

  it("rejects quotes from the wrong page", () => {
    expect(checkEvidence(pages, { page: 1, quote: "Gesamtbetrag 1.190,00 EUR" })).toEqual({ ok: false, reason: "quote-not-on-page" });
  });

  it("rejects invented quotes and values that are not inside the quote", () => {
    expect(checkEvidence(pages, { page: 1, quote: "Rechnung Nr. R-2026-0043" }).ok).toBe(false);
    expect(checkEvidence(pages, { page: 1, quote: "Rechnung Nr. R-2026-0042" }, "R-2026-0099")).toEqual({
      ok: false,
      reason: "value-not-in-quote",
    });
  });

  it("rejects pages that do not exist and empty quotes", () => {
    expect(checkEvidence(pages, { page: 3, quote: "x" })).toEqual({ ok: false, reason: "page-out-of-range" });
    expect(checkEvidence(pages, { page: 1, quote: "  " })).toEqual({ ok: false, reason: "empty-quote" });
  });
});
