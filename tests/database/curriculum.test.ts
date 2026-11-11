import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { adminConfig } from "../../scripts/local-db.mjs";
import {
  createRuntimePool,
  ownerTransaction,
} from "../../src/shared/db/transaction";
import { PostgresCurriculumRepository } from "../../src/modules/curriculum/infrastructure/postgres-curriculum";
import { PostgresContentRepository } from "../../src/modules/content/infrastructure/postgres-content";
import { PostgresStudyRepository } from "../../src/modules/planning/infrastructure/postgres-study";
import { loadDraftCatalog } from "../../src/modules/content/application/catalog";
import { seedCurriculum } from "../../scripts/seed-curriculum";
const pool = createRuntimePool(process.env.DATABASE_URL!, 1),
  repo = new PostgresCurriculumRepository(pool),
  content = new PostgresContentRepository(pool),
  study = new PostgresStudyRepository(pool),
  admin = new pg.Client(adminConfig());
const { packages } = loadDraftCatalog();
test.before(async () => {
  await admin.connect();
});
test.after(async () => {
  await pool.end();
  await admin.end();
});
async function start(owner: string, version = "f01-draft-v1") {
  const p = packages.find((p) => p.lesson.versionId === version)!;
  return content.start(owner, randomUUID(), version, {
    restart: false,
    packageHash: p.packageHash,
  });
}
async function finish(owner: string, version: string) {
  const p = packages.find((p) => p.lesson.versionId === version)!;
  const s = await start(owner, version);
  let view = await content.view(owner, version);
  while (view.session!.cursor < p.blocks.length) {
    const b = p.blocks[view.session!.cursor];
    if (
      b.type === "exercise" &&
      !view.session!.answers.some(
        (a) => a.exerciseVersionId === b.exerciseVersionId,
      )
    ) {
      const e = p.exercises.find((e) => e.id === b.exerciseVersionId)!,
        k = p.privateKeys.find((k) => k.id === e.keyRef)!;
      const response =
        e.type === "choice"
          ? { choice: e.choices.indexOf(k.accepted[0]) }
          : e.type === "sequence"
            ? { order: k.accepted[0].split(",").map(Number) }
            : { text: k.accepted[0] };
      await content.answer(owner, randomUUID(), s.sessionId, {
        exerciseVersionId: e.id,
        response,
      });
    }
    view = await content.view(owner, version);
    await content.advance(
      owner,
      randomUUID(),
      s.sessionId,
      view.session!.version,
    );
    view = await content.view(owner, version);
  }
  await content.complete(owner, randomUUID(), s.sessionId);
}
test("Five DB courses / four real units / four current lessons / six immutable versions, seed replay and no empty-course percentages", async () => {
  await seedCurriculum();
  const s = await repo.snapshot(randomUUID());
  assert.deepEqual(
    s.courses.map((c) => c.code),
    ["FOUNDATION", "HSK1", "HSK2", "HSK3", "HSK4"],
  );
  assert.equal(s.lessons.length, 4);
  assert.equal(s.units.length, 4);
  assert.ok(
    s.courses.every(
      (c) =>
        c.practiced === 0 && c.completed === 0 && c.independentEvidence === 0,
    ),
  );
  for (const c of s.courses.slice(2)) {
    assert.equal(c.totalLessons, 0);
    assert.equal(c.unitCount, 0);
    assert.equal(c.availability, "NOT_RELEASED");
    assert.equal(c.activityState, "NOT_STARTED");
    assert.equal(c.currentPracticeScopeComplete, false);
    assert.ok(!("percentage" in c));
  }
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM app_content.lesson_versions",
      )
    ).rows[0].n,
    6,
  );
});
test("Owner-isolated persisted start/answers/completion; provisional practice never becomes verified course completion", async () => {
  const a = randomUUID(),
    b = randomUUID();
  await finish(a, "f01-draft-v1");
  const s = await repo.snapshot(a),
    empty = await repo.snapshot(b);
  const f = s.courses[0];
  assert.equal(f.practiced, 1);
  assert.equal(f.completed, 1);
  assert.equal(f.independentEvidence, 0);
  assert.notEqual(f.activityState, "COMPLETED");
  assert.ok(empty.courses.every((c) => c.completed === 0 && c.practiced === 0));
  assert.equal(
    s.lessons.find((l) => l.key === "F02")!.access.verifiedEligible,
    false,
  );
  assert.ok(
    s.lessons
      .find((l) => l.key === "F02")!
      .prerequisites.every((r) => !r.satisfied),
  );
});
test("Historical v1 practice is retained separately; v2 completion is not synthesized or migrated", async () => {
  const uid = randomUUID();
  await finish(uid, "l001-draft-v1");
  let s = await repo.snapshot(uid),
    l = s.lessons.find((l) => l.key === "L001")!;
  assert.equal(l.currentVersion, "l001-draft-v2");
  assert.equal(l.completed, false);
  assert.equal(l.practiced, false);
  assert.deepEqual(l.historicalVersions, ["l001-draft-v1"]);
  await finish(uid, "l001-draft-v2");
  s = await repo.snapshot(uid);
  l = s.lessons.find((l) => l.key === "L001")!;
  assert.equal(l.completed, true);
  assert.equal(s.courses[1].completed, 1);
  assert.equal(s.courses[1].coverageVerified, false);
  assert.equal(s.courses[2].availability, "NOT_RELEASED");
});
test("Runtime SELECT-only catalog: ordinary owner cannot publish, edit metadata or delete version links", async () => {
  for (const table of [
    "courses",
    "units",
    "lessons",
    "lesson_versions",
    "unit_prerequisites",
    "lesson_skill_prerequisites",
  ]) {
    await assert.rejects(
      ownerTransaction(pool, randomUUID(), (c) =>
        c.query(`DELETE FROM app_content.${table}`),
      ),
      (e: { code: string }) => e.code === "42501",
    );
  }
  await assert.rejects(
    ownerTransaction(pool, randomUUID(), (c) =>
      c.query("UPDATE app_content.courses SET availability='AVAILABLE'"),
    ),
    (e: { code: string }) => e.code === "42501",
  );
});
test("Parent and current-version FK, unique level/order and version immutability survive concurrency", async () => {
  const owner = randomUUID();
  const [a, b] = await Promise.all([start(owner), start(owner)]);
  assert.equal(a.sessionId, b.sessionId);
  await assert.rejects(
    admin.query(
      "INSERT INTO app_content.units VALUES($1,$2,'invalid',0,'test','test','PRACTICE_ONLY')",
      [randomUUID(), randomUUID()],
    ),
    (e: { code: string }) => e.code === "23503",
  );
  await admin.query("BEGIN");
  try {
    await admin.query(
      "UPDATE app_content.lessons SET current_version='f02-draft-v1' WHERE stable_key='F01'",
    );
    await assert.rejects(
      admin.query("SET CONSTRAINTS ALL IMMEDIATE"),
      (e: { code: string }) => e.code === "23503",
    );
  } finally {
    await admin.query("ROLLBACK");
  }
  await assert.rejects(
    admin.query(
      "INSERT INTO app_content.courses SELECT $1,code,title,description,ordinal,syllabus_id,release_ref,availability,coverage_verified FROM app_content.courses LIMIT 1",
      [randomUUID()],
    ),
    (e: { code: string }) => e.code === "23505",
  );
});
test("Planner consumes DB hierarchy, keeps draft prerequisites distinct and never schedules HSK2–4", async () => {
  const uid = randomUUID();
  await study.save(uid, randomUUID(), {
    preferences: {
      weeklyHours: 3,
      days: [0, 1, 2, 3, 4, 5, 6],
      dailyCap: 90,
      sessionMinutes: 20,
    },
    planning: {
      dayCaps: [90, 90, 90, 90, 90, 90, 90],
      maxSessionMinutes: 25,
      paused: false,
      timezone: "Asia/Saigon",
      startingLevel: "zero",
    },
    expectedVersion: 0,
    acceptLimited: false,
  });
  const s = await study.today(uid);
  assert.equal(s.plan!.action?.target, "f01-draft-v1");
  assert.equal(s.plan!.action?.courseCode, "FOUNDATION");
  assert.equal(s.plan!.action?.unitSlug, "pinyin");
  assert.ok(
    s.plan!.blocks.every(
      (b) => !b.courseCode || ["FOUNDATION", "HSK1"].includes(b.courseCode),
    ),
  );
  const l = (await repo.snapshot(uid)).lessons.find((l) => l.key === "L001")!;
  assert.equal(l.access.availability, "PRACTICE_ONLY");
  assert.equal(l.access.prerequisitesSatisfied, false);
  assert.equal(l.access.verifiedEligible, false);
});
test("Learner snapshot exposes only course/public lesson metadata; keys, grading feedback and accepted alternatives absent", async () => {
  const s = await repo.snapshot(randomUUID()),
    json = JSON.stringify(s);
  for (const field of [
    "privateKeys",
    "keyRef",
    "accepted",
    "feedback",
    "answerKey",
    "humanReview",
  ])
    assert.ok(!json.includes(`"${field}"`));
  assert.ok(
    s.lessons.every(
      (l) => l.independentEvidence === 0 && !l.access.verifiedEligible,
    ),
  );
});

test("Server draft access rechecks actual course/unit permission, including historical versions; UI state cannot bypass it", async () => {
  await admin.query(
    "UPDATE app_content.courses SET availability='NOT_RELEASED' WHERE code='HSK1'",
  );
  try {
    const snapshot = await repo.snapshot(randomUUID());
    assert.equal(snapshot.courses[1].availability, "NOT_RELEASED");
    assert.ok(
      snapshot.lessons
        .filter((l) => l.courseCode === "HSK1")
        .every((l) => !l.access.mayPractice && !l.access.verifiedEligible),
    );
    for (const v of ["l001-draft-v1", "l001-draft-v2"])
      await assert.rejects(
        start(randomUUID(), v),
        (e: { code: string }) => e.code === "COURSE_NOT_AVAILABLE",
      );
  } finally {
    await admin.query(
      "UPDATE app_content.courses SET availability='PRACTICE_ONLY' WHERE code='HSK1'",
    );
  }
  await admin.query(
    "UPDATE app_content.units SET availability='NOT_RELEASED' WHERE slug='greetings'",
  );
  try {
    const snapshot = await repo.snapshot(randomUUID());
    assert.equal(
      snapshot.lessons.find((l) => l.key === "L001")!.access.mayPractice,
      false,
    );
    await assert.rejects(
      content.view(randomUUID(), "l001-draft-v2"),
      (e: { code: string }) => e.code === "COURSE_NOT_AVAILABLE",
    );
  } finally {
    await admin.query(
      "UPDATE app_content.units SET availability='PRACTICE_ONLY' WHERE slug='greetings'",
    );
  }
});
