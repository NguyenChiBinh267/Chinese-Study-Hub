import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { exportReviewPackets } from "../../scripts/export-review-packets";
import test from "node:test";
import assert from "node:assert/strict";
import raw from "../../content/curriculum/catalog.v1.json";
import { loadDraftCatalog } from "../../src/modules/content/application/catalog";
import {
  validateCurriculum,
  prerequisiteStatus,
  lessonAccess,
} from "../../src/modules/curriculum/domain/catalog";
import { projectMastery } from "../../src/modules/learning/domain/mastery";
import {
  allocateWeek,
  type WeeklyInput,
} from "../../src/modules/planning/domain/weekly-plan";
const { packages } = loadDraftCatalog();
test("Five ordered courses, real associations and no imaginary Foundation/HSK levels", () => {
  const c = validateCurriculum(raw, packages);
  assert.deepEqual(
    c.courses.map((c) => c.code),
    ["FOUNDATION", "HSK1", "HSK2", "HSK3", "HSK4"],
  );
  assert.equal(c.courses[0].syllabusId, null);
  assert.equal(c.units.length, 4);
  assert.equal(c.lessons.length, 4);
  assert.ok(c.courses.every((c) => !c.coverageVerified));
  for (const code of ["HSK2", "HSK3", "HSK4"]) {
    const course = c.courses.find((c) => c.code === code)!;
    assert.equal(course.availability, "NOT_RELEASED");
    assert.equal(c.units.filter((u) => u.courseId === course.id).length, 0);
  }
  for (const l of c.lessons) {
    const u = c.units.find((u) => u.id === l.unitId)!,
      course = c.courses.find((c) => c.id === u.courseId)!;
    assert.equal(course.code, l.key.startsWith("F") ? "FOUNDATION" : "HSK1");
    assert.ok(packages.some((p) => p.lesson.versionId === l.currentVersion));
  }
});
test("Duplicate IDs/order/slug, missing course/unit/version and mismatched immutable version rejected", () => {
  const edits = [
    (c: typeof raw) => {
      c.courses[1].id = c.courses[0].id;
    },
    (c: typeof raw) => {
      c.units[1].order = c.units[0].order;
    },
    (c: typeof raw) => {
      c.units[1].slug = c.units[0].slug;
    },
    (c: typeof raw) => {
      c.units[0].courseId = crypto.randomUUID();
    },
    (c: typeof raw) => {
      c.lessons[0].unitId = crypto.randomUUID();
    },
    (c: typeof raw) => {
      c.lessons[0].currentVersion = "missing-version";
    },
    (c: typeof raw) => {
      c.lessons[0].currentVersion = "f02-draft-v1";
    },
  ];
  for (const edit of edits) {
    const c = structuredClone(raw);
    edit(c);
    assert.throws(() => validateCurriculum(c, packages));
  }
});
test("Unit and version cycles, wrong syllabus/level and unknown concept/skill rejected", () => {
  const c = structuredClone(raw);
  c.units[0].prerequisites = [c.units[1].id];
  assert.throws(() => validateCurriculum(c, packages), /CYCLIC/);
  const ps = structuredClone(packages);
  ps[0].lesson.prerequisites = [ps[1].lesson.versionId];
  assert.throws(() => validateCurriculum(raw, ps), /CYCLIC/);
  const c2 = structuredClone(raw);
  c2.courses[1].syllabusId = "GF0025-2021";
  assert.throws(() => validateCurriculum(c2, packages));
  const c3 = structuredClone(raw);
  c3.lessons[1].requirements[0].conceptId = "missing";
  assert.throws(() => validateCurriculum(c3, packages), /MISSING_CONCEPT/);
});
test("Source-pinned current v2 and six old immutable versions remain separate", () => {
  const c = validateCurriculum(raw, packages);
  assert.equal(
    c.lessons.find((l) => l.key === "L001")!.currentVersion,
    "l001-draft-v2",
  );
  assert.equal(packages.length, 6);
  assert.notEqual(
    packages.find((p) => p.lesson.versionId === "l001-draft-v1")!.packageHash,
    packages.find((p) => p.lesson.versionId === "l001-draft-v2")!.packageHash,
  );
  assert.equal(
    c.lessons.find((l) => l.key === "F01")!.currentVersion,
    "f01-draft-v1",
  );
});
test("Practice/completion and self/draft evidence do not satisfy independent prerequisites or publication", () => {
  const l = validateCurriculum(raw, packages).lessons.find(
      (l) => l.key === "L001",
    )!,
    p = packages.find((p) => p.lesson.versionId === l.currentVersion)!;
  const req = prerequisiteStatus(l.requirements, []);
  assert.ok(req.every((r) => !r.satisfied));
  const access = lessonAccess(p, req, true, true);
  assert.equal(access.availability, "PRACTICE_ONLY");
  assert.equal(access.verifiedEligible, false);
  assert.equal(lessonAccess(p, req, true, false).availability, "NOT_RELEASED");
  assert.equal(lessonAccess(p, req, true, true, false).mayPractice, false);
  const unreviewed = projectMastery([], new Date());
  assert.equal(
    prerequisiteStatus(
      l.requirements,
      l.requirements.map((r) => ({
        conceptId: r.conceptId,
        skill: r.skill,
        projection: { ...unreviewed, status: "secure" },
      })),
    ).some((r) => r.satisfied),
    false,
  );
});
test("Reviewed prerequisite eligibility is evaluated separately from source, publication and local practice", () => {
  const l = validateCurriculum(raw, packages).lessons.find(
      (l) => l.key === "L002",
    )!,
    p = packages.find((p) => p.lesson.versionId === l.currentVersion)!;
  const projection = {
    ...projectMastery([], new Date()),
    status: "secure" as const,
    evidenceCount: 5,
    distinctItems: 3,
    independentAccuracy: 1,
    stale: false,
  };
  const req = prerequisiteStatus(
    l.requirements,
    l.requirements.map((r) => ({
      conceptId: r.conceptId,
      skill: r.skill,
      projection,
    })),
  );
  assert.ok(req.every((r) => r.satisfied));
  assert.equal(lessonAccess(p, req, true, true).verifiedEligible, false);
  projection.stale = true;
  assert.ok(
    prerequisiteStatus(
      l.requirements,
      l.requirements.map((r) => ({
        conceptId: r.conceptId,
        skill: r.skill,
        projection,
      })),
    ).every((r) => !r.satisfied),
  );
});
test("Planner never schedules disallowed/unreleased content; due priority, rest and pause preserved with course context", () => {
  const i: WeeklyInput = {
    asOf: "2026-10-19T01:00:00Z",
    settings: {
      weeklyMinutes: 180,
      days: [0],
      dayCaps: [90, 0, 0, 0, 0, 0, 0],
      preferredMinutes: 20,
      maxSessionMinutes: 25,
      paused: false,
      timezone: "Asia/Saigon",
      startingLevel: "zero",
      version: 1,
    },
    cards: [],
    lessons: [
      {
        id: "future",
        versionId: "future",
        minutes: 15,
        order: 0,
        prerequisites: [],
        completed: false,
        verifiedEligible: false,
        practiceAllowed: false,
      },
    ],
    sessions: [],
    frozen: [],
    observedByDate: {},
    overrides: {},
  };
  assert.equal(allocateWeek(i).action, null);
  i.lessons.push({
    ...i.lessons[0],
    id: "F01",
    versionId: "f01-draft-v1",
    order: 1,
    practiceAllowed: true,
    courseCode: "FOUNDATION",
    courseTitle: "Nền tảng",
    unitTitle: "Pinyin",
    unitSlug: "pinyin",
  });
  assert.equal(allocateWeek(i).action?.courseCode, "FOUNDATION");
  i.cards = [{ id: "c", dueAt: i.asOf, state: 3, concept: "c" }];
  assert.equal(allocateWeek(i).action?.kind, "review");
  i.settings.paused = true;
  assert.equal(allocateWeek(i).action, null);
  i.settings.paused = false;
  i.overrides["2026-10-19"] = 0;
  assert.equal(allocateWeek(i).action, null);
});

test("Private human-review packets bind all four versions/keys, keep human fields empty and preserve subsequent findings", () => {
  const dir = path.resolve(
    ".local-postgres/review-packets",
    `test-${randomUUID()}`,
  );
  exportReviewPackets(dir);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.equal(files.length, 4);
  for (const name of files) {
    const packet = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    const p = packages.find(
      (p) => p.lesson.versionId === packet.lessonVersion,
    )!;
    assert.equal(packet.packageHash, p.packageHash);
    assert.equal(packet.reviewer.identity, null);
    assert.equal(packet.reviewer.decision, null);
    assert.ok(
      packet.exercises.every(
        (e: { answerKey: { accepted: string[] } }) =>
          e.answerKey.accepted.length > 0,
      ),
    );
    assert.equal(packet.rights.sourceUse, "REFERENCE_ONLY");
    assert.ok(packet.unresolved.length > 0);
  }
  const file = path.join(dir, files[0]),
    packet = JSON.parse(fs.readFileSync(file, "utf8"));
  packet.reviewer.findings = [
    "TEST_EXPORT_PRESERVATION_ONLY_NOT_A_HUMAN_REVIEW",
  ];
  fs.writeFileSync(file, JSON.stringify(packet));
  exportReviewPackets(dir);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(file, "utf8")).reviewer.findings,
    packet.reviewer.findings,
  );
  assert.throws(
    () => exportReviewPackets(path.resolve("public")),
    /private directory/,
  );
});
