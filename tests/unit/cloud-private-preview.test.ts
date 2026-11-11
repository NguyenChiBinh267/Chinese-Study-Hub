import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import {
  loadPrivatePackages,
  loadPrivateOwnerPreview,
  privatePreviewAllowed,
} from "../../src/modules/content/application/private-preview";

const env: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  VERCEL: "1",
  VERCEL_ENV: "production",
  CSH_APP_MODE: "PRODUCTION_AUTHENTICATED",
  CSH_PRIVATE_OWNER_PREVIEW: "cloud-v1",
  CSH_APP_ORIGIN: "https://chinese-study-hub-owner.vercel.app",
  CSH_AUTH_URL: "https://yartjbdapoyqcxfagsrj.supabase.co",
  DATABASE_URL:
    "postgresql://csh_runtime.yartjbdapoyqcxfagsrj:dummy@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=verify-full",
};
test("Cloud scope pins exact production project, alias and role; preview and development flags fail closed", () => {
  assert.equal(privatePreviewAllowed(env, "production"), true);
  for (const change of [
    { VERCEL_ENV: "preview" },
    { VERCEL: "0" },
    { NODE_ENV: "development" },
    { CSH_APP_ORIGIN: "https://other.vercel.app" },
    { CSH_AUTH_URL: "https://other.supabase.co" },
    { DATABASE_URL: env.DATABASE_URL!.replace("csh_runtime.", "postgres.") },
    { DATABASE_URL: env.DATABASE_URL!.replace("verify-full", "require") },
    { CSH_LOCAL_OWNER_ID: "owner" },
    { CSH_CONTENT_RELEASE: "published" },
    { CSH_CONTENT_TEST_ROOT: "fixture" },
    { CSH_AUTH_TECHNICAL_FIXTURE: "fixture" },
  ] as NodeJS.ProcessEnv[])
    assert.equal(
      privatePreviewAllowed({ ...env, ...change }, "production"),
      false,
    );
});
test("Production content supplied privately, authenticated against four pinned hashes, never falls back to disk", () => {
  assert.throws(
    () => loadPrivateOwnerPreview(env, "production"),
    /PRIVATE_SERVER_BUNDLE_REQUIRED/,
  );
  const all = loadPrivatePackages().all;
  const bundle = (x: unknown) => gzipSync(JSON.stringify(x)).toString("base64");
  const r = loadPrivateOwnerPreview(
    { ...env, CSH_PRIVATE_PACKAGE_BUNDLE: bundle(all) },
    "production",
  )!;
  assert.equal(r.all.length, 4);
  assert.equal(r.access.reviewStatus, "DRAFT_UNREVIEWED");
  assert.equal(
    r.all.every((p) => p.humanReview === null && p.state === "DRAFT"),
    true,
  );
  const changed = structuredClone(all);
  changed[0].lesson.title += "changed";
  assert.throws(() =>
    loadPrivateOwnerPreview(
      { ...env, CSH_PRIVATE_PACKAGE_BUNDLE: bundle(changed) },
      "production",
    ),
  );
  assert.throws(() =>
    loadPrivateOwnerPreview(
      { ...env, CSH_PRIVATE_PACKAGE_BUNDLE: bundle(all.slice(1)) },
      "production",
    ),
  );
});
