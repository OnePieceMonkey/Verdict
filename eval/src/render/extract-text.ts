// Text-layer extraction via pdf.js (legacy Node build). Items are emitted in content-stream
// order; items on the same baseline are joined with a space, a new baseline starts a new line.

import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);
// In Node, pdf.js reads this with fs.readFile, so it must be a plain path with a trailing separator.
const STANDARD_FONTS = join(dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts") + sep;

interface Item {
  readonly str: string;
  readonly hasEOL: boolean;
  readonly transform: readonly number[];
}

const isItem = (x: unknown): x is Item =>
  typeof x === "object" && x !== null && "str" in x && "transform" in x && "hasEOL" in x;

export async function extractPageTexts(pdf: Buffer): Promise<string[]> {
  const task = getDocument({
    data: new Uint8Array(pdf),
    standardFontDataUrl: STANDARD_FONTS,
    verbosity: 0,
  });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent({ disableNormalization: true });
      let out = "";
      let lastY: number | undefined;
      let eol = false;
      for (const raw of content.items) {
        if (!isItem(raw)) continue;
        const y = raw.transform[5] ?? 0;
        if (raw.str.trim().length > 0) {
          if (lastY !== undefined) out += eol || Math.abs(y - lastY) > 1 ? "\n" : " ";
          out += raw.str;
          lastY = y;
          eol = false;
        }
        if (raw.hasEOL) eol = true;
      }
      pages.push(out);
      page.cleanup();
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
