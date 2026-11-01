import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  currentDrafts,
  loadDraftCatalog,
} from "../../src/modules/content/application/catalog";
import { gradeContent } from "../../src/modules/content/domain/package";
import { recallTemplateId } from "../../src/modules/content/application/recall-origin";
process.env.CSH_LOCAL_CURRICULUM = "hsk24-batch1";
process.env.CSH_LOCAL_DATABASE = "1";

test("Specified male/mixed and female groups grade by written pronouns; old versions remain pinned", () => {
  const all = loadDraftCatalog().packages;
  for (const [id, index, right, wrong] of [
    ["L114", 3, "他们", "她们"],
    ["L115", 0, "她们", "他们"],
  ] as const) {
    const p = currentDrafts().find((p) => p.lesson.id === id)!;
    assert.equal(p.lesson.version, 2);
    const e = p.exercises[index];
    assert(gradeContent(p, e.id, { choice: e.choices.indexOf(right) }).correct);
    assert(
      !gradeContent(p, e.id, { choice: e.choices.indexOf(wrong) }).correct,
    );
    assert(all.some((old) => old.lesson.id === id && old.lesson.version === 1));
  }
});

test("Pinned base starter aliases reuse the original card and reject path/hash/level drift", () => {
  const current = currentDrafts();
  const p = current.find((p) => p.lesson.id === "L1152")!;
  const registry = JSON.parse(
    fs.readFileSync("content/hsk24/reviews.json", "utf8"),
  );
  const activity = registry.activities.find(
    (a: { versionId: string }) => a.versionId === p.lesson.versionId,
  );
  const c = p.concepts.find(
    (c) => activity.origins[c.id].file === "L002.v2.json",
  )!;
  assert(c);
  const base = current.find((p) => p.lesson.id === "L002")!;
  assert.equal(recallTemplateId(p, c.id), recallTemplateId(base, c.id));
  const actualRead = fs.readFileSync;
  try {
    for (const mutation of ["hash", "path"]) {
      const changed = structuredClone(registry),
        origin = changed.activities.find(
          (a: { versionId: string }) => a.versionId === p.lesson.versionId,
        ).origins[c.id];
      if (mutation === "hash") origin.sha256 = "0".repeat(64);
      else origin.file = "../slice/L002.v2.json";
      fs.readFileSync = ((path: fs.PathOrFileDescriptor, ...args: unknown[]) =>
        String(path) === "content/hsk24/reviews.json"
          ? JSON.stringify(changed)
          : Reflect.apply(actualRead, fs, [
              path,
              ...args,
            ])) as typeof fs.readFileSync;
      assert.throws(
        () => recallTemplateId(p, c.id),
        /REVIEW_ORIGIN_(UNREGISTERED|REQUIRED)/,
      );
    }
  } finally {
    fs.readFileSync = actualRead;
  }
  const otherLevel = structuredClone(p);
  otherLevel.alignment.targetLevel = 2;
  assert.throws(
    () => recallTemplateId(otherLevel, c.id),
    /REVIEW_ORIGIN_UNREGISTERED/,
  );
});

test("Grammar transfer tasks do not update an arbitrary word card", () => {
  for (const p of currentDrafts().filter((p) =>
    /^L11(0\d|10|11)$/.test(p.lesson.id),
  )) {
    assert.equal(p.exercises.length, 8);
    assert(
      p.exercises.slice(4).every((e) => e.evidenceScope === "CONTEXT_ONLY"),
    );
    assert(
      p.exercises.slice(0, 4).every((e) => e.evidenceScope !== "CONTEXT_ONLY"),
    );
  }
});
