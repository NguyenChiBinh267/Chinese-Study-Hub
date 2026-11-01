import test from "node:test";
import assert from "node:assert/strict";
import { loadDraftCatalog } from "../../src/modules/content/application/catalog";
import {
  validatePackage,
  gradeContent,
} from "../../src/modules/content/domain/package";
import { recallTemplateId } from "../../src/modules/content/application/recall-origin";
process.env.CSH_LOCAL_CURRICULUM = "hsk24-batch1";
process.env.CSH_LOCAL_DATABASE = "1";
test("Pinned 谁 variants keep one sense/card; wrong tones and unpinned alternatives remain rejected", () => {
  const { packages, evidence } = loadDraftCatalog();
  const p = packages.find((p) => p.lesson.versionId === "l182-draft-v2")!,
    old = packages.find((p) => p.lesson.versionId === "l182-draft-v1")!;
  assert(p);
  assert.deepEqual(validatePackage(p, packages, evidence), []);
  const ex = p.exercises[0];
  for (const text of ["shéi", "shei2", "shuí", "shui2"])
    assert.equal(gradeContent(p, ex.id, { text }).correct, true);
  for (const text of ["shui3", "shuí3", "shei4"])
    assert.equal(gradeContent(p, ex.id, { text }).correct, false);
  for (const c of p.concepts)
    assert.equal(recallTemplateId(p, c.id), recallTemplateId(old, c.id));
  const bad = structuredClone(p);
  bad.privateKeys[0].accepted = ["shéi", "shuǐ"];
  assert(
    validatePackage(bad, packages, evidence).some(
      (i) => i.code === "AMBIGUOUS_SENSE",
    ),
  );
  const unpinned = structuredClone(p);
  unpinned.alignment.sourceSnapshotSha256 = "0".repeat(64);
  assert(
    validatePackage(unpinned, packages, evidence).some(
      (i) => i.code === "AMBIGUOUS_SENSE",
    ),
  );
});
