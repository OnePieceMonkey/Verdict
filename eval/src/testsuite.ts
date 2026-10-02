import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/** Pinned public KoSIT XRechnung test suite (ground truth for corpus and verifier checks). */
export const TESTSUITE = {
  version: "xrechnung-3.0.2-testsuite-2026-08-31",
  url: "https://github.com/itplr-kosit/xrechnung-testsuite/releases/download/v2026-08-31/xrechnung-3.0.2-testsuite-2026-08-31.zip",
  sha256: "1e81ef7563e0fa04c0e0b0631318a7e0843a3c0beb57d83ef95ac0c4a095e3d7",
} as const;

export const TESTSUITE_DIR = resolve(import.meta.dirname, "../.cache", TESTSUITE.version);

/** All CII (UN/CEFACT) instances of the suite. Every one of them is a positive test case. */
export function ciiInstances(): string[] {
  const root = join(TESTSUITE_DIR, "instances");
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((p) => p.endsWith("_uncefact.xml"))
    .sort()
    .map((p) => join(root, p));
}
