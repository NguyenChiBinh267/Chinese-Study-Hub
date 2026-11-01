// The pinned 谁 entry explicitly lists shéi/shuí; both are valid in this prompt.
import fs from "node:fs";
import assert from "node:assert/strict";
import {
  loadDraftCatalog,
  contentHash,
} from "../src/modules/content/application/catalog";
import {
  packageSchema,
  validatePackage,
  gradeContent,
} from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const dir = "content/hsk24",
  read = (file: string) =>
    JSON.parse(fs.readFileSync(`${dir}/${file}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json"),
  registry = read("reviews.json");
const { packages, evidence } = loadDraftCatalog();
const row = catalog.lessons.find((l: { key: string }) => l.key === "L182");
assert.equal(row.currentVersion, "l182-draft-v1");
const source = packages.find((p) => p.lesson.versionId === row.currentVersion)!;
assert(
  source.alignment.vocabularyReferences.some(
    (r) => r.written === "谁" && r.note.includes("shéi/shuí"),
  ),
);
const p = packageSchema.parse(structuredClone(source));
p.lesson.version = 2;
p.lesson.versionId = "l182-draft-v2";
const ex = p.exercises.find(
  (e) =>
    e.type === "pinyin" &&
    p.concepts.find((c) => c.id === e.conceptId)?.hanzi === "谁",
)!;
const answer = p.privateKeys.find((k) => k.id === ex.keyRef)!;
assert.deepEqual(answer.accepted, ["shéi"]);
answer.accepted = ["shéi", "shuí"];
answer.feedback =
  "Nguồn ghi cả shéi và shuí cho 谁. Bài dùng shéi trong ví dụ, nhưng câu hỏi pinyin này nhận cả hai cách đọc cùng nghĩa ai.";
for (const [i, e] of p.exercises.entries()) {
  const old = e.id,
    key = p.privateKeys.find((k) => k.id === e.keyRef)!;
  e.id = `l182-v2-e${i}`;
  e.keyRef = `l182-v2-k${i}`;
  key.id = e.keyRef;
  key.exerciseVersionId = e.id;
  for (const block of p.blocks)
    if (block.type === "exercise" && block.exerciseVersionId === old)
      block.exerciseVersionId = e.id;
}
p.packageHash = contentHash(p);
assert.deepEqual(validatePackage(p, [...packages, p], evidence), []);
for (const text of ["shéi", "shei2", "shuí", "shui2"])
  assert.equal(gradeContent(p, ex.id, { text }).correct, true);
assert.equal(gradeContent(p, ex.id, { text: "shui3" }).correct, false);
const activity = registry.activities.find(
  (a: { versionId: string }) => a.versionId === source.lesson.versionId,
);
assert(activity);
registry.activities.push({
  ...structuredClone(activity),
  versionId: p.lesson.versionId,
  sha256: p.packageHash,
});
fs.writeFileSync(`${dir}/L182.v2.json`, JSON.stringify(p, null, 2) + "\n", {
  flag: "wx",
});
manifest.packages.push({
  file: "L182.v2.json",
  versionId: p.lesson.versionId,
  sha256: p.packageHash,
});
row.currentVersion = p.lesson.versionId;
for (const [file, value] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
  ["reviews.json", registry],
] as const)
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(value, null, 2) + "\n");
console.log(
  "L182.v2 accepts both pinned-source readings; v1 package and its exact review alias retained.",
);
