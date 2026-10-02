// Thin drawing layer over PDFKit. Only the built-in Helvetica family is used, so every
// glyph stays real, selectable WinAnsi text in the PDF text layer.

import type { Fact } from "./facts.ts";

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const LINE_GAP = 1.5;

export type FontName = "Helvetica" | "Helvetica-Bold" | "Helvetica-Oblique";

export interface TextStyle {
  readonly font?: FontName;
  readonly size?: number;
  readonly color?: string;
  readonly align?: "left" | "right" | "center";
}

/**
 * WinAnsi (the encoding of the standard 14 fonts) covers Latin-1 plus a few typographic
 * characters (€ … – — „ “ ‚ ‘ ’ • ‰ ™ Œ œ Š š Ž ž Ÿ ƒ ˆ ˜). Anything else would be written
 * as a wrong byte and extract as garbage, so it is replaced by "?". Synthetic fixtures
 * should stay inside WinAnsi; the replacement only guards against silent corruption.
 */
const WIN_ANSI_EXTRA = new Set([
  0x20ac, 0x2026, 0x2013, 0x2014, 0x201e, 0x201c, 0x201d, 0x201a, 0x2018, 0x2019, 0x2022, 0x2030, 0x2122,
  0x0152, 0x0153, 0x0160, 0x0161, 0x017d, 0x017e, 0x0178, 0x0192, 0x02c6, 0x02dc, 0x2020, 0x2021, 0x2039,
  0x203a,
]);

export function toWinAnsi(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0x3f;
    const ok = (cp >= 0x20 && cp <= 0x7e) || cp === 0x0a || (cp >= 0xa0 && cp <= 0xff) || WIN_ANSI_EXTRA.has(cp);
    out += ok ? ch : "?";
  }
  return out;
}

export class Pen {
  /** When true, nothing is drawn; text() only returns the height it would take. */
  dry = false;

  constructor(
    readonly doc: PDFKit.PDFDocument,
    /** Body font size in pt. */
    readonly base: number,
  ) {}

  private apply(st: TextStyle): void {
    this.doc
      .font(st.font ?? "Helvetica")
      .fontSize(st.size ?? this.base)
      .fillColor(st.color ?? "#111111");
  }

  height(s: string, width: number, st: TextStyle = {}): number {
    if (s.length === 0) return 0;
    this.apply(st);
    return this.doc.heightOfString(toWinAnsi(s), { width, lineGap: LINE_GAP });
  }

  /** Draws `s` in a box of `width` at (x, y) and returns the used height. */
  text(s: string, x: number, y: number, width: number, st: TextStyle = {}): number {
    if (s.length === 0) return 0;
    const h = this.height(s, width, st);
    if (!this.dry) {
      this.apply(st);
      this.doc.text(toWinAnsi(s), x, y, { width, align: st.align ?? "left", lineGap: LINE_GAP });
    }
    return h;
  }

  rule(x1: number, x2: number, y: number, color = "#9ca3af", width = 0.5): void {
    if (this.dry) return;
    this.doc.save().moveTo(x1, y).lineTo(x2, y).lineWidth(width).strokeColor(color).stroke().restore();
  }

  fillRect(x: number, y: number, w: number, h: number, color: string): void {
    if (this.dry) return;
    this.doc.save().rect(x, y, w, h).fillColor(color).fill().restore();
  }

  /** Label/value rows with the label in its own column. Returns the y below the last row. */
  rows(
    facts: readonly Fact[],
    x: number,
    y: number,
    labelW: number,
    valueW: number,
    labelSt: TextStyle,
    valueSt: TextStyle,
    gap = 2,
  ): number {
    let cy = y;
    for (const f of facts) {
      const hl = this.text(f.label, x, cy, labelW, labelSt);
      const hv = this.text(f.value, x + labelW, cy, valueW, valueSt);
      cy += Math.max(hl, hv) + gap;
    }
    return cy;
  }

  /** "Label: value" lines stacked in one column. Returns the y below the last line. */
  inline(facts: readonly Fact[], x: number, y: number, width: number, st: TextStyle, gap = 0.5): number {
    let cy = y;
    for (const f of facts) cy += this.text(`${f.label}: ${f.value}`, x, cy, width, st) + gap;
    return cy;
  }

  /** Plain lines stacked in one column. Returns the y below the last line. */
  lines(lines: readonly string[], x: number, y: number, width: number, st: TextStyle, gap = 0.5): number {
    let cy = y;
    for (const l of lines) cy += this.text(l, x, cy, width, st) + gap;
    return cy;
  }
}
