import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appMode,
  authConfiguration,
  AuthConfigurationError,
} from "../../src/modules/auth/server/config";
import { safeRedirect } from "../../src/modules/auth/domain/mode";
import { profileCommand } from "../../src/modules/auth/domain/profile";
import {
  technicalFixtureConfiguration,
  TECHNICAL_FIXTURE,
} from "../../src/modules/auth/domain/technical-fixture";
const owner = "9de72601-f367-4de7-8e84-52b0cc898596";
const production: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  CSH_APP_MODE: "PRODUCTION_AUTHENTICATED",
  OWNER_USER_ID: owner,
  CSH_APP_ORIGIN: "https://study.example.invalid",
  CSH_AUTH_URL: "https://project.supabase.co",
  CSH_AUTH_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrstuvwxyz123456",
  DATABASE_URL:
    "postgresql://csh_runtime:synthetic-test-password@aws-0-region.pooler.supabase.com:6543/postgres?sslmode=verify-full",
};
test("Technical content requires local Auth, an isolated database and development build; it cannot become production content", () => {
  const env: NodeJS.ProcessEnv = {
    ...production,
    NODE_ENV: "development",
    CSH_APP_ORIGIN: "http://127.0.0.1:3023",
    CSH_AUTH_URL: "http://127.0.0.1:54390",
    DATABASE_URL:
      "postgresql://csh_runtime:synthetic@127.0.0.1:5447/csh_auth_verify_abcdef123456",
    CSH_AUTH_TECHNICAL_FIXTURE: TECHNICAL_FIXTURE,
  };
  assert.equal(technicalFixtureConfiguration(env, "development"), true);
  assert.equal(authConfiguration(env, "development").technicalFixture, true);
  for (const patch of [
    { DATABASE_URL: production.DATABASE_URL },
    {
      DATABASE_URL: env.DATABASE_URL!.replace(
        "csh_auth_verify_abcdef123456",
        "csh_local",
      ),
    },
    { CSH_APP_MODE: "LOCAL_DATABASE_DEV" },
    { CSH_AUTH_TECHNICAL_FIXTURE: "1" },
    { NODE_ENV: "production" },
  ] satisfies Partial<NodeJS.ProcessEnv>[])
    assert.equal(
      technicalFixtureConfiguration({ ...env, ...patch }, "development"),
      false,
    );
  assert.throws(
    () => authConfiguration(env, "production"),
    (e: AuthConfigurationError) => e.code === "TECHNICAL_FIXTURE_FORBIDDEN",
  );
  assert.throws(
    () =>
      authConfiguration(
        { ...production, CSH_AUTH_TECHNICAL_FIXTURE: TECHNICAL_FIXTURE },
        "production",
      ),
    (e: AuthConfigurationError) => e.code === "TECHNICAL_FIXTURE_FORBIDDEN",
  );
});
test("Production always requires authenticated mode; DEMO and local runtime flags are rejected", () => {
  assert.equal(
    appMode({ NODE_ENV: "production" }, "production"),
    "PRODUCTION_AUTHENTICATED",
  );
  for (const env of [
    { ...production, CSH_APP_MODE: "DEMO" },
    { ...production, CSH_APP_MODE: "LOCAL_DATABASE_DEV" },
    { ...production, CSH_APP_MODE: "typo" },
  ])
    assert.throws(() => appMode(env, "production"), AuthConfigurationError);
});
test("Production configuration accepts only a single UUID owner, HTTPS, public Auth key and least-privilege TLS database credentials", () => {
  const cfg = authConfiguration(production, "production");
  assert.equal(cfg.ownerId, owner);
  assert.equal(cfg.secure, true);
  for (const patch of [
    { OWNER_USER_ID: undefined },
    { OWNER_USER_ID: "email@example.invalid" },
    { OWNER_USER_ID: owner + "," + owner },
    { CSH_APP_ORIGIN: "http://study.example.invalid" },
    { CSH_AUTH_URL: "http://127.0.0.1:54390" },
    { CSH_APP_ORIGIN: "https://study.example.invalid/path" },
    { CSH_APP_ORIGIN: "https://user:password@study.example.invalid" },
    { CSH_AUTH_PUBLISHABLE_KEY: "sb_secret_never-allowed" },
    { CSH_AUTH_PUBLISHABLE_KEY: "invalid" },
    {
      DATABASE_URL:
        "postgresql://postgres:synthetic@db.supabase.co/postgres?sslmode=verify-full",
    },
    {
      DATABASE_URL:
        "postgresql://csh_runtime:synthetic@db.supabase.co/postgres?sslmode=require",
    },
    { DATABASE_URL: undefined },
  ])
    assert.throws(
      () => authConfiguration({ ...production, ...patch }, "production"),
      AuthConfigurationError,
    );
});
test("Production fails closed with development flags, public server values or unexpected provider credentials", () => {
  for (const patch of [
    { CSH_LOCAL_DATABASE: "1" },
    { CSH_LOCAL_OWNER_ID: owner },
    { CSH_LOCAL_SESSION_SECRET: "synthetic" },
    { SUPABASE_SERVICE_ROLE_KEY: "synthetic" },
    { SUPABASE_SECRET_KEY: "synthetic" },
    { NEXT_PUBLIC_DATABASE_URL: "synthetic" },
    { OPENAI_API_KEY: "synthetic" },
  ])
    assert.throws(
      () => authConfiguration({ ...production, ...patch }, "production"),
      AuthConfigurationError,
    );
});
test("Local real Auth integration permits only development loopback HTTP, not a production TLS bypass", () => {
  const env: NodeJS.ProcessEnv = {
    ...production,
    NODE_ENV: "development",
    CSH_APP_ORIGIN: "http://127.0.0.1:3021",
    CSH_AUTH_URL: "http://127.0.0.1:54390",
    DATABASE_URL: "postgresql://csh_runtime:synthetic@127.0.0.1:5447/csh_local",
  };
  assert.equal(authConfiguration(env, "development").secure, false);
  assert.throws(() => authConfiguration(env, "production"));
  assert.throws(() =>
    authConfiguration(
      { ...env, CSH_APP_ORIGIN: "http://192.168.1.2:3021" },
      "development",
    ),
  );
});
test("Return paths cannot become open redirects, auth loops, backslash URLs or encoded bypasses", () => {
  for (const value of [
    "https://evil.invalid",
    "//evil.invalid",
    "/\\evil.invalid",
    "/login",
    "/api/v1/me",
    "/%2f%2fevil.invalid",
    "/today\n//evil.invalid",
    null,
    "/learn/../../login",
  ]) {
    assert.equal(safeRedirect(value), "/today");
  }
  assert.equal(
    safeRedirect("/learn/courses/hsk1?unit=1"),
    "/learn/courses/hsk1?unit=1",
  );
  assert.equal(safeRedirect("/account"), "/account");
});
test("Profile rejects forged ownership, unknown fields, invalid timezone and unbounded display input", () => {
  const good = {
    displayName: "Người học",
    textSize: "normal",
    timezone: "Asia/Saigon",
  };
  assert.equal(profileCommand.safeParse(good).success, true);
  for (const patch of [
    { userId: owner },
    { timezone: "Invalid/Moon" },
    { textSize: "999px" },
    { displayName: "a".repeat(81) },
  ])
    assert.equal(
      profileCommand.safeParse({ ...good, ...patch }).success,
      false,
    );
});
