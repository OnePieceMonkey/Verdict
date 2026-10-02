// The three invoice layouts. Each one prints the same facts; they differ in placement,
// typography and therefore in text-layer order, which is what the extraction eval needs.

import type { Fact, PrintFacts, PrintLine } from "./facts.ts";
import { PAGE_H, PAGE_W, type Pen, type TextStyle } from "./pen.ts";

export interface LayoutContext {
  readonly pen: Pen;
  readonly facts: PrintFacts;
  readonly shuffleBlocks: boolean;
  readonly splitPages: boolean;
}

interface Flow extends LayoutContext {
  readonly top: number;
  readonly limit: number;
  newPage(): number;
}

interface Column {
  readonly header: string;
  readonly width: number;
  readonly align?: "left" | "right" | "center";
  readonly cell: (l: PrintLine) => string;
}

interface TableStyle {
  readonly headerFill?: string;
  readonly headerColor: string;
  readonly headerRule: string;
  readonly rowRule?: string;
  readonly zebra?: string;
  readonly padX: number;
  readonly padY: number;
}

interface TotalRow {
  readonly label: string;
  readonly mid?: string;
  readonly value: string;
  readonly strong?: boolean;
}

const GREY = "#6b7280";
const sz = (pen: Pen, delta: number): number => Math.max(5.5, pen.base + delta);

/** Runs `draw` without output and returns how far it advanced from y = 0. */
function measure(pen: Pen, draw: () => number): number {
  const prev = pen.dry;
  pen.dry = true;
  try {
    return draw();
  } finally {
    pen.dry = prev;
  }
}

function flow(ctx: LayoutContext, top: number, limit: number): Flow {
  return {
    ...ctx,
    top,
    limit,
    newPage: () => {
      ctx.pen.doc.addPage();
      return top;
    },
  };
}

/** Moves to a new page when `h` does not fit below `y`. */
function ensure(f: Flow, y: number, h: number): number {
  return y + h > f.limit ? f.newPage() : y;
}

/** Draws header blocks in a fixed or shuffled order; positions do not depend on the order. */
function drawBlocks(shuffle: boolean, blocks: readonly (() => number)[]): number[] {
  const order = shuffle ? [...blocks.keys()].reverse() : [...blocks.keys()];
  const bottoms: number[] = new Array<number>(blocks.length).fill(0);
  for (const i of order) bottoms[i] = blocks[i]?.() ?? 0;
  return bottoms;
}

function table(f: Flow, x: number, y: number, cols: readonly Column[], st: TableStyle): number {
  const { pen } = f;
  const totalW = cols.reduce((s, c) => s + c.width, 0);
  const hs: TextStyle = { font: "Helvetica-Bold", size: sz(pen, -0.5), color: st.headerColor };
  const cs: TextStyle = { size: pen.base };

  const header = (yy: number): number => {
    const h = Math.max(...cols.map((c) => pen.height(c.header, c.width - 2 * st.padX, hs))) + 2 * st.padY;
    if (st.headerFill !== undefined) pen.fillRect(x, yy, totalW, h, st.headerFill);
    let cx = x;
    for (const c of cols) {
      pen.text(c.header, cx + st.padX, yy + st.padY, c.width - 2 * st.padX, { ...hs, align: c.align ?? "left" });
      cx += c.width;
    }
    pen.rule(x, x + totalW, yy + h, st.headerRule, 0.75);
    return yy + h;
  };

  let cy = header(ensure(f, y, 70));
  f.facts.lines.forEach((line, i) => {
    const cells = cols.map((c) => c.cell(line));
    const h =
      Math.max(...cells.map((s, k) => pen.height(s, (cols[k]?.width ?? 0) - 2 * st.padX, cs))) + 2 * st.padY;
    if (cy + h > f.limit) cy = header(f.newPage());
    if (st.zebra !== undefined && i % 2 === 1) pen.fillRect(x, cy, totalW, h, st.zebra);
    let cx = x;
    cells.forEach((s, k) => {
      const c = cols[k];
      if (c === undefined) return;
      pen.text(s, cx + st.padX, cy + st.padY, c.width - 2 * st.padX, { ...cs, align: c.align ?? "left" });
      cx += c.width;
    });
    cy += h;
    if (st.rowRule !== undefined) pen.rule(x, x + totalW, cy, st.rowRule, 0.3);
  });
  return cy;
}

function totalRows(F: PrintFacts): TotalRow[] {
  const L = F.labels;
  return [
    { label: F.lineTotal.label, value: F.lineTotal.value },
    ...F.vat.map((v) => ({ label: v.label, mid: `${L.taxableBase} ${v.taxable}`, value: v.tax })),
    { label: F.taxTotal.label, value: F.taxTotal.value },
    { label: F.grandTotal.label, value: F.grandTotal.value, strong: true },
  ];
}

/** Right-aligned totals block: label | mid | value. Returns the y below it. */
function totals(
  f: Flow,
  right: number,
  y: number,
  widths: readonly [number, number, number],
  strongFill: string | undefined,
  strongColor: string,
): number {
  const { pen } = f;
  const [lw, mw, vw] = widths;
  const x = right - lw - mw - vw;
  const rows = totalRows(f.facts);
  const draw = (y0: number): number => {
    let cy = y0;
    for (const r of rows) {
      const st: TextStyle = r.strong
        ? { font: "Helvetica-Bold", size: pen.base + 1, color: strongColor }
        : { size: pen.base };
      const h = Math.max(pen.height(r.label, lw, st), pen.height(r.mid ?? "", mw, st), pen.height(r.value, vw, st));
      if (r.strong) {
        pen.rule(x, right, cy, "#111111", 0.75);
        cy += 3;
        if (strongFill !== undefined) pen.fillRect(x, cy - 2, right - x, h + 3, strongFill);
      }
      pen.text(r.label, x, cy, lw, st);
      pen.text(r.mid ?? "", x + lw, cy, mw, { ...st, align: "right" });
      pen.text(r.value, x + lw + mw, cy, vw, { ...st, align: "right" });
      cy += h + 2;
    }
    return cy;
  };
  const start = ensure(f, y, measure(pen, () => draw(0)));
  return draw(start);
}

/** Payment terms (line breaks kept) and VAT exemption notes. Returns the y below them. */
function notes(f: Flow, x: number, y: number, width: number, withBank: boolean): number {
  const { pen, facts: F } = f;
  const L = F.labels;
  const head: TextStyle = { font: "Helvetica-Bold", size: pen.base };
  const body: TextStyle = { size: pen.base };
  const draw = (y0: number): number => {
    let cy = y0;
    if (withBank && F.bank.length > 0) {
      cy += pen.text(L.bank, x, cy, width, head) + 1;
      cy = pen.inline(F.bank, x, cy, width, body) + 6;
    }
    if (F.paymentTerms !== undefined) {
      cy += pen.text(F.paymentTerms.label, x, cy, width, head) + 1;
      cy += pen.text(F.paymentTerms.value, x, cy, width, body) + 6;
    }
    cy = pen.lines(F.exemptions, x, cy, width, body, 2);
    return cy;
  };
  const start = ensure(f, y, measure(pen, () => draw(0)));
  return draw(start);
}

function pageNumbers(pen: Pen, F: PrintFacts, x: number, width: number): void {
  const doc = pen.doc;
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    pen.text(`${F.labels.page} ${i + 1} ${F.labels.of} ${range.count}`, x, PAGE_H - 22, width, {
      size: sz(pen, -2),
      color: GREY,
      align: "right",
    });
  }
}

function eachPage(pen: Pen, draw: () => void): void {
  const range = pen.doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    pen.doc.switchToPage(i);
    draw();
  }
}

// ---------------------------------------------------------------------------------------
// classic: DIN-5008-like letter with sender line, address window, meta block on the right
// ---------------------------------------------------------------------------------------

export function renderClassic(ctx: LayoutContext): void {
  const { pen, facts: F } = ctx;
  const L = F.labels;
  const X = 56;
  const R = PAGE_W - 56;
  const small: TextStyle = { size: sz(pen, -2) };

  const footer = (y: number): number => {
    pen.rule(X, R, y - 6, "#9ca3af", 0.5);
    const c1 = pen.lines(
      [F.sellerName ?? "", ...F.sellerAddress].filter((s) => s.length > 0),
      X,
      y,
      150,
      small,
    );
    const c2 = pen.inline(
      [...F.sellerContact, ...(F.sellerElectronic === undefined ? [] : [F.sellerElectronic])],
      X + 158,
      y,
      160,
      small,
    );
    const c3 = pen.inline([...F.bank, ...F.sellerLegal], X + 326, y, R - X - 326, small);
    return Math.max(c1, c2, c3);
  };
  const footerH = measure(pen, () => footer(0));
  const footerTop = PAGE_H - 30 - footerH;
  const f = flow(ctx, 50, footerTop - 14);

  const [, buyerBottom, metaBottom] = drawBlocks(ctx.shuffleBlocks, [
    () => {
      const y = 44 + pen.text(F.sellerName ?? "", X, 44, R - X, { font: "Helvetica-Bold", size: pen.base + 7 });
      const sender = [F.sellerName, ...F.sellerAddress].filter((s) => s !== undefined).join(" · ");
      const h = pen.text(sender, X, 126, 250, { size: sz(pen, -2.5), color: GREY });
      pen.rule(X, X + 250, 126 + h + 1, "#9ca3af", 0.4);
      return y;
    },
    () => {
      let y = 142;
      y += pen.text(F.buyerName ?? "", X, y, 240, { font: "Helvetica-Bold", size: pen.base + 1 });
      y = pen.lines(F.buyerAddress, X, y, 240, { size: pen.base + 0.5 });
      if (F.buyerElectronic !== undefined) y = pen.inline([F.buyerElectronic], X, y + 3, 240, small);
      return y;
    },
    () =>
      pen.rows(
        F.meta,
        330,
        142,
        112,
        R - 330 - 112,
        { size: sz(pen, -0.5), color: GREY },
        { font: "Helvetica-Bold", size: sz(pen, -0.5) },
      ),
  ]);

  let y = Math.max(buyerBottom ?? 0, metaBottom ?? 0, 230) + 22;
  y += pen.text(L.title, X, y, R - X, { font: "Helvetica-Bold", size: pen.base + 7 }) + 10;
  if (ctx.splitPages) y = f.newPage();

  y = table(
    f,
    X,
    y,
    [
      { header: L.pos, width: 30, cell: (l) => l.pos },
      { header: L.name, width: 141, cell: (l) => l.name },
      { header: L.quantity, width: 44, align: "right", cell: (l) => l.quantity },
      { header: L.unit, width: 62, cell: (l) => l.unit },
      {
        header: L.price,
        width: 78,
        align: "right",
        cell: (l) => (l.priceBase === undefined ? l.price : `${l.price}\n${l.priceBase}`),
      },
      { header: L.vat, width: 60, align: "center", cell: (l) => l.vat },
      { header: L.lineAmount, width: 68, align: "right", cell: (l) => l.net },
    ],
    { headerFill: "#e5e7eb", headerColor: "#111111", headerRule: "#374151", rowRule: "#d1d5db", padX: 3, padY: 4 },
  );
  y = totals(f, R, y + 12, [108, 78, 70], undefined, "#111111");
  notes(f, X, y + 16, R - X, false);

  eachPage(pen, () => footer(footerTop));
  pageNumbers(pen, F, X, R - X);
}

// ---------------------------------------------------------------------------------------
// modern: big title, "Von"/"An" columns, label/value meta rows, light table
// ---------------------------------------------------------------------------------------

export function renderModern(ctx: LayoutContext): void {
  const { pen, facts: F } = ctx;
  const L = F.labels;
  const X = 50;
  const R = PAGE_W - 50;
  const ACCENT = "#1d4ed8";
  const small: TextStyle = { size: sz(pen, -1.5), color: GREY };
  const heading: TextStyle = { font: "Helvetica-Bold", size: sz(pen, -1.5), color: ACCENT };

  const footer = (y: number): number => {
    pen.rule(X, R, y - 6, "#e5e7eb", 0.75);
    const half = Math.ceil(F.sellerLegal.length / 2);
    const a = pen.inline(F.sellerLegal.slice(0, half), X, y, 240, small);
    const b = pen.inline(F.sellerLegal.slice(half), X + 255, y, R - X - 255, small);
    return Math.max(a, b);
  };
  const footerH = measure(pen, () => footer(0));
  const footerTop = PAGE_H - 30 - footerH;
  const f = flow(ctx, 50, footerTop - 14);

  const from = (): number => {
    let y = 104;
    y += pen.text(L.from, X, y, 230, heading) + 3;
    y += pen.text(F.sellerName ?? "", X, y, 230, { font: "Helvetica-Bold", size: pen.base });
    y = pen.lines(F.sellerAddress, X, y, 230, { size: pen.base });
    const extra: Fact[] = [...F.sellerContact, ...(F.sellerElectronic === undefined ? [] : [F.sellerElectronic])];
    return pen.inline(extra, X, y + 4, 230, small);
  };
  const to = (): number => {
    let y = 104;
    y += pen.text(L.to, X + 255, y, R - X - 255, heading) + 3;
    y += pen.text(F.buyerName ?? "", X + 255, y, R - X - 255, { font: "Helvetica-Bold", size: pen.base });
    y = pen.lines(F.buyerAddress, X + 255, y, R - X - 255, { size: pen.base });
    if (F.buyerElectronic === undefined) return y;
    return pen.inline([F.buyerElectronic], X + 255, y + 4, R - X - 255, small);
  };
  const metaTop = Math.max(measure(pen, from), measure(pen, to)) + 20;
  const meta = (): number =>
    pen.rows(F.meta, X, metaTop, 160, 250, { size: pen.base, color: GREY }, { font: "Helvetica-Bold", size: pen.base }, 3);

  pen.text(L.title.toUpperCase(), X, 40, 300, { font: "Helvetica-Bold", size: pen.base + 19, color: "#111827" });
  pen.text(F.sellerName ?? "", X + 260, 50, R - X - 260, {
    font: "Helvetica-Bold",
    size: pen.base + 1,
    color: ACCENT,
    align: "right",
  });
  pen.rule(X, R, 86, ACCENT, 2);
  const [, , metaBottom] = drawBlocks(ctx.shuffleBlocks, [from, to, meta]);

  let y = (metaBottom ?? metaTop) + 18;
  if (ctx.splitPages) y = f.newPage();

  y = table(
    f,
    X,
    y,
    [
      { header: L.pos, width: 28, cell: (l) => l.pos },
      { header: L.name, width: 172, cell: (l) => l.name },
      {
        header: `${L.quantity} / ${L.unit}`,
        width: 91,
        cell: (l) => [l.quantity, l.unit].filter((s) => s.length > 0).join(" "),
      },
      {
        header: L.price,
        width: 82,
        align: "right",
        cell: (l) => (l.priceBase === undefined ? l.price : `${l.price}\n${l.priceBase}`),
      },
      { header: L.vat, width: 56, align: "center", cell: (l) => l.vat },
      { header: L.lineAmount, width: 66, align: "right", cell: (l) => l.net },
    ],
    { headerColor: GREY, headerRule: "#9ca3af", rowRule: "#e5e7eb", padX: 3, padY: 5 },
  );
  y = totals(f, R, y + 14, [112, 80, 70], "#eff6ff", ACCENT);
  notes(f, X, y + 18, R - X, true);

  eachPage(pen, () => footer(footerTop));
  pageNumbers(pen, F, X, R - X);
}

// ---------------------------------------------------------------------------------------
// compact: dense single column, one key-value list for all metadata, narrow table
// ---------------------------------------------------------------------------------------

export function renderCompact(ctx: LayoutContext): void {
  const { pen, facts: F } = ctx;
  const L = F.labels;
  const X = 40;
  const R = PAGE_W - 40;
  const f = flow(ctx, 36, PAGE_H - 40);
  const labelSt: TextStyle = { size: pen.base, color: GREY };
  const valueSt: TextStyle = { size: pen.base };
  const one = (label: string, value: string | undefined): Fact[] => (value === undefined ? [] : [{ label, value }]);
  const joined = (lines: readonly string[]): string | undefined => (lines.length > 0 ? lines.join(", ") : undefined);

  const sellerGroup: Fact[] = [
    ...one(L.seller, F.sellerName),
    ...one(L.address, joined(F.sellerAddress)),
    ...F.sellerContact,
    ...(F.sellerElectronic === undefined ? [] : [F.sellerElectronic]),
    ...F.sellerLegal,
  ];
  const buyerGroup: Fact[] = [
    ...one(L.buyer, F.buyerName),
    ...one(L.address, joined(F.buyerAddress)),
    ...(F.buyerElectronic === undefined ? [] : [F.buyerElectronic]),
  ];
  const groups = ctx.shuffleBlocks ? [buyerGroup, F.meta, sellerGroup] : [F.meta, sellerGroup, buyerGroup];
  const tail: Fact[] = [...F.bank, ...(F.paymentTerms === undefined ? [] : [F.paymentTerms])];

  let y = 36;
  y += pen.text(L.title, X, y, R - X, { font: "Helvetica-Bold", size: pen.base + 4 }) + 3;
  pen.rule(X, R, y, "#111111", 0.75);
  y += 5;
  for (const g of [...groups, tail]) {
    if (g.length === 0) continue;
    y = pen.rows(g, X, y, 140, R - X - 140, labelSt, valueSt, 1) + 4;
  }
  y = pen.lines(F.exemptions, X, y, R - X, valueSt, 1) + 6;
  if (ctx.splitPages) y = f.newPage();

  y = table(
    f,
    X,
    y,
    [
      { header: L.pos, width: 30, cell: (l) => l.pos },
      { header: L.name, width: 190, cell: (l) => l.name },
      {
        header: `${L.quantity} × ${L.price}`,
        width: 165,
        cell: (l) =>
          `${[l.quantity, l.unit].filter((s) => s.length > 0).join(" ")} × ${l.price}${
            l.priceBase === undefined ? "" : ` ${l.priceBase}`
          }`,
      },
      { header: L.vat, width: 62, cell: (l) => l.vat },
      { header: L.lineAmount, width: 68, align: "right", cell: (l) => l.net },
    ],
    { headerFill: "#f3f4f6", headerColor: "#111111", headerRule: "#111111", zebra: "#fafafa", padX: 2, padY: 2.5 },
  );
  totals(f, R, y + 8, [110, 80, 70], undefined, "#111111");
  pageNumbers(pen, F, X, R - X);
}

export const LAYOUTS = {
  classic: renderClassic,
  modern: renderModern,
  compact: renderCompact,
} as const;
