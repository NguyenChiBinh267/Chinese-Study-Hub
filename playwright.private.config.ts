import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const auth = JSON.parse(
    fs.readFileSync(
      ".local-postgres/sprint10/auth-local/credentials.json",
      "utf8",
    ),
  ),
  s = JSON.parse(
    fs.readFileSync(".local-postgres/private-preview/database.json", "utf8"),
  );
if (
  !/^csh_private_verify_[a-f0-9]{12}$/.test(s.database) ||
  new URL(s.runtimeUrl).pathname !== "/" + s.database
)
  throw Error("Isolated private database required");
export default defineConfig({
  testDir: "./tests/private-preview-browser",
  workers: 1,
  retries: 0,
  timeout: 300000,
  expect: { timeout: 20000 },
  reporter: [
    ["list"],
    ["junit", { outputFile: ".local-postgres/private-preview/browser.xml" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3025",
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
  webServer: [
    {
      command: "node scripts/auth-local-gateway.mjs",
      url: "http://127.0.0.1:54390/health",
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: "npm run dev -- --port 3025",
      url: "http://127.0.0.1:3025/login",
      reuseExistingServer: false,
      timeout: 90000,
      env: {
        CSH_APP_MODE: "PRODUCTION_AUTHENTICATED",
        CSH_APP_ORIGIN: "http://127.0.0.1:3025",
        CSH_AUTH_URL: "http://127.0.0.1:54390",
        CSH_AUTH_PUBLISHABLE_KEY: auth.anonKey,
        OWNER_USER_ID: auth.owner.id,
        DATABASE_URL: s.runtimeUrl,
        CSH_ISOLATED_PREVIEW_BUILD: "1",
        CSH_PRIVATE_OWNER_PREVIEW: "local-v1",
        CSH_CONTENT_RELEASE: "",
        CSH_CONTENT_TEST_ROOT: "",
        CSH_AUTH_TECHNICAL_FIXTURE: "",
        CSH_LOCAL_DATABASE: "0",
        SUPABASE_SERVICE_ROLE_KEY: "",
        SUPABASE_SECRET_KEY: "",
        OPENAI_API_KEY: "",
        GEMINI_API_KEY: "",
        AZURE_OPENAI_API_KEY: "",
      },
    },
  ],
});
