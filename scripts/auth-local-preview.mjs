// Starts the real local Auth integration preview. Never enables a production bypass.
import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";
const cfg = JSON.parse(
  fs.readFileSync(".local-postgres/sprint10/auth-local/credentials.json"),
);
if (!(await fetch("http://127.0.0.1:54391/health").catch(() => null))?.ok)
  throw Error("Run npm run auth:local:start first");
const technical = process.argv.includes("--technical")
  ? JSON.parse(
      fs.readFileSync(".local-postgres/sprint11/database.json", "utf8"),
    )
  : null;
const published=process.argv.includes("--published-test")?JSON.parse(fs.readFileSync(".local-postgres/sprint12/database.json","utf8")):null;
if(published && (!/^csh_release_verify_[a-f0-9]{12}$/.test(published.database) || new URL(published.runtimeUrl).pathname!=="/"+published.database))throw Error("Isolated release database required");
if(published&&technical)throw Error("Choose one fixture adapter");
if (
  technical &&
  (!/^csh_auth_verify_[a-f0-9]{12}$/.test(technical.database) ||
    new URL(technical.runtimeUrl).pathname !== "/" + technical.database)
)
  throw Error("An isolated technical database is required");
const env = {
  ...process.env,
  NODE_ENV: "development",
  CSH_APP_MODE: "PRODUCTION_AUTHENTICATED",
  CSH_APP_ORIGIN: "http://127.0.0.1:3015",
  CSH_AUTH_URL: "http://127.0.0.1:54390",
  CSH_AUTH_PUBLISHABLE_KEY: cfg.anonKey,
  OWNER_USER_ID: cfg.owner.id,
  CSH_LOCAL_DATABASE: "0",
  CSH_AUTH_TECHNICAL_FIXTURE: technical ? "csh-auth-technical-v1" : "",
  ...(technical ? { DATABASE_URL: technical.runtimeUrl } : {}),
  ...(published?{DATABASE_URL:published.runtimeUrl,CSH_CONTENT_TEST_ROOT:published.root,CSH_CONTENT_RELEASE:published.releaseId}:{}),
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SECRET_KEY: "",
  OPENAI_API_KEY: "",
  AZURE_OPENAI_API_KEY: "",
  GEMINI_API_KEY: "",
};
const gateway = spawn(process.execPath, ["scripts/auth-local-gateway.mjs"], {
  env,
  stdio: "inherit",
  windowsHide: true,
});
const app = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--no-server-fast-refresh",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3015",
  ],
  { env, stdio: "inherit", windowsHide: true },
);
console.log(
  "Local test credentials: .local-postgres/sprint10/auth-local/owner-login.txt (ignored, not a production account).",
);
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  for (const child of [gateway, app]) {
    if (child.exitCode !== null) continue;
    if (process.platform === "win32")
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    else child.kill("SIGTERM");
  }
}
for (const child of [gateway, app]) child.once("exit", () => close());
process.once("SIGINT", close);
process.once("SIGTERM", close);
