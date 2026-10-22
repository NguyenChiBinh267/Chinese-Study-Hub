import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  targetSchema,
  cloudUrl,
  managedFoundation,
  managedPolicyCompilation,
  verifiedPgOptions,
} from "../../scripts/cloud-gates-policy";
import {
  configuration,
  verifiedPgOptions as proofPgOptions,
} from "../../lib/config";
const target = targetSchema.parse({
  projectRef: "abcdefghijklmnopqrst",
  organization: "mcqypdwzlglhrosegrli",
  name: "chinese-study-hub",
  region: "ap-southeast-1",
  plan: "Free",
  observedAt: "2026-10-22T00:00:00.000Z",
  poolerHost: "aws-1-ap-southeast-1.pooler.supabase.com",
  ownerConfirmedNewIsolatedProject: true,
});
const runtime = `postgresql://csh_runtime.${target.projectRef}:SYNTHETIC_ONLY@${target.poolerHost}:6543/postgres?sslmode=verify-full`;
test("Cloud: exact project, custom role, transaction pooler and verified TLS required", () => {
  assert.equal(cloudUrl(runtime, target).hostname, target.poolerHost);
  for (const value of [
    runtime.replace(target.projectRef, "mhhbetnwdpigljqnnthu"),
    runtime.replace("csh_runtime.", "postgres."),
    runtime.replace(":6543/", ":5432/"),
    runtime.replace("verify-full", "require"),
    runtime + "&sslrootcert=system",
    runtime.replace(target.poolerHost, "untrusted.example.com"),
    runtime.replace("SYNTHETIC_ONLY", ""),
  ])
    assert.throws(() => cloudUrl(value, target));
  assert.throws(() =>
    cloudUrl(runtime, { ...target, projectRef: "mhhbetnwdpigljqnnthu" }),
  );
});
test("Cloud: admin URL limited to explicit session pooler and the new project", () => {
  const admin = runtime
    .replace("csh_runtime.", "postgres.")
    .replace(":6543/", ":5432/");
  assert.doesNotThrow(() => cloudUrl(admin, target, true));
  assert.throws(() => cloudUrl(runtime, target, true));
});
test("Cloud: TLS keeps the provider CA, verifies host identity and rejects URL overrides", () => {
  const ca = fs.readFileSync(
    "tests/fixtures/supabase-prod-ca-2021.crt",
    "utf8",
  );
  for (const make of [verifiedPgOptions, proofPgOptions]) {
    const pg = make(runtime, ca);
    assert.equal(new URL(pg.connectionString).search, "");
    assert.equal(pg.ssl.rejectUnauthorized, true);
    assert.equal(pg.ssl.servername, target.poolerHost);
    assert.throws(() => make(runtime, "UNTRUSTED_CA"));
    assert.throws(() => make(runtime.replace("verify-full", "require"), ca));
  }
});
test("Cloud: managed baseline retains RLS and managed Auth without rewriting local migrations", () => {
  const source = fs.readFileSync(
    "supabase/migrations/202610170001_local_foundation.sql",
    "utf8",
  );
  const managed = managedFoundation(source);
  assert.ok(!managed.includes("CREATE SCHEMA auth"));
  assert.ok(!managed.includes("CREATE FUNCTION auth.uid"));
  assert.ok(!managed.includes("REVOKE ALL ON FUNCTION auth.uid"));
  const compiled = managedPolicyCompilation(managed);
  assert.ok(compiled.includes("RESET ROLE;\nDO $$"));
  assert.equal(
    compiled
      .replaceAll("RESET ROLE;\n", "")
      .replaceAll("\nSET LOCAL ROLE csh_schema_owner;", ""),
    managed.replaceAll("\nSET LOCAL ROLE csh_schema_owner;", ""),
  );
  for (const part of [
    "FORCE ROW LEVEL SECURITY",
    "WITH CHECK (user_id=auth.uid())",
    "SET LOCAL ROLE csh_schema_owner",
  ])
    assert.ok(managed.includes(part));
  assert.throws(() =>
    managedFoundation(
      source.replace("CREATE SCHEMA auth", "CREATE SCHEMA other"),
    ),
  );
});

const proofEnv = {
  CSH_DATABASE_CA_PEM: fs.readFileSync(
    "tests/fixtures/supabase-prod-ca-2021.crt",
    "utf8",
  ),
  NODE_ENV: "production",
  CSH_PROOF_MODE: "cloud-benchmark-v1",
  CSH_PROJECT_REF: target.projectRef,
  OWNER_USER_ID: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  CSH_APP_ORIGIN: "https://proof.example.com",
  CSH_AUTH_URL: `https://${target.projectRef}.supabase.co`,
  CSH_AUTH_PUBLISHABLE_KEY: "sb_publishable_SYNTHETIC_ONLY_1234567890",
  CSH_POOLER_HOST: target.poolerHost,
  DATABASE_URL: runtime,
} as NodeJS.ProcessEnv;
test("Cloud proof: requires owner, exact provider, HTTPS and dedicated mode", () => {
  assert.equal(configuration(proofEnv, "production").secure, true);
  for (const patch of [
    { OWNER_USER_ID: undefined },
    { CSH_APP_ORIGIN: "http://proof.example.com" },
    { CSH_AUTH_URL: "https://untrusted.example.com" },
    { CSH_PROOF_MODE: undefined },
    { CSH_PROOF_LOCAL_TEST: "1" },
  ])
    assert.throws(() => configuration({ ...proofEnv, ...patch }, "production"));
});
test("Cloud proof: admin credentials and real content flags are refused", () => {
  for (const name of [
    "SUPABASE_DB_PASSWORD",
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "CSH_CONTENT_RELEASE",
    "CSH_CONTENT_TEST_ROOT",
    "CSH_PRIVATE_OWNER_PREVIEW",
    "NEXT_PUBLIC_DATABASE_SECRET",
  ])
    assert.throws(() =>
      configuration({ ...proofEnv, [name]: "SYNTHETIC_ONLY" }, "production"),
    );
  assert.throws(() =>
    configuration(
      {
        ...proofEnv,
        CSH_AUTH_PUBLISHABLE_KEY: "sb_secret_" + "SYNTHETIC_ONLY_1234567890",
      },
      "production",
    ),
  );
});
test("Cloud proof: runtime never accepts the admin role or unverified TLS", () => {
  for (const value of [
    runtime.replace("csh_runtime.", "postgres."),
    runtime.replace("verify-full", "require"),
    runtime.replace(":6543/", ":5432/"),
  ])
    assert.throws(() =>
      configuration({ ...proofEnv, DATABASE_URL: value }, "production"),
    );
});
test("Cloud proof: local cookie exception is development-only and cannot reach public hosts", () => {
  const local = {
    ...proofEnv,
    NODE_ENV: "development",
    CSH_PROOF_LOCAL_TEST: "1",
    CSH_APP_ORIGIN: "http://127.0.0.1:3031",
  } as NodeJS.ProcessEnv;
  assert.equal(configuration(local, "development").secure, false);
  assert.throws(() => configuration(local, "production"));
  assert.throws(() =>
    configuration(
      { ...local, CSH_APP_ORIGIN: "http://public.example.com" },
      "development",
    ),
  );
});
