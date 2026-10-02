import type { NextConfig } from "next";

const config: NextConfig = {
  // The core package ships TypeScript sources with .ts import specifiers.
  transpilePackages: ["@verdict/core"],
  // pdf.js reads its font data from node_modules at runtime on the server.
  serverExternalPackages: ["pdfjs-dist"],
  output: "standalone",
  poweredByHeader: false,
};

export default config;
