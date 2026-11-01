// Local negative-route checks only. These never count as real cloud Auth/RLS.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import http from "node:http";
const dir = ".local-postgres/cloud-gates",
  port = 3031,
  checks = [];
const env = { ...process.env, NODE_ENV: "production" };
for (const name of Object.keys(env))
  if (/^(CSH_|SUPABASE_|NEXT_PUBLIC_|OWNER_USER_ID$|DATABASE_URL$)/.test(name))
    delete env[name];
Object.assign(env, {
  CSH_DATABASE_CA_PEM: fs.readFileSync(
    "tests/fixtures/supabase-prod-ca-2021.crt",
    "utf8",
  ),
  CSH_PROOF_MODE: "cloud-benchmark-v1",
  CSH_PROJECT_REF: "abcdefghijklmnopqrst",
  OWNER_USER_ID: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  CSH_APP_ORIGIN: "https://proof.example.com",
  CSH_AUTH_URL: "https://abcdefghijklmnopqrst.supabase.co",
  CSH_AUTH_PUBLISHABLE_KEY: "sb_publishable_SYNTHETIC_ONLY_1234567890",
  CSH_POOLER_HOST: "aws-1-ap-southeast-1.pooler.supabase.com",
  DATABASE_URL:
    "postgresql://csh_runtime.abcdefghijklmnopqrst:SYNTHETIC_ONLY@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=verify-full",
});
const fd = fs.openSync(dir + "/proof-negative-server.log", "w");
const child = spawn(
  process.execPath,
  [
    path.resolve("benchmarks/cloud-proof/node_modules/next/dist/bin/next"),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: path.resolve("benchmarks/cloud-proof"),
    env,
    windowsHide: true,
    stdio: ["ignore", fd, fd],
  },
);
const request = (url, options = {}) =>
  new Promise((resolve, reject) => {
    const r = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: url,
        method: options.method ?? "GET",
        headers: { host: "proof.example.com", ...options.headers },
        timeout: 8000,
      },
      (res) => {
        const parts = [];
        res.on("data", (b) => parts.push(b));
        res.on("end", () => {
          const result = {
            status: res.statusCode,
            headers: new Headers(
              Object.fromEntries(
                Object.entries(res.headers)
                  .filter(([, v]) => v !== undefined)
                  .map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : v]),
              ),
            ),
            json: async () => JSON.parse(Buffer.concat(parts).toString()),
            clone: () => result,
          };
          resolve(result);
        });
      },
    );
    r.on("error", reject);
    r.on("timeout", () => r.destroy(Error("TIMEOUT")));
    if (options.body) r.write(options.body);
    r.end();
  });
try {
  const until = Date.now() + 20000;
  let up = false;
  while (Date.now() < until) {
    try {
      up = (await request("/api/health")).status === 200;
      if (up) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(up, "Proof server did not start");
  assert.equal((await request("/")).status, 200);
  checks.push("public-technical-UI-no-content");
  const denied = await request("/api/proof");
  if (denied.status !== 401)
    console.error(
      "ANONYMOUS_RESPONSE_STATUS=" +
        denied.status +
        " CODE=" +
        String((await denied.clone().json()).error),
    );
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get("cache-control"), /no-store/);
  checks.push("anonymous-private-route-401-no-store");
  assert.equal(
    (
      await request("/api/proof", {
        headers: { "x-user-id": env.OWNER_USER_ID },
      })
    ).status,
    403,
  );
  checks.push("forged-identity-header-403");
  assert.equal(
    (
      await request("/api/proof", {
        method: "POST",
        headers: {
          origin: "https://attacker.invalid",
          "content-type": "application/json",
          "x-csh-proof": "1",
        },
        body: "{}",
      })
    ).status,
    403,
  );
  checks.push("cross-origin-write-403");
  assert.equal(
    (
      await request("/api/proof", {
        method: "POST",
        headers: {
          origin: env.CSH_APP_ORIGIN,
          "content-type": "application/json",
          "x-csh-proof": "1",
        },
        body: JSON.stringify({ key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
      })
    ).status,
    401,
  );
  checks.push("anonymous-write-401");
  console.log(
    `PASS ${checks.length} local negative proof routes; cloud Auth/RLS/TLS/latency NOT tested.`,
  );
} catch (e) {
  console.error(
    e instanceof assert.AssertionError
      ? "NEGATIVE_ROUTE_ASSERTION_FAILED"
      : "NEGATIVE_ROUTE_CHECK_FAILED",
  );
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
  fs.closeSync(fd);
  fs.writeFileSync(
    dir + "/proof-negative.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        passed: checks.length,
        expected: 5,
        checks,
        cloudVerified: false,
      },
      null,
      2,
    ) + "\n",
  );
}
