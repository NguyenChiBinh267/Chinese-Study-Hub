// Fresh install in a newly generated disposable database; never resets csh_local.
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { adminConfig, migrate } from "./local-db.mjs";
const name = `csh_sprint6_restore_${randomUUID().replaceAll("-", "")}`;
const cluster = new pg.Client(adminConfig("postgres"));
await cluster.connect();
try {
  await cluster.query(`CREATE DATABASE ${name}`);
  await cluster.query(`GRANT CREATE ON DATABASE ${name} TO csh_schema_owner`);
  await migrate(name);
  for (const script of ["seed-content.ts", "seed-curriculum.ts"]) {
    const r = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", `scripts/${script}`, name],
      { windowsHide: true, stdio: "pipe", timeout: 30000 },
    );
    if (r.status !== 0) throw new Error("Fresh seed failed");
  }
  const c = new pg.Client(adminConfig(name));
  await c.connect();
  try {
    for (const [table, count] of [
      ["courses", 5],
      ["units", 4],
      ["lessons", 4],
      ["lesson_versions", 6],
      ["packages", 6],
    ])
      if (
        (await c.query(`SELECT count(*)::int AS n FROM app_content.${table}`))
          .rows[0].n !== count
      )
        throw new Error("Fresh catalog count mismatch");
    const owners = (
      await c.query(
        "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='app_private'::regnamespace AND relkind='r'",
      )
    ).rows;
    if (
      owners.length !== 18 ||
      owners.some((r) => !r.relrowsecurity || !r.relforcerowsecurity)
    )
      throw new Error("Fresh RLS mismatch");
    const grants = (
      await c.query(
        "SELECT table_name,privilege_type FROM information_schema.role_table_grants WHERE grantee='csh_runtime' AND table_schema='app_content'",
      )
    ).rows;
    if (
      grants.some((r) => r.privilege_type !== "SELECT") ||
      grants.length !== 8
    )
      throw new Error("Fresh content grant mismatch");
  } finally {
    await c.end();
  }
  console.log(
    "PASS: fresh install/migrations/seeds in disposable DB; 5 courses, 4 units/lessons, 6 immutable versions; 18 FORCE-RLS owner tables and 8 SELECT-only content tables.",
  );
} finally {
  await cluster.query(`DROP DATABASE ${name} WITH (FORCE)`);
  await cluster.end();
}
