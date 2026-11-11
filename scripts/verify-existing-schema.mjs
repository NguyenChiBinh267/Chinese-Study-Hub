// Read-only readback of the already populated local sandbox. Never migrates it.
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { adminConfig, migrationFiles, migrationDigest } from "./local-db.mjs";

const phase = process.argv[2];
assert(["before", "after"].includes(phase));
const output = ".local-postgres/integration";
fs.mkdirSync(output, { recursive: true });
const file = `${output}/schema-${phase}.json`;
assert(!fs.existsSync(file), "Schema receipt already exists");
const pointer = JSON.parse(
  fs.readFileSync(".local-postgres/hsk24/current.json", "utf8"),
);
const state = JSON.parse(fs.readFileSync(pointer.stateFile, "utf8"));
assert.equal(state.database, "csh_hsk24_bf294b6506c1");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const client = new Client(adminConfig(state.database));
await client.connect();
try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const ledger = (
    await client.query(
      "SELECT version,digest FROM public.csh_migrations ORDER BY version",
    )
  ).rows;
  const source = migrationFiles().map((name) => ({
    name,
    version: name.split("_")[0],
    digest: hash(
      fs
        .readFileSync(`supabase/migrations/${name}`, "utf8")
        .replace(/\r\n/g, "\n"),
    ),
  }));
  const unmatched = ledger.filter(
    (r) =>
      !source.some((f) => f.version === r.version && f.digest === r.digest),
  );
  const unapplied = source.filter(
    (f) => !ledger.some((r) => r.version === f.version),
  );
  const queries = {
    relations:
      "SELECT n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('app_private','app_content','app_meta') ORDER BY 1,2",
    columns:
      "SELECT table_schema,table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,is_identity,is_generated FROM information_schema.columns WHERE table_schema IN ('app_private','app_content','app_meta') ORDER BY 1,2,4",
    constraints:
      "SELECT n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid,true) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('app_private','app_content','app_meta') ORDER BY 1,2,3",
    policies:
      "SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('app_private','app_content','app_meta') ORDER BY 1,2,3",
    indexes:
      "SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname IN ('app_private','app_content','app_meta') ORDER BY 1,2,3",
    functions:
      "SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('app_private','app_content','app_meta') AND p.prokind IN ('f','p') ORDER BY 1,2,3",
    grants:
      "SELECT table_schema,table_name,grantee,privilege_type,is_grantable FROM information_schema.role_table_grants WHERE table_schema IN ('app_private','app_content','app_meta') ORDER BY 1,2,3,4,5",
    roles:
      "SELECT rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname IN ('csh_runtime','csh_migrator') ORDER BY 1",
  };
  const objects = {};
  let runtimeSafe = false;
  for (const [kind, sql] of Object.entries(queries)) {
    const rows = (await client.query(sql)).rows;
    objects[kind] = { count: rows.length, sha256: hash(JSON.stringify(rows)) };
    if (kind === "roles")
      runtimeSafe = rows.some(
        (r) =>
          r.rolname === "csh_runtime" &&
          !r.rolsuper &&
          !r.rolbypassrls &&
          !r.rolcreaterole &&
          !r.rolcreatedb,
      );
  }
  const proof = (
    await client.query(
      "SELECT migration_digest,database_oid,runtime_oid FROM app_meta.runtime_proof WHERE singleton",
    )
  ).rows;
  const expected = migrationDigest();
  assert.equal(proof.length, 1);
  assert.equal(proof[0].migration_digest, expected);
  assert(runtimeSafe);
  assert.equal(
    unmatched.length,
    0,
    "Applied history differs from candidate migration bytes",
  );
  assert.equal(
    unapplied.length,
    0,
    "Candidate requires unapplied migrations; no automatic migration allowed",
  );
  const schemaSha256 = hash(JSON.stringify(objects));
  if (phase === "after")
    assert.equal(
      schemaSha256,
      JSON.parse(fs.readFileSync(`${output}/schema-before.json`, "utf8"))
        .schemaSha256,
    );
  await client.query("COMMIT");
  const receipt = {
    checkedAtUTC: new Date().toISOString(),
    phase,
    database: state.database,
    readOnly: true,
    migrationHistoryMatches: true,
    migrationCount: source.length,
    aggregateMigrationDigest: expected,
    migrations: source,
    schemaSha256,
    objects,
    runtimeRoleSafe: runtimeSafe,
    runtimeProofMatches: true,
    schemaUnchanged: phase === "after" ? true : null,
    schemaOrMigrationsAppliedByThisCheck: false,
  };
  fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(
    JSON.stringify({
      phase,
      migrationCount: source.length,
      migrationHistoryMatches: true,
      schemaSha256,
      objects,
      runtimeRoleSafe: runtimeSafe,
      runtimeProofMatches: true,
    }),
  );
} finally {
  await client.end();
}
