// Exercises the actual built Next server. Every case must refuse startup;
// synthetic configuration never authorizes a real provider or database call.
import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const base = {
  ...process.env,
  NODE_ENV: "production",
  CSH_APP_MODE: "PRODUCTION_AUTHENTICATED",
  OWNER_USER_ID: "9de72601-f367-4de7-8e84-52b0cc898596",
  CSH_APP_ORIGIN: "https://study.example.invalid",
  CSH_AUTH_URL: "https://project.supabase.co",
  CSH_AUTH_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrstuvwxyz123456",
  DATABASE_URL:
    "postgresql://csh_runtime:synthetic-test-password@db.project.supabase.co/postgres?sslmode=verify-full",
  CSH_LOCAL_DATABASE: "",
  CSH_LOCAL_OWNER_ID: "",
  CSH_LOCAL_SESSION_SECRET: "",
  CSH_CONTENT_TEST_ROOT: "",
  CSH_CONTENT_RELEASE: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_SECRET_KEY: "",
  OPENAI_API_KEY: "",
  AZURE_OPENAI_API_KEY: "",
  GEMINI_API_KEY: "",
  NEXT_PUBLIC_DATABASE_URL: "",
};
// Empty public variables do not contain a credential, and must not pollute other cases.
delete base.NEXT_PUBLIC_DATABASE_URL;
const cases = [
  [
    "private-preview-in-production",
    { CSH_PRIVATE_OWNER_PREVIEW: "local-v1" },
    "PRIVATE_PREVIEW_LOCAL_ONLY",
  ],
  [
    "runtime-node-env-private-preview",
    {
      NODE_ENV: "development",
      CSH_PRIVATE_OWNER_PREVIEW: "local-v1",
      CSH_APP_ORIGIN: "http://127.0.0.1:3025",
      CSH_AUTH_URL: "http://127.0.0.1:54390",
      DATABASE_URL:
        "postgresql://csh_runtime:synthetic@127.0.0.1:5447/csh_private_verify_012345abcdef",
    },
    "PRIVATE_PREVIEW_LOCAL_ONLY",
  ],
  [
    "content-test-in-production",
    { CSH_CONTENT_TEST_ROOT: ".local-postgres/synthetic" },
    "CONTENT_TEST_FORBIDDEN",
  ],
  [
    "runtime-node-env-content-test",
    {
      NODE_ENV: "development",
      CSH_CONTENT_TEST_ROOT: ".local-postgres/synthetic",
    },
    "CONTENT_TEST_FORBIDDEN",
  ],
  [
    "untrusted-content-release",
    { CSH_CONTENT_RELEASE: "untrusted-v1" },
    "RELEASE_UNAVAILABLE",
  ],
  [
    "default-missing-owner",
    { CSH_APP_MODE: "", OWNER_USER_ID: "" },
    "OWNER_USER_ID_REQUIRED",
  ],
  [
    "local-mode",
    { CSH_APP_MODE: "LOCAL_DATABASE_DEV" },
    "DEVELOPMENT_MODE_IN_PRODUCTION",
  ],
  [
    "runtime-node-env-cannot-enable-local",
    { NODE_ENV: "development", CSH_APP_MODE: "LOCAL_DATABASE_DEV" },
    "DEVELOPMENT_MODE_IN_PRODUCTION",
  ],
  [
    "http-origin",
    { CSH_APP_ORIGIN: "http://study.example.invalid" },
    "HTTPS_REQUIRED",
  ],
  [
    "http-auth-provider",
    { CSH_AUTH_URL: "http://127.0.0.1:54390" },
    "HTTPS_REQUIRED",
  ],
  [
    "development-flags",
    { CSH_LOCAL_DATABASE: "1" },
    "DEVELOPMENT_FLAGS_PRESENT",
  ],
  [
    "service-role",
    { SUPABASE_SERVICE_ROLE_KEY: "synthetic-not-used" },
    "UNEXPECTED_PROVIDER_CREDENTIAL",
  ],
  [
    "public-server-value",
    { NEXT_PUBLIC_DATABASE_URL: "synthetic-not-used" },
    "SERVER_VALUE_MARKED_PUBLIC",
  ],
  [
    "admin-db-role",
    {
      DATABASE_URL:
        "postgresql://postgres:synthetic@db.project.supabase.co/postgres?sslmode=verify-full",
    },
    "LEAST_PRIVILEGE_DATABASE_ROLE_REQUIRED",
  ],
  [
    "unverified-db-tls",
    {
      DATABASE_URL:
        "postgresql://csh_runtime:synthetic@db.project.supabase.co/postgres?sslmode=require",
    },
    "VERIFIED_DATABASE_TLS_REQUIRED",
  ],
];
const results = [];
cases.push([
  "missing-provider-ca",
  { CSH_DATABASE_CA_PEM: "" },
  "VERIFIED_PROVIDER_CA_REQUIRED",
]);
cases.push([
  "untrusted-provider-ca",
  { CSH_DATABASE_CA_PEM: "SYNTHETIC_NOT_A_CERTIFICATE" },
  "VERIFIED_PROVIDER_CA_REQUIRED",
]);
cases.push([
  "technical-fixture-in-production",
  { CSH_AUTH_TECHNICAL_FIXTURE: "csh-auth-technical-v1" },
  "TECHNICAL_FIXTURE_FORBIDDEN",
]);
for (const [name, patch, code] of cases) {
  let result;
  try {
    execFileSync(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3022",
      ],
      {
        env: { ...base, ...patch },
        windowsHide: true,
        stdio: "pipe",
        timeout: 15000,
      },
    );
    throw Error("Unexpected successful startup");
  } catch (e) {
    if (!Number.isInteger(e.status) || e.status === 0)
      throw Error("Startup gate did not exit safely: " + name);
    result = String(e.stdout ?? "") + String(e.stderr ?? "");
    assert.ok(result.includes(code), "Wrong refusal code for " + name);
    fs.writeFileSync(
      ".local-postgres/sprint10/startup-" + name + ".log",
      result,
    );
  }
  results.push({ name, expectedCode: code, result: "PASS_REFUSED_STARTUP" });
}
fs.writeFileSync(
  ".local-postgres/sprint10/production-startup.json",
  JSON.stringify(
    {
      kind: "REAL_NEXT_PRODUCTION_ARTIFACT_NEGATIVE_CONFIGURATION_TESTS",
      at: new Date().toISOString(),
      passed: results.length,
      failed: 0,
      results,
      cloudContact: false,
    },
    null,
    2,
  ),
);
console.log(
  `PASS ${results.length} production-artifact startup refusals; no cloud contact.`,
);
