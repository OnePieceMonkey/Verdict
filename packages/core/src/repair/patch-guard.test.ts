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

describe("guardPatches across parties", () => {
  const page = ["Stadtwerke Birkenfeld", "Am Markt 3", "54321 Birkenfeld", "Elektronische Adresse: buyer@info.de (Schema: EM)"].join("\n");
  const existing = {
    provenance: new Map([["buyer.electronicAddress.value", { kind: "evidence" as const, page: 1, quote: "Elektronische Adresse: buyer@info.de" }]]),
    valueOf: (path: string) => (path === "buyer.electronicAddress.value" ? "buyer@info.de" : undefined),
  };

  it("does not give the buyer's once-printed electronic address to the seller", () => {
    const { accepted, rejected } = guardPatches(
      [p("/seller/electronicAddress/value", "buyer@info.de", "buyer@info.de")],
      [page],
      "de",
      existing,
    );
    expect(accepted).toEqual([]);
    expect(rejected[0]?.reason).toBe("printed once and already used for the buyer");
  });
});

describe("guardPatches against the other party's block", () => {
  it("refuses the buyer's once-printed address for the seller even when the buyer has none yet", () => {
    const page = [
      "Brückner KG · Postfach 123456 · 12345 · DE",
      "Landesamt für Statistik",
      "Lindenallee 47",
      "12345 Tannenberg",
      "Elektronische Adresse: buyer@info.de (Schema: EM)",
      "Rechnungsnummer R1",
      "Rechnungsdatum 18.01.2016",
      "Pos. Bezeichnung Menge Einheit Einzelpreis USt Betrag",
      "1 Wartung 2 Stk. 10,00 € 19 % (S) 20,00 €",
      "Rechnungsbetrag 23,80 €",
      "Brückner KG",
      "Postfach 123456",
    ].join("\n");
    const values: Record<string, string> = {
      "seller.name": "Brückner KG",
      "seller.address.line1": "Postfach 123456",
      "buyer.name": "Landesamt für Statistik",
      "buyer.address.line1": "Lindenallee 47",
    };
    const quotes: Record<string, string> = {
      "seller.name": "Brückner KG",
      "seller.address.line1": "Postfach 123456",
      "buyer.name": "Landesamt für Statistik",
      "buyer.address.line1": "Lindenallee 47",
    };
    const existing = {
      provenance: new Map(Object.keys(values).map((k) => [k, { kind: "evidence" as const, page: 1, quote: quotes[k]! }])),
      valueOf: (path: string) => values[path],
    };
    const { accepted, rejected } = guardPatches(
      [p("/seller/electronicAddress/value", "buyer@info.de", "Elektronische Adresse: buyer@info.de (Schema: EM)")],
      [page],
      "de",
      existing,
    );
    expect(accepted).toEqual([]);
    expect(rejected[0]?.reason).toBe("printed inside the buyer's address block");
  });
});

describe("guardPatches for the buyer reference", () => {
  it("refuses a party name as buyer reference", () => {
    const existing = {
      provenance: new Map([["buyer.name", { kind: "evidence" as const, page: 1, quote: "Stadtverwaltung Birkenfeld" }]]),
      valueOf: (path: string) => (path === "buyer.name" ? "Stadtverwaltung Birkenfeld" : undefined),
    };
    const { rejected } = guardPatches(
      [p("/buyerReference", "Stadtverwaltung Birkenfeld", "Stadtverwaltung Birkenfeld")],
      ["Stadtverwaltung Birkenfeld\nAm Markt 3"],
      "de",
      existing,
    );
    expect(rejected[0]?.reason).toBe("a party name is not a buyer reference");
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
