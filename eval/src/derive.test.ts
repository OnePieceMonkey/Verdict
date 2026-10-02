// CORE-01: derived amounts must reproduce the totals of every in-scope test suite invoice.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { deriveAmounts, readCii } from "@verdict/core";
import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { inScopeInstances } from "./scope.ts";

const same = (a: string | undefined, b: string) =>
  a === undefined ? true : new Decimal(a).equals(new Decimal(b));

// EN 16931 tolerates ±0.01 on VAT amounts (BR-CO-17). Instance 01.06_minimal prints 757.41
// for 3986.34 × 19 % = 757.4046; half-up gives 757.40. Only tax-dependent totals get the tolerance.
const withinCent = (a: string | undefined, b: string) =>
  a === undefined ? true : new Decimal(a).minus(b).abs().lte("0.01");

describe("deriveAmounts against KoSIT test suite", () => {
  for (const file of inScopeInstances()) {
    it(basename(file), () => {
      const { invoice, documentTotals } = readCii(readFileSync(file, "utf8"));
      const d = deriveAmounts(invoice);
      expect(same(documentTotals.lineTotal, d.lineTotal), `BT-106 ${documentTotals.lineTotal} vs ${d.lineTotal}`).toBe(true);
      expect(same(documentTotals.taxBasisTotal, d.taxBasisTotal), "BT-109").toBe(true);
      expect(withinCent(documentTotals.taxTotal, d.taxTotal), `BT-110 ${documentTotals.taxTotal} vs ${d.taxTotal}`).toBe(true);
      expect(withinCent(documentTotals.grandTotal, d.grandTotal), `BT-112 ${documentTotals.grandTotal} vs ${d.grandTotal}`).toBe(true);
      expect(withinCent(documentTotals.duePayable, d.duePayable), "BT-115").toBe(true);
    });
  }
});
