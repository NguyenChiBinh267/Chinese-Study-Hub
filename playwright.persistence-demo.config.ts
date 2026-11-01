import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
process.env.CSH_PREVIEW_EVIDENCE = ".local-postgres/demo-evidence";
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: "http://127.0.0.1:3011", trace: "off" },
  reporter: [
    ["list"],
    ["json", { outputFile: ".local-postgres/demo-regression-results.json" }],
  ],
  webServer: {
    env: { CSH_APP_MODE: "DEMO" },
    command: "npm run start -- --port 3011",
    url: "http://127.0.0.1:3011",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
