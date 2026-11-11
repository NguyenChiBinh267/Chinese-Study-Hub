import { defineConfig } from "@playwright/test";
import baseline from "./playwright.sprint12.config";
const servers = Array.isArray(baseline.webServer) ? baseline.webServer : [];
export default defineConfig({
  ...baseline,
  reporter: [
    ["list"],
    [
      "junit",
      { outputFile: ".local-postgres/private-preview/publication-browser.xml" },
    ],
  ],
  webServer: servers.map((s) => ({
    ...s,
    reuseExistingServer: s.url?.includes(":54390/") === true,
    env: {
      ...s.env,
      CSH_ISOLATED_PREVIEW_BUILD: "1",
      CSH_PRIVATE_OWNER_PREVIEW: "",
    },
  })),
});
