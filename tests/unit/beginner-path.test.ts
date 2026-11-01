import test from "node:test";
import assert from "node:assert/strict";
import {
  beginnerPath,
  nextBeginnerLesson,
} from "../../src/modules/curriculum/domain/beginner-path";
import type {
  CurriculumSnapshot,
  LessonView,
} from "../../src/modules/curriculum/domain/snapshot";

test("Beginner navigation follows course/unit/lesson order, not lexical IDs", () => {
  const lessons = [
    { key: "L101", unitId: "new", order: 0, courseCode: "HSK1" },
    { key: "L002", unitId: "base", order: 1, courseCode: "HSK1" },
    { key: "L001", unitId: "base", order: 0, courseCode: "HSK1" },
    { key: "F05", unitId: "bridge", order: 0, courseCode: "FOUNDATION" },
    { key: "L201", unitId: "higher", order: 0, courseCode: "HSK2" },
  ];
  const data = {
    courses: [
      { id: "h1", order: 1 },
      { id: "f", order: 0 },
    ],
    units: [
      { id: "new", courseId: "h1", order: 1 },
      { id: "base", courseId: "h1", order: 0 },
      { id: "bridge", courseId: "f", order: 4 },
    ],
    lessons,
  } as unknown as CurriculumSnapshot;
  assert.deepEqual(
    beginnerPath(data).map((l) => l.key),
    ["F05", "L001", "L002", "L101"],
  );
});
test("Resume wins; completed old versions and locked lessons cannot manufacture eligibility", () => {
  const row = (
    key: string,
    started: boolean,
    completed: boolean,
    mayPractice = true,
  ) =>
    ({
      key,
      started,
      completed,
      access: { mayPractice, prerequisitesSatisfied: false },
    }) as LessonView;
  const path = [
    row("F01", true, true),
    row("F02", false, false),
    row("L001", true, false),
    row("L101", false, false, false),
  ];
  assert.equal(nextBeginnerLesson(path)?.key, "L001");
  path[2].completed = true;
  assert.equal(nextBeginnerLesson(path)?.key, "F02");
  path[1].completed = true;
  assert.equal(nextBeginnerLesson(path), undefined);
  assert.equal(path[1].access.prerequisitesSatisfied, false);
});
