import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
const mobile = process.env.CSH_SPRINT7_VIEWPORT === "mobile";
const name = mobile ? "mobile" : "desktop";
export default defineConfig({
  testDir: "./tests/sprint7-browser",
  workers: 1,
  retries: 0,
  timeout: 180000,
  expect: { timeout: 15000 },
  reporter: [
    ["list"],
    ["json", { outputFile: `.local-postgres/sprint7/${name}-browser.json` }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3018",
    channel: "chromium",
    actionTimeout: 15000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["microphone"],
    // Synthetic Chromium media, not the user's physical microphone or native audio.
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
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
    command: "npm run dev -- --port 3018",
    url: "http://127.0.0.1:3018/api/local/status",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      CSH_APP_ORIGIN: "http://127.0.0.1:3018",
      CSH_LOCAL_OWNER_ID: randomUUID(),
    },
  },
});
