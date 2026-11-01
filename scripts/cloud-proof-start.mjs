// Local browser verification against real cloud Auth/SQL, never a public dev service.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
const dir = ".local-postgres/cloud-gates",
  read = (n) =>
    JSON.parse(fs.readFileSync(dir + "/" + n, "utf8").replace(/^\uFEFF/, ""));
const p = read("project.json"),
  a = read("auth-test-accounts.json"),
  auth = read("auth-config.json"),
  db = read("runtime-connection.json");
if (
  p.projectRef !== "yartjbdapoyqcxfagsrj" ||
  [a, auth, db].some((s) => s.projectRef !== p.projectRef) ||
  new URL(db.runtimeUrl).username !== "csh_runtime." + p.projectRef
)
  throw Error("PINNED_CLOUD_PROJECT_REQUIRED");
const env = { ...process.env };
for (const k of Object.keys(env))
  if (
    /^(CSH_|SUPABASE_|NEXT_PUBLIC_|OWNER_USER_ID$|DATABASE_URL$|VERCEL_TOKEN$|GH_TOKEN$|GITHUB_TOKEN$|OPENAI_API_KEY$|AZURE_OPENAI_API_KEY$|GEMINI_API_KEY$)/.test(
      k,
    )
  )
    delete env[k];
Object.assign(env, {
  NODE_ENV: "development",
  CSH_PROOF_MODE: "cloud-benchmark-v1",
  CSH_PROOF_LOCAL_TEST: "1",
  CSH_PROJECT_REF: p.projectRef,
  CSH_POOLER_HOST: p.poolerHost,
  CSH_APP_ORIGIN: "http://127.0.0.1:3032",
  CSH_AUTH_URL: auth.providerUrl,
  CSH_AUTH_PUBLISHABLE_KEY: auth.publishableKey,
  OWNER_USER_ID: a.owner.id,
  DATABASE_URL: db.runtimeUrl,
  CSH_DATABASE_CA_PEM: fs.readFileSync(dir + "/supabase-ca.crt", "utf8"),
});
const child = spawn(
  process.execPath,
  [
    path.resolve("benchmarks/cloud-proof/node_modules/next/dist/bin/next"),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3032",
  ],
  {
    cwd: path.resolve("benchmarks/cloud-proof"),
    env,
    stdio: "inherit",
    windowsHide: true,
  },
);
let closing = false;
function close() {
  if (closing) return;
  closing = true;
  if (child.exitCode === null) {
    if (process.platform === "win32")
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    else child.kill("SIGTERM");
  }
}
child.once("exit", () => close());
process.once("SIGINT", close);
process.once("SIGTERM", close);
console.log(
  "Local-only technical proof: http://127.0.0.1:3032. Real cloud Auth/SQL, no learning content or admin credential.",
);
