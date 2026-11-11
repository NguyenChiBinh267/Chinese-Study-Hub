import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { Pool, Client } from "pg";
import { releaseState } from "../../scripts/release-test-db";
import { adminConfig } from "../../scripts/local-db.mjs";
import { installRelease } from "../../scripts/content-release";
import {
  assertRuntime,
  assertLearningGate,
  ownerTransaction,
  migrationDigest,
} from "../../src/shared/db/transaction";
import { loadContentRelease } from "../../src/modules/content/application/releases";
import { PostgresContentRepository } from "../../src/modules/content/infrastructure/postgres-content";
import { PostgresReviewRepository } from "../../src/modules/review/infrastructure/postgres-review-repository";
import { PostgresStudyRepository } from "../../src/modules/planning/infrastructure/postgres-study";
const s = releaseState(),
  env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
    CSH_APP_MODE: "PRODUCTION_AUTHENTICATED",
    DATABASE_URL: s.runtimeUrl,
    CSH_CONTENT_TEST_ROOT: s.root,
    CSH_CONTENT_RELEASE: s.releaseId,
  };
const r = loadContentRelease(env, "development")!,
  pool = new Pool({ connectionString: s.runtimeUrl, max: 1 }),
  admin = new Client(adminConfig(s.database)),
  a = randomUUID(),
  b = randomUUID();
test.before(() => admin.connect());
test.after(async () => {
  await pool.end();
  await admin.end();
});
test("Release DB: least privilege and 19 FORCE RLS tables", async () => {
  const c = await pool.connect();
  try {
    await assertRuntime(c);
    await assert.rejects(
      c.query("UPDATE app_content.packages SET state='PUBLISHED'"),
    );
    await assert.rejects(
      c.query("INSERT INTO app_meta.runtime_proof DEFAULT VALUES"),
    );
  } finally {
    c.release();
  }
});
test("Release DB: A/B USING and WITH CHECK; rollback clears pooled identity", async () => {
  await ownerTransaction(pool, a, (c) =>
    c.query(
      "INSERT INTO app_private.owner_profiles(user_id,display_name) VALUES($1,'synthetic A')",
      [a],
    ),
  );
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
      c.query(
        "INSERT INTO app_private.owner_profiles(user_id,display_name) VALUES($1,'forged')",
        [a],
      ),
    ),
  );
  const c = await pool.connect();
  try {
    assert.equal(
      (
        await c.query(
          "SELECT count(*)::int AS n FROM app_private.owner_profiles",
        )
      ).rows[0].n,
      0,
    );
  } finally {
    c.release();
  }
});
test("Release DB: missing/stale proof rejects learning write; install bound proof after actual role/RLS checks", async () => {
  await admin.query("DELETE FROM app_meta.runtime_proof");
  await assert.rejects(ownerTransaction(pool, a, async () => {}, true));
  const c = await pool.connect();
  let role;
  try {
    role = await assertRuntime(c);
  } finally {
    c.release();
  }
  await admin.query(
    "INSERT INTO app_meta.runtime_proof VALUES(true,$1,$2,$3,$4)",
    [
      migrationDigest(),
      role.database_oid,
      role.oid,
      {
        kind: "local-release-runtime-proof-v1",
        environment: "local",
        checks: [
          "actual-role",
          "FORCE-RLS",
          "A-B-WITH-CHECK",
          "pooled-context",
        ],
      },
    ],
  );
  await ownerTransaction(pool, a, (c) => assertLearningGate(c), true);
});
test("Release DB: idempotent immutable operator import cannot rebind content or progress", async () => {
  const before = (
    await admin.query("SELECT count(*)::int AS n FROM app_private.attempts")
  ).rows[0].n;
  await installRelease(s.database, env);
  await installRelease(s.database, env);
  assert.equal(
    (await admin.query("SELECT count(*)::int AS n FROM app_private.attempts"))
      .rows[0].n,
    before,
  );
  assert.throws(
    () => loadContentRelease({ ...env, NODE_ENV: "production" }, "production"),
    /CONTENT_TEST_FORBIDDEN/,
  );
});
test("Release DB: server grading/bindings/FSRS; selected rollback keeps old attempts and exact versions", async () => {
  const repo = new PostgresContentRepository(pool, r.access),
    p = r.current[0];
  const start = await repo.start(a, randomUUID(), p.lesson.versionId, {
    restart: false,
    packageHash: p.packageHash,
  });
  const id = start.sessionId;
  for (const block of p.blocks) {
    let view = await repo.view(a, p.lesson.versionId);
    if (block.type === "exercise") {
      const ex = p.exercises.find((e) => e.id === block.exerciseVersionId)!;
      const key = p.privateKeys.find((k) => k.id === ex.keyRef)!;
      assert.equal(
        (
          await repo.answer(a, randomUUID(), id, {
            exerciseVersionId: ex.id,
            response: { choice: ex.choices.indexOf(key.accepted[0]) },
          })
        ).correct,
        true,
      );
      view = await repo.view(a, p.lesson.versionId);
    }
    await repo.advance(a, randomUUID(), id, view.session!.version);
  }
  await repo.complete(a, randomUUID(), id);
  const bound = (
    await admin.query(
      "SELECT package_id,package_hash,review_status FROM app_private.content_attempt_bindings WHERE user_id=$1 ORDER BY attempt_id",
      [a],
    )
  ).rows;
  assert.equal(bound.length, 2);
  assert.ok(
    bound.every(
      (x) =>
        x.package_id === p.lesson.versionId &&
        x.package_hash === p.packageHash &&
        x.review_status === "TECHNICAL_ONLY",
    ),
  );
  const card = (
      await admin.query(
        "SELECT id,version FROM app_private.cards WHERE user_id=$1",
        [a],
      )
    ).rows[0],
    reviews = new PostgresReviewRepository(pool, r.template);
  await reviews.reveal(a, randomUUID(), card.id, card.version);
  await reviews.rate(a, randomUUID(), card.id, {
    expectedVersion: card.version,
    rating: "Good",
  });
  assert.equal(
    (
      await admin.query("SELECT version FROM app_private.cards WHERE id=$1", [
        card.id,
      ])
    ).rows[0].version,
    2,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM app_private.review_logs WHERE user_id=$1",
        [a],
      )
    ).rows[0].n,
    1,
  );
  const previous = loadContentRelease(
      { ...env, CSH_CONTENT_RELEASE: s.previousReleaseId },
      "development",
    )!,
    other = new PostgresContentRepository(pool, previous.access);
  await assert.rejects(
    other.start(a, randomUUID(), p.lesson.versionId, {
      restart: true,
      packageHash: p.packageHash,
    }),
  );
  const p2 = previous.current[0];
  await other.start(a, randomUUID(), p2.lesson.versionId, {
    restart: false,
    packageHash: p2.packageHash,
  });
  assert.deepEqual(
    (
      await admin.query(
        "SELECT package_id,package_hash,review_status FROM app_private.content_attempt_bindings WHERE user_id=$1 ORDER BY attempt_id",
        [a],
      )
    ).rows,
    bound,
  );
  assert.equal(
    (await repo.view(a, p.lesson.versionId)).session?.state,
    "completed",
  );
});
test("Release DB: planner only sees eligible published versions, current scope and actual persisted completion", async () => {
  const study = new PostgresStudyRepository(pool, {
    id: r.id,
    current: r.current,
    all: r.all,
  });
  const config = {
    preferences: {
      weeklyHours: 2,
      days: [0, 1, 2, 3, 4, 5, 6],
      dailyCap: 60,
      sessionMinutes: 15,
    },
    planning: {
      dayCaps: [60, 60, 60, 60, 60, 60, 60],
      maxSessionMinutes: 25,
      paused: false,
      timezone: "Asia/Saigon",
      startingLevel: "zero" as const,
    },
    expectedVersion: 0,
    acceptLimited: true,
  };
  await study.save(b, randomUUID(), config);
  const today = await study.today(b);
  assert.ok(today.plan);
  assert.ok(today.plan.blocks.length > 0);
  assert.ok(
    today.plan.blocks
      .filter((x) => x.kind !== "review")
      .every((x) => x.target === s.versionId),
  );
  assert.ok(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM app_private.attempts WHERE user_id=$1",
        [a],
      )
    ).rows[0].n === 2,
  );
});
test("Release DB: withdrawal and bad allowlist hash fail closed without deleting history", async () => {
  const file = s.root + "/trusted.json",
    original = fs.readFileSync(file),
    before = (
      await admin.query("SELECT count(*)::int AS n FROM app_private.attempts")
    ).rows[0].n;
  try {
    const reg = JSON.parse(original.toString());
    reg.releases.find((x: { id: string }) => x.id === s.releaseId).state =
      "WITHDRAWN";
    fs.writeFileSync(file, JSON.stringify(reg));
    assert.throws(
      () => loadContentRelease(env, "development"),
      /RELEASE_UNAVAILABLE/,
    );
    reg.releases[0].state = "PUBLISHED";
    reg.releases[0].sha256 = "0".repeat(64);
    fs.writeFileSync(file, JSON.stringify(reg));
    assert.throws(
      () => loadContentRelease(env, "development"),
      /UNTRUSTED_RELEASE_BYTES/,
    );
  } finally {
    fs.writeFileSync(file, original);
  }
  assert.equal(
    (await admin.query("SELECT count(*)::int AS n FROM app_private.attempts"))
      .rows[0].n,
    before,
  );
});

test("Release DB: schema rollback refuses publication-bound history and leaves bindings intact", async () => {
  const before = (
    await admin.query(
      "SELECT count(*)::int AS n FROM app_private.content_attempt_bindings",
    )
  ).rows[0].n;
  await admin.query("BEGIN");
  try {
    await assert.rejects(
      admin.query(
        fs.readFileSync(
          "supabase/rollbacks/202610210007_content_release.sql",
          "utf8",
        ),
      ),
      /Keep forward schema/,
    );
  } finally {
    await admin.query("ROLLBACK");
  }
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM app_private.content_attempt_bindings",
      )
    ).rows[0].n,
    before,
  );
});
