// AUD-03: pnpm audit:verify <audit.jsonl> [output files...]
// Verifies the hash chain and, if given, that the output files match the hashes in the OUTPUT event.
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { verifyAuditLog } from "../src/audit/audit-log.ts";

// pnpm runs the script inside packages/core; resolve paths against where the user called it.
const base = process.env.INIT_CWD ?? process.cwd();
const [logPath, ...filePaths] = process.argv.slice(2).map((p) => resolve(base, p));
if (!logPath) {
  console.error("usage: pnpm audit:verify <audit.jsonl> [output files...]");
  process.exit(2);
}
const files = filePaths.length ? new Map(filePaths.map((p) => [basename(p), readFileSync(p)])) : undefined;
const verdict = verifyAuditLog(readFileSync(logPath, "utf8"), files);
if (verdict.ok) {
  console.log(`ok: ${verdict.events} events, chain intact${files ? `, ${files.size} file(s) match` : ""}`);
} else {
  console.error(`TAMPERED at event ${verdict.seq}: ${verdict.reason}`);
  process.exit(1);
}
