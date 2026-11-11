import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { adminConfig } from "../../scripts/local-db.mjs";
import {
  createRuntimePool,
  ownerTransaction,
} from "../../src/shared/db/transaction";
import { PostgresLocalRepository } from "../../src/modules/learning/infrastructure/postgres-local-repository";
import { PostgresReviewRepository } from "../../src/modules/review/infrastructure/postgres-review-repository";
import {
  CommandError,
  answerCommand,
} from "../../src/modules/learning/domain/local-foundation";
import { ratingCommand } from "../../src/modules/review/domain/local-review";
import { fixture } from "../../src/modules/learning/server/local-fixture";
import {
  ALGORITHM,
  SCHEDULER_CONFIG,
  schedule,
} from "../../src/modules/review/domain/fsrs-adapter";
const pool = createRuntimePool(process.env.DATABASE_URL!, 1),
  admin = new pg.Client(adminConfig());
const repo = new PostgresLocalRepository(pool),
  review = new PostgresReviewRepository(pool);
const uid = randomUUID(),
  other = randomUUID();
let cardId: string, attemptSession: string;
const conflict = (e: CommandError) => e.status === 409;
test.before(async () => {
  await admin.connect();
});
test.after(async () => {
  await pool.end();
  await admin.end();
});

test("Actual grading validates item/choice/owner; immutable evidence/card/projection commit once; no public key", async () => {
  assert.ok(!JSON.stringify(fixture).includes("expected"));
  assert.ok(!JSON.stringify(fixture).includes("feedback"));
  assert.equal(
    answerCommand.safeParse({
      exerciseVersionId: "x",
      response: { choice: 0 },
      correct: true,
    }).success,
    false,
  );
  assert.equal(
    ratingCommand.safeParse({
      expectedVersion: 1,
      rating: "Easy",
      owner: other,
    }).success,
    false,
  );
  attemptSession = (await repo.start(uid, randomUUID(), false)).sessionId;
  for (const command of [
    { exerciseVersionId: "wrong-version", response: { choice: 0 } },
    { exerciseVersionId: "local-token-v1-a", response: { choice: 8 } },
    { exerciseVersionId: "local-token-v1-a", response: { choice: -1 } },
  ])
    await assert.rejects(
      repo.answer(uid, randomUUID(), attemptSession, command),
      (e: CommandError) => e.status === 422,
    );
  const key = randomUUID(),
    command = {
      exerciseVersionId: "local-token-v1-a",
      response: { choice: 0 },
    };
  const results = await Promise.all([
    repo.answer(uid, key, attemptSession, command),
    repo.answer(uid, key, attemptSession, command),
  ]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[0].correct, true);
  assert.match(results[0].feedback!, /ma/);
  const wrong = await repo.answer(uid, randomUUID(), attemptSession, {
    exerciseVersionId: "local-token-v1-b",
    response: { choice: 0 },
  });
  assert.equal(wrong.correct, false);
  assert.match(wrong.feedback!, /ni/);
  const snapshot = await repo.snapshot(uid);
  assert.equal(snapshot.learning.dueCount, 2);
  assert.equal(snapshot.learning.mastery.length, 2);
  assert.ok(
    snapshot.learning.mastery.every(
      (m) =>
        m.projection.status === "unseen" &&
        m.projection.evidenceCount === 0 &&
        m.projection.excludedCount === 1,
    ),
  );
  assert.ok(!JSON.stringify(snapshot.learning.due).includes("back"));
  cardId = snapshot.learning.due[0].id;
  const counts = await ownerTransaction(pool, uid, (c) =>
    c.query(
      `SELECT (SELECT count(*) FROM app_private.mastery_evidence WHERE user_id=$1)::int AS evidence,(SELECT count(*) FROM app_private.cards WHERE user_id=$1)::int AS cards`,
      [uid],
    ),
  );
  assert.deepEqual(counts.rows[0], { evidence: 2, cards: 2 });
});

test("Rating requires reveal, enforces owner, concurrent duplicate/lost receipt exactly once; no mastery change", async () => {
  await assert.rejects(
    review.rate(uid, randomUUID(), cardId, {
      expectedVersion: 1,
      rating: "Easy",
    }),
    conflict,
  );
  await assert.rejects(
    review.reveal(other, randomUUID(), cardId, 1),
    (e: CommandError) => e.status === 404,
  );
  const reveal = await review.reveal(uid, randomUUID(), cardId, 1);
  assert.ok(["ma", "ni"].includes(reveal.back));
  assert.equal(reveal.algorithm, ALGORITHM);
  assert.deepEqual(Object.keys(reveal.previews), [
    "Again",
    "Hard",
    "Good",
    "Easy",
  ]);
  const before = (await repo.snapshot(uid)).learning.mastery;
  const key = randomUUID(),
    command = { expectedVersion: 1, rating: "Easy" as const };
  const result = await Promise.all([
    review.rate(uid, key, cardId, command),
    review.rate(uid, key, cardId, command),
  ]);
  assert.deepEqual(result[0], result[1]);
  // Treat first response as lost, replay across a fresh pool below too.
  assert.deepEqual(await review.rate(uid, key, cardId, command), result[0]);
  await assert.rejects(
    review.rate(uid, key, cardId, { ...command, rating: "Good" }),
    (e: CommandError) => e.code === "IDEMPOTENCY_CONFLICT",
  );
  await assert.rejects(
    review.rate(uid, randomUUID(), cardId, command),
    conflict,
  );
  const after = await repo.snapshot(uid);
  assert.deepEqual(after.learning.mastery, before);
  assert.equal(after.learning.reviews, 1);
  assert.equal(after.learning.dueCount, 1);
  const log = (
    await admin.query(
      "SELECT * FROM app_private.review_logs WHERE user_id=$1",
      [uid],
    )
  ).rows[0];
  assert.equal(log.before_card.reps, 0);
  assert.equal(log.after_card.reps, 1);
  assert.deepEqual(
    log.after_card,
    schedule(log.before_card, new Date(log.occurred_at), "Easy").card,
  );
  assert.deepEqual(
    log.scheduler_config,
    JSON.parse(JSON.stringify(SCHEDULER_CONFIG)),
  );
  const fresh = createRuntimePool(process.env.DATABASE_URL!, 1);
  try {
    assert.deepEqual(
      await new PostgresReviewRepository(fresh).rate(uid, key, cardId, command),
      result[0],
    );
    assert.deepEqual(
      (await new PostgresLocalRepository(fresh).snapshot(uid)).learning,
      after.learning,
    );
  } finally {
    await fresh.end();
  }
});

test("Two competing ratings at same card version apply only one", async () => {
  const card = (await repo.snapshot(uid)).learning.due[0];
  await review.reveal(uid, randomUUID(), card.id, card.version);
  const results = await Promise.allSettled(
    ["Good", "Again"].map((rating) =>
      review.rate(uid, randomUUID(), card.id, {
        expectedVersion: card.version,
        rating: rating as "Good" | "Again",
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const rejected = results.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.equal(rejected.reason.code, "STALE_CARD");
});

test("Review log/card/idempotency atomic rollback on denied card UPDATE; retry remains safe", async () => {
  const owner = randomUUID(),
    id = (await repo.start(owner, randomUUID(), false)).sessionId;
  await repo.answer(owner, randomUUID(), id, {
    exerciseVersionId: "local-token-v1-a",
    response: { choice: 0 },
  });
  const card = (await repo.snapshot(owner)).learning.due[0];
  await review.reveal(owner, randomUUID(), card.id, 1);
  const key = randomUUID();
  await admin.query("REVOKE UPDATE ON app_private.cards FROM csh_runtime");
  try {
    await assert.rejects(
      review.rate(owner, key, card.id, { expectedVersion: 1, rating: "Good" }),
    );
  } finally {
    await admin.query("GRANT UPDATE ON app_private.cards TO csh_runtime");
  }
  assert.equal((await repo.snapshot(owner)).learning.reviews, 0);
  await review.rate(owner, key, card.id, {
    expectedVersion: 1,
    rating: "Good",
  });
  assert.equal((await repo.snapshot(owner)).learning.reviews, 1);
});

test("Attempt/card/mastery/idempotency all roll back on denied projection write", async () => {
  const owner = randomUUID(),
    id = (await repo.start(owner, randomUUID(), false)).sessionId,
    key = randomUUID();
  await admin.query(
    "REVOKE INSERT ON app_private.skill_mastery FROM csh_runtime",
  );
  try {
    await assert.rejects(
      repo.answer(owner, key, id, {
        exerciseVersionId: "local-token-v1-a",
        response: { choice: 0 },
      }),
    );
  } finally {
    await admin.query(
      "GRANT INSERT ON app_private.skill_mastery TO csh_runtime",
    );
  }
  const s = await repo.snapshot(owner);
  assert.equal(s.progress.attempts, 0);
  assert.equal(s.learning.dueCount, 0);
  assert.equal(s.learning.mastery.length, 0);
  await repo.answer(owner, key, id, {
    exerciseVersionId: "local-token-v1-a",
    response: { choice: 0 },
  });
  assert.equal((await repo.snapshot(owner)).learning.dueCount, 1);
});

test("Cross-user new tables, composite FK, context cleanup and pool reuse", async () => {
  const aPid = await ownerTransaction(pool, uid, async (c) => {
    assert.equal(
      (await c.query("SELECT * FROM app_private.cards")).rowCount,
      2,
    );
    return (await c.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  });
  const bPid = await ownerTransaction(pool, other, async (c) => {
    for (const table of [
      "mastery_evidence",
      "skill_mastery",
      "cards",
      "review_logs",
    ])
      assert.equal(
        (await c.query(`SELECT * FROM app_private.${table}`)).rowCount,
        0,
      );
    return (await c.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
  });
  assert.equal(aPid, bPid);
  assert.equal(
    (
      await ownerTransaction(pool, other, (c) =>
        c.query("SELECT * FROM app_private.review_logs WHERE user_id=$1", [
          uid,
        ]),
      )
    ).rowCount,
    0,
  );
  const attempt = (
    await admin.query(
      "SELECT id FROM app_private.attempts WHERE user_id=$1 LIMIT 1",
      [uid],
    )
  ).rows[0].id;
  await assert.rejects(
    ownerTransaction(pool, other, (c) =>
      c.query(
        `INSERT INTO app_private.cards(id,user_id,template_version_id,source_attempt_id,scheduler_card,algorithm,scheduler_config,due_at) VALUES($1,$2,'foreign',$3,'{}','x','{}',now())`,
        [randomUUID(), other, attempt],
      ),
    ),
    (e: { code?: string }) => e.code === "23503",
  );
  const c = await pool.connect();
  try {
    assert.equal((await c.query("SELECT auth.uid() AS uid")).rows[0].uid, null);
  } finally {
    c.release();
  }
});
test("Due queue excludes future cards; unknown configuration fails closed without review mutation", async () => {
  const owner = randomUUID(),
    id = (await repo.start(owner, randomUUID(), false)).sessionId;
  await repo.answer(owner, randomUUID(), id, {
    exerciseVersionId: "local-token-v1-a",
    response: { choice: 0 },
  });
  const card = (await repo.snapshot(owner)).learning.due[0];
  await admin.query(
    "UPDATE app_private.cards SET due_at=clock_timestamp()+interval '1 day' WHERE user_id=$1",
    [owner],
  );
  const future = await repo.snapshot(owner);
  assert.equal(future.learning.dueCount, 0);
  assert.ok(future.learning.nextDueAt);
  await assert.rejects(
    review.reveal(owner, randomUUID(), card.id, 1),
    (e: CommandError) => e.code === "CARD_NOT_DUE",
  );
  await admin.query(
    "UPDATE app_private.cards SET due_at=clock_timestamp()-interval '1 day',algorithm='unknown' WHERE user_id=$1",
    [owner],
  );
  await assert.rejects(
    review.reveal(owner, randomUUID(), card.id, 1),
    (e: CommandError) => e.code === "SCHEDULER_CONFIG",
  );
  assert.equal((await repo.snapshot(owner)).learning.reviews, 0);
});
