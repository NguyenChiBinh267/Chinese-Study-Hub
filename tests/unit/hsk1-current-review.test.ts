import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  loadDraftCatalog,
  currentDrafts,
} from "../../src/modules/content/application/catalog";
import { recallTemplateId } from "../../src/modules/content/application/recall-origin";
process.env.CSH_LOCAL_CURRICULUM = "hsk24-batch1";
process.env.CSH_LOCAL_DATABASE = "1";
test("Current HSK1 reviews follow current origin versions; historical review aliases remain available", () => {
  const { packages } = loadDraftCatalog(),
    current = currentDrafts(),
    registry = JSON.parse(
      fs.readFileSync("content/hsk24/reviews.json", "utf8"),
    );
  for (const a of registry.activities) {
    const p = packages.find((p) => p.lesson.versionId === a.versionId)!;
    if (
      p.alignment.targetLevel !== 1 ||
      !current.some((c) => c.lesson.versionId === a.versionId)
    )
      continue;
    for (const c of p.concepts) {
      const old = packages.find(
          (p) => p.lesson.versionId === a.origins[c.id].versionId,
        )!,
        intro = current.find((p) => p.lesson.id === old.lesson.id)!;
      assert.equal(
        a.origins[c.id].versionId,
        intro.lesson.versionId,
        `${p.lesson.id}:${c.id}:stale current review origin`,
      );
      assert.equal(recallTemplateId(p, c.id), recallTemplateId(intro, c.id));
    }
  }
  for (const id of ["L185", "L187", "L197"]) {
    const old = packages.find(
      (p) => p.lesson.versionId === `${id.toLowerCase()}-draft-v1`,
    )!;
    for (const c of old.concepts)
      assert.notEqual(recallTemplateId(old, c.id), undefined);
  }
});
