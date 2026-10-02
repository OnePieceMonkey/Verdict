// Text-layer extraction via pdf.js (legacy Node build). Items are emitted in content-stream
// order; items on the same baseline are joined with a space, a new baseline starts a new line.

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * pdf.js reads its standard font data with fs.readFile, so it needs a plain path with a trailing
 * separator. Inside a bundled server (Next.js) require.resolve returns a module id instead of a
 * path, so resolve lazily and fall back to node_modules under the working directory.
 */
let standardFonts: string | null | undefined;
function standardFontsPath(): string | undefined {
  if (standardFonts !== undefined) return standardFonts ?? undefined;
  const candidates: string[] = [];
  try {
    const resolved: unknown = createRequire(import.meta.url).resolve("pdfjs-dist/package.json");
    if (typeof resolved === "string") candidates.push(join(dirname(resolved), "standard_fonts"));
  } catch {
    // fall through to the cwd-based candidates
  }
  candidates.push(join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts"));
  const found = candidates.find((c) => existsSync(c));
  standardFonts = found ? found + sep : null;
  return standardFonts ?? undefined;
}

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
    ...(standardFontsPath() ? { standardFontDataUrl: standardFontsPath() } : {}),
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
