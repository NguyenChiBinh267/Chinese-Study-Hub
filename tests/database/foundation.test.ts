import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { NextRequest } from "next/server";
import { adminConfig, migrate } from "../../scripts/local-db.mjs";
import {
  createRuntimePool,
  assertRuntime,
  assertLearningGate,
  ownerTransaction,
  migrationDigest,
} from "../../src/shared/db/transaction";
import { PostgresLocalRepository } from "../../src/modules/learning/infrastructure/postgres-local-repository";
import {
  preferenceCommand,
  answerCommand,
  CommandError,
} from "../../src/modules/learning/domain/local-foundation";
import {
  developmentEnabled,
  status as localStatus,
  identity,
  mode,
  body,
} from "../../src/modules/learning/server/local-service";

const pool = createRuntimePool(process.env.DATABASE_URL!, 1);
const admin = new pg.Client(adminConfig());
const a = randomUUID(),
  b = randomUUID(),
  prefs = { weeklyHours: 3, days: [0, 2, 4], dailyCap: 60, sessionMinutes: 20 };
const settings = {
  preferences: prefs,
  expectedVersion: 0,
  acceptLimited: false,
};
const securityChecks: string[] = [];
let aSession: string;
test.after(async () => {
  await pool.end();
  await admin.end();
});

test("Versioned migration, rerun checksum and isolated rollback/reapply", async () => {
  await admin.connect();
  await migrate();
  await admin.query("DELETE FROM app_meta.runtime_proof");
  const name = `csh_rollback_${randomUUID().replaceAll("-", "")}`;
  const cluster = new pg.Client(adminConfig("postgres"));
  await cluster.connect();
  try {
    await cluster.query(`CREATE DATABASE ${name}`);
    await cluster.query(`GRANT CREATE ON DATABASE ${name} TO csh_schema_owner`);
    await migrate(name);
    await migrate(name);
    const c = new pg.Client(adminConfig(name));
    await c.connect();
    assert.equal(
      (
        await c.query(
          "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='app_private'",
        )
      ).rows[0].n,
      19,
    );
    await c.end();
    await migrate(name, true);
    const d = new pg.Client(adminConfig(name));
    await d.connect();
    assert.equal(
      (await d.query("SELECT to_regnamespace('app_private') AS schema")).rows[0]
        .schema,
      null,
    );
    await d.end();
    await migrate(name);
  } finally {
    await cluster.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await cluster.end();
  }
});

test("Real runtime security proof BEFORE opening learning writes", async (t) => {
  await t.test(
    "Runtime is not owner/admin/BYPASSRLS, has no privileged membership or schema/DDL/evidence mutation access",
    async () => {
      const c = await pool.connect();
      try {
        await assertRuntime(c);
        for (const q of [
          "SET ROLE csh_schema_owner",
          "CREATE TABLE app_private.forbidden(id int)",
          "CREATE ROLE forbidden_role",
          "UPDATE app_private.attempts SET correct=true",
          "DELETE FROM app_private.learning_events",
          "TRUNCATE app_private.attempts",
          "DELETE FROM app_meta.runtime_proof",
        ]) {
          await assert.rejects(
            c.query(q),
            (e: { code?: string }) => e.code === "42501",
          );
        }
      } finally {
        c.release();
      }
      securityChecks.push(
        "least-privilege-non-owner-no-bypass-no-membership-evidence-append-only",
      );
    },
  );
  await t.test(
    "Missing claims expose no rows and reject writes, learning gate closed",
    async () => {
      const c = await pool.connect();
      try {
        assert.equal(
          (await c.query("SELECT auth.uid() AS uid")).rows[0].uid,
          null,
        );
        assert.equal(
          (await c.query("SELECT * FROM app_private.time_preferences"))
            .rowCount,
          0,
        );
        await assert.rejects(
          c.query(
            "INSERT INTO app_private.time_preferences VALUES($1,180,ARRAY[0,2,4],60,20,1,now())",
            [a],
          ),
          (e: { code?: string }) => e.code === "42501",
        );
        await assert.rejects(
          assertLearningGate(c),
          (e: CommandError) => e.code === "RLS_PROOF_REQUIRED",
        );
      } finally {
        c.release();
      }
      securityChecks.push(
        "unauthenticated-read-and-write-denied-learning-gate-closed",
      );
    },
  );
  await t.test(
    "Pool A -> B uses same backend, RLS hides owner A and WITH CHECK rejects spoofing",
    async () => {
      const pidA = await ownerTransaction(pool, a, async (c) => {
        await c.query(
          "INSERT INTO app_private.time_preferences VALUES($1,180,ARRAY[0,2,4],60,20,1,now())",
          [a],
        );
        return (await c.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      });
      const pidB = await ownerTransaction(pool, b, async (c) => {
        assert.equal(
          (await c.query("SELECT * FROM app_private.time_preferences"))
            .rowCount,
          0,
        );
        assert.equal(
          (
            await c.query(
              "UPDATE app_private.time_preferences SET weekly_minutes=300 WHERE user_id=$1",
              [a],
            )
          ).rowCount,
          0,
        );
        return (await c.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      });
      assert.equal(pidA, pidB);
      await assert.rejects(
        ownerTransaction(pool, b, (c) =>
          c.query(
            "INSERT INTO app_private.time_preferences VALUES($1,180,ARRAY[0],60,20,1,now())",
            [a],
          ),
        ),
        (e: { code?: string }) => e.code === "42501",
      );
      await assert.rejects(
        ownerTransaction(pool, a, (c) =>
          c.query(
            "UPDATE app_private.time_preferences SET user_id=$1 WHERE user_id=$2",
            [b, a],
          ),
        ),
        (e: { code?: string }) => e.code === "42501",
      );
      securityChecks.push(
        "same-backend-pool-A-B-cross-read-update-insert-owner-forgery",
      );
    },
  );
  await t.test(
    "Failed transaction -> B and commit clear LOCAL claims; partial writes roll back",
    async () => {
      await assert.rejects(
        ownerTransaction(pool, b, async (c) => {
          await c.query(
            "INSERT INTO app_private.time_preferences VALUES($1,180,ARRAY[0],60,20,1,now())",
            [b],
          );
          throw new Error("intentional rollback");
        }),
        /intentional rollback/,
      );
      await ownerTransaction(pool, b, async (c) => {
        assert.equal(
          (await c.query("SELECT * FROM app_private.time_preferences"))
            .rowCount,
          0,
        );
      });
      const c = await pool.connect();
      try {
        assert.equal(
          (await c.query("SELECT auth.uid() AS uid,current_user AS role"))
            .rows[0].uid,
          null,
        );
      } finally {
        c.release();
      }
      securityChecks.push(
        "rollback-atomicity-LOCAL-claim-clear-after-success-and-failure",
      );
    },
  );
  await t.test(
    "Composite FK rejects B attempt pointing at A session; FORCE RLS applies to table owner",
    async () => {
      aSession = randomUUID();
      await ownerTransaction(pool, a, (c) =>
        c.query(
          "INSERT INTO app_private.lesson_sessions(id,user_id,lesson_version_id) VALUES($1,$2,'local-foundation-v1')",
          [aSession, a],
        ),
      );
      await assert.rejects(
        ownerTransaction(pool, b, (c) =>
          c.query(
            `INSERT INTO app_private.attempts(id,user_id,session_id,exercise_version_id,response,correct,score_source)
      VALUES($1,$2,$3,'test','{}',false,'local-fixture-v1')`,
            [randomUUID(), b, aSession],
          ),
        ),
        (e: { code?: string }) => e.code === "23503",
      );
      await admin.query("BEGIN");
      await admin.query("SET LOCAL ROLE csh_schema_owner");
      try {
        assert.equal(
          (await admin.query("SELECT * FROM app_private.time_preferences"))
            .rowCount,
          0,
        );
      } finally {
        await admin.query("ROLLBACK");
      }
      securityChecks.push("cross-owner-composite-FK-and-FORCE-RLS-owner");
    },
  );
  await t.test(
    "New mastery/card/log tables enforce RLS and append-only evidence before writes open",
    async () => {
      const c = await pool.connect();
      try {
        for (const table of [
          "mastery_evidence",
          "skill_mastery",
          "cards",
          "review_logs",
        ]) {
          assert.equal(
            (await c.query(`SELECT * FROM app_private.${table}`)).rowCount,
            0,
          );
          const flags = (
            await admin.query(
              `SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=$1::regclass`,
              [`app_private.${table}`],
            )
          ).rows[0];
          assert.deepEqual(flags, {
            relrowsecurity: true,
            relforcerowsecurity: true,
          });
        }
        for (const table of ["mastery_evidence", "review_logs"])
          for (const query of [
            `UPDATE app_private.${table} SET user_id=user_id`,
            `DELETE FROM app_private.${table}`,
            `TRUNCATE app_private.${table}`,
          ])
            await assert.rejects(
              c.query(query),
              (e: { code?: string }) => e.code === "42501",
            );
      } finally {
        c.release();
      }
      await assert.rejects(
        ownerTransaction(pool, b, (c) =>
          c.query(
            `INSERT INTO app_private.skill_mastery VALUES($1,'forged','recognition','{}','forged',1,now())`,
            [a],
          ),
        ),
        (e: { code?: string }) => e.code === "42501",
      );
      securityChecks.push("new-table-RLS-append-only-and-owner-forgery");
    },
  );
  // This record is published by the migration credential only AFTER the actual
  // database assertions above, never by an API request or client flag.
  await t.test(
    "Owner profiles enforce RLS USING/WITH CHECK and clear identity on reused connections",
    async () => {
      await ownerTransaction(pool, a, (c) =>
        c.query(
          "INSERT INTO app_private.owner_profiles(user_id,display_name) VALUES($1,'Owner A')",
          [a],
        ),
      );
      await ownerTransaction(pool, b, async (c) => {
        assert.equal(
          (await c.query("SELECT * FROM app_private.owner_profiles")).rowCount,
          0,
        );
        assert.equal(
          (
            await c.query(
              "UPDATE app_private.owner_profiles SET display_name='forged' WHERE user_id=$1",
              [a],
            )
          ).rowCount,
          0,
        );
      });
      await assert.rejects(
        ownerTransaction(pool, b, (c) =>
          c.query(
            "INSERT INTO app_private.owner_profiles(user_id) VALUES($1)",
            [a],
          ),
        ),
        (e: { code?: string }) => e.code === "42501",
      );
      const c = await pool.connect();
      try {
        assert.equal(
          (await c.query("SELECT auth.uid() AS uid")).rows[0].uid,
          null,
        );
        assert.equal(
          (await c.query("SELECT * FROM app_private.owner_profiles")).rowCount,
          0,
        );
      } finally {
        c.release();
      }
      securityChecks.push(
        "owner-profile-RLS-USING-WITH-CHECK-and-pool-cleanup",
      );
    },
  );
  assert.equal(securityChecks.length, 7);
  const c = await pool.connect();
  const role = await assertRuntime(c);
  c.release();
  await admin.query(
    `INSERT INTO app_meta.runtime_proof(singleton,migration_digest,database_oid,runtime_oid,evidence)
    VALUES(true,$1,$2,$3,$4)`,
    [
      migrationDigest(),
      role.database_oid,
      role.oid,
      JSON.stringify({
        kind: "native-postgresql-local-only",
        checks: securityChecks,
      }),
    ],
  );
});

test("Repository persistence, duplicate/concurrent writes, trusted fixture outcome and progress readback", async () => {
  const repo = new PostgresLocalRepository(pool),
    uid = randomUUID(),
    key = randomUUID();
  const both = await Promise.all([
    repo.savePreferences(uid, key, settings),
    repo.savePreferences(uid, key, settings),
  ]);
  assert.deepEqual(both[0], both[1]);
  assert.equal(both[0].version, 1);
  await assert.rejects(
    repo.savePreferences(uid, key, {
      ...settings,
      preferences: { ...prefs, weeklyHours: 4 },
    }),
    (e: CommandError) => e.code === "IDEMPOTENCY_CONFLICT",
  );
  await assert.rejects(
    repo.savePreferences(uid, randomUUID(), settings),
    (e: CommandError) => e.code === "STALE_VERSION",
  );
  const { sessionId } = await repo.start(uid, randomUUID(), false);
  await assert.rejects(
    repo.answer(b, randomUUID(), sessionId, {
      exerciseVersionId: "local-token-v1-a",
      response: { choice: 0 },
    }),
    (e: CommandError) => e.status === 404,
  );
  await assert.rejects(
    repo.complete(uid, randomUUID(), sessionId),
    (e: CommandError) => e.code === "INCOMPLETE_SESSION",
  );
  const answer = {
      exerciseVersionId: "local-token-v1-a",
      response: { choice: 1 },
    },
    answerKey = randomUUID();
  const receipts = await Promise.all([
    repo.answer(uid, answerKey, sessionId, answer),
    repo.answer(uid, answerKey, sessionId, answer),
  ]);
  assert.deepEqual(receipts[0], receipts[1]);
  assert.equal(receipts[0].correct, false);
  await assert.rejects(
    repo.answer(uid, randomUUID(), sessionId, answer),
    (e: CommandError) => e.code === "ANSWER_EXISTS",
  );
  assert.equal(
    (
      await repo.answer(uid, randomUUID(), sessionId, {
        exerciseVersionId: "local-token-v1-b",
        response: { choice: 2 },
      })
    ).correct,
    true,
  );
  const completeKey = randomUUID();
  await Promise.all([
    repo.complete(uid, completeKey, sessionId),
    repo.complete(uid, completeKey, sessionId),
  ]);
  // Brand-new pool/repository simulates a server connection/process restart.
  const freshPool = createRuntimePool(process.env.DATABASE_URL!, 1);
  try {
    const restored = await new PostgresLocalRepository(freshPool).snapshot(uid);
    assert.deepEqual(restored.settings?.preferences, prefs);
    assert.equal(restored.session?.answers.length, 2);
    assert.equal(restored.session?.state, "completed");
    assert.deepEqual(restored.progress, {
      attempts: 2,
      correct: 1,
      completedSessions: 1,
    });
    const other = await new PostgresLocalRepository(freshPool).snapshot(b);
    assert.equal(other.progress.attempts, 0);
  } finally {
    await freshPool.end();
  }
  const counts = await ownerTransaction(pool, uid, (c) =>
    c.query(
      "SELECT (SELECT count(*) FROM app_private.learning_events WHERE user_id=$1)::int AS events,(SELECT count(*) FROM app_private.attempts WHERE user_id=$1)::int AS attempts",
      [uid],
    ),
  );
  assert.equal(counts.rows[0].events, 3);
  assert.equal(counts.rows[0].attempts, 2);
});

test("Answer/evidence/idempotency roll back together when event insert fails", async () => {
  const repo = new PostgresLocalRepository(pool),
    uid = randomUUID(),
    key = randomUUID();
  const { sessionId } = await repo.start(uid, randomUUID(), false);
  await admin.query(
    "REVOKE INSERT ON app_private.learning_events FROM csh_runtime",
  );
  try {
    await assert.rejects(
      repo.answer(uid, key, sessionId, {
        exerciseVersionId: "local-token-v1-a",
        response: { choice: 0 },
      }),
    );
  } finally {
    await admin.query(
      "GRANT INSERT ON app_private.learning_events TO csh_runtime",
    );
  }
  assert.equal((await repo.snapshot(uid)).progress.attempts, 0);
  assert.equal(
    (
      await repo.answer(uid, key, sessionId, {
        exerciseVersionId: "local-token-v1-a",
        response: { choice: 0 },
      })
    ).correct,
    true,
  );
});

test("Migration-bound proof cannot be bypassed by stale metadata", async () => {
  const repo = new PostgresLocalRepository(pool);
  await admin.query(
    "UPDATE app_meta.runtime_proof SET migration_digest='stale'",
  );
  try {
    await assert.rejects(
      repo.start(randomUUID(), randomUUID(), false),
      (e: CommandError) => e.code === "RLS_PROOF_REQUIRED",
    );
  } finally {
    await admin.query("UPDATE app_meta.runtime_proof SET migration_digest=$1", [
      migrationDigest(),
    ]);
  }
});

test("Server rejects forged owner/score/extra fields; development identity is locked out of production", async () => {
  assert.equal(
    preferenceCommand.safeParse({ ...settings, user_id: b }).success,
    false,
  );
  assert.equal(
    answerCommand.safeParse({
      exerciseVersionId: "local-token-v1-a",
      response: { choice: 1 },
      correct: true,
      score: 100,
    }).success,
    false,
  );
  assert.equal(
    developmentEnabled({ NODE_ENV: "production", CSH_LOCAL_DATABASE: "1" }),
    false,
  );
  assert.equal(
    developmentEnabled(
      { NODE_ENV: "development", CSH_LOCAL_DATABASE: "1" },
      "production",
    ),
    false,
  );
  const old = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "development" });
  try {
    const req = (
      headers: Record<string, string>,
      data: unknown = { local: true },
    ) =>
      new NextRequest("http://127.0.0.1:3000/api/local/mode", {
        method: "POST",
        headers: {
          host: "127.0.0.1:3000",
          origin: "http://127.0.0.1:3000",
          "content-type": "application/json",
          "x-csh-local": "1",
          ...headers,
        },
        body: JSON.stringify(data),
      });
    await assert.rejects(
      mode(req({ origin: "https://other.example" })),
      (e: CommandError) => e.status === 403,
    );
    await assert.rejects(
      mode(req({ "x-user-id": b })),
      (e: CommandError) => e.code === "FORGED_IDENTITY",
    );
    const result = await mode(req({})),
      cookie = result.cookies.get("csh_local_development")!.value;
    const read = (value: string) =>
      new NextRequest("http://127.0.0.1:3000/api/local/snapshot", {
        headers: {
          host: "127.0.0.1:3000",
          cookie: `csh_local_development=${value}`,
        },
      });
    assert.equal(identity(read(cookie)), process.env.CSH_LOCAL_OWNER_ID);
    assert.equal(result.cookies.get("csh_local_selected")?.value, "1");
    const expiredSelection = new NextRequest(
      "http://127.0.0.1:3000/api/local/status",
      { headers: { host: "127.0.0.1:3000", cookie: "csh_local_selected=1" } },
    );
    assert.deepEqual(await (await localStatus(expiredSelection)).json(), {
      enabled: true,
      active: true,
    });
    assert.throws(
      () => identity(expiredSelection),
      (e: CommandError) => e.status === 401,
    );
    assert.throws(
      () => identity(read(cookie.replace(process.env.CSH_LOCAL_OWNER_ID!, b))),
      (e: CommandError) => e.status === 401,
    );
    await assert.rejects(
      body(req({}, { ...settings, user_id: b }), preferenceCommand),
      (e: CommandError) => e.status === 422,
    );
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.throws(
      () => identity(read(cookie)),
      (e: CommandError) => e.code === "DEV_ONLY",
    );
  } finally {
    if (old === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: old });
  }
});
