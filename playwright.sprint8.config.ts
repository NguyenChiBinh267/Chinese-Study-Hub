import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
export default defineConfig({
  testDir: "./tests/sprint8-browser",
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [
    ["list"],
    ["json", { outputFile: ".local-postgres/sprint8/browser.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3019",
    channel: "chromium",
    actionTimeout: 15000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["microphone"],
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
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
    command: "npm run dev -- --port 3019",
    url: "http://127.0.0.1:3019/api/local/status",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      CSH_APP_ORIGIN: "http://127.0.0.1:3019",
      CSH_LOCAL_OWNER_ID: randomUUID(),
    },
  },
});
