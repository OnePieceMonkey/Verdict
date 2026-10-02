/**
 * Evidence check (EXT-03): an extracted value is only kept if its quote really appears on the
 * cited page of the document's text layer. Matching is whitespace- and case-insensitive and
 * tolerant to hyphen/dash variants, because text layers break lines and normalize glyphs
 * differently, but it never accepts partial or fuzzy matches.
 */
export interface Evidence {
  /** 1-based page number. */
  readonly page: number;
  readonly quote: string;
}

export type EvidenceVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "page-out-of-range" | "empty-quote" | "quote-not-on-page" | "value-not-in-quote" };

export function canonical(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‐-―−]/g, "-")
    .replace(/[   ]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * @param pages text of each page (index 0 = page 1)
 * @param rawValue the value as printed (before normalization), must occur inside the quote
 */
export function checkEvidence(pages: readonly string[], evidence: Evidence, rawValue?: string): EvidenceVerdict {
  const quote = canonical(evidence.quote);
  if (quote === "") return { ok: false, reason: "empty-quote" };
  const page = pages[evidence.page - 1];
  if (page === undefined) return { ok: false, reason: "page-out-of-range" };
  // Text layers may join or split lines anywhere, so compare without whitespace as a fallback.
  const pageText = canonical(page);
  const found = pageText.includes(quote) || pageText.replace(/ /g, "").includes(quote.replace(/ /g, ""));
  if (!found) return { ok: false, reason: "quote-not-on-page" };
  if (rawValue !== undefined) {
    const v = canonical(rawValue);
    if (v !== "" && !quote.includes(v) && !quote.replace(/ /g, "").includes(v.replace(/ /g, ""))) {
      return { ok: false, reason: "value-not-in-quote" };
    }
  }
  return { ok: true };
}
