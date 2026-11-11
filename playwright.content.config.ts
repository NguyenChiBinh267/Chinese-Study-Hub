import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
export default defineConfig({
  testDir: "./tests/content-browser",
  workers: 1,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: [
    ["list"],
    ["json", { outputFile: ".local-postgres/phase4/browser.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3014",
    channel: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3014",
    url: "http://127.0.0.1:3014/api/local/status",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      CSH_APP_ORIGIN: "http://127.0.0.1:3014",
      CSH_LOCAL_OWNER_ID: randomUUID(),
    },
  },
});
