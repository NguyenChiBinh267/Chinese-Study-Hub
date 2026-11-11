import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
const auth = JSON.parse(
    fs.readFileSync(
      ".local-postgres/sprint10/auth-local/credentials.json",
      "utf8",
    ),
  ),
  db = JSON.parse(
    fs.readFileSync(".local-postgres/sprint12/database.json", "utf8"),
  );
if (
  !/^csh_release_verify_[a-f0-9]{12}$/.test(db.database) ||
  new URL(db.runtimeUrl).pathname !== "/" + db.database
)
  throw Error("Isolated release test database required");
export default defineConfig({
  testDir: "./tests/sprint12-browser",
  workers: 1,
  retries: 0,
  timeout: 150000,
  expect: { timeout: 20000 },
  reporter: [
    ["list"],
    ["junit", { outputFile: ".local-postgres/sprint12/release-browser.xml" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3024",
    channel: "chromium",
    actionTimeout: 20000,
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
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: "npm run dev -- --port 3024",
      url: "http://127.0.0.1:3024/login",
      reuseExistingServer: false,
      timeout: 90000,
      env: {
        CSH_APP_MODE: "PRODUCTION_AUTHENTICATED",
        CSH_APP_ORIGIN: "http://127.0.0.1:3024",
        CSH_AUTH_URL: "http://127.0.0.1:54390",
        CSH_AUTH_PUBLISHABLE_KEY: auth.anonKey,
        OWNER_USER_ID: auth.owner.id,
        DATABASE_URL: db.runtimeUrl,
        CSH_CONTENT_TEST_ROOT: db.root,
        CSH_CONTENT_RELEASE: db.releaseId,
        CSH_AUTH_TECHNICAL_FIXTURE: "",
        CSH_LOCAL_DATABASE: "0",
        SUPABASE_SERVICE_ROLE_KEY: "",
        SUPABASE_SECRET_KEY: "",
        OPENAI_API_KEY: "",
        AZURE_OPENAI_API_KEY: "",
        GEMINI_API_KEY: "",
      },
    },
  ],
});
