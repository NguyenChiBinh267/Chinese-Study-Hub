import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/cloud-browser",
  workers: 1,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [
    ["list"],
    ["junit", { outputFile: ".local-postgres/cloud-gates/cloud-browser.xml" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3032",
    channel: "chromium",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } },
    },
  ],
  webServer: {
    command: "node scripts/cloud-proof-start.mjs",
    url: "http://127.0.0.1:3032/api/health",
    reuseExistingServer: false,
    timeout: 90000,
  },
});
