import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
export default defineConfig({
  testDir: "./tests/sprint9-browser",
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [
    ["list"],
    ["junit", { outputFile: ".local-postgres/sprint9/browser.xml" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3020",
    channel: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["microphone"],
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
    command: "npm run dev -- --port 3020",
    url: "http://127.0.0.1:3020/api/local/status",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      CSH_APP_ORIGIN: "http://127.0.0.1:3020",
      CSH_LOCAL_OWNER_ID: randomUUID(),
    },
  },
});
