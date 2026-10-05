import { clientIp, takeRateLimit } from "@/lib/limits.ts";
import { buildZugferd } from "@/lib/zugferd.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_XML_BYTES = 1024 * 1024;

const json = (status: number, message: string, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json", ...extra } });

/**
 * POST application/xml: a CII XRechnung (as produced by a run). Responds with a ZUGFeRD PDF/A-3
 * (profile XRECHNUNG) whose embedded XML is byte-identical to the input. No model call.
 */
export async function POST(request: Request): Promise<Response> {
  const limit = takeRateLimit(`zugferd:${clientIp(request.headers)}`);
  if (!limit.ok) return json(429, "Too many requests. Please try again later.", { "Retry-After": String(limit.retryAfterS) });

  const xml = await request.text();
  if (xml.length === 0 || new TextEncoder().encode(xml).length > MAX_XML_BYTES) return json(413, "Expected an XRechnung XML up to 1 MB.");
  if (!xml.includes("<rsm:CrossIndustryInvoice")) return json(415, "Only CII XRechnung XML is supported.");

  try {
    const out = await buildZugferd(xml);
    if (!out.ok) return json(out.status, out.message);
    return new Response(out.pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="zugferd.pdf"',
        "X-Zugferd-Sha256": out.sha256,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("zugferd failed:", e instanceof Error ? e.name : "unknown");
    return json(502, "The ZUGFeRD file could not be built. Please try again.");
  }
}
