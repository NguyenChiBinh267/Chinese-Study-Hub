// Real local GoTrue lifecycle checks, not a JWT simulator or cloud attestation.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const dir = ".local-postgres/sprint10/auth-local",
  file = path.join(dir, "credentials.json"),
  cfg = JSON.parse(fs.readFileSync(file));
const checks = [],
  short = cfg.auth.replace("server", "short"),
  base = "http://127.0.0.1:54391";
const docker = (args) =>
  execFileSync("docker", args, {
    windowsHide: true,
    stdio: "pipe",
    encoding: "utf8",
    timeout: 60000,
  });
const headers = { "Content-Type": "application/json" };
const login = (password = cfg.owner.password, url = base) =>
  fetch(url + "/token?grant_type=password", {
    method: "POST",
    headers,
    body: JSON.stringify({ email: cfg.owner.email, password }),
  });
let started = false;
try {
  const env = path.resolve(dir, "short.env");
  fs.writeFileSync(
    env,
    fs
      .readFileSync(path.join(dir, "auth.env"), "utf8")
      .replace("GOTRUE_JWT_EXP=3600", "GOTRUE_JWT_EXP=2"),
    { mode: 0o600 },
  );
  let exists = false;
  try {
    const c = JSON.parse(docker(["inspect", short]))[0];
    if (c.Config.Labels?.["csh.sprint"] !== "10")
      throw Error("Wrong managed resource");
    exists = true;
  } catch {
    /* Only this uniquely named disposable Auth instance. */
  }
  docker(
    exists
      ? ["start", short]
      : [
          "run",
          "-d",
          "--name",
          short,
          "--label",
          "csh.sprint=10",
          "--network",
          cfg.network,
          "--env-file",
          env,
          "-p",
          "127.0.0.1:54392:9999",
          "supabase/gotrue:v2.197.0",
        ],
  );
  started = true;
  let healthy = false;
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch("http://127.0.0.1:54392/health")).ok) {
        healthy = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.equal(healthy, true);
  const signin = await login(cfg.owner.password, "http://127.0.0.1:54392"),
    session = await signin.json();
  assert.equal(signin.status, 200);
  checks.push("REAL_PASSWORD_LOGIN");
  const claims = JSON.parse(
    Buffer.from(session.access_token.split(".")[1], "base64url").toString(),
  );
  assert.equal(claims.sub, cfg.owner.id);
  assert.ok(claims.exp - claims.iat <= 5);
  checks.push("REAL_PROVIDER_ISSUED_SHORT_LIVED_JWT");
  await new Promise((r) =>
    setTimeout(r, Math.max(0, claims.exp * 1000 - Date.now()) + 1200),
  );
  const expired = await fetch(base + "/user", {
    headers: { Authorization: "Bearer " + session.access_token },
  });
  assert.ok([401, 403].includes(expired.status));
  assert.equal((await expired.json()).error_code, "bad_jwt");
  checks.push("NATURALLY_EXPIRED_ACCESS_TOKEN_REJECTED");
  const refresh = await fetch(base + "/token?grant_type=refresh_token", {
      method: "POST",
      headers,
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    }),
    fresh = await refresh.json();
  assert.equal(refresh.status, 200);
  assert.equal(fresh.user.id, cfg.owner.id);
  checks.push("REAL_REFRESH_AFTER_CRYPTOGRAPHIC_EXPIRY");
  const out = await fetch(base + "/logout?scope=local", {
    method: "POST",
    headers: { Authorization: "Bearer " + fresh.access_token },
  });
  assert.equal(out.status, 204);
  assert.equal(
    (
      await fetch(base + "/user", {
        headers: { Authorization: "Bearer " + fresh.access_token },
      })
    ).status,
    403,
  );
  checks.push("REVOKED_SESSION_REJECTED_BY_PROVIDER");
  const settings = await fetch(base + "/settings");
  assert.equal((await settings.json()).disable_signup, true);
  checks.push("SIGNUP_DISABLED");
  const nextPassword = randomBytes(32).toString("hex");
  const reset = await fetch(base + "/admin/users/" + cfg.owner.id, {
    method: "PUT",
    headers: { ...headers, Authorization: "Bearer " + cfg.adminKey },
    body: JSON.stringify({ password: nextPassword }),
  });
  assert.equal(reset.status, 200);
  assert.equal((await login()).status, 400);
  checks.push("ADMIN_PASSWORD_RESET_NO_EMAIL_OLD_PASSWORD_DENIED");
  assert.equal((await login(nextPassword)).status, 200);
  cfg.owner.password = nextPassword;
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  fs.writeFileSync(
    path.join(dir, "owner-login.txt"),
    `LOCAL TEST ACCOUNT ONLY — not your future production identity.\nEmail: ${cfg.owner.email}\nPassword: ${cfg.owner.password}\n`,
    { mode: 0o600 },
  );
  checks.push("NEW_PASSWORD_LOGIN_SUCCEEDS");
  fs.writeFileSync(
    ".local-postgres/sprint10/provider-tests.json",
    JSON.stringify(
      {
        kind: "REAL_LOCAL_GOTRUE_V2_197_0_NOT_MOCK_NOT_CLOUD",
        at: new Date().toISOString(),
        passed: checks.length,
        failed: 0,
        checks,
        rawTokensInReport: false,
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS ${checks.length} real local provider lifecycle checks; no tokens/passwords printed.`,
  );
} catch (e) {
  fs.writeFileSync(
    ".local-postgres/sprint10/provider-test-error.log",
    String(e.message),
  );
  console.error("Real provider check failed; see private diagnostic log.");
  process.exitCode = 1;
} finally {
  if (started) docker(["stop", short]);
}
