import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
const pointer = JSON.parse(
  fs.readFileSync(".local-postgres/hsk24/current.json", "utf8"),
);
const state = JSON.parse(fs.readFileSync(pointer.stateFile, "utf8"));
const port = process.env.CSH_HSK24_PREVIEW_PORT ?? "3037";
if (!/^\d{4,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535)
  throw Error("INVALID_LOCAL_BROWSER_PORT");
const origin = `http://127.0.0.1:${port}`;
const reportPath =
  process.env.CSH_HSK24_BROWSER_REPORT ?? ".local-postgres/hsk24/browser.json";
if (!/^\.local-postgres\/hsk24\/[a-z0-9-]+\.json$/.test(reportPath))
  throw Error("BOUNDED_LOCAL_BROWSER_REPORT_REQUIRED");
export default defineConfig({
  testDir: "./tests/hsk24-browser",
  workers: 1,
  retries: 0,
  maxFailures: 1,
  timeout: 180000,
  expect: { timeout: 15000 },
  reporter: [["list"], ["json", { outputFile: reportPath }]],
  use: {
    baseURL: origin,
    channel: "chromium",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile360",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } },
    },
  ],
  webServer: {
    stdout: "pipe",
    command: `node node_modules/next/dist/bin/next dev --webpack --no-server-fast-refresh --hostname 127.0.0.1 --port ${port}`,
    url: `${origin}/api/local/status`,
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      CSH_APP_MODE: "LOCAL_DATABASE_DEV",
      CSH_LOCAL_CURRICULUM: "hsk24-batch1",
      CSH_LOCAL_DATABASE: "1",
      CSH_APP_ORIGIN: origin,
      CSH_HSK3_CHECK_BUILD: "1",
      CSH_LOCAL_OWNER_ID: randomUUID(),
      DATABASE_URL: state.runtimeUrl,
    },
  },
});
