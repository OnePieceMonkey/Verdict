import { Decimal } from "decimal.js";
import type { InvoiceInput, VatCategory } from "../model/invoice.ts";

/** EN 16931 amounts carry two decimals; half-up is the common commercial rounding. */
const money = (d: Decimal): Decimal => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export interface DerivedLine {
  readonly lineId: string;
  /** BT-131 = BT-129 × BT-146 / BT-149, rule "line-net-amount" */
  readonly netAmount: string;
}

export interface VatBreakdown {
  readonly category: VatCategory; // BT-118
  readonly rate: string; // BT-119, "0" for category O (XRechnung BR-DE-14 requires it)
  readonly taxableAmount: string; // BT-116
  readonly taxAmount: string; // BT-117
}

export interface DerivedAmounts {
  readonly lines: readonly DerivedLine[];
  readonly vatBreakdown: readonly VatBreakdown[];
  readonly lineTotal: string; // BT-106
  readonly taxBasisTotal: string; // BT-109
  readonly taxTotal: string; // BT-110
  readonly grandTotal: string; // BT-112
  readonly duePayable: string; // BT-115
}

/** Names of the deterministic rules, recorded as provenance of derived fields. */
export const DERIVATION_RULES = {
  lineNet: "line-net-amount",
  vatTaxable: "vat-category-taxable-sum",
  vatTax: "vat-category-tax-amount",
  lineTotal: "sum-line-net-amounts",
  taxBasisTotal: "tax-basis-equals-line-total",
  taxTotal: "sum-vat-category-tax",
  grandTotal: "tax-basis-plus-tax",
  duePayable: "due-equals-grand-total",
} as const;

/**
 * Computes every amount of the invoice from line facts. The MVP has no document-level
 * allowances/charges, prepaid amounts or rounding amounts, so BT-109 = BT-106 and
 * BT-115 = BT-112.
 */
export function deriveAmounts(invoice: InvoiceInput): DerivedAmounts {
  const lines = invoice.lines.map((l) => {
    const base = l.priceBaseQuantity ? new Decimal(l.priceBaseQuantity) : new Decimal(1);
    const net = money(new Decimal(l.quantity).mul(l.netPrice).div(base));
    return { lineId: l.id, net, category: l.vatCategory, rate: l.vatRate };
  });

  // Group by (category, rate); keep first-seen order so output is stable.
  const groups = new Map<string, { category: VatCategory; rate: string | undefined; taxable: Decimal }>();
  for (const l of lines) {
    const rate = l.rate === undefined ? undefined : new Decimal(l.rate).toString();
    const key = `${l.category}|${rate ?? ""}`;
    const g = groups.get(key) ?? { category: l.category, rate, taxable: new Decimal(0) };
    g.taxable = g.taxable.add(l.net);
    groups.set(key, g);
  }

  const vatBreakdown = [...groups.values()].map((g) => {
    const rate = g.rate ?? "0";
    const tax = money(g.taxable.mul(rate).div(100));
    return {
      category: g.category,
      rate,
      taxableAmount: money(g.taxable).toFixed(2),
      taxAmount: tax.toFixed(2),
    };
  });

  const lineTotal = lines.reduce((s, l) => s.add(l.net), new Decimal(0));
  const taxTotal = vatBreakdown.reduce((s, v) => s.add(v.taxAmount), new Decimal(0));
  const grandTotal = lineTotal.add(taxTotal);

  return {
    lines: lines.map((l) => ({ lineId: l.lineId, netAmount: l.net.toFixed(2) })),
    vatBreakdown,
    lineTotal: lineTotal.toFixed(2),
    taxBasisTotal: lineTotal.toFixed(2),
    taxTotal: taxTotal.toFixed(2),
    grandTotal: grandTotal.toFixed(2),
    duePayable: grandTotal.toFixed(2),
  };
}
