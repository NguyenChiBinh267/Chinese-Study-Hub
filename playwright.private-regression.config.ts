import { defineConfig } from "@playwright/test";
import baseline from "./playwright.config";
// Exercise the original DEMO suite against this build on its own port.
export default defineConfig({
  ...baseline,
  reporter: [
    ["list"],
    [
      "junit",
      { outputFile: ".local-postgres/private-preview/demo-browser.xml" },
    ],
  ],
  use: { ...baseline.use, baseURL: "http://127.0.0.1:3030" },
  webServer: {
    command: "npm run start -- --port 3030",
    url: "http://127.0.0.1:3030",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      CSH_ISOLATED_PREVIEW_BUILD: "1",
      CSH_APP_MODE: "DEMO",
      CSH_PRIVATE_OWNER_PREVIEW: "",
    },
  },
});
