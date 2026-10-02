// Downloads the pinned KoSIT XRechnung test suite and verifies its checksum.
// The suite is not committed; it lives in eval/.cache (gitignored).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { TESTSUITE, TESTSUITE_DIR } from "../src/testsuite.ts";

if (existsSync(TESTSUITE_DIR)) {
  console.log(`test suite already present: ${TESTSUITE_DIR}`);
  process.exit(0);
}

const zipPath = `${TESTSUITE_DIR}.zip`;
mkdirSync(TESTSUITE_DIR, { recursive: true });
const res = await fetch(TESTSUITE.url);
if (!res.ok) throw new Error(`download failed: ${res.status}`);
writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));

const actual = createHash("sha256").update(readFileSync(zipPath)).digest("hex");
if (actual !== TESTSUITE.sha256) {
  throw new Error(`checksum mismatch for ${TESTSUITE.version}: ${actual}`);
}
execFileSync("unzip", ["-q", "-o", zipPath, "-d", TESTSUITE_DIR]);
console.log(`test suite ${TESTSUITE.version} ready: ${TESTSUITE_DIR}`);
