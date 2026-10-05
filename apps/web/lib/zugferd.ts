import "server-only";

export type ZugferdOutcome =
  | { readonly ok: true; readonly pdf: ArrayBuffer; readonly sha256: string }
  | { readonly ok: false; readonly status: number; readonly message: string };

/**
 * CORE-05: asks the verifier to wrap a CII invoice into a ZUGFeRD PDF/A-3. The verifier re-checks
 * the XML with KoSIT and validates the produced file with Mustang before returning it.
 */
export async function buildZugferd(xml: string): Promise<ZugferdOutcome> {
  const url = process.env.VERIFIER_URL || "http://localhost:8081";
  const secret = process.env.VERIFIER_SECRET;
  if (!secret) throw new Error("VERIFIER_SECRET is not configured");
  const res = await fetch(`${url}/v1/zugferd/combine`, {
    method: "POST",
    headers: { "X-Verifier-Secret": secret, "Content-Type": "application/xml" },
    body: xml,
  });
  if (res.status === 422) return { ok: false, status: 422, message: "The official validator does not accept this XML." };
  if (!res.ok || res.headers.get("X-Zugferd-Validation") !== "valid") {
    return { ok: false, status: 502, message: "The ZUGFeRD file could not be built. Please try again." };
  }
  return { ok: true, pdf: await res.arrayBuffer(), sha256: res.headers.get("X-Zugferd-Sha256") ?? "" };
}
