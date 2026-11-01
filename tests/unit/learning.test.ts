import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  projectMastery,
  foundationPrerequisite,
  type Evidence,
} from "../../src/modules/learning/domain/mastery";
import {
  newCard,
  schedule,
  storeCard,
  ALGORITHM,
} from "../../src/modules/review/domain/fsrs-adapter";
import {
  gradeFixture,
  fixture,
} from "../../src/modules/learning/server/local-fixture";
import { ratingCommand } from "../../src/modules/review/domain/local-review";
const base = new Date("2026-01-01T00:00:00Z"),
  day = 86400000;
const e = (
  id: number,
  at: number,
  extra: Partial<Evidence> = {},
): Evidence => ({
  id: String(id),
  item: `item${id}`,
  at: new Date(base.getTime() + at).toISOString(),
  score: 1,
  weight: 1,
  source: "verified_key",
  assisted: false,
  answerSeen: false,
  repeatedInSession: false,
  durationVerified: true,
  delayedProbe: false,
  ...extra,
});
test("Server choice grader validates all fixture choices and unknown/invalid data", () => {
  assert.equal(gradeFixture("local-token-v1-a", 0), true);
  assert.equal(gradeFixture("local-token-v1-a", 1), false);
  assert.equal(gradeFixture("local-token-v1-b", 2), true);
  for (const choice of [-1, 3, NaN, 1.1])
    assert.equal(gradeFixture("local-token-v1-a", choice), null);
  assert.equal(gradeFixture("invalid", 0), null);
  assert.ok(!JSON.stringify(fixture).includes("expected"));
  for (const rating of ["Manual", 0, 5, "Unknown"])
    assert.equal(
      ratingCommand.safeParse({ expectedVersion: 1, rating }).success,
      false,
    );
});
test("Mastery excludes hints/assistance/repeat/exposure/unverified/AI/self/implausible timing", () => {
  const cases: Partial<Evidence>[] = [
    { assisted: true },
    { answerSeen: true },
    { repeatedInSession: true },
    { source: "self" },
    { source: "ai_provisional" },
    { source: "unreviewed_fixture" },
    { durationVerified: false },
  ];
  for (const c of cases)
    assert.equal(projectMastery([e(1, 0, c)], base).evidenceCount, 0);
  const same = [
    e(1, 0),
    e(2, day - 1, { item: "item1" }),
    e(3, 2 * day - 1, { item: "item1" }),
  ];
  assert.equal(
    projectMastery(same, new Date(base.getTime() + 3 * day)).evidenceCount,
    2,
  );
  assert.equal(
    projectMastery(
      [e(1, 0, { assisted: true }), e(2, day - 1, { item: "item1" })],
      new Date(base.getTime() + day),
    ).evidenceCount,
    0,
  );
});
test("Mastery 48h boundary, secure thresholds, needs-review and stale flag without calendar demotion", () => {
  const items = [
    e(1, 0),
    e(2, 1000),
    e(3, 2000),
    e(4, day),
    e(5, 2 * day - 1, { delayedProbe: true }),
  ];
  assert.equal(
    projectMastery(items, new Date(base.getTime() + 2 * day)).status,
    "practicing",
  );
  items[4] = e(5, 2 * day, { delayedProbe: true });
  const secure = projectMastery(items, new Date(base.getTime() + 2 * day));
  assert.equal(secure.status, "secure");
  assert.equal(secure.delayedAccuracy, 1);
  assert.equal(foundationPrerequisite(secure), true);
  const stale = projectMastery(items, new Date(base.getTime() + 33 * day));
  assert.equal(stale.stale, true);
  assert.equal(stale.status, "secure");
  assert.equal(foundationPrerequisite(stale), false);
  assert.equal(
    projectMastery(
      [e(1, 0, { score: 0 }), e(2, 1, { score: 0 }), e(3, 2, { score: 0 })],
      new Date(base.getTime() + day),
    ).status,
    "needs_review",
  );
  assert.equal(foundationPrerequisite(projectMastery([e(1, 0)], base)), false);
});
test("Mastery weighted accuracy and distinct items are required, replay order deterministic", () => {
  const items = [
    e(1, 0),
    e(2, 1000),
    e(3, 2000),
    e(4, day, { score: 0, weight: 10 }),
    e(5, 2 * day, { delayedProbe: true }),
  ];
  const result = projectMastery(items, new Date(base.getTime() + 2 * day));
  assert.notEqual(result.status, "secure");
  assert.deepEqual(
    projectMastery([...items].reverse(), new Date(base.getTime() + 2 * day)),
    result,
  );
  assert.equal(projectMastery([], base).status, "unseen");
  const repeated = [
    e(1, 0, { item: "a" }),
    e(2, 1, { item: "b" }),
    e(3, day, { item: "a" }),
    e(4, day + 1, { item: "b" }),
    e(5, 2 * day, { item: "a", delayedProbe: true }),
  ];
  assert.equal(
    projectMastery(repeated, new Date(base.getTime() + 2 * day)).status,
    "practicing",
  );
  assert.equal(
    projectMastery([e(1, 0), e(1, day)], new Date(base.getTime() + day))
      .evidenceCount,
    1,
  );
  assert.throws(() => projectMastery(items, new Date(NaN)));
});
test("FSRS pinned library goldens, full card roundtrip, all ratings, overdue and UTC equivalent instants", () => {
  const golden = JSON.parse(
    readFileSync("tests/fixtures/fsrs-5.4.2.json", "utf8"),
  );
  assert.equal(ALGORITHM, golden.algorithm);
  assert.deepEqual(newCard(base), golden.initial);
  for (const rating of ["Again", "Hard", "Good", "Easy"] as const)
    assert.deepEqual(
      schedule(golden.initial, base, rating),
      golden.new[rating],
    );
  assert.deepEqual(
    schedule(golden.review, new Date(golden.overdueAt), "Again"),
    golden.overdue,
  );
  assert.deepEqual(
    schedule(golden.initial, new Date("2026-01-01T07:00:00+07:00"), "Good"),
    golden.new.Good,
  );
  assert.deepEqual(
    schedule(golden.initial, new Date("2025-12-31T19:00:00-05:00"), "Good"),
    golden.new.Good,
  );
  const repeated = schedule(
    golden.new.Good.card,
    new Date(golden.new.Good.card.due),
    "Good",
  );
  assert.equal(repeated.card.reps, 2);
  assert.equal(
    typeof storeCard({ ...golden.initial, due: base }).due,
    "string",
  );
  assert.throws(() =>
    schedule(golden.new.Good.card, new Date(base.getTime() - 1), "Good"),
  );
});
