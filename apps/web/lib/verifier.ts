import "server-only";
import type { VerifierVerdict } from "@verdict/core";

export interface VerifierResponse extends VerifierVerdict {
  readonly acceptRecommendation: string;
  readonly report: string | null;
}

export async function validateXRechnung(xml: string): Promise<VerifierResponse> {
  const url = process.env.VERIFIER_URL || "http://localhost:8081";
  const secret = process.env.VERIFIER_SECRET;
  if (!secret) throw new Error("VERIFIER_SECRET is not configured");
  const res = await fetch(`${url}/v1/validate/xrechnung`, {
    method: "POST",
    headers: { "X-Verifier-Secret": secret, "Content-Type": "application/xml" },
    body: xml,
  });
  if (!res.ok) throw new Error(`verifier responded ${res.status}`);
  return (await res.json()) as VerifierResponse;
}
