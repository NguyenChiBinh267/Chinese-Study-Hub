// Additive first review repair for this run, preserving every original version.
import fs from "node:fs";
import assert from "node:assert/strict";
import {
  contentHash,
  loadDraftCatalog,
} from "../src/modules/content/application/catalog";
import {
  validatePackage,
  type ContentPackage,
} from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
import { glyphPrompt } from "./hsk24-glyph-prompt";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const dir = "content/hsk24";
const read = (file: string) =>
  JSON.parse(fs.readFileSync(`${dir}/${file}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json"),
  registry = read("reviews.json");
const { packages, evidence } = loadDraftCatalog();
const words = new Map<string, string[]>();
for (let b = 58; b <= 62; b++)
  for (const l of read(`batch${b}.authoring.json`).lessons)
    l.words.forEach((w: string[], i: number) =>
      words.set(`${l.id.toLowerCase()}-c${i}`, w),
    );
const outputs: ContentPackage[] = [];
for (const row of catalog.lessons.filter(
  (l: { key: string }) =>
    /^L40(?:2[5-9]|[34]\d)$/.test(l.key) || l.key === "L49005",
)) {
  const original = packages.find(
    (p) => p.lesson.versionId === row.currentVersion,
  )!;
  if (original.lesson.version !== 1) throw Error("EXPECTED_FIRST_REPAIR_ONLY");
  const p = structuredClone(original);
  let changed = false;
  for (const e of p.exercises)
    if (e.skill === "recognition" && e.prompt.includes("Ngữ cảnh:")) {
      const c = p.concepts.find((c) => c.id === e.conceptId)!;
      const w = words.get(c.id)!;
      assert(w);
      const key = p.privateKeys.find((k) => k.id === e.keyRef)!;
      e.prompt =
        (p.lesson.id === "L49005" ? "Ôn trong phạm vi nghĩa đã học · " : "") +
        glyphPrompt(
          c.hanzi,
          key.accepted[0],
          c.meaning,
          c.dictionaryPinyin,
          w[4],
        );
      if (p.lesson.id === "L4036")
        e.choices = e.choices.map((x) => (x === "杮" ? "柯" : x));
      changed = true;
    }
  if (!changed) continue;
  p.lesson.version = 2;
  p.lesson.versionId = `${p.lesson.id.toLowerCase()}-draft-v2`;
  for (const [i, e] of p.exercises.entries()) {
    const oldId = e.id,
      k = p.privateKeys.find((k) => k.id === e.keyRef)!;
    e.id = `${p.lesson.id.toLowerCase()}-v2-e${i}`;
    e.keyRef = `${p.lesson.id.toLowerCase()}-v2-k${i}`;
    k.id = e.keyRef;
    k.exerciseVersionId = e.id;
    for (const b of p.blocks)
      if (b.type === "exercise" && b.exerciseVersionId === oldId)
        b.exerciseVersionId = e.id;
  }
  assert.deepEqual(p.concepts, original.concepts);
  assert.deepEqual(p.alignment, original.alignment);
  p.packageHash = contentHash(p);
  outputs.push(p);
}
for (const p of outputs) {
  assert(!fs.existsSync(`${dir}/${p.lesson.id}.v2.json`));
  assert.deepEqual(validatePackage(p, [...packages, ...outputs], evidence), []);
}
for (const p of outputs) {
  const old = registry.activities.find(
    (a: { versionId: string }) =>
      a.versionId === `${p.lesson.id.toLowerCase()}-draft-v1`,
  );
  if (old) {
    const activity = structuredClone(old);
    activity.versionId = p.lesson.versionId;
    activity.sha256 = p.packageHash;
    activity.characterItems = activity.characterItems.map(
      (x: { exerciseId: string }) => ({
        ...x,
        exerciseId:
          p.exercises[
            packages
              .find((q) => q.lesson.versionId === old.versionId)!
              .exercises.findIndex((e) => e.id === x.exerciseId)
          ].id,
      }),
    );
    registry.activities.push(activity);
  }
  const file = `${p.lesson.id}.v2.json`;
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(p, null, 2) + "\n", {
    flag: "wx",
  });
  manifest.packages.push({
    file,
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
  });
  catalog.lessons.find(
    (l: { key: string }) => l.key === p.lesson.id,
  ).currentVersion = p.lesson.versionId;
}
for (const [file, data] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
  ["reviews.json", registry],
] as const)
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(data, null, 2) + "\n");
console.log(
  JSON.stringify({
    additiveGlyphContextRepairs: outputs.map((p) => p.lesson.versionId),
    oldVersionsRetained: true,
  }),
);
