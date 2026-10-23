import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/modules/**/ui/**/*.{ts,tsx}", "src/components/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "pg",
            "@supabase/*",
            "node:*",
            "**/infrastructure/**",
            "**/server/**",
            "@/shared/db/**",
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/**/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "next",
            "next/*",
            "react",
            "@/components/*",
            "**/infrastructure/*",
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
  ]),
]);
