import { describe, expect, it } from "vitest";
import {
  normalizeCountry,
  normalizeCurrency,
  normalizeDate,
  normalizeDecimal,
  normalizeUnit,
  normalizeVatCategory,
  type Normalized,
} from "./normalize.ts";

const value = (n: Normalized) => (n.ok ? n.value : undefined);

describe("normalizeUnit", () => {
  it("passes valid UN/ECE codes through", () => {
    expect(value(normalizeUnit("H87"))).toBe("H87");
    expect(value(normalizeUnit("XPP"))).toBe("XPP");
    expect(value(normalizeUnit("hur"))).toBe("HUR");
  });
  it("maps German unit words", () => {
    expect(value(normalizeUnit("Stück"))).toBe("H87");
    expect(value(normalizeUnit("Stk."))).toBe("H87");
    expect(value(normalizeUnit("Stunde"))).toBe("HUR");
    expect(value(normalizeUnit("Pauschale"))).toBe("LS");
  });
  it("refuses unknown units instead of guessing", () => {
    expect(normalizeUnit("Fass voll").ok).toBe(false);
  });
});

describe("normalizeVatCategory", () => {
  it("accepts codes and German wording", () => {
    expect(value(normalizeVatCategory("S"))).toBe("S");
    expect(value(normalizeVatCategory("Steuerschuldnerschaft des Leistungsempfängers"))).toBe("AE");
    expect(value(normalizeVatCategory("nicht steuerbar"))).toBe("O");
    expect(value(normalizeVatCategory("steuerfrei nach § 4 UStG"))).toBe("E");
  });
  it("derives S from a positive rate but refuses a bare 0 %", () => {
    expect(value(normalizeVatCategory(undefined, "19"))).toBe("S");
    expect(normalizeVatCategory(undefined, "0").ok).toBe(false);
  });
});

describe("normalizeDate", () => {
  it("handles German, ISO and long formats", () => {
    expect(value(normalizeDate("04.04.2016"))).toBe("2016-04-04");
    expect(value(normalizeDate("4.4.2016"))).toBe("2016-04-04");
    expect(value(normalizeDate("2016-04-04"))).toBe("2016-04-04");
    expect(value(normalizeDate("4. April 2016"))).toBe("2016-04-04");
    expect(value(normalizeDate("1. März 2026"))).toBe("2026-03-01");
  });
  it("rejects impossible dates", () => {
    expect(normalizeDate("31.02.2026").ok).toBe(false);
  });
});

describe("normalizeDecimal", () => {
  it("parses German and plain formats", () => {
    expect(value(normalizeDecimal("1.234,56"))).toBe("1234.56");
    expect(value(normalizeDecimal("1234,56"))).toBe("1234.56");
    expect(value(normalizeDecimal("1234.56"))).toBe("1234.56");
    expect(value(normalizeDecimal("1,234.56"))).toBe("1234.56");
    expect(value(normalizeDecimal("-12,50 €"))).toBe("-12.50");
  });
  it("uses the document format for 1.234", () => {
    expect(value(normalizeDecimal("1.234", "de"))).toBe("1234");
    expect(value(normalizeDecimal("1.234", "plain"))).toBe("1.234");
    expect(normalizeDecimal("1.234").ok).toBe(false);
  });
});

describe("country and currency", () => {
  it("normalizes", () => {
    expect(value(normalizeCountry("Deutschland"))).toBe("DE");
    expect(value(normalizeCountry("de"))).toBe("DE");
    expect(value(normalizeCurrency("€"))).toBe("EUR");
    expect(normalizeCountry("Atlantis").ok).toBe(false);
  });
});
