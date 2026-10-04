import type { NextConfig } from "next";

const config: NextConfig = {
  // The core package ships TypeScript sources with .ts import specifiers.
  transpilePackages: ["@verdict/core"],
  // pdf.js reads its font data from node_modules at runtime on the server.
  serverExternalPackages: ["pdfjs-dist"],
  // pdf.js loads its worker and font data at runtime, so file tracing misses them in a
  // standalone build. Without these the deployed server cannot read any PDF.
  outputFileTracingIncludes: {
    "/api/run": [
      "../../node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "../../node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/standard_fonts/**",
    ],
  },
  output: "standalone",
  poweredByHeader: false,
};

export default config;
