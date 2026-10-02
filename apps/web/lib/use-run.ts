"use client";
import { useCallback, useRef, useState } from "react";
import type { AuditEvent, UserInput } from "@verdict/core";
import type { RunEvent, RunResultView } from "./run-protocol.ts";

export type RunPhase = "idle" | "running" | "done" | "error";

export interface RunState {
  readonly phase: RunPhase;
  readonly source: { kind: "upload"; name: string } | { kind: "gallery"; id: string; title: string } | null;
  readonly pdfUrl: string | null;
  readonly pages: readonly string[];
  readonly events: readonly AuditEvent[];
  readonly result: RunResultView | null;
  readonly error: string | null;
  /** Wall-clock start of the run, for live elapsed time. */
  readonly startedAt: number | null;
  /** Model cost of earlier passes of this document (a resumed run adds to it). */
  readonly priorCostUsd: number;
}

const EMPTY: RunState = {
  phase: "idle",
  source: null,
  pdfUrl: null,
  pages: [],
  events: [],
  result: null,
  error: null,
  startedAt: null,
  priorCostUsd: 0,
};

export interface GalleryRecording {
  readonly id: string;
  readonly title: string;
  readonly story: string;
  readonly pdf: string;
  readonly run: readonly { at: number; event: RunEvent }[];
  readonly answer?: readonly UserInput[];
  readonly followUp?: readonly { at: number; event: RunEvent }[];
}

/** Drives one run: live via the API (server-sent events) or replayed from a gallery recording. */
export function useRun() {
  const [state, setState] = useState<RunState>(EMPTY);
  const fileRef = useRef<File | null>(null);
  const recordingRef = useRef<GalleryRecording | null>(null);
  const cancelRef = useRef<() => void>(() => undefined);

  const apply = useCallback((event: RunEvent) => {
    setState((s) => {
      switch (event.type) {
        case "start":
          return { ...s, pages: event.pages };
        case "audit":
          return { ...s, events: [...s.events, event.event] };
        case "result":
          return { ...s, phase: "done", result: event.result };
        case "error":
          return { ...s, phase: "error", error: event.message };
      }
    });
  }, []);

  const reset = useCallback(() => {
    cancelRef.current();
    setState(EMPTY);
    fileRef.current = null;
    recordingRef.current = null;
  }, []);

  const streamFrom = useCallback(
    async (form: FormData) => {
      const controller = new AbortController();
      cancelRef.current = () => controller.abort();
      let res: Response;
      try {
        res = await fetch("/api/run", { method: "POST", body: form, signal: controller.signal });
      } catch {
        if (!controller.signal.aborted) apply({ type: "error", message: "Could not reach the server." });
        return;
      }
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        apply({ type: "error", message: body.error ?? `The server refused the run (${res.status}).` });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut: number;
        while ((cut = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          if (chunk.startsWith("data: ")) apply(JSON.parse(chunk.slice(6)) as RunEvent);
        }
      }
    },
    [apply],
  );

  const runUpload = useCallback(
    (file: File) => {
      cancelRef.current();
      fileRef.current = file;
      recordingRef.current = null;
      setState({
        ...EMPTY,
        phase: "running",
        source: { kind: "upload", name: file.name },
        pdfUrl: URL.createObjectURL(file),
        startedAt: Date.now(),
      });
      const form = new FormData();
      form.set("file", file);
      void streamFrom(form);
    },
    [streamFrom],
  );

  const replay = useCallback(
    (events: readonly { at: number; event: RunEvent }[]) => {
      const timers: ReturnType<typeof setTimeout>[] = [];
      for (const { at, event } of events) timers.push(setTimeout(() => apply(event), at));
      cancelRef.current = () => timers.forEach(clearTimeout);
    },
    [apply],
  );

  const runGallery = useCallback(
    async (id: string) => {
      cancelRef.current();
      fileRef.current = null;
      const rec = (await fetch(`/gallery/${id}.json`).then((r) => r.json())) as GalleryRecording;
      recordingRef.current = rec;
      setState({
        ...EMPTY,
        phase: "running",
        source: { kind: "gallery", id, title: rec.title },
        pdfUrl: `/gallery/${rec.pdf}`,
        startedAt: Date.now(),
      });
      replay(rec.run);
    },
    [replay],
  );

  /** REP-04: answer missing facts and re-validate without another extraction call. */
  const answer = useCallback(
    (inputs: readonly UserInput[]) => {
      const result = state.result;
      if (!result) return;
      // The slip keeps its first pass; the second pass is appended below it.
      setState((s) => ({
        ...s,
        phase: "running",
        result: null,
        error: null,
        priorCostUsd: s.priorCostUsd + Number(result.costUsd),
      }));
      const rec = recordingRef.current;
      if (rec?.followUp) {
        replay(rec.followUp);
        return;
      }
      const file = fileRef.current;
      if (!file) return;
      const form = new FormData();
      form.set("file", file);
      form.set("extraction", JSON.stringify(result.extraction));
      form.set("userInputs", JSON.stringify(inputs));
      void streamFrom(form);
    },
    [state.result, replay, streamFrom],
  );

  return {
    state,
    runUpload,
    runGallery,
    answer,
    reset,
    galleryAnswer: () => recordingRef.current?.answer ?? null,
  };
}
