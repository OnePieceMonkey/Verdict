import { describe, expect, it } from "vitest";
import { cityFollowsPostcode, EvidenceRoles, shapeProblem, sharedAddressLosers } from "./shape.ts";

describe("shapeProblem", () => {
  it("rejects a postcode extracted as city and a 'postcode city' line as street", () => {
    expect(shapeProblem("seller.address.city", "12345")).toBe("city without letters");
    expect(shapeProblem("buyer.address.line1", "12345 Eichstedt")).toMatch(/postcode city/);
    expect(shapeProblem("seller.address.city", "Eichstedt")).toBeUndefined();
    expect(shapeProblem("buyer.address.line1", "Am Markt 3")).toBeUndefined();
  });
  it("checks e-mail and phone shapes", () => {
    expect(shapeProblem("seller.contact.email", "Jana Wiesner")).toBe("not an e-mail address");
    expect(shapeProblem("seller.contact.phone", "Tel.")).toMatch(/fewer than 5 digits/);
    expect(shapeProblem("seller.contact.email", "jana@example.org")).toBeUndefined();
  });
});

describe("cityFollowsPostcode", () => {
  it("accepts 'postcode city' and rejects a city taken from elsewhere", () => {
    const pages = ["Stadtverwaltung Birkenfeld\nAm Markt 3\n12345\nDE", "Seller · 12345 Tannenberg"];
    expect(cityFollowsPostcode(pages, "12345", "Tannenberg")).toBe(true);
    expect(cityFollowsPostcode(pages, "12345", "Birkenfeld")).toBe(false);
  });
});

describe("EvidenceRoles", () => {
  it("lets one value+quote back only one field", () => {
    const roles = new EvidenceRoles();
    const quote = "Elektronische Adresse: seller@email.de (Schema: EM)";
    expect(roles.claim("seller.electronicAddress.value", "seller@email.de", quote)).toBeUndefined();
    expect(roles.claim("seller.contact.email", "seller@email.de", quote)).toBe("seller.electronicAddress.value");
    expect(roles.claim("seller.contact.email", "seller@email.de", "E-Mail: seller@email.de")).toBeUndefined();
  });
  it("allows the same kind of field to share evidence", () => {
    const roles = new EvidenceRoles();
    expect(roles.claim("seller.address.city", "Testhausen", "12345 Testhausen")).toBeUndefined();
    expect(roles.claim("buyer.address.city", "Testhausen", "12345 Testhausen")).toBeUndefined();
    expect(roles.claim("buyerReference", "Stadtverwaltung Birkenfeld", "Stadtverwaltung Birkenfeld")).toBeUndefined();
    expect(roles.claim("buyer.name", "Stadtverwaltung Birkenfeld", "Stadtverwaltung Birkenfeld")).toBe("buyerReference");
  });
});

describe("shapeProblem for address lines and seller IDs", () => {
  it("rejects a country printed as an address line and a VAT ID as seller identifier", () => {
    expect(shapeProblem("buyer.address.line2", "DE")).toBe("country printed as an address line");
    expect(shapeProblem("seller.address.line2", "Gebäude B")).toBeUndefined();
    expect(shapeProblem("seller.id", "ATU123456789")).toBe("a VAT ID is not a seller identifier");
    expect(shapeProblem("seller.id", "4000001123452")).toBeUndefined();
    expect(shapeProblem("buyerReference", "Elektronische Adresse: buyer@info.de (Schema: EM)")).toBe(
      "an e-mail address is not a buyer reference",
    );
    expect(shapeProblem("buyerReference", "04011000-12345-03")).toBeUndefined();
    expect(shapeProblem("seller.address.city", "DE")).toBe("a country is not a city");
  });
});

describe("shapeProblem for VAT identifiers", () => {
  it("accepts real VAT IDs and rejects a bare country code or a name", () => {
    expect(shapeProblem("seller.vatId", "DE 123456789")).toBeUndefined();
    expect(shapeProblem("seller.vatId", "ATU123456789")).toBeUndefined();
    expect(shapeProblem("seller.vatId", "DE")).toBe("not a VAT identifier");
    expect(shapeProblem("seller.vatId", "Lindenhof Seminare e. V.")).toBe("not a VAT identifier");
  });
});

describe("sharedAddressLosers", () => {
  const ev = (value: string, quote: string) => ({ value, quote, page: 1 });
  const party = (
    o: Partial<Record<"name" | "street" | "addressLine2" | "city" | "postcode" | "electronicAddress", ReturnType<typeof ev> | null>>,
  ) => ({ name: null, street: null, addressLine2: null, city: null, postcode: null, electronicAddress: null, ...o });

  it("gives a line printed once to the party whose street sits right above it", () => {
    // The seller's city is not printed; both parties share postcode 12345.
    const page = [
      "Brückner KG",
      "Brückner KG · Postfach 123456 · 12345 · DE",
      "Landesamt für Statistik",
      "Lindenallee 47",
      "12345 Tannenberg",
      "DE",
    ].join("\n");
    const seller = party({
      street: ev("Postfach 123456", "Brückner KG · Postfach 123456 · 12345 · DE"),
      city: ev("Tannenberg", "12345 Tannenberg"),
      postcode: ev("12345", "12345 Tannenberg"),
    });
    const buyer = party({
      street: ev("Lindenallee 47", "Lindenallee 47"),
      city: ev("Tannenberg", "12345 Tannenberg"),
      postcode: ev("12345", "12345 Tannenberg"),
    });
    expect(sharedAddressLosers([page], seller, buyer)).toEqual([
      ["seller", "city"],
      ["seller", "postcode"],
    ]);
  });

  it("lets both parties keep a city that is printed in both address blocks", () => {
    const page = ["Muster GmbH", "Industriestr. 1", "12345 Musterstadt", "Stadtwerke", "Am Markt 3", "12345 Musterstadt"].join("\n");
    const seller = party({ street: ev("Industriestr. 1", "Industriestr. 1"), city: ev("Musterstadt", "12345 Musterstadt") });
    const buyer = party({ street: ev("Am Markt 3", "Am Markt 3"), city: ev("Musterstadt", "12345 Musterstadt") });
    expect(sharedAddressLosers([page], seller, buyer)).toEqual([]);
  });

  it("takes the line from both parties when it cannot tell whose it is", () => {
    const page = ["12345 Musterstadt"].join("\n");
    const seller = party({ city: ev("Musterstadt", "12345 Musterstadt") });
    const buyer = party({ city: ev("Musterstadt", "12345 Musterstadt") });
    expect(sharedAddressLosers([page], seller, buyer)).toEqual([
      ["seller", "city"],
      ["buyer", "city"],
    ]);
  });

  it("does not hand the buyer's electronic address to the seller", () => {
    const page = [
      "Muster GmbH · Industriestr. 1 · 12345 Musterstadt",
      "Stadtwerke Birkenfeld",
      "Am Markt 3",
      "54321 Birkenfeld",
      "Elektronische Adresse: buyer@info.de (Schema: EM)",
    ].join("\n");
    const seller = party({ street: ev("Industriestr. 1", "Muster GmbH · Industriestr. 1 · 12345 Musterstadt"), electronicAddress: ev("buyer@info.de", "buyer@info.de") });
    const buyer = party({ street: ev("Am Markt 3", "Am Markt 3"), electronicAddress: ev("buyer@info.de", "Elektronische Adresse: buyer@info.de (Schema: EM)") });
    expect(sharedAddressLosers([page], seller, buyer)).toEqual([["seller", "electronicAddress"]]);
  });

  it("takes a once-printed line from the party that claims it when it sits in the other's block", () => {
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
      "Elektronische Adresse: seller@firma.de (Schema: EM)",
    ].join("\n");
    const seller = party({
      name: ev("Brückner KG", "Brückner KG"),
      street: ev("Postfach 123456", "Postfach 123456"),
      electronicAddress: ev("buyer@info.de", "Elektronische Adresse: buyer@info.de (Schema: EM)"),
    });
    const buyer = party({ name: ev("Landesamt für Statistik", "Landesamt für Statistik"), street: ev("Lindenallee 47", "Lindenallee 47") });
    expect(sharedAddressLosers([page], seller, buyer)).toEqual([["seller", "electronicAddress"]]);
    // The seller's own address in the footer stays the seller's.
    const own = party({ ...seller, electronicAddress: ev("seller@firma.de", "Elektronische Adresse: seller@firma.de (Schema: EM)") });
    expect(sharedAddressLosers([page], own, buyer)).toEqual([]);
  });
});
