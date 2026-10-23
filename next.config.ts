import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  distDir:
    process.env.CSH_CLOUD_GATE_VERIFY_BUILD === "1"
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
