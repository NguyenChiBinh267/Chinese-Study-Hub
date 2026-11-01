import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";
const auth = JSON.parse(
    fs.readFileSync(
      ".local-postgres/sprint10/auth-local/credentials.json",
      "utf8",
    ),
  ),
  s = JSON.parse(
    fs.readFileSync(".local-postgres/private-preview/database.json", "utf8"),
  );
const u = new URL(s.runtimeUrl);
if (
  !/^csh_private_verify_[a-f0-9]{12}$/.test(s.database) ||
  u.pathname !== "/" + s.database ||
  u.hostname !== "127.0.0.1" ||
  u.username !== "csh_runtime" ||
  u.port !== "5447" ||
  s.ownerId !== auth.owner.id
)
  throw Error("Isolated identity-bound local database required");
if (!(await fetch("http://127.0.0.1:54391/health").catch(() => null))?.ok)
  throw Error("Run npm run auth:local:start first");
const env = {
  ...process.env,
  NODE_ENV: "development",
  CSH_APP_MODE: "PRODUCTION_AUTHENTICATED",
  CSH_APP_ORIGIN: "http://127.0.0.1:3025",
  CSH_AUTH_URL: "http://127.0.0.1:54390",
  CSH_AUTH_PUBLISHABLE_KEY: auth.anonKey,
  OWNER_USER_ID: auth.owner.id,
  DATABASE_URL: s.runtimeUrl,
  CSH_ISOLATED_PREVIEW_BUILD: "1",
  CSH_PRIVATE_OWNER_PREVIEW: "local-v1",
  CSH_CONTENT_TEST_ROOT: "",
  CSH_CONTENT_RELEASE: "",
  CSH_AUTH_TECHNICAL_FIXTURE: "",
  CSH_LOCAL_DATABASE: "0",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SECRET_KEY: "",
  OPENAI_API_KEY: "",
  AZURE_OPENAI_API_KEY: "",
  GEMINI_API_KEY: "",
};
const children = [];
const health = await fetch("http://127.0.0.1:54390/health").catch(() => null);
if (health) {
  if (!health.ok || (await health.text()) !== "local-gotrue-prefix-gateway")
    throw Error("Unknown gateway on port 54390");
} else
  children.push(
    spawn(process.execPath, ["scripts/auth-local-gateway.mjs"], {
      env,
      stdio: "inherit",
      windowsHide: true,
    }),
  );
children.push(
  spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--no-server-fast-refresh",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3025",
    ],
    { env, stdio: "inherit", windowsHide: true },
  ),
);
console.log(
  "PRIVATE_OWNER_PREVIEW local: http://127.0.0.1:3025/login; disposable login in .local-postgres/sprint10/auth-local/owner-login.txt. Online activation remains blocked.",
);
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  for (const c of children)
    if (c.exitCode === null) {
      if (process.platform === "win32")
        spawnSync("taskkill", ["/PID", String(c.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
      else c.kill("SIGTERM");
    }
}
for (const c of children) c.once("exit", close);
process.once("SIGINT", close);
process.once("SIGTERM", close);
