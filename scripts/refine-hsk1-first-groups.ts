// Additive pedagogical precision; historical attempts remain bound to v1 bytes.
import fs from "node:fs";
import assert from "node:assert/strict";
import {
  loadDraftCatalog,
  contentHash,
} from "../src/modules/content/application/catalog";
import {
  packageSchema,
  validatePackage,
} from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const dir = "content/hsk24",
  read = (f: string) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json");
const { packages, evidence } = loadDraftCatalog();
const row = catalog.lessons.find((l: { key: string }) => l.key === "L110");
assert.equal(row.currentVersion, "l110-draft-v1");
const source = packages.find((p) => p.lesson.versionId === row.currentVersion)!;
const old = "九 đọc jiǔ, âm cuối ou",
  replacement = "九 đọc jiǔ; vần iu là cách viết rút gọn của iou sau âm đầu";
assert(JSON.stringify(source).includes(old));
const p = packageSchema.parse(
  JSON.parse(JSON.stringify(source).replaceAll(old, replacement)),
);
// Existing checked source-reference records retain their exact historical bytes.
p.alignment = structuredClone(source.alignment);
p.lesson.version = 2;
p.lesson.versionId = "l110-draft-v2";
for (const [i, e] of p.exercises.entries()) {
  const previous = e.id,
    key = p.privateKeys.find((k) => k.id === e.keyRef)!;
  e.id = `l110-v2-e${i}`;
  e.keyRef = `l110-v2-k${i}`;
  key.id = e.keyRef;
  key.exerciseVersionId = e.id;
  for (const b of p.blocks)
    if (b.type === "exercise" && b.exerciseVersionId === previous)
      b.exerciseVersionId = e.id;
}
p.packageHash = contentHash(p);
assert.deepEqual(validatePackage(p, [...packages, p], evidence), []);
fs.writeFileSync(`${dir}/L110.v2.json`, JSON.stringify(p, null, 2) + "\n", {
  flag: "wx",
});
manifest.packages.push({
  file: "L110.v2.json",
  versionId: p.lesson.versionId,
  sha256: p.packageHash,
});
row.currentVersion = p.lesson.versionId;
for (const [file, data] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
] as const)
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(data, null, 2) + "\n");
console.log("L110.v2: clarify iu/iou; v1 and its practice history preserved.");
