import test from "node:test";
import assert from "node:assert/strict";
import {
  loadDraftCatalog,
  contentHash,
  currentDrafts,
} from "../../src/modules/content/application/catalog";
import {
  gradeContent,
  publicProjection,
  validatePackage,
} from "../../src/modules/content/domain/package";
import { loadCurriculum } from "../../src/modules/curriculum/application/catalog";
import { expansionEnabled } from "../../src/modules/curriculum/application/local-expansion";
import { createRuntimePool } from "../../src/shared/db/transaction";
import manifest from "../../content/hsk24/manifest.json";
import fs from "node:fs";
import { recallTemplateId } from "../../src/modules/content/application/recall-origin";
process.env.CSH_LOCAL_CURRICULUM = "hsk24-batch1";
process.env.CSH_LOCAL_DATABASE = "1";
const { packages, evidence } = loadDraftCatalog();
const newPackages = packages.filter((p) =>
  manifest.packages.some((m) => m.versionId === p.lesson.versionId),
);
test("Real HSK2 batch has bounded lessons, exact hashes and technical keys", () => {
  assert.equal(newPackages.length, manifest.packages.length);
  for (const p of newPackages) {
    assert.deepEqual(validatePackage(p, packages, evidence), []);
    assert.equal(contentHash(p), p.packageHash);
    assert.ok(p.concepts.length >= 4 && p.concepts.length <= 6);
    assert.equal(p.exercises.length, 8);
    assert.ok(p.blocks.filter((b) => b.type === "teaching").length >= 3);
    for (const c of p.concepts) {
      assert.ok(
        p.blocks.some(
          (b) => b.type === "teaching" && b.hanzi.includes(c.hanzi),
        ),
      );
      assert.ok(p.exercises.some((e) => e.conceptId === c.id));
    }
    for (const e of p.exercises) {
      const key = p.privateKeys.find((k) => k.id === e.keyRef)!;
      for (const answer of key.accepted) {
        const response =
          e.type === "choice"
            ? { choice: e.choices.indexOf(answer) }
            : e.type === "sequence"
              ? { order: answer.split(",").map(Number) }
              : { text: answer };
        assert.equal(gradeContent(p, e.id, response).correct, true);
      }
    }
    const projection = JSON.stringify(publicProjection(p));
    for (const name of ["privateKeys", "keyRef", "accepted", "feedback"])
      assert.ok(!projection.includes(`"${name}"`));
    assert.ok(
      validatePackage(p, packages, evidence, "batch", true).some(
        (i) => i.code === "HUMAN_REVIEW_REQUIRED",
      ),
    );
  }
});
test("HSK1 foundations remain required; no cross-level mastery shortcut", () => {
  const catalog = loadCurriculum();
  assert.equal(currentDrafts().length, loadCurriculum().lessons.length);
  for (const l of catalog.lessons.filter((l) => /^L[234]/.test(l.key))) {
    assert.ok(l.requirements.some((r) => r.rule === "secure"));
    if (/^L[34]/.test(l.key))
      assert.ok(
        l.requirements.some(
          (r) => r.conceptId === "l234-c0" && r.rule === "secure",
        ),
      );
    if (/^L4/.test(l.key))
      assert.ok(
        l.requirements.some(
          (r) => r.conceptId === "l375-c3" && r.rule === "secure",
        ),
      );
  }
  const p = structuredClone(newPackages[0]);
  p.alignment.vocabularyReferences[0].sourceLocator = null;
  assert.ok(
    validatePackage(p, packages, evidence).some(
      (i) => i.code === "SOURCE_LOCATOR",
    ),
  );
  p.alignment.vocabularyReferences[0].officialLevel = 3;
  assert.ok(
    validatePackage(p, packages, evidence).some(
      (i) => i.code === "SOURCE_LEVEL",
    ),
  );
});

test("HSK4 checked locators reject another level and writing pages even with a matching forged evidence tuple", () => {
  const h4 = newPackages.find((p) => p.alignment.targetLevel === 4)!;
  assert.ok(h4);
  for (const [field, page] of [
    ["vocabularyReferences", 103],
    ["characterReferences", 363],
    ["characterReferences", 378],
    ["grammarReferences", 397],
    ["topicReferences", 68],
    ["taskReferences", 31],
  ] as const) {
    const p = structuredClone(h4);
    const ref = p.alignment[field].find((r) => r.status === "VERIFIED")!;
    ref.sourceLocator = {
      ...ref.sourceLocator!,
      pdfIndex: page,
      physicalPage: page + 1,
      printedPage: page - 2,
    };
    const forgedEvidence = structuredClone(evidence);
    forgedEvidence.references = forgedEvidence.references.map((r) =>
      r.id === ref.id ? structuredClone(ref) : r,
    );
    assert.ok(
      validatePackage(p, packages, forgedEvidence).some(
        (i) => i.code === "SOURCE_LOCATOR",
      ),
    );
  }
  const p = structuredClone(h4);
  p.alignment.vocabularyReferences[0].officialLevel = 5;
  assert.ok(
    validatePackage(p, packages, evidence).some(
      (i) => i.code === "SOURCE_LEVEL",
    ),
  );
});
test("Expansion cannot connect to owner local DB or activate under production flags", () => {
  assert.throws(() =>
    createRuntimePool("postgresql://csh_runtime:x@127.0.0.1:5447/csh_local"),
  );
  const old = process.env.NODE_ENV;
  try {
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.equal(expansionEnabled(), false);
    assert.equal(loadDraftCatalog().packages.length, 6);
    assert.equal(currentDrafts().length, 4);
  } finally {
    if (old === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: old });
  }
});

test("New HSK4 glyph practice is tagged recognition and binds an exact source-listed character", () => {
  const introductions = currentDrafts().filter((p) =>
    /^L4(?:0[5-9]|[12]\d|3[0-6])$/.test(p.lesson.id),
  );
  assert.equal(introductions.length, 32);
  for (const p of introductions) {
    const glyphs = p.exercises.filter((e) =>
      e.prompt.startsWith("Nhận diện chữ"),
    );
    assert.equal(glyphs.length, 1);
    for (const e of glyphs) {
      assert.equal(e.skill, "recognition");
      const key = p.privateKeys.find((k) => k.id === e.keyRef)!;
      assert.equal(key.accepted[0].length, 1);
      assert.ok(
        p.alignment.characterReferences.some(
          (r) =>
            r.status === "VERIFIED" &&
            r.officialLevel === 4 &&
            r.written === key.accepted[0],
        ),
      );
    }
  }
});

test("Continuous HSK4 introductions keep source-bound glyph tasks, unique choices and meaningful ordering", () => {
  const intros = currentDrafts().filter((p) => {
    const n = Number(p.lesson.id.slice(1));
    return (n >= 437 && n <= 480) || (n >= 489 && n <= 492);
  });
  assert.equal(intros.length, 48);
  for (const p of intros) {
    assert.ok(
      p.exercises[7].type === "sequence" && p.exercises[7].choices.length >= 3,
    );
    const glyphs = p.exercises.filter((e) => e.skill === "recognition");
    assert.equal(glyphs.length, 1);
    for (const e of p.exercises) {
      if (e.type === "choice")
        assert.equal(new Set(e.choices).size, e.choices.length, e.id);
      if (e.skill === "recognition") {
        const key = p.privateKeys.find((k) => k.id === e.keyRef)!;
        assert.equal(key.accepted.length, 1);
        assert.equal(key.accepted[0].length, 1);
        assert.ok(
          p.alignment.characterReferences.some(
            (r) =>
              r.status === "VERIFIED" &&
              r.officialLevel === 4 &&
              r.written === key.accepted[0],
          ),
        );
      }
    }
  }
});

test(
  "Review activities keep original sense/card identities and reject altered review packages",
  { skip: !fs.existsSync("content/hsk24/reviews.json") },
  () => {
    const activities = JSON.parse(
      fs.readFileSync("content/hsk24/reviews.json", "utf8"),
    ).activities;
    assert.equal(
      activities.filter(
        (a: { kind: string; versionId: string }) =>
          a.kind === "UNIT_REVIEW" && /^l2/.test(a.versionId),
      ).length,
      34,
    );
    assert.equal(
      activities.filter(
        (a: { kind: string; versionId: string }) =>
          a.kind === "UNIT_REVIEW" && /^l3/.test(a.versionId),
      ).length,
      4,
    );
    for (const a of activities) {
      const p = packages.find((p) => p.lesson.versionId === a.versionId)!;
      assert.ok(p);
      for (const c of p.concepts)
        assert.equal(
          recallTemplateId(p, c.id),
          `${a.origins[c.id].versionId}:recall:${c.id}`,
        );
      const tampered = structuredClone(p);
      tampered.packageHash = "0".repeat(64);
      assert.throws(
        () => recallTemplateId(tampered, p.concepts[0].id),
        /REVIEW_HASH_DRIFT/,
      );
      const alteredSense = structuredClone(p);
      alteredSense.concepts[0].senseId = "wrong-sense";
      assert.throws(
        () => recallTemplateId(alteredSense, p.concepts[0].id),
        /REVIEW_SENSE_DRIFT/,
      );
    }
  },
);
