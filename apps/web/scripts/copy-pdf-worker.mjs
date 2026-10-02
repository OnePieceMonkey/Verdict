// The browser loads the pdf.js worker as a static file; copy it from the installed package.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkg = dirname(require.resolve("pdfjs-dist/package.json"));
mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
copyFileSync(join(pkg, "build/pdf.worker.min.mjs"), new URL("../public/pdf.worker.min.mjs", import.meta.url));
