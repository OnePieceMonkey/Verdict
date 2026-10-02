import { describe, expect, it } from "vitest";
import { cityFollowsPostcode, EvidenceRoles, shapeProblem } from "./shape.ts";

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
