// Supported GoTrue Admin API, only for the new isolated project. Never imported by web code.
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const dir = ".local-postgres/cloud-gates",
  read = (n) =>
    JSON.parse(fs.readFileSync(dir + "/" + n, "utf8").replace(/^\uFEFF/, ""));
async function main() {
  if (process.argv[2] !== "--create-synthetic-owner")
    throw Error("EXPLICIT_BOOTSTRAP_ACTION_REQUIRED");
  const p = read("project.json");
  if (
    p.projectRef !== "yartjbdapoyqcxfagsrj" ||
    p.name !== "chinese-study-hub" ||
    p.plan !== "Free"
  )
    throw Error("UNRECOGNIZED_PROJECT");
  const keys = read("api-keys.json");
  if (!Array.isArray(keys)) throw Error("API_KEYS_FORMAT_REQUIRED");
  const anon = keys.find((k) => k.name === "anon")?.api_key,
    service = keys.find((k) => k.name === "service_role")?.api_key;
  if (!anon || !service)
    throw Error("SUPPORTED_ADMIN_AND_PUBLIC_KEYS_REQUIRED");
  const url = `https://${p.projectRef}.supabase.co`;
  const settings = await fetch(url + "/auth/v1/settings", {
    headers: { apikey: anon },
    signal: AbortSignal.timeout(10000),
  });
  if (!settings.ok || (await settings.json()).disable_signup !== true)
    throw Error("PUBLIC_SIGNUP_MUST_BE_DISABLED_FIRST");
  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const file = dir + "/auth-test-accounts.json";
  const state = fs.existsSync(file)
    ? read("auth-test-accounts.json")
    : {
        projectRef: p.projectRef,
        owner: {
          email: "owner-cloud-gate@csh.invalid",
          password: "aA1!" + randomBytes(32).toString("base64url"),
        },
        nonowner: {
          email: "nonowner-cloud-gate@csh.invalid",
          password: "aA1!" + randomBytes(32).toString("base64url"),
        },
      };
  if (state.projectRef !== p.projectRef)
    throw Error("AUTH_STATE_PROJECT_MISMATCH");
  fs.writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });
  const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (existing.error) throw Error("AUTH_USER_INSPECTION_FAILED");
  if (
    existing.data.users.some(
      (u) => ![state.owner.email, state.nonowner.email].includes(u.email),
    )
  )
    throw Error("UNRECOGNIZED_AUTH_USER_DO_NOT_OVERWRITE");
  for (const label of ["owner", "nonowner"]) {
    const account = state[label];
    const old = existing.data.users.find((u) => u.email === account.email);
    if (account.id) {
      if (old) {
        if (old.id !== account.id) throw Error("AUTH_IDENTITY_DRIFT");
        continue;
      }
      const cleanup = fs.existsSync(dir + "/cloud-cohort-cleanup.json")
        ? read("cloud-cohort-cleanup.json")
        : null;
      if (
        label !== "nonowner" ||
        cleanup?.projectRef !== p.projectRef ||
        cleanup?.syntheticNonownerRemoved !== true
      )
        throw Error("AUTH_IDENTITY_DRIFT");
      delete account.id;
    }
    if (old) throw Error("PREEXISTING_ACCOUNT_REQUIRES_OWNER_RECONCILIATION");
    const result = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
    });
    if (result.error || !result.data.user)
      throw Error("SUPPORTED_AUTH_USER_CREATION_FAILED");
    account.id = result.data.user.id;
    fs.writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });
  }
  fs.writeFileSync(
    dir + "/auth-config.json",
    JSON.stringify({
      projectRef: p.projectRef,
      providerUrl: url,
      publishableKey: anon,
    }),
    { mode: 0o600 },
  );
  fs.writeFileSync(
    dir + "/owner-login.txt",
    `Synthetic technical owner for this cloud gate only. Not a production release account.\nEmail: ${state.owner.email}\nPassword: ${state.owner.password}\n`,
    { mode: 0o600 },
  );
  fs.writeFileSync(
    dir + "/auth-bootstrap.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        projectRef: p.projectRef,
        publicSignupDisabled: true,
        syntheticAccounts: 2,
        supportedAdminApi: true,
        emailInvitationsSent: 0,
        serviceCredentialInWebApp: false,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS supported synthetic owner/non-owner bootstrap; signup disabled; no email sent. Credentials kept only in ignored local files.",
  );
}
main().catch((e) => {
  console.error(
    /^[A-Z0-9_]+$/.test(e.message) ? e.message : "CLOUD_AUTH_BOOTSTRAP_FAILED",
  );
  process.exitCode = 1;
});
