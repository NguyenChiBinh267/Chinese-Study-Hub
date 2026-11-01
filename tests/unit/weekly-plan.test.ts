import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateWeek,
  localDate,
  weekStart,
  type WeeklyInput,
  type PlanBlock,
} from "../../src/modules/planning/domain/weekly-plan";
import { studyPreferenceCommand } from "../../src/modules/planning/domain/study-commands";
import { loadDraftCatalog } from "../../src/modules/content/application/catalog";
import {
  gradeContent,
  publicProjection,
  normalizeShortChinese,
} from "../../src/modules/content/domain/package";
import { draftAnswer } from "../../src/modules/content/domain/commands";
const input = (): WeeklyInput => ({
  asOf: "2026-10-19T02:00:00.000Z",
  settings: {
    weeklyMinutes: 360,
    days: [0, 1, 2, 3, 4, 5],
    dayCaps: [60, 60, 60, 60, 60, 60, 0],
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
      id: "F01",
      versionId: "f01-draft-v1",
      minutes: 15,
      order: 0,
      prerequisites: [],
      completed: false,
      verifiedEligible: false,
    },
    {
      id: "F02",
      versionId: "f02-draft-v1",
      minutes: 15,
      order: 1,
      prerequisites: ["f01-draft-v1"],
      completed: false,
      verifiedEligible: false,
    },
  ],
  sessions: [],
  observedByDate: {},
  overrides: {},
  frozen: [],
});

test("Bounded candidates retain completed historical prerequisite facts without loading completed lesson bodies", () => {
  const value = input();
  value.lessons = [
    {
      id: "L4001",
      versionId: "l4001-draft-v1",
      minutes: 15,
      order: 4001,
      prerequisites: ["l492-draft-v1"],
      completed: false,
      verifiedEligible: false,
      practiceAllowed: true,
      checkpointMinutes: 5,
    },
  ];
  assert.equal(allocateWeek(value).blocks.length, 0);
  value.completedVersions = ["l492-draft-v1"];
  const plan = allocateWeek(value);
  assert.ok(plan.blocks.some((b) => b.target === "l4001-draft-v1"));
  assert.ok(plan.blocks.every((b) => b.status === "tentative"));
});
test("3h/6h/9h, impossible capacity, no filler and stable plan ordering", () => {
  for (const hours of [3, 6, 9]) {
    const i = input();
    i.settings.weeklyMinutes = hours * 60;
    const p = allocateWeek(i);
    assert.deepEqual(p, allocateWeek(structuredClone(i)));
    assert.equal(p.requestedMinutes, hours * 60);
    assert.ok(p.plannedMinutes + p.bufferMinutes <= Math.min(hours * 60, 360));
    assert.equal(p.blocks.filter((b) => b.kind === "draft_lesson").length, 1);
    assert.equal(p.action?.reason, "OPTIONAL_DRAFT_NOT_UNLOCKED");
  }
  const i = input();
  i.settings.days = [0, 2, 4];
  i.settings.dayCaps = [90, 0, 90, 0, 90, 0, 0];
  const p = allocateWeek(i);
  assert.equal(p.feasibleMinutes, 270);
  assert.equal(p.unscheduledMinutes, 90);
});
test("Relearning/due priority, overloaded reviews consume buffer and suppress new lessons without deleting debt", () => {
  const i = input();
  i.settings.weeklyMinutes = 30;
  i.settings.dayCaps = [10, 10, 10, 10, 10, 10, 0];
  i.cards = Array.from({ length: 200 }, (_, n) => ({
    id: `c${String(n).padStart(3, "0")}`,
    concept: `t${n}`,
    state: n === 9 ? 3 : 0,
    dueAt: "2026-10-18T00:00:00.000Z",
  }));
  const p = allocateWeek(i);
  assert.equal(p.action?.kind, "review");
  assert.equal(p.blocks[0].targetIds[0], "c009");
  assert.equal(p.plannedMinutes, 30);
  assert.equal(p.bufferMinutes, 0);
  assert.equal(p.reviewDebtCards, 140);
  assert.ok(!p.blocks.some((b) => b.kind === "draft_lesson"));
  assert.equal(i.cards.length, 200);
});
test("Active review intent is not scheduled twice and empty stale review is not a Today action", () => {
  const i = input();
  i.cards = [{ id: "c1", concept: "t1", state: 3, dueAt: i.asOf }];
  i.frozen = [
    {
      id: "r1",
      localDate: "2026-10-19",
      ordinal: 1,
      kind: "review",
      target: "due",
      targetIds: ["c1"],
      estimatedMinutes: 1,
      status: "in_progress",
      reason: "RELEARNING_FIRST",
      sessionId: "s1",
    },
  ];
  let p = allocateWeek(i);
  assert.equal(p.action?.id, "r1");
  assert.ok(!p.blocks.some((b) => b.targetIds.includes("c1")));
  i.cards = [];
  p = allocateWeek(i);
  assert.notEqual(p.action?.id, "r1");
});

test("Ten-minute override allows only an explicit saved checkpoint and keeps slack; atomic lessons are not split", () => {
  const i = input();
  i.settings.days = [0];
  i.settings.dayCaps = [60, 0, 0, 0, 0, 0, 0];
  i.overrides["2026-10-19"] = 10;
  assert.equal(allocateWeek(i).action, null);
  i.lessons[0].checkpointMinutes = 5;
  const p = allocateWeek(i);
  assert.equal(p.action?.target, "f01-draft-v1");
  assert.equal(p.action?.estimatedMinutes, 9);
  assert.equal(p.plannedMinutes + p.bufferMinutes, 10);
  i.settings.days = [0, 1];
  i.settings.dayCaps[1] = 60;
  assert.equal(allocateWeek(i).action?.localDate, "2026-10-19");
});

test("Rest/paused, missed day and timezone/week boundaries never schedule an unavailable or past date", () => {
  const i = input();
  i.asOf = "2026-10-25T01:00:00.000Z";
  let p = allocateWeek(i);
  assert.equal(p.action, null);
  assert.ok(p.blocks.every((b) => b.localDate >= p.today));
  i.settings.paused = true;
  p = allocateWeek(i);
  assert.equal(p.requestedMinutes, 0);
  assert.equal(p.blocks.length, 0);
  assert.ok(p.reasons.includes("PAUSED"));
  assert.equal(localDate("2026-10-18T18:00:00Z", "Asia/Saigon"), "2026-10-19");
  assert.equal(weekStart("2026-10-19"), "2026-10-19");
  assert.equal(
    localDate("2026-11-01T05:30:00Z", "America/New_York"),
    "2026-11-01",
  );
  const skip = input();
  skip.overrides["2026-10-19"] = 0;
  p = allocateWeek(skip);
  assert.equal(p.action, null);
  assert.ok(p.blocks.every((b) => b.localDate !== "2026-10-19"));
});
test("Observed time is counted once, completed estimates never become actual, lower budget preserves history and frozen blocks", () => {
  const i = input();
  i.observedByDate["2026-10-19"] = 100 * 60000;
  i.settings.weeklyMinutes = 60;
  const frozen: PlanBlock = {
    id: "done",
    localDate: "2026-10-19",
    ordinal: 1,
    kind: "draft_lesson",
    target: "f01-draft-v1",
    targetIds: [],
    estimatedMinutes: 15,
    status: "completed",
    reason: "TEST",
  };
  i.frozen = [frozen];
  const p = allocateWeek(i);
  assert.equal(p.actualMinutes, 100);
  assert.equal(p.remainingMinutes, 0);
  assert.equal(p.plannedMinutes, 0);
  assert.deepEqual(p.frozen[0], frozen);
  assert.ok(p.reasons.includes("BUDGET_BELOW_SPENT"));
});
test("In-progress checkpoints remain frozen; next-day resume gets a new pending slot while old facts remain", () => {
  const i = input();
  i.sessions = [
    {
      id: "s1",
      versionId: "f01-draft-v1",
      startedAt: i.asOf,
      remainingMinutes: 10,
    },
  ];
  i.frozen = [
    {
      id: "b1",
      localDate: "2026-10-19",
      ordinal: 1,
      kind: "draft_lesson",
      target: "f01-draft-v1",
      targetIds: [],
      estimatedMinutes: 15,
      status: "in_progress",
      reason: "TEST",
      sessionId: "s1",
    },
  ];
  i.observedByDate["2026-10-19"] = 5 * 60000;
  i.observedBySession = { b1: 5 * 60000 };
  let p = allocateWeek(i);
  assert.equal(p.action?.id, "b1");
  assert.equal(p.frozenRemainingMinutes, 10);
  assert.ok(!p.blocks.some((b) => b.target === "f01-draft-v1"));
  i.asOf = "2026-10-20T02:00:00Z";
  p = allocateWeek(i);
  assert.equal(p.action?.kind, "resume");
  assert.equal(p.action?.sessionId, "s1");
  assert.equal(p.frozen[0].localDate, "2026-10-19");
});
test("Property bounds across budgets, caps, pause, partial weeks, due dates and active-time snapshots", () => {
  let seed = 517;
  const random = (max: number) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed % max;
  };
  for (let n = 0; n < 750; n++) {
    const i = input();
    i.settings.weeklyMinutes = 30 + random(1231);
    i.settings.dayCaps = Array.from({ length: 7 }, () => random(181));
    i.settings.days = i.settings.dayCaps
      .map((cap, d) => (cap ? d : -1))
      .filter((d) => d >= 0);
    i.settings.paused = random(12) === 0;
    i.asOf = `2026-10-${19 + random(7)}T02:00:00.000Z`;
    i.cards = Array.from({ length: random(200) }, (_, j) => ({
      id: `card-${j}`,
      concept: `t-${j}`,
      state: random(4),
      dueAt: `2026-10-${18 + random(8)}T01:00:00.000Z`,
    }));
    const p = allocateWeek(i);
    assert.ok(p.plannedMinutes + p.bufferMinutes <= p.remainingMinutes + 1e-8);
    assert.ok(
      p.plannedMinutes + p.bufferMinutes <= p.remainingCapacityMinutes + 1e-8,
    );
    for (const b of p.blocks) {
      assert.ok(b.localDate >= p.today);
      assert.ok(b.estimatedMinutes <= i.settings.maxSessionMinutes);
      if (b.kind === "review")
        for (const id of b.targetIds)
          assert.ok(
            localDate(
              i.cards.find((c) => c.id === id)!.dueAt,
              i.settings.timezone,
            ) <= b.localDate,
          );
    }
    for (const day of new Set(p.blocks.map((b) => b.localDate))) {
      const sum = p.blocks
        .filter((b) => b.localDate === day)
        .reduce((a, b) => a + b.estimatedMinutes, 0);
      const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
      assert.ok(sum <= i.settings.dayCaps[weekday]);
    }
  }
});
test("Extended settings reject forged owner, bad timezone, rest caps, missing capacity consent and preferred>max", () => {
  const base = {
    preferences: {
      weeklyHours: 6,
      days: [0, 2, 4],
      dailyCap: 90,
      sessionMinutes: 20,
    },
    planning: {
      dayCaps: [90, 0, 90, 0, 90, 0, 0],
      maxSessionMinutes: 25,
      paused: false,
      timezone: "Asia/Saigon",
      startingLevel: "zero",
    },
    expectedVersion: 0,
    acceptLimited: true,
  };
  assert.ok(studyPreferenceCommand.safeParse(base).success);
  for (const bad of [
    { ...base, userId: "forged" },
    { ...base, acceptLimited: false },
    { ...base, planning: { ...base.planning, timezone: "invalid" } },
    { ...base, planning: { ...base.planning, maxSessionMinutes: 10 } },
    {
      ...base,
      planning: { ...base.planning, dayCaps: [90, 10, 90, 0, 90, 0, 0] },
    },
  ])
    assert.equal(studyPreferenceCommand.safeParse(bad).success, false);
});
test("New v2 original dialogs: bounded types, deterministic short/sequence grading, private keys absent; v1 remains valid", () => {
  const { packages } = loadDraftCatalog();
  for (const id of ["l001-draft-v2", "l002-draft-v2"]) {
    const p = packages.find((p) => p.lesson.versionId === id)!;
    assert.equal(p.exercises.length, 6);
    assert.equal(p.concepts.length, 6);
    assert.equal(p.reviewStatus, "DRAFT_UNREVIEWED");
    assert.equal(p.alignment.alignmentStatus, "PARTIAL");
    assert.ok(p.alignment.sourceSnapshotSha256);
    const sequence = p.exercises.find((e) => e.type === "sequence")!,
      key = p.privateKeys.find((k) => k.id === sequence.keyRef)!;
    const order = key.accepted[0].split(",").map(Number);
    assert.equal(gradeContent(p, sequence.id, { order }).correct, true);
    assert.equal(
      gradeContent(p, sequence.id, { order: [...order].reverse() }).correct,
      false,
    );
    assert.throws(
      () => gradeContent(p, sequence.id, { order: order.map(() => 0) }),
      /INVALID_ANSWER/,
    );
    const short = p.exercises.find((e) => e.type === "short")!,
      shortKey = p.privateKeys.find((k) => k.id === short.keyRef)!;
    assert.ok(
      gradeContent(p, short.id, { text: ` ${shortKey.accepted[0]}。 ` })
        .correct,
    );
    assert.equal(
      gradeContent(p, short.id, { text: "不" + shortKey.accepted[0] }).correct,
      false,
    );
    assert.ok(!JSON.stringify(publicProjection(p)).includes('"privateKeys"'));
    assert.equal(
      draftAnswer.safeParse({
        exerciseVersionId: sequence.id,
        response: { order, score: 100 },
      }).success,
      false,
    );
  }
  assert.equal(normalizeShortChinese(" 我 叫 安。 "), "我叫安");
  assert.equal(
    packages.find((p) => p.lesson.versionId === "l001-draft-v1")!.exercises
      .length,
    2,
  );
});
