import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/host-browser",
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [
    ["list"],
    ["junit", { outputFile: ".local-postgres/cloud-gates/host-browser.xml" }],
  ],
  use: { channel: "chromium", trace: "off", screenshot: "off", video: "off" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 360, height: 800 } } },
  ],
});
