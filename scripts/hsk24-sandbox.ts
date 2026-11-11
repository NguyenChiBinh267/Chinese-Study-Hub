import fs from "node:fs";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { adminConfig, migrate } from "./local-db.mjs";
import { seedContent } from "./seed-content";
import { seedCurriculum } from "./seed-curriculum";
import {
  assertRuntime,
  assertLearningGate,
  migrationDigest,
  ownerTransaction,
} from "../src/shared/db/transaction";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";

async function main() {
  if (!expansionEnabled()) throw Error("LOCAL_EXPANSION_OPT_IN_REQUIRED");
  const dir = ".local-postgres/hsk24";
  fs.mkdirSync(dir, { recursive: true });
  // Always new: never truncate, repoint or replace another database/state file.
  const database = "csh_hsk24_" + randomBytes(6).toString("hex");
  const c = new Client(adminConfig("postgres"));
  await c.connect();
  try {
    await c.query(`CREATE DATABASE ${database}`);
    await c.query(`REVOKE ALL ON DATABASE ${database} FROM PUBLIC`);
    await c.query(`GRANT CONNECT ON DATABASE ${database} TO csh_runtime`);
    await c.query(`GRANT CREATE ON DATABASE ${database} TO csh_schema_owner`);
  } finally {
    await c.end();
  }
  await migrate(database);
  await seedContent(database);
  await seedCurriculum(database);
  const credentials = JSON.parse(
    fs.readFileSync(".local-postgres/credentials.json", "utf8"),
  );
  const runtimeUrl = `postgresql://csh_runtime:${encodeURIComponent(credentials.runtime)}@127.0.0.1:5447/${database}`;
  const pool = new Pool({ connectionString: runtimeUrl, max: 1 });
  const admin = new Client(adminConfig(database));
  await admin.connect();
  const checks: string[] = [];
  try {
    const client = await pool.connect();
    let role;
    try {
      role = await assertRuntime(client);
      checks.push("runtime-role-and-19-force-rls");
      await assert.rejects(assertLearningGate(client), /runtime proof/);
      checks.push("learning-denied-before-proof");
      for (const sql of [
        "UPDATE app_content.packages SET state='PUBLISHED'",
        "DELETE FROM app_meta.runtime_proof",
        "CREATE TABLE public.hsk24_probe(x int)",
      ]) {
        await assert.rejects(
          client.query(sql),
          (e: { code: string }) => e.code === "42501",
        );
      }
      checks.push("private-manifest-proof-and-ddl-denied");
    } finally {
      client.release();
    }
    const a = randomUUID(),
      b = randomUUID();
    // Existing transaction API sets per-owner claims; raw cross-owner read must be empty.
    await admin.query(
      "INSERT INTO app_private.time_preferences(user_id,version,weekly_minutes,available_days,daily_cap,session_minutes) VALUES($1,1,180,ARRAY[1],60,20)",
      [a],
    );
    const own = await ownerTransaction(
      pool,
      a,
      async (c) =>
        (await c.query("SELECT user_id FROM app_private.time_preferences"))
          .rows,
    );
    const other = await ownerTransaction(
      pool,
      b,
      async (c) =>
        (await c.query("SELECT user_id FROM app_private.time_preferences"))
          .rows,
    );
    assert.equal(own.length, 1);
    assert.equal(other.length, 0);
    checks.push("cross-owner-rls-isolation");
    await admin.query(
      "INSERT INTO app_meta.runtime_proof(singleton,migration_digest,database_oid,runtime_oid,evidence) VALUES(true,$1,$2,$3,$4)",
      [
        migrationDigest(),
        role.database_oid,
        role.oid,
        { kind: "hsk24-isolated-technical-checks", checks },
      ],
    );
    const fresh = await pool.connect();
    try {
      await assertLearningGate(fresh);
    } finally {
      fresh.release();
    }
    checks.push("migration-bound-proof-accepted");
    const state = { database, ownerId: randomUUID(), runtimeUrl };
    const stateFile = `${dir}/${database}.json`;
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    fs.writeFileSync(`${dir}/current.json`, JSON.stringify({ stateFile }));
    fs.writeFileSync(
      `${dir}/checks.json`,
      JSON.stringify(
        { database, checks, migrationDigest: migrationDigest() },
        null,
        2,
      ),
    );
    console.log(
      `PASS ${checks.length} isolated security checks. State: ${stateFile}. No existing history touched.`,
    );
  } finally {
    await admin.end();
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Sandbox failed");
  process.exitCode = 1;
});
