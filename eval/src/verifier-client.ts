export interface VerifierFinding {
  readonly ruleId: string;
  readonly severity: "error" | "warning" | "information" | string;
  readonly message: string;
  readonly location: string;
}

export interface VerifierResult {
  readonly valid: boolean;
  readonly acceptRecommendation: "ACCEPTABLE" | "REJECT" | "UNDEFINED";
  readonly schemaValid: boolean;
  readonly schematronValid: boolean;
  readonly errors: readonly VerifierFinding[];
  readonly reportHash: string | null;
  readonly report: string | null;
  readonly versions: { readonly validator: string; readonly configuration: string };
}

export async function validateXRechnung(
  xml: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<VerifierResult> {
  const url = env.VERIFIER_URL || "http://localhost:8081";
  const secret = env.VERIFIER_SECRET;
  if (!secret) throw new Error("VERIFIER_SECRET is missing");
  const res = await fetch(`${url}/v1/validate/xrechnung`, {
    method: "POST",
    headers: { "X-Verifier-Secret": secret, "Content-Type": "application/xml" },
    body: xml,
  });
  if (!res.ok) throw new Error(`verifier ${res.status}: ${await res.text()}`);
  return (await res.json()) as VerifierResult;
}
