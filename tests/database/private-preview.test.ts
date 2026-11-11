import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool, Client } from "pg";
import { privateState } from "../../scripts/private-preview-db";
import { adminConfig } from "../../scripts/local-db.mjs";
import {
  loadPrivateOwnerPreview,
  assertPrivatePath,
} from "../../src/modules/content/application/private-preview";
import { PostgresContentRepository } from "../../src/modules/content/infrastructure/postgres-content";
import { PostgresReviewRepository } from "../../src/modules/review/infrastructure/postgres-review-repository";
import { PostgresLocalRepository } from "../../src/modules/learning/infrastructure/postgres-local-repository";
import { curriculumWithin } from "../../src/modules/curriculum/infrastructure/postgres-curriculum";
import {
  ownerTransaction,
  assertRuntime,
} from "../../src/shared/db/transaction";
import { expectedKeys } from "../fixtures/private-preview";
import {
  projectMastery,
  MASTERY_ENGINE,
} from "../../src/modules/learning/domain/mastery";
const s = privateState(),
  env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
    CSH_APP_MODE: "PRODUCTION_AUTHENTICATED",
    CSH_PRIVATE_OWNER_PREVIEW: "local-v1",
    CSH_APP_ORIGIN: "http://127.0.0.1:3025",
    CSH_AUTH_URL: "http://127.0.0.1:54390",
    DATABASE_URL: s.runtimeUrl,
  },
  r = loadPrivateOwnerPreview(env, "development")!;
const pool = new Pool({ connectionString: s.runtimeUrl, max: 1 }),
  admin = new Client(adminConfig(s.database)),
  uid = randomUUID(),
  other = randomUUID();
const content = new PostgresContentRepository(pool, r.access),
  snapshot = new PostgresLocalRepository(
    pool,
    r.template,
    r.all.map((p) => p.lesson.versionId),
  );
test.before(() => admin.connect());
test.after(async () => {
  await pool.end();
  await admin.end();
});
test("Private DB actual role/RLS, key store and publication write denied", async () => {
  const c = await pool.connect();
  try {
    await assertRuntime(c);
    await assert.rejects(
      c.query("UPDATE app_content.packages SET state='PUBLISHED'"),
      { code: "42501" },
    );
    await assert.rejects(
      c.query("INSERT INTO app_meta.runtime_proof DEFAULT VALUES"),
      { code: "42501" },
    );
  } finally {
    c.release();
  }
});
test("Practice all four immutable selected lessons; 26 answers, concurrent idempotency, private keys and no verified mastery", async () => {
  const existing = projectMastery([], new Date());
  await ownerTransaction(pool, uid, (c) =>
    c.query(
      "INSERT INTO app_private.skill_mastery(user_id,concept_id,skill,projection,engine_version,version) VALUES($1,$2,'recognition',$3,$4,7)",
      [uid, r.all[0].concepts[0].id, existing, MASTERY_ENGINE],
    ),
  );
  for (const p of r.all) {
    const command = { restart: true, packageHash: p.packageHash },
      key = randomUUID();
    const [a, b] = await Promise.all([
      content.start(uid, key, p.lesson.versionId, command),
      content.start(uid, key, p.lesson.versionId, command),
    ]);
    assert.deepEqual(a, b);
    const id = a.sessionId;
    await assert.rejects(content.advance(other, randomUUID(), id, 1));
    while (true) {
      const v = await content.view(uid, p.lesson.versionId),
        session = v.session!;
      assert.doesNotMatch(JSON.stringify(v), /"(privateKeys|accepted|keyRef)"/);
      const block = p.blocks[session.cursor];
      if (!block) break;
      if (block.type === "exercise") {
        const i = p.exercises.findIndex(
            (e) => e.id === block.exerciseVersionId,
          ),
          e = p.exercises[i],
          answer = expectedKeys[p.lesson.id][i];
        const response =
          e.type === "choice"
            ? { choice: e.choices.indexOf(answer) }
            : e.type === "sequence"
              ? { order: answer.split(",").map(Number) }
              : { text: answer };
        const key = randomUUID(),
          cmd = { exerciseVersionId: e.id, response };
        const [a, b] = await Promise.all([
          content.answer(uid, key, id, cmd),
          content.answer(uid, key, id, cmd),
        ]);
        assert.deepEqual(a, b);
        assert.equal(
          (await content.view(uid, p.lesson.versionId)).session!.answers.at(-1)!
            .correct,
          true,
        );
      }
      const latest = (await content.view(uid, p.lesson.versionId)).session!;
      await content.advance(uid, randomUUID(), id, latest.version);
    }
    await content.complete(uid, randomUUID(), id);
  }
  const data = await snapshot.snapshot(uid);
  assert.equal(data.progress.attempts, 26);
  assert.equal(data.progress.correct, 26);
  assert.equal(data.progress.completedSessions, 4);
  const preserved = (
    await admin.query(
      "SELECT projection,version FROM app_private.skill_mastery WHERE user_id=$1 AND concept_id=$2 AND skill='recognition'",
      [uid, r.all[0].concepts[0].id],
    )
  ).rows[0];
  assert.deepEqual(preserved, { projection: existing, version: 7 });
  assert.ok(
    data.learning.mastery.every((m) => m.projection.evidenceCount === 0),
  );
  const counts = (
    await admin.query(
      "SELECT review_status,count(*)::int AS n FROM app_private.content_attempt_bindings WHERE user_id=$1 GROUP BY review_status",
      [uid],
    )
  ).rows;
  assert.deepEqual(counts, [{ review_status: "DRAFT_UNREVIEWED", n: 26 }]);
  const catalog = await ownerTransaction(pool, uid, (c) =>
    curriculumWithin(c, uid, {
      id: r.id,
      current: r.current,
      all: r.all,
      privateOwnerPreview: true,
    }),
  );
  assert.equal(catalog.lessons.length, 4);
  assert.ok(
    catalog.lessons.every(
      (l) =>
        l.access.mayPractice &&
        !l.access.verifiedEligible &&
        !l.access.published,
    ),
  );
  assert.ok(catalog.lessons.some((l) => !l.access.prerequisitesSatisfied));
});
test("FSRS persists from provisional practice; replay stays once and other identity cannot access cards/sessions", async () => {
  const before = await snapshot.snapshot(uid),
    card = before.learning.due[0];
  assert.ok(card);
  const review = new PostgresReviewRepository(pool, r.template);
  await assert.rejects(
    review.reveal(other, randomUUID(), card.id, card.version),
  );
  await review.reveal(uid, randomUUID(), card.id, card.version);
  const key = randomUUID(),
    command = { expectedVersion: card.version, rating: "Good" as const };
  const [a, b] = await Promise.all([
    review.rate(uid, key, card.id, command),
    review.rate(uid, key, card.id, command),
  ]);
  assert.deepEqual(a, b);
  const after = await new PostgresLocalRepository(
    pool,
    r.template,
    r.all.map((p) => p.lesson.versionId),
  ).snapshot(uid);
  assert.equal(after.learning.reviews, before.learning.reviews + 1);
  assert.ok(
    after.learning.mastery.every((m) => m.projection.evidenceCount === 0),
  );
  assert.equal((await snapshot.snapshot(other)).progress.attempts, 0);
  const row = (
    await admin.query(
      "SELECT version,scheduler_card FROM app_private.cards WHERE user_id=$1 AND id=$2",
      [uid, card.id],
    )
  ).rows[0];
  assert.equal(row.version, card.version + 1);
  assert.equal(row.scheduler_card.reps, 1);
});
test("Nonselected content and corrupted registered package refuse; old versions/hash/current pointers retained", async () => {
  await assert.rejects(content.view(uid, "f01-draft-v1"));
  const old = (
    await admin.query(
      "SELECT state FROM app_content.packages WHERE version_id='f01-draft-v1'",
    )
  ).rows[0];
  assert.equal(old.state, "REVIEW_PENDING");
  const p = r.all[0];
  await admin.query(
    "UPDATE app_content.packages SET manifest=jsonb_set(manifest,'{lesson,title}',to_jsonb('corrupted title'::text)) WHERE version_id=$1",
    [p.lesson.versionId],
  );
  try {
    await assert.rejects(
      content.start(uid, randomUUID(), p.lesson.versionId, {
        restart: true,
        packageHash: p.packageHash,
      }),
    );
  } finally {
    await admin.query(
      "UPDATE app_content.packages SET manifest=$2 WHERE version_id=$1",
      [p.lesson.versionId, p],
    );
  }
  const pointers = (
    await admin.query(
      "SELECT current_version FROM app_content.lessons ORDER BY stable_key",
    )
  ).rows.map((x) => x.current_version);
  assert.deepEqual(pointers, [
    "f01-draft-v1",
    "f02-draft-v1",
    "l001-draft-v2",
    "l002-draft-v2",
  ]);
});
test("Scope checked before receipt replay: legacy session/card and removed selection stay inaccessible", async () => {
  const legacy = new PostgresContentRepository(pool),
    oldVersion = "f01-draft-v1";
  const manifest = (
    await admin.query(
      "SELECT manifest FROM app_content.packages WHERE version_id=$1",
      [oldVersion],
    )
  ).rows[0].manifest;
  const key = randomUUID(),
    command = { restart: true, packageHash: manifest.packageHash };
  const old = await legacy.start(uid, key, oldVersion, command);
  await assert.rejects(
    ownerTransaction(pool, uid, (c) =>
      assertPrivatePath(c, uid, `content/${oldVersion}/start`, r),
    ),
  );
  await assert.rejects(
    ownerTransaction(pool, uid, (c) =>
      assertPrivatePath(c, uid, `content/sessions/${old.sessionId}/advance`, r),
    ),
  );
  const p = r.all[0],
    active = await content.start(uid, randomUUID(), p.lesson.versionId, {
      restart: true,
      packageHash: p.packageHash,
    });
  const selectedKey = randomUUID(),
    selectedCommand = { restart: true, packageHash: p.packageHash };
  await content.start(uid, selectedKey, p.lesson.versionId, selectedCommand);
  const removed = {
    ...r,
    access: {
      ...r.access,
      packageFor: async () => {
        throw Error("REMOVED_SELECTION");
      },
    },
    template: () => null,
  };
  await assert.rejects(
    ownerTransaction(pool, uid, (c) =>
      assertPrivatePath(
        c,
        uid,
        `content/sessions/${active.sessionId}/complete`,
        removed,
      ),
    ),
  );
  const card = (await snapshot.snapshot(uid)).learning.due[0];
  await assert.rejects(
    ownerTransaction(pool, uid, (c) =>
      assertPrivatePath(c, uid, `cards/${card.id}/reveal`, removed),
    ),
  );
  await assert.rejects(
    ownerTransaction(pool, other, (c) =>
      assertPrivatePath(
        c,
        other,
        `content/sessions/${active.sessionId}/answers`,
        r,
      ),
    ),
  );
  assert.equal((await snapshot.snapshot(uid)).progress.attempts, 26);
  const catalog = await ownerTransaction(pool, uid, (c) =>
    curriculumWithin(c, uid, {
      id: r.id,
      current: r.current,
      all: r.all,
      privateOwnerPreview: true,
    }),
  );
  assert.ok(
    catalog.lessons.every((l) => !l.historicalVersions.includes(oldVersion)),
  );
  assert.equal(
    (await content.summary(uid)).lessons.some(
      (l) => l.versionId === oldVersion,
    ),
    false,
  );
});
