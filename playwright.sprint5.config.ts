import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
const mobile = process.env.CSH_SPRINT5_VIEWPORT === "mobile";
const name = mobile ? "mobile" : "desktop";
// Run viewports in separate invocations: each gets a genuinely new local owner
// and one Next development server, without sharing a .next/dev lock.
export default defineConfig({
  testDir: "./tests/sprint5-browser",
  workers: 1,
  retries: 0,
  timeout: 180000,
  expect: { timeout: 15000 },
  reporter: [
    ["list"],
    ["json", { outputFile: `.local-postgres/sprint5/${name}-browser.json` }],
  ],
  use: {
    actionTimeout: 15000,
    baseURL: "http://127.0.0.1:3016",
    channel: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name,
      use: mobile
        ? { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } }
        : {
            ...devices["Desktop Chrome"],
            viewport: { width: 1440, height: 1000 },
          },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3016",
    url: "http://127.0.0.1:3016/api/local/status",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      CSH_APP_ORIGIN: "http://127.0.0.1:3016",
      CSH_LOCAL_OWNER_ID: randomUUID(),
    },
  },
});
