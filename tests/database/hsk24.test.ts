import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import {
  createRuntimePool,
  ownerTransaction,
} from "../../src/shared/db/transaction";
import { PostgresContentRepository } from "../../src/modules/content/infrastructure/postgres-content";
import { PostgresLocalRepository } from "../../src/modules/learning/infrastructure/postgres-local-repository";
import { PostgresCurriculumRepository } from "../../src/modules/curriculum/infrastructure/postgres-curriculum";
import {
  currentDrafts,
  loadDraftCatalog,
} from "../../src/modules/content/application/catalog";
import { PostgresReviewRepository } from "../../src/modules/review/infrastructure/postgres-review-repository";
import { PostgresStudyRepository } from "../../src/modules/planning/infrastructure/postgres-study";
import { recallTemplateId } from "../../src/modules/content/application/recall-origin";
const pointer = JSON.parse(
  fs.readFileSync(".local-postgres/hsk24/current.json", "utf8"),
);
const state = JSON.parse(fs.readFileSync(pointer.stateFile, "utf8"));
const pool = createRuntimePool(state.runtimeUrl, 1);
const repo = new PostgresContentRepository(pool),
  learning = new PostgresLocalRepository(pool);
const testedOwners: string[] = [];
const testedLevel = Number(process.env.CSH_HSK_TEST_LEVEL ?? 2);
const allLessons = currentDrafts().filter((p) =>
  testedLevel === 0
    ? p.lesson.classification === "FOUNDATION_INTERNAL"
    : p.alignment.targetLevel === testedLevel,
);
const requested = process.env.CSH_HSK2_TEST_LESSONS?.split(",");
const selectedLessons = requested
  ? allLessons.filter((p) => requested.includes(p.lesson.id))
  : allLessons;
if (requested && selectedLessons.length !== requested.length)
  throw Error("UNKNOWN_TEST_LESSON");
test.after(() => pool.end());
for (const p of selectedLessons) {
  const uid = randomUUID();
  testedOwners.push(uid);
  test(`${p.lesson.id}: saved cursor, idempotent grading, owner isolation, completion, FSRS and progress`, async () => {
    const { sessionId } = await repo.start(
      uid,
      randomUUID(),
      p.lesson.versionId,
      { restart: false, packageHash: p.packageHash },
    );
    await assert.rejects(
      repo.advance(randomUUID(), randomUUID(), sessionId, 1),
      /phiên học/i,
    );
    const publicView = await repo.view(uid, p.lesson.versionId);
    for (const marker of ["privateKeys", "keyRef", "accepted"])
      assert.ok(!JSON.stringify(publicView).includes(`"${marker}"`));
    while (true) {
      const view = await repo.view(uid, p.lesson.versionId);
      const session = view.session!;
      if (session.cursor === p.blocks.length) break;
      const block = p.blocks[session.cursor];
      if (block.type === "teaching") {
        await repo.advance(uid, randomUUID(), sessionId, session.version);
        continue;
      }
      const ex = p.exercises.find((e) => e.id === block.exerciseVersionId)!;
      const key = p.privateKeys.find((k) => k.id === ex.keyRef)!;
      const a = key.accepted[0];
      const command = {
        exerciseVersionId: ex.id,
        response:
          ex.type === "choice"
            ? { choice: ex.choices.indexOf(a) }
            : ex.type === "sequence"
              ? { order: a.split(",").map(Number) }
              : { text: a },
      };
      const invalidResponse =
        ex.type === "choice"
          ? { choice: 99 }
          : ex.type === "sequence"
            ? { order: [99, 99] }
            : { choice: 99 };
      await assert.rejects(
        repo.answer(uid, randomUUID(), sessionId, {
          exerciseVersionId: ex.id,
          response: invalidResponse,
        }),
      );
      const idempotency = randomUUID();
      const result = await repo.answer(uid, idempotency, sessionId, command);
      assert.equal(result.correct, true);
      assert.equal(result.independentEvidence, false);
      assert.deepEqual(
        await repo.answer(uid, idempotency, sessionId, command),
        result,
      );
      const saved = await repo.view(uid, p.lesson.versionId);
      await repo.advance(uid, randomUUID(), sessionId, saved.session!.version);
    }
    await repo.complete(uid, randomUUID(), sessionId);
    const summary = await learning.snapshot(uid);
    const expectedCards = new Set(
      p.exercises
        .filter((e) => e.evidenceScope !== "CONTEXT_ONLY")
        .map((e) => recallTemplateId(p, e.conceptId)),
    ).size;
    assert.equal(summary.learning.dueCount, expectedCards);
    assert.ok(
      summary.learning.mastery.every((m) => m.projection.evidenceCount === 0),
    );
    await ownerTransaction(pool, uid, async (c) => {
      assert.equal(
        (
          await c.query(
            "SELECT count(*)::int n FROM app_private.attempts WHERE session_id=$1",
            [sessionId],
          )
        ).rows[0].n,
        p.exercises.length,
      );
      const contextualIds = p.exercises
        .filter((e) => e.evidenceScope === "CONTEXT_ONLY")
        .map((e) => e.id);
      if (contextualIds.length) {
        assert.equal(
          (
            await c.query(
              "SELECT count(*)::int n FROM app_private.mastery_evidence m JOIN app_private.attempts a ON a.id=m.attempt_id WHERE a.user_id=$1 AND a.session_id=$2 AND a.exercise_version_id=ANY($3::text[])",
              [uid, sessionId, contextualIds],
            )
          ).rows[0].n,
          0,
          "Context-only tasks must not attribute lexical evidence",
        );
        assert.equal(
          (
            await c.query(
              "SELECT count(*)::int n FROM app_private.cards c JOIN app_private.attempts a ON a.id=c.source_attempt_id WHERE a.user_id=$1 AND a.session_id=$2 AND a.exercise_version_id=ANY($3::text[])",
              [uid, sessionId, contextualIds],
            )
          ).rows[0].n,
          0,
          "Context-only tasks must not originate vocabulary cards",
        );
      }
    });
  });
}
test("Curriculum persists real HSK2 progress and still blocks verified prerequisites", async () => {
  const snapshot = await new PostgresCurriculumRepository(pool).snapshot(
    testedOwners[0],
  );
  const hsk2 = snapshot.courses.find(
    (c) => c.code === (testedLevel === 0 ? "FOUNDATION" : `HSK${testedLevel}`),
  )!;
  const expected = currentDrafts().filter((p) =>
    testedLevel === 0
      ? p.lesson.classification === "FOUNDATION_INTERNAL"
      : p.alignment.targetLevel === testedLevel,
  ).length;
  assert.equal(hsk2.totalLessons, expected);
  assert.equal(hsk2.completed, 1);
  assert.equal(hsk2.independentEvidence, 0);
  for (const l of snapshot.lessons.filter(
    (l) =>
      l.courseCode === (testedLevel === 0 ? "FOUNDATION" : `HSK${testedLevel}`),
  )) {
    assert.equal(l.access.verifiedEligible, false);
    assert.equal(l.access.availability, "PRACTICE_ONLY");
    if (testedLevel !== 0) assert.ok(l.prerequisites.some((p) => !p.satisfied));
  }
});
test("New content rejects invalid answers, saves incorrect feedback, and persists FSRS review without mastery", async () => {
  const p = currentDrafts().find((p) => p.lesson.id === "L203")!,
    owner = randomUUID();
  const { sessionId } = await repo.start(
    owner,
    randomUUID(),
    p.lesson.versionId,
    { restart: false, packageHash: p.packageHash },
  );
  let view = await repo.view(owner, p.lesson.versionId);
  while (p.blocks[view.session!.cursor].type === "teaching") {
    await repo.advance(owner, randomUUID(), sessionId, view.session!.version);
    view = await repo.view(owner, p.lesson.versionId);
  }
  const e = p.exercises[0],
    a = p.privateKeys.find((k) => k.id === e.keyRef)!.accepted[0];
  await assert.rejects(
    repo.answer(owner, randomUUID(), sessionId, {
      exerciseVersionId: e.id,
      response: { choice: 99 },
    }),
  );
  const wrong = await repo.answer(owner, randomUUID(), sessionId, {
    exerciseVersionId: e.id,
    response: { choice: (e.choices.indexOf(a) + 1) % e.choices.length },
  });
  assert.equal(wrong.correct, false);
  assert.ok(wrong.feedback.length > 10);
  const review = new PostgresReviewRepository(pool);
  const queue = await learning.snapshot(owner);
  const card = queue.learning.due[0];
  await review.reveal(owner, randomUUID(), card.id, card.version);
  const token = randomUUID(),
    command = { expectedVersion: card.version, rating: "Good" as const };
  const result = await review.rate(owner, token, card.id, command);
  assert.deepEqual(await review.rate(owner, token, card.id, command), result);
  const after = await learning.snapshot(owner);
  assert.ok(
    after.learning.mastery.every((m) => m.projection.evidenceCount === 0),
  );
});
test("Today/weekly planner accepts expanded draft catalog without granting verified eligibility", async () => {
  const planner = new PostgresStudyRepository(pool),
    owner = randomUUID();
  await planner.save(owner, randomUUID(), {
    preferences: {
      weeklyHours: 9,
      days: [0, 1, 2, 3, 4, 5, 6],
      dailyCap: 90,
      sessionMinutes: 20,
    },
    planning: {
      dayCaps: [90, 90, 90, 90, 90, 90, 90],
      maxSessionMinutes: 25,
      paused: false,
      timezone: "Asia/Saigon",
      startingLevel: "some",
    },
    expectedVersion: 0,
    acceptLimited: false,
  });
  const today = await planner.today(owner);
  assert.ok(today.plan);
  const catalog = await new PostgresCurriculumRepository(pool).snapshot(owner);
  assert.equal(
    catalog.courses.find((c) => c.code === "HSK2")!.totalLessons,
    currentDrafts().filter((p) => p.alignment.targetLevel === 2).length,
  );
  assert.ok(
    catalog.lessons
      .filter((l) => l.courseCode === "HSK2")
      .every((l) => !l.access.verifiedEligible),
  );
  const selected = currentDrafts().find((p) => p.lesson.id === "L203")!;
  await repo.start(owner, randomUUID(), selected.lesson.versionId, {
    restart: false,
    packageHash: selected.packageHash,
  });
  const resumed = await planner.today(owner);
  assert.equal(resumed.plan!.action?.target, selected.lesson.versionId);
  assert.equal(resumed.plan!.action?.kind, "resume");
});

if (testedLevel === 1 && selectedLessons.some((p) => p.lesson.id === "L182"))
  test("HSK1 谁 accepts the second official reading on the server without a new card identity", async () => {
    const p = selectedLessons.find((p) => p.lesson.id === "L182")!,
      owner = randomUUID();
    const { sessionId } = await repo.start(
      owner,
      randomUUID(),
      p.lesson.versionId,
      { restart: false, packageHash: p.packageHash },
    );
    let view = await repo.view(owner, p.lesson.versionId);
    while (p.blocks[view.session!.cursor].type === "teaching") {
      await repo.advance(owner, randomUUID(), sessionId, view.session!.version);
      view = await repo.view(owner, p.lesson.versionId);
    }
    const result = await repo.answer(owner, randomUUID(), sessionId, {
      exerciseVersionId: p.exercises[0].id,
      response: { text: "shui2" },
    });
    assert.equal(result.correct, true);
    assert.equal(result.independentEvidence, false);
    await ownerTransaction(pool, owner, async (c) => {
      const rows = (
        await c.query(
          "SELECT template_version_id FROM app_private.cards WHERE user_id=$1",
          [owner],
        )
      ).rows;
      assert.deepEqual(
        rows.map((r) => r.template_version_id),
        [recallTemplateId(p, p.exercises[0].conceptId)],
      );
    });
  });
test(
  "Unit review reuses the existing FSRS card and persists Today continuation",
  { skip: !fs.existsSync("content/hsk24/reviews.json") },
  async () => {
    const activities = JSON.parse(
      fs.readFileSync("content/hsk24/reviews.json", "utf8"),
    ).activities;
    const activity =
      activities.find(
        (a: { kind: string; versionId: string }) =>
          a.kind === "UNIT_REVIEW" && a.versionId.startsWith(`l${testedLevel}`),
      ) ??
      activities.find(
        (a: { kind: string; versionId: string }) =>
          a.kind === "UNIT_REVIEW" && a.versionId.startsWith("l2"),
      );
    assert(
      activity,
      "A current HSK1 or shared existing HSK2 review fixture is required",
    );
    const reviewPackage = currentDrafts().find(
      (p) => p.lesson.versionId === activity.versionId,
    )!;
    const origin = loadDraftCatalog().packages.find(
      (p) => p.lesson.versionId === activity.sourceVersions[0],
    )!;
    const owner = randomUUID();
    for (const p of [origin, reviewPackage]) {
      const { sessionId } = await repo.start(
        owner,
        randomUUID(),
        p.lesson.versionId,
        { restart: false, packageHash: p.packageHash },
      );
      let view = await repo.view(owner, p.lesson.versionId);
      while (p.blocks[view.session!.cursor].type === "teaching") {
        await repo.advance(
          owner,
          randomUUID(),
          sessionId,
          view.session!.version,
        );
        view = await repo.view(owner, p.lesson.versionId);
      }
      const b = p.blocks[view.session!.cursor];
      assert.equal(b.type, "exercise");
      const e = p.exercises.find(
        (e) => b.type === "exercise" && e.id === b.exerciseVersionId,
      )!;
      const a = p.privateKeys.find((k) => k.id === e.keyRef)!.accepted[0];
      await repo.answer(owner, randomUUID(), sessionId, {
        exerciseVersionId: e.id,
        response:
          e.type === "choice"
            ? { choice: e.choices.indexOf(a) }
            : e.type === "sequence"
              ? { order: a.split(",").map(Number) }
              : { text: a },
      });
    }
    await ownerTransaction(pool, owner, async (c) => {
      const cards = (
        await c.query(
          "SELECT template_version_id FROM app_private.cards WHERE user_id=$1",
          [owner],
        )
      ).rows;
      assert.equal(cards.length, 1);
      assert.equal(
        cards[0].template_version_id,
        recallTemplateId(reviewPackage, reviewPackage.exercises[0].conceptId),
      );
    });
    const continuationOwner = randomUUID(),
      planner = new PostgresStudyRepository(pool);
    await planner.save(continuationOwner, randomUUID(), {
      preferences: {
        weeklyHours: 9,
        days: [0, 1, 2, 3, 4, 5, 6],
        dailyCap: 90,
        sessionMinutes: 20,
      },
      planning: {
        dayCaps: [90, 90, 90, 90, 90, 90, 90],
        maxSessionMinutes: 25,
        paused: false,
        timezone: "Asia/Saigon",
        startingLevel: "some",
      },
      expectedVersion: 0,
      acceptLimited: false,
    });
    await repo.start(
      continuationOwner,
      randomUUID(),
      reviewPackage.lesson.versionId,
      { restart: false, packageHash: reviewPackage.packageHash },
    );
    const today = await planner.today(continuationOwner);
    assert.equal(today.plan?.action?.target, reviewPackage.lesson.versionId);
  },
);
