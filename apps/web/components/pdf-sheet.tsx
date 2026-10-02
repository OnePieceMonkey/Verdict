"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export interface QuoteMark {
  readonly page: number;
  readonly quote: string;
  readonly kind: "evidence" | "active" | "void";
}

interface TextBox {
  readonly str: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface RenderedPage {
  readonly width: number;
  readonly height: number;
  readonly image: string;
  readonly boxes: readonly TextBox[];
}

const canon = (s: string) =>
  s.normalize("NFKC").replace(/[‐-―−]/g, "-").replace(/\s+/g, "").toLowerCase();

/** Boxes of the text items that together contain the quote (whitespace-insensitive). */
function boxesForQuote(boxes: readonly TextBox[], quote: string): TextBox[] {
  const target = canon(quote);
  if (!target) return [];
  let text = "";
  const owner: number[] = [];
  boxes.forEach((b, i) => {
    const c = canon(b.str);
    text += c;
    for (let k = 0; k < c.length; k++) owner.push(i);
  });
  const at = text.indexOf(target);
  if (at < 0) return [];
  const hit = new Set(owner.slice(at, at + target.length));
  return [...hit].map((i) => boxes[i]!).filter(Boolean);
}

/**
 * The invoice as printed, rendered with pdf.js. The page never moves between states (it stays
 * registered); only the marks on it change: faint yellow for every quoted fact, violet for the
 * fact in focus, red for refused quotes.
 */
export function PdfSheet({ url, marks, focusPage }: { url: string; marks: readonly QuoteMark[]; focusPage?: number }) {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [failed, setFailed] = useState(false);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setFailed(false);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ url }).promise;
        const out: RenderedPage[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, viewport }).promise;
          const content = await page.getTextContent();
          const boxes: TextBox[] = [];
          for (const item of content.items) {
            if (!("str" in item) || !item.str.trim()) continue;
            const h = item.height || Math.abs(item.transform[3]);
            const [x0, y0] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]) as [number, number];
            const [x1, y1] = viewport.convertToViewportPoint(item.transform[4] + item.width, item.transform[5] + h) as [
              number,
              number,
            ];
            boxes.push({
              str: item.str,
              x: Math.min(x0, x1) / viewport.width,
              y: Math.min(y0, y1) / viewport.height,
              w: Math.abs(x1 - x0) / viewport.width,
              h: Math.abs(y1 - y0) / viewport.height,
            });
          }
          out.push({ width: viewport.width, height: viewport.height, image: canvas.toDataURL("image/png"), boxes });
        }
        if (!cancelled) setPages(out);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const overlays = useMemo(
    () =>
      pages.map((p, i) =>
        marks
          .filter((m) => m.page === i + 1)
          .flatMap((m) => boxesForQuote(p.boxes, m.quote).map((b) => ({ ...b, kind: m.kind }))),
      ),
    [pages, marks],
  );

  useEffect(() => {
    if (focusPage) pageRefs.current[focusPage - 1]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusPage]);

  if (failed) {
    return <p className="p-6 text-sm text-ink-2">The PDF preview could not be rendered in this browser.</p>;
  }
  if (pages.length === 0) {
    return (
      <div className="aspect-[1/1.414] w-full animate-pulse bg-sheet ring-1 ring-rule" aria-label="Loading the document" />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {pages.map((p, i) => (
        <div
          key={i}
          ref={(el) => {
            pageRefs.current[i] = el;
          }}
          className="relative bg-white shadow-[0_1px_2px_rgba(28,31,34,0.08),0_8px_24px_-12px_rgba(28,31,34,0.18)]"
          style={{ aspectRatio: `${p.width} / ${p.height}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image} alt={`Invoice page ${i + 1}`} className="absolute inset-0 h-full w-full" />
          {overlays[i]?.map((b, k) => (
            <span
              key={k}
              aria-hidden
              className={
                b.kind === "active"
                  ? "absolute bg-stamp/25 outline-2 outline-stamp transition-[background-color] duration-200"
                  : b.kind === "void"
                    ? "absolute bg-void/15 outline-1 outline-void/70"
                    : "absolute bg-quote/30 mix-blend-multiply"
              }
              style={{
                left: `${b.x * 100 - 0.3}%`,
                top: `${b.y * 100 - 0.25}%`,
                width: `${b.w * 100 + 0.6}%`,
                height: `${b.h * 100 + 0.5}%`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
