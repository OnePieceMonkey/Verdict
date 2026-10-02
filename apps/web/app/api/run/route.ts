import type { RawExtraction, UserInput } from "@verdict/core";
import { clientIp, MAX_UPLOAD_BYTES, takeRateLimit } from "@/lib/limits.ts";
import type { RunEvent } from "@/lib/run-protocol.ts";
import { streamRun, UserFacingError } from "@/lib/run-stream.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const json = (status: number, message: string, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });

/**
 * POST multipart/form-data: `file` (PDF, required); optional `extraction` (JSON) and
 * `userInputs` (JSON array of {path, value}) to resume a NEEDS_INPUT run without a new model call.
 * Responds with a text/event-stream of RunEvents.
 */
export async function POST(request: Request): Promise<Response> {
  const limit = takeRateLimit(clientIp(request.headers));
  if (!limit.ok) {
    return json(429, "Too many runs from your network. Please try again later or use the gallery.", {
      "Retry-After": String(limit.retryAfterS),
    });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, "Expected a multipart upload with a PDF file.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json(400, "No file uploaded.");
  if (file.size > MAX_UPLOAD_BYTES) {
    return json(413, `The file is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Check the magic number, not the client-supplied MIME type.
  if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    return json(415, "Only PDF files are supported.");
  }

  let resume: { extraction: RawExtraction; userInputs: UserInput[] } | undefined;
  const extraction = form.get("extraction");
  const userInputs = form.get("userInputs");
  if (typeof extraction === "string" && typeof userInputs === "string") {
    try {
      const inputs = JSON.parse(userInputs) as unknown;
      if (!Array.isArray(inputs) || !inputs.every((i) => typeof i?.path === "string" && typeof i?.value === "string")) {
        return json(400, "userInputs must be a list of {path, value}.");
      }
      resume = { extraction: JSON.parse(extraction) as RawExtraction, userInputs: inputs as UserInput[] };
    } catch {
      return json(400, "Could not read the resume data.");
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: RunEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        await streamRun(bytes, send, resume);
      } catch (e) {
        // Never echo internal errors (they may contain configuration details).
        const message = e instanceof UserFacingError ? e.message : "The run failed unexpectedly. Please try again.";
        if (!(e instanceof UserFacingError)) console.error("run failed:", e instanceof Error ? e.name : "unknown");
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
