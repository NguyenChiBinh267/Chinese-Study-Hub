// Real cloud GoTrue lifecycle; raw credentials/tokens stay in ignored local files.
import fs from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const dir = ".local-postgres/cloud-gates",
  read = (n) =>
    JSON.parse(fs.readFileSync(`${dir}/${n}`, "utf8").replace(/^\uFEFF/, ""));
const cfg = read("auth-config.json"),
  accounts = read("auth-test-accounts.json");
if (
  cfg.projectRef !== "yartjbdapoyqcxfagsrj" ||
  accounts.projectRef !== cfg.projectRef
)
  throw Error("PINNED_CLOUD_AUTH_REQUIRED");
const make = () =>
  createClient(cfg.providerUrl, cfg.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const reportFile = dir + "/cloud-auth.json";
const report = process.argv.includes("--expiry")
  ? read("cloud-auth.json")
  : {
      at: new Date().toISOString(),
      projectRef: cfg.projectRef,
      environment: "supabase-cloud",
      expected: 8,
      checks: [],
      completed: false,
      rawTokensInReport: false,
    };
async function check(name, fn) {
  await fn();
  if (!report.checks.includes(name)) report.checks.push(name);
  fs.writeFileSync(
    reportFile,
    JSON.stringify({ ...report, passed: report.checks.length }, null, 2) + "\n",
  );
  console.log("PASS " + name);
}
async function signin(client, label = "owner") {
  const a = accounts[label];
  const r = await client.auth.signInWithPassword({
    email: a.email,
    password: a.password,
  });
  assert.equal(r.error, null);
  assert.ok(r.data.session);
  assert.equal(r.data.user.id, a.id);
  return r.data.session;
}
async function main() {
  if (process.argv.includes("--expiry")) {
    const saved = read("expiry-session.json");
    if (Date.now() / 1000 <= saved.expiresAt + 2) {
      console.log("PENDING actual token expiry; no forged token substituted.");
      process.exitCode = 78;
      return;
    }
    await check(
      "actual-expired-token-denied-refresh-restores-and-logout-revokes",
      async () => {
        const client = make();
        const expired = await client.auth.getUser(saved.accessToken);
        assert.ok(expired.error);
        assert.equal(expired.data.user, null);
        const refreshed = await client.auth.refreshSession({
          refresh_token: saved.refreshToken,
        });
        assert.equal(refreshed.error, null);
        assert.equal(
          (await client.auth.getUser()).data.user?.id,
          accounts.owner.id,
        );
        assert.equal(
          (await client.auth.signOut({ scope: "local" })).error,
          null,
        );
        assert.ok(
          (
            await client.auth.refreshSession({
              refresh_token: refreshed.data.session.refresh_token,
            })
          ).error,
        );
      },
    );
    assert.equal(report.checks.length, 8);
    report.completed = true;
    report.expiryPending = false;
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(
      reportFile,
      JSON.stringify({ ...report, passed: 8 }, null, 2) + "\n",
    );
    console.log(
      "PASS 8 actual cloud Auth lifecycle groups including real expiry.",
    );
    return;
  }
  await check("cloud-public-signup-disabled", async () => {
    const r = await fetch(cfg.providerUrl + "/auth/v1/settings", {
      headers: { apikey: cfg.publishableKey },
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).disable_signup, true);
  });
  await check("anonymous-user-verification-denied", async () => {
    const r = await make().auth.getUser();
    assert.ok(r.error);
    assert.equal(r.data.user, null);
  });
  const owner = make();
  let session;
  await check("actual-owner-password-login-and-remote-get-user", async () => {
    session = await signin(owner);
    const r = await owner.auth.getUser();
    assert.equal(r.error, null);
    assert.equal(r.data.user.id, accounts.owner.id);
    assert.equal(r.data.user.role, "authenticated");
    assert.equal(r.data.user.is_anonymous, false);
    const expiresAt = JSON.parse(
      Buffer.from(session.access_token.split(".")[1], "base64url").toString(),
    ).exp;
    fs.writeFileSync(
      dir + "/expiry-session.json",
      JSON.stringify({
        projectRef: cfg.projectRef,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt,
      }),
      { mode: 0o600 },
    );
    report.actualExpiryDue = expiresAt;
  });
  await check("actual-nonowner-has-distinct-provider-identity", async () => {
    const c = make();
    await signin(c, "nonowner");
    const r = await c.auth.getUser();
    assert.equal(r.data.user.id, accounts.nonowner.id);
    assert.notEqual(r.data.user.id, accounts.owner.id);
    await c.auth.signOut({ scope: "local" });
  });
  await check("forged-signature-rejected-by-real-provider", async () => {
    const parts = session.access_token.split(".");
    parts[2] = (parts[2][0] === "a" ? "b" : "a") + parts[2].slice(1);
    const r = await make().auth.getUser(parts.join("."));
    assert.ok(r.error);
    assert.equal(r.data.user, null);
  });
  await check(
    "wrong-password-and-public-signup-fail-without-email",
    async () => {
      assert.ok(
        (
          await make().auth.signInWithPassword({
            email: accounts.owner.email,
            password: "SYNTHETIC_WRONG_PASSWORD_ONLY",
          })
        ).error,
      );
      assert.ok(
        (
          await make().auth.signUp({
            email: "signup-denied-cloud-gate@csh.invalid",
            password: "aA1!SYNTHETIC_NOT_A_USER",
          })
        ).error,
      );
    },
  );
  await check("actual-refresh-and-local-session-revocation", async () => {
    const c = make(),
      s = await signin(c);
    const r = await c.auth.refreshSession({ refresh_token: s.refresh_token });
    assert.equal(r.error, null);
    assert.equal((await c.auth.getUser()).data.user.id, accounts.owner.id);
    assert.equal((await c.auth.signOut({ scope: "local" })).error, null);
    assert.ok(
      (
        await make().auth.refreshSession({
          refresh_token: r.data.session.refresh_token,
        })
      ).error,
    );
  });
  fs.writeFileSync(
    reportFile,
    JSON.stringify(
      { ...report, passed: report.checks.length, expiryPending: true },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "PASS 7 actual cloud Auth groups; natural-expiry check remains pending.",
  );
}
main().catch(() => {
  console.error("CLOUD_AUTH_VERIFICATION_FAILED");
  process.exitCode = 1;
});
