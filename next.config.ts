import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the workspace root (a stray lockfile in the home dir confuses auto-detection).
  turbopack: { root: projectRoot },
  // Bundle the versioned prompt files + market rulesets so fs reads work on Vercel.
  outputFileTracingIncludes: {
    "/**": ["./engine/llm/prompts/**/*.md"],
  },
  // pdfkit loads its standard font (.afm) files from its own package dir at runtime;
  // keep it external so the bundler doesn't break those fs reads.
  serverExternalPackages: ["pdfkit"],
  // keep the dev indicator out of the sidebar footer
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
