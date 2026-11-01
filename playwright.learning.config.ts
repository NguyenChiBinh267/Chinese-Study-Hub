import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
export default defineConfig({
  testDir: "./tests/learning-browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [
    ["list"],
    ["json", { outputFile: ".local-postgres/phase3-browser.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3012",
    channel: "chromium",
    trace: "off",
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
    command: "npm run dev -- --port 3012",
    url: "http://127.0.0.1:3012/api/local/status",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      CSH_APP_ORIGIN: "http://127.0.0.1:3012",
      CSH_LOCAL_OWNER_ID: randomUUID(),
    },
  },
});
