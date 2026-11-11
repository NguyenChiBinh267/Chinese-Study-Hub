import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { adminConfig } from "../../scripts/local-db.mjs";
import { seedContent } from "../../scripts/seed-content";
import {
  createRuntimePool,
  ownerTransaction,
} from "../../src/shared/db/transaction";
import { PostgresContentRepository } from "../../src/modules/content/infrastructure/postgres-content";
import { PostgresReviewRepository } from "../../src/modules/review/infrastructure/postgres-review-repository";
import { PostgresLocalRepository } from "../../src/modules/learning/infrastructure/postgres-local-repository";
import { loadDraftCatalog } from "../../src/modules/content/application/catalog";
import { gradeContent } from "../../src/modules/content/domain/package";
import type { CommandError } from "../../src/modules/learning/domain/local-foundation";
const pool = createRuntimePool(process.env.DATABASE_URL!, 1),
  repo = new PostgresContentRepository(pool),
  review = new PostgresReviewRepository(pool),
  oldRepo = new PostgresLocalRepository(pool),
  admin = new pg.Client(adminConfig());
const { packages } = loadDraftCatalog();
const uid = randomUUID(),
  other = randomUUID();
let sessionId: string, attemptId: string;
const code = (value: string) => (e: CommandError) => e.code === value;
test.before(async () => {
  await admin.connect();
  await seedContent();
});
test.after(async () => {
  await pool.end();
  await admin.end();
});
async function open(owner = uid, version = packages[0]) {
  return (
    await repo.start(owner, randomUUID(), version.lesson.versionId, {
      restart: false,
      packageHash: version.packageHash,
    })
  ).sessionId;
}
async function nextExercise(owner: string, id: string, version = packages[0]) {
  let v = await repo.view(owner, version.lesson.versionId);
  while (
    v.session &&
    v.session.cursor < version.blocks.length &&
    version.blocks[v.session.cursor].type === "teaching"
  ) {
    await repo.advance(owner, randomUUID(), id, v.session.version);
    v = await repo.view(owner, version.lesson.versionId);
  }
  return v;
}
test("Content runtime has no publisher/DDL permission; all 19 owner tables FORCE RLS and new rows isolate owners", async () => {
  await ownerTransaction(pool, uid, async (c) => {
    const tables = (
      await c.query(
        "SELECT relname,relforcerowsecurity FROM pg_class WHERE relnamespace='app_private'::regnamespace AND relkind='r'",
      )
    ).rows;
    assert.equal(tables.length, 19);
    assert.ok(tables.every((t) => t.relforcerowsecurity));
  });
  for (const sql of [
    "UPDATE app_content.packages SET state='PUBLISHED'",
    "DELETE FROM app_content.exercise_versions",
    "INSERT INTO app_content.packages SELECT * FROM app_content.packages",
    "UPDATE app_private.duration_events SET accepted_ms=15000",
    "DELETE FROM app_private.content_attempt_bindings",
  ]) {
    const c = await pool.connect();
    try {
      await assert.rejects(
        c.query(sql),
        (e: { code?: string }) => e.code === "42501",
      );
    } finally {
      c.release();
    }
  }
  sessionId = await open();
  await assert.rejects(
    repo.advance(other, randomUUID(), sessionId, 1),
    code("SESSION_NOT_FOUND"),
  );
  await ownerTransaction(pool, other, async (c) => {
    for (const table of [
      "content_session_state",
      "activity_leases",
      "duration_events",
      "content_attempt_bindings",
    ])
      assert.equal(
        (await c.query(`SELECT * FROM app_private.${table}`)).rowCount,
        0,
      );
  });
});
test("Public package has no private grading projection; step order, stale versions and bounds enforced", async () => {
  const v = await repo.view(uid, packages[0].lesson.versionId);
  const payload = JSON.stringify(v.lesson);
  for (const key of ["privateKeys", "keyRef", "accepted", "feedback"])
    assert.equal(payload.includes(`"${key}"`), false);
  await assert.rejects(
    repo.start(uid, randomUUID(), packages[0].lesson.versionId, {
      restart: false,
      packageHash: "f".repeat(64),
    }),
    code("CONTENT_STALE"),
  );
  await assert.rejects(
    repo.answer(uid, randomUUID(), sessionId, {
      exerciseVersionId: packages[0].exercises[0].id,
      response: { choice: 0 },
    }),
    code("WRONG_STEP"),
  );
  await assert.rejects(
    repo.advance(uid, randomUUID(), sessionId, 999),
    code("STALE_STEP"),
  );
  const step = await nextExercise(uid, sessionId);
  await assert.rejects(
    repo.advance(uid, randomUUID(), sessionId, step.session!.version),
    code("ANSWER_REQUIRED"),
  );
  await assert.rejects(
    repo.answer(uid, randomUUID(), sessionId, {
      exerciseVersionId: packages[0].exercises[0].id,
      response: { choice: 99 },
    }),
    code("INVALID_ANSWER"),
  );
});
test("Content answer/key binding, immutable attempt/evidence/card/receipt commit atomically, lost ack and concurrency do not duplicate", async () => {
  const ex = packages[0].exercises[0],
    key = randomUUID(),
    command = { exerciseVersionId: ex.id, response: { choice: 1 } };
  const [a, b] = await Promise.all([
    repo.answer(uid, key, sessionId, command),
    repo.answer(uid, key, sessionId, command),
  ]);
  assert.deepEqual(a, b);
  assert.equal(a.correct, true);
  assert.equal(a.independentEvidence, false);
  await assert.rejects(
    repo.answer(uid, key, sessionId, { ...command, response: { choice: 0 } }),
    code("IDEMPOTENCY_CONFLICT"),
  );
  await assert.rejects(
    repo.answer(uid, randomUUID(), sessionId, command),
    code("ANSWER_EXISTS"),
  );
  const rows = (
    await admin.query(
      "SELECT a.id,b.* FROM app_private.attempts a JOIN app_private.content_attempt_bindings b ON b.user_id=a.user_id AND b.attempt_id=a.id WHERE a.user_id=$1 AND a.session_id=$2",
      [uid, sessionId],
    )
  ).rows;
  assert.equal(rows.length, 1);
  attemptId = rows[0].id;
  assert.equal(rows[0].package_hash, packages[0].packageHash);
  assert.equal(rows[0].key_version, packages[0].privateKeys[0].id);
  assert.equal(rows[0].duration_classification, "MISSING_INSUFFICIENT");
  const summary = await oldRepo.snapshot(uid);
  assert.equal(summary.learning.dueCount, 1);
  assert.equal(summary.learning.mastery[0].projection.evidenceCount, 0);
  const c = await pool.connect();
  try {
    await assert.rejects(
      c.query("UPDATE app_private.attempts SET correct=false WHERE id=$1", [
        attemptId,
      ]),
      (e: { code?: string }) => e.code === "42501",
    );
  } finally {
    c.release();
  }
});
test("Failure during content binding write rolls back grading, card, mastery and idempotency; retry succeeds", async () => {
  const owner = randomUUID(),
    id = await open(owner);
  await nextExercise(owner, id);
  const key = randomUUID(),
    ex = packages[0].exercises[0];
  await admin.query(
    "REVOKE INSERT ON app_private.content_attempt_bindings FROM csh_runtime",
  );
  try {
    await assert.rejects(
      repo.answer(owner, key, id, {
        exerciseVersionId: ex.id,
        response: { choice: 0 },
      }),
    );
  } finally {
    await admin.query(
      "GRANT INSERT ON app_private.content_attempt_bindings TO csh_runtime",
    );
  }
  assert.equal((await oldRepo.snapshot(owner)).progress.attempts, 0);
  assert.equal((await oldRepo.snapshot(owner)).learning.dueCount, 0);
  await repo.answer(owner, key, id, {
    exerciseVersionId: ex.id,
    response: { choice: 0 },
  });
  assert.equal((await oldRepo.snapshot(owner)).progress.attempts, 1);
});
test("Telemetry receipt retries, duplicates, ordering, skew, idle, overlaps, lease theft and concurrent writes cannot inflate time", async () => {
  const clientId = randomUUID(),
    lease = await repo.lease(uid, randomUUID(), sessionId, clientId);
  await new Promise((r) => setTimeout(r, 30));
  const end = Date.now(),
    start = end - 20;
  const input = {
    eventId: randomUUID(),
    leaseId: lease.leaseId,
    clientId,
    observedStart: new Date(start).toISOString(),
    observedEnd: new Date(end).toISOString(),
    lastInteractionAt: new Date(start).toISOString(),
    activeMs: 20,
  };
  const [a, b] = await Promise.all([
    repo.duration(uid, sessionId, input),
    repo.duration(uid, sessionId, input),
  ]);
  assert.equal(a.acceptedMs, 20);
  assert.equal(b.acceptedMs, 20);
  assert.equal((await repo.summary(uid)).observedActiveMs, 20);
  await assert.rejects(
    repo.duration(uid, sessionId, { ...input, activeMs: 1 }),
    code("IDEMPOTENCY_CONFLICT"),
  );
  const overlap = await repo.duration(uid, sessionId, {
    ...input,
    eventId: randomUUID(),
  });
  assert.equal(overlap.acceptedMs, 0);
  assert.equal(overlap.classification, "SUSPICIOUS_INVALID");
  const skew = await repo.duration(uid, sessionId, {
    ...input,
    eventId: randomUUID(),
    observedStart: new Date(start + 3600000).toISOString(),
    observedEnd: new Date(end + 3600000).toISOString(),
  });
  assert.equal(skew.acceptedMs, 0);
  const idle = await repo.duration(uid, sessionId, {
    ...input,
    eventId: randomUUID(),
    lastInteractionAt: new Date(start - 61000).toISOString(),
  });
  assert.equal(idle.acceptedMs, 0);
  await assert.rejects(
    repo.duration(uid, sessionId, {
      ...input,
      eventId: randomUUID(),
      observedEnd: new Date(start - 1).toISOString(),
    }),
    code("INTERVAL_ORDER"),
  );
  const second = await repo.lease(uid, randomUUID(), sessionId, randomUUID());
  assert.notEqual(second.leaseId, lease.leaseId);
  await assert.rejects(
    repo.duration(uid, sessionId, { ...input, eventId: randomUUID() }),
    code("LEASE_LOST"),
  );
  await assert.rejects(
    repo.lease(other, randomUUID(), sessionId, randomUUID()),
    code("SESSION_NOT_FOUND"),
  );
  assert.equal((await repo.summary(uid)).observedActiveMs, 20);
});
test("Complete and resume F01/F02, typed Pinyin grading, persistent FSRS self-rating and provisional mastery", async () => {
  for (const p of packages.slice(0, 2)) {
    const id = await open(uid, p);
    let view = await repo.view(uid, p.lesson.versionId);
    while (view.session!.cursor < p.blocks.length) {
      const block = p.blocks[view.session!.cursor];
      if (
        block.type === "exercise" &&
        !view.session!.answers.some(
          (a) => a.exerciseVersionId === block.exerciseVersionId,
        )
      ) {
        const ex = p.exercises.find((e) => e.id === block.exerciseVersionId)!,
          key = p.privateKeys.find((k) => k.id === ex.keyRef)!;
        const input =
          ex.type === "choice"
            ? { choice: ex.choices.indexOf(key.accepted[0]) }
            : { text: key.accepted[0] };
        const ack = await repo.answer(uid, randomUUID(), id, {
          exerciseVersionId: ex.id,
          response: input,
        });
        assert.equal(ack.correct, gradeContent(p, ex.id, input).correct);
        assert.equal(ack.independentEvidence, false);
      }
      await repo.advance(uid, randomUUID(), id, view.session!.version);
      view = await repo.view(uid, p.lesson.versionId);
    }
    await repo.complete(uid, randomUUID(), id);
    assert.equal(
      (await repo.view(uid, p.lesson.versionId)).session!.state,
      "completed",
    );
  }
  const saved = await oldRepo.snapshot(uid);
  assert.ok(saved.learning.dueCount >= 2);
  assert.ok(
    saved.learning.mastery.every(
      (m) =>
        m.projection.evidenceCount === 0 && m.projection.status !== "secure",
    ),
  );
  const card = saved.learning.due[0];
  const reveal = await review.reveal(uid, randomUUID(), card.id, card.version);
  assert.match(reveal.back, /draft chưa duyệt/);
  await review.rate(uid, randomUUID(), card.id, {
    rating: "Good",
    expectedVersion: card.version,
  });
  assert.equal((await oldRepo.snapshot(uid)).learning.reviews, 1);
  assert.equal((await repo.summary(uid)).independentEvidence, 0);
  await assert.rejects(
    repo.duration(uid, sessionId, {
      eventId: randomUUID(),
      leaseId: randomUUID(),
      clientId: randomUUID(),
      observedStart: new Date().toISOString(),
      observedEnd: new Date().toISOString(),
      lastInteractionAt: new Date().toISOString(),
      activeMs: 0,
    }),
    code("SESSION_COMPLETED"),
  );
});
test("Database manifest drift cannot rebind historical keys; source bindings survive reread", async () => {
  const p = packages[0],
    stored = (
      await admin.query(
        "SELECT manifest FROM app_content.packages WHERE version_id=$1",
        [p.lesson.versionId],
      )
    ).rows[0].manifest;
  try {
    await admin.query(
      "UPDATE app_content.packages SET manifest=$2 WHERE version_id=$1",
      [
        p.lesson.versionId,
        { ...stored, lesson: { ...stored.lesson, title: "corrupted title" } },
      ],
    );
    await assert.rejects(
      repo.view(uid, p.lesson.versionId),
      code("CONTENT_STALE"),
    );
  } finally {
    await admin.query(
      "UPDATE app_content.packages SET manifest=$2 WHERE version_id=$1",
      [p.lesson.versionId, stored],
    );
  }
  const binding = (
    await admin.query(
      "SELECT key_version,package_hash FROM app_private.content_attempt_bindings WHERE user_id=$1 AND attempt_id=$2",
      [uid, attemptId],
    )
  ).rows[0];
  assert.equal(binding.package_hash, p.packageHash);
  assert.equal(binding.key_version, p.privateKeys[0].id);

  const old = (
    await admin.query(
      "SELECT * FROM app_private.content_attempt_bindings WHERE user_id=$1 AND attempt_id=$2",
      [uid, attemptId],
    )
  ).rows[0];
  await assert.rejects(
    ownerTransaction(pool, other, (c) =>
      c.query(
        `INSERT INTO app_private.content_attempt_bindings VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          other,
          attemptId,
          old.package_id,
          old.package_hash,
          old.exercise_version_id,
          old.key_version,
          old.normalizer_version,
          old.grading_version,
          old.review_status,
          old.duration_classification,
        ],
      ),
    ),
    (e: { code?: string }) => e.code === "23503",
  );
});
