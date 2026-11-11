// Additive beginner-language correction, keeping the imported original immutable.
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
  catalog = read("catalog.json"),
  { packages, evidence } = loadDraftCatalog();
const row = catalog.lessons.find((l: { key: string }) => l.key === "L131");
assert.equal(row.currentVersion, "l131-draft-v1");
const p = packageSchema.parse(
  structuredClone(
    packages.find((p) => p.lesson.versionId === row.currentVersion)!,
  ),
);
p.lesson.version = 2;
p.lesson.versionId = "l131-draft-v2";
const block = p.blocks.find(
  (b) => b.type === "teaching" && b.id === "l131-grammar",
)!;
assert.equal(block.type, "teaching");
if (block.type === "teaching")
  block.text =
    "外 đứng sau tên nơi chốn để chỉ bên ngoài: 房间外. 外边 là cách nói địa điểm đầy đủ hơn; 边 trong 桌子边 chỉ phía cạnh bàn. 那边 là phía kia được người nói chỉ, không tự đồng nghĩa với bên trái hay bên phải cố định. Bài chỉ dùng vị trí được viết rõ, không đo khoảng cách hoặc yêu cầu suy từ ảnh không có.";
for (const [i, e] of p.exercises.entries()) {
  const previous = e.id,
    k = p.privateKeys.find((k) => k.id === e.keyRef)!;
  e.id = `l131-v2-e${i}`;
  e.keyRef = `l131-v2-k${i}`;
  k.id = e.keyRef;
  k.exerciseVersionId = e.id;
  for (const b of p.blocks)
    if (b.type === "exercise" && b.exerciseVersionId === previous)
      b.exerciseVersionId = e.id;
}
p.packageHash = contentHash(p);
assert.deepEqual(validatePackage(p, [...packages, p], evidence), []);
fs.writeFileSync(`${dir}/L131.v2.json`, JSON.stringify(p, null, 2) + "\n", {
  flag: "wx",
});
manifest.packages.push({
  file: "L131.v2.json",
  versionId: p.lesson.versionId,
  sha256: p.packageHash,
});
row.currentVersion = p.lesson.versionId;
for (const [f, v] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
] as const)
  fs.writeFileSync(`${dir}/${f}`, JSON.stringify(v, null, 2) + "\n");
console.log(
  "L131.v2: Vietnamese beginner explanation; original package/history retained.",
);
