import { describe, expect, it } from "vitest";
import { applyPatches, guardPatches, type ProposedPatch } from "./patch-guard.ts";

const pages = ["Kontakt: Jana Wiesner, Tel. +49 30 4411-0\nPos. 1 Fachzeitschrift 2 Stück à 12,50 €\nLeitweg-ID: 04011000-12345-03"];
const p = (path: string, value: string, quote: string, page = 1): ProposedPatch => ({ op: "add", path, value, quote, page });

describe("guardPatches", () => {
  it("accepts evidenced patches and normalizes their values", () => {
    const { accepted, rejected } = guardPatches(
      [
        p("/seller/contact/phone", "+49 30 4411-0", "Tel. +49 30 4411-0"),
        p("/lines/0/unitCode", "Stück", "2 Stück à 12,50 €"),
        p("/lines/0/netPrice", "12,50", "2 Stück à 12,50 €"),
        p("/buyerReference", "04011000-12345-03", "Leitweg-ID: 04011000-12345-03"),
      ],
      pages,
      "de",
    );
    expect(rejected).toEqual([]);
    expect(accepted.map((a) => a.normalized)).toEqual(["+49 30 4411-0", "H87", "12.50", "04011000-12345-03"]);
  });

  it("rejects derived fields, unknown fields, missing and invented quotes", () => {
    const { accepted, rejected } = guardPatches(
      [
        p("/lines/0/netAmount", "25.00", "2 Stück à 12,50 €"),
        p("/typeCode", "381", "Rechnung"),
        p("/seller/favouriteColour", "blau", "Kontakt"),
        p("/seller/contact/email", "jana@example.org", ""),
        p("/seller/contact/email", "jana@example.org", "E-Mail: jana@example.org"),
        p("/payment/iban", "DE79000000001234567890", "Leitweg-ID: 04011000-12345-03"),
      ],
      pages,
      "de",
    );
    expect(accepted).toEqual([]);
    expect(rejected.map((r) => r.reason)).toEqual([
      "derived or fixed field",
      "derived or fixed field",
      "unknown field",
      "no provenance (missing quote)",
      "evidence: quote-not-on-page",
      "evidence: value-not-in-quote",
    ]);
  });
});

describe("applyPatches", () => {
  it("writes normalized values and creates missing objects", () => {
    const model = { seller: { name: "X" }, lines: [{ id: "1" }] };
    const [phone, unit] = guardPatches(
      [p("/seller/contact/phone", "+49 30 4411-0", "Tel. +49 30 4411-0"), p("/lines/0/unitCode", "Stück", "2 Stück")],
      pages,
      "de",
    ).accepted;
    const patched = applyPatches(model, [phone!, unit!]);
    expect(patched).toEqual({ seller: { name: "X", contact: { phone: "+49 30 4411-0" } }, lines: [{ id: "1", unitCode: "H87" }] });
    expect(model).toEqual({ seller: { name: "X" }, lines: [{ id: "1" }] });
  });
});
