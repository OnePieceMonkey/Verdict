"use client";
import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";

/**
 * CORE-05: builds a ZUGFeRD PDF/A-3 from the validated XRechnung on demand. The server checks
 * the XML with KoSIT again and validates the file with Mustang before it is handed out.
 */
export function ZugferdButton({ xml }: { xml: string }) {
  const [state, setState] = useState<"idle" | "building" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const build = async () => {
    setState("building");
    setError(null);
    try {
      const res = await fetch("/api/zugferd", { method: "POST", headers: { "Content-Type": "application/xml" }, body: xml });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "The ZUGFeRD file could not be built.");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: "zugferd.pdf" });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The ZUGFeRD file could not be built.");
      setState("error");
    }
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={build}
        disabled={state === "building"}
        title="PDF/A-3 with the validated XRechnung embedded (ZUGFeRD, profile XRECHNUNG)"
        className="inline-flex h-9 items-center gap-1.5 border border-stamp px-3 font-semibold text-stamp hover:bg-stamp hover:text-white focus-visible:bg-stamp focus-visible:text-white disabled:opacity-60"
      >
        {state === "building" ? (
          <LoaderCircle size={14} strokeWidth={2} className="animate-spin" aria-hidden />
        ) : (
          <Download size={14} strokeWidth={2} aria-hidden />
        )}
        {state === "building" ? "Building ZUGFeRD…" : "ZUGFeRD PDF"}
      </button>
      {error && (
        <span role="alert" className="text-2xs text-void">
          {error}
        </span>
      )}
    </span>
  );
}
