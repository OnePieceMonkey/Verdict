// Deterministic PDF renderer for synthetic corpus invoices. The output carries every value
// as real text (standard Helvetica, WinAnsi), so the extraction step can quote it verbatim
// from the text layer. Same input -> byte-identical PDF.

import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import type { DerivedAmounts, InvoiceInput } from "@verdict/core";
import { buildFacts, type PrintedAmounts } from "./facts.ts";
import { LAYOUTS } from "./layouts.ts";
import { Pen } from "./pen.ts";

export type { PrintedAmounts } from "./facts.ts";
export { formatAmount, formatDate, formatDecimal, labelsFor, type Labels } from "./format.ts";

export type LayoutId = "classic" | "modern" | "compact";

export interface NoiseOptions {
  /** de: 1.234,56 (default); plain: 1234.56 */
  numberFormat?: "de" | "plain";
  /** de: 04.04.2016 (default); iso: 2016-04-04; long: 4. April 2016 */
  dateFormat?: "de" | "iso" | "long";
  /** Alternative German label wording, e.g. "Rechnungsnummer" vs "Rechnung Nr." */
  labelVariant?: 0 | 1;
  /** Reorder the header blocks (seller/buyer/meta) to change the text-layer order. */
  shuffleBlocks?: boolean;
  /** ~7pt body text. */
  smallFont?: boolean;
  /** Force the line table onto page 2. */
  splitPages?: boolean;
}

export interface RenderOptions {
  layout: LayoutId;
  noise?: NoiseOptions;
  /** What is printed; defaults to the derived amounts. */
  printed?: PrintedAmounts;
}

const BASE_FONT: Readonly<Record<LayoutId, number>> = { classic: 9, modern: 9.5, compact: 8 };
const PRODUCER = "verdict-eval invoice renderer";

export function printedFromDerived(amounts: DerivedAmounts): PrintedAmounts {
  return {
    lineNet: amounts.lines.map((l) => l.netAmount),
    vatBreakdown: amounts.vatBreakdown.map((v) => ({
      category: v.category,
      rate: v.rate,
      taxableAmount: v.taxableAmount,
      taxAmount: v.taxAmount,
    })),
    lineTotal: amounts.lineTotal,
    taxTotal: amounts.taxTotal,
    grandTotal: amounts.grandTotal,
  };
}

/** Fixed timestamp: the issue date at 00:00 UTC, or the epoch when the date is missing. */
function fixedDate(invoice: InvoiceInput): Date {
  const iso = typeof invoice.issueDate === "string" ? invoice.issueDate : "";
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export async function renderInvoicePdf(
  invoice: InvoiceInput,
  amounts: DerivedAmounts,
  opts: RenderOptions,
): Promise<Buffer> {
  const noise = opts.noise ?? {};
  const printed = opts.printed ?? printedFromDerived(amounts);
  const facts = buildFacts(invoice, printed, {
    numberFormat: noise.numberFormat ?? "de",
    dateFormat: noise.dateFormat ?? "de",
    labelVariant: noise.labelVariant ?? 0,
  });

  const date = fixedDate(invoice);
  const doc = new PDFDocument({
    size: "A4",
    // Small bottom margin: layouts manage page breaks themselves; PDFKit must never auto-break.
    margins: { top: 20, left: 20, right: 20, bottom: 4 },
    bufferPages: true,
    // No Flate: deflate output may differ between zlib builds (Node 22 in CI vs. local), which
    // would break byte identity across machines. Uncompressed invoices stay around 10-20 KB.
    compress: false,
    info: { Title: "Rechnung", Producer: PRODUCER, Creator: PRODUCER, CreationDate: date, ModDate: date },
  });

  // PDFKit derives the trailer /ID from the info dictionary only, so two different invoices
  // with the same issue date would share an ID. Use a content hash instead (still deterministic).
  const id = createHash("sha256")
    .update(JSON.stringify({ invoice, printed, layout: opts.layout, noise }))
    .digest()
    .subarray(0, 16);
  (doc as unknown as { _id: Uint8Array })._id = new Uint8Array(id);

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const pen = new Pen(doc, noise.smallFont ? 7 : BASE_FONT[opts.layout]);
  LAYOUTS[opts.layout]({
    pen,
    facts,
    shuffleBlocks: noise.shuffleBlocks ?? false,
    splitPages: noise.splitPages ?? false,
  });
  doc.end();
  return done;
}
