import "server-only";
import type { RawExtraction, UserInput } from "@verdict/core";
import { engineClient, engineExplainer, MODELS } from "./engine.ts";
import { executeRun } from "./run-core.ts";
import type { RunEvent } from "./run-protocol.ts";
import { validateXRechnung } from "./verifier.ts";

export { UserFacingError } from "./run-core.ts";

export function streamRun(
  pdf: Uint8Array,
  emit: (event: RunEvent) => void,
  resume?: { extraction: RawExtraction; userInputs: readonly UserInput[] },
): Promise<void> {
  return executeRun(
    { client: engineClient(), models: MODELS, validate: validateXRechnung, explain: engineExplainer() },
    pdf,
    emit,
    resume,
  );
}
