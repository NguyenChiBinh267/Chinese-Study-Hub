import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { Pool, Client } from "pg";
import { adminConfig } from "../../scripts/local-db.mjs";
import {
  technicalState,
  technicalDirectory,
} from "../../scripts/auth-technical-db.mjs";
import {
  assertRuntime,
  assertLearningGate,
  ownerTransaction,
  migrationDigest,
} from "../../src/shared/db/transaction";
import { PostgresLocalRepository } from "../../src/modules/learning/infrastructure/postgres-local-repository";
import { TECHNICAL_FIXTURE } from "../../src/modules/auth/domain/technical-fixture";
const state = technicalState(),
  pool = new Pool({ connectionString: state.runtimeUrl, max: 1 });
const admin = new Client(adminConfig(state.database));
const a = randomUUID(),
  b = randomUUID();
const checks: string[] = [];
test.after(async () => {
  await pool.end();
  await admin.end();
});
test("Isolated role, 19 FORCE RLS tables and proof not writable by runtime", async () => {
  await admin.connect();
  await admin.query("DELETE FROM app_meta.runtime_proof");
  const c = await pool.connect();
  try {
    await assertRuntime(c);
    await assert.rejects(
      c.query("INSERT INTO app_meta.runtime_proof VALUES(true,'x',1,1,'{}')"),
    );
  } finally {
    c.release();
  }
  checks.push("runtime-least-privilege-and-19-FORCE-RLS");
});
test("Learning write refuses missing migration/role-bound proof", async () => {
  await assert.rejects(
    new PostgresLocalRepository(pool).start(a, randomUUID(), false),
    (e: Error) => e.message.includes("runtime proof"),
  );
  checks.push("learning-proof-required");
});
test("A/B USING and WITH CHECK; request claims are transaction-local", async () => {
  await ownerTransaction(pool, a, async (c) => {
    await c.query(
      "INSERT INTO app_private.owner_profiles(user_id,display_name) VALUES($1,'A')",
      [a],
    );
  });
  await ownerTransaction(pool, b, async (c) => {
    assert.equal(
      (
        await c.query(
          "SELECT * FROM app_private.owner_profiles WHERE user_id=$1",
          [a],
        )
      ).rowCount,
      0,
    );
  });
  await assert.rejects(
    ownerTransaction(pool, b, (c) =>
      c.query("INSERT INTO app_private.owner_profiles(user_id) VALUES($1)", [
        randomUUID(),
      ]),
    ),
  );
  const c = await pool.connect();
  try {
    assert.equal((await c.query("SELECT auth.uid() AS uid")).rows[0].uid, null);
    assert.equal(
      (await c.query("SELECT * FROM app_private.owner_profiles")).rowCount,
      0,
    );
  } finally {
    c.release();
  }
  checks.push("owner-A-B-using-with-check-and-unauthenticated");
});
test("Failed transaction A → B connection reuse leaves no leaked claims", async () => {
  await assert.rejects(
    ownerTransaction(pool, a, async (c) => {
      await c.query("SELECT 1/0");
    }),
  );
  await ownerTransaction(pool, b, async (c) => {
    assert.equal((await c.query("SELECT auth.uid() AS uid")).rows[0].uid, b);
    assert.equal(
      (
        await c.query(
          "SELECT * FROM app_private.owner_profiles WHERE user_id=$1",
          [a],
        )
      ).rowCount,
      0,
    );
  });
  checks.push("failure-and-connection-reuse");
});
test("Runtime cannot publish content, modify admin proof or escalate roles", async () => {
  const c = await pool.connect();
  try {
    await assert.rejects(c.query("SET ROLE csh_schema_owner"));
    await assert.rejects(
      c.query("UPDATE app_meta.runtime_proof SET evidence='{}'"),
    );
    // The trusted grading server can read keys. Browser access is tested at the
    // authenticated HTTP boundary; runtime must never publish or change keys.
    assert.equal(
      (
        await c.query(
          "SELECT has_table_privilege(current_user,'app_content.packages','INSERT,UPDATE,DELETE') AS allowed",
        )
      ).rows[0].allowed,
      false,
    );
    await assert.rejects(c.query("DELETE FROM app_content.packages"));
  } finally {
    c.release();
  }
  checks.push("content-publication-and-admin-denial");
});
test("Record actual local proof; concurrent/idempotent fixture writes stay owner-scoped", async () => {
  assert.equal(checks.length, 5);
  const c = await pool.connect();
  let role;
  try {
    role = await assertRuntime(c);
  } finally {
    c.release();
  }
  await admin.query(
    "INSERT INTO app_meta.runtime_proof(singleton,migration_digest,database_oid,runtime_oid,evidence) VALUES(true,$1,$2,$3,$4)",
    [
      migrationDigest(),
      role.database_oid,
      role.oid,
      JSON.stringify({
        kind: "native-auth-technical-rls-proof-v1",
        technicalFixture: { id: TECHNICAL_FIXTURE, ownerId: state.ownerId },
        checks,
      }),
    ],
  );
  const repo = new PostgresLocalRepository(pool),
    key = randomUUID();
  const [one, two] = await Promise.all([
    repo.start(a, key, false),
    repo.start(a, key, false),
  ]);
  assert.equal(one.sessionId, two.sessionId);
  const other = await repo.start(b, key, false);
  assert.notEqual(other.sessionId, one.sessionId);
  await assert.rejects(
    repo.answer(b, randomUUID(), one.sessionId, {
      exerciseVersionId: "local-token-v1-a",
      response: { choice: 0 },
    }),
  );
  const command = {
    exerciseVersionId: "local-token-v1-a",
    response: { choice: 0 },
  };
  const ack = randomUUID();
  await Promise.all([
    repo.answer(a, ack, one.sessionId, command),
    repo.answer(a, ack, one.sessionId, command),
  ]);
  assert.equal((await repo.snapshot(a)).progress.attempts, 1);
  await assert.rejects(
    repo.answer(a, ack, one.sessionId, { ...command, response: { choice: 1 } }),
  );
  checks.push("concurrency-idempotency-and-owner-scoped-session");
  const r = await pool.connect();
  try {
    await assertLearningGate(r);
  } finally {
    r.release();
  }
  fs.writeFileSync(
    technicalDirectory + "/isolated-rls.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        kind: "LOCAL_ONLY_NOT_CLOUD_T009",
        checks,
        role: {
          name: "csh_runtime",
          superuser: false,
          bypassRls: false,
          tableOwner: false,
          privateForceRlsTables: 19,
        },
        database: state.database,
      },
      null,
      2,
    ),
  );
});
