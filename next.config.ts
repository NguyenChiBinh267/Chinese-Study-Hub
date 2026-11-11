import type { NextConfig } from "next";
const config: NextConfig = {
  // Main's repository policy is authoritative; Next must not rewrite AGENTS.md.
  agentRules: false,
  poweredByHeader: false,
  devIndicators: false,
  distDir:
    process.env.CSH_HSK3_CHECK_BUILD === "1"
      ? ".next/hsk3-check"
      : process.env.CSH_HSK2_CHECK_BUILD === "1"
        ? ".next/hsk2-check"
        : process.env.CSH_CLOUD_GATE_VERIFY_BUILD === "1"
          ? ".next/cloud-gate-verify"
          : process.env.CSH_ISOLATED_PREVIEW_BUILD === "1"
            ? ".next/private-preview"
            : ".next",
  outputFileTracingIncludes: {
    "/*": [
      "./content/releases/trusted.json",
      "./content/staging/slice/source-pin.json",
      "./content/staging/slice/source-evidence.json",
      "./content/pronunciation/*.json",
      "./supabase/migrations/*.sql",
    ],
  },
};
export default config;
