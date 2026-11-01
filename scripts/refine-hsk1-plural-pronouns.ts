// Additive repair: supplied group facts, not identical tamen audio, select the glyphs.
import fs from "node:fs";
import assert from "node:assert/strict";
import {
  loadDraftCatalog,
  contentHash,
} from "../src/modules/content/application/catalog";
import {
  packageSchema,
  validatePackage,
  type ContentPackage,
} from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const dir = "content/hsk24";
const read = (name: string) =>
  JSON.parse(fs.readFileSync(`${dir}/${name}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json"),
  registry = read("reviews.json");
const { packages, evidence } = loadDraftCatalog();
const outputs: ContentPackage[] = [],
  advanced = new Map<string, ContentPackage>();
function clone(id: string) {
  const row = catalog.lessons.find((r: { key: string }) => r.key === id);
  assert.equal(row.currentVersion, `${id.toLowerCase()}-draft-v1`);
  const source = packages.find(
    (p) => p.lesson.versionId === row.currentVersion,
  )!;
  const p = packageSchema.parse(structuredClone(source));
  p.lesson.version = 2;
  p.lesson.versionId = `${id.toLowerCase()}-draft-v2`;
  return { row, source, p };
}
function finish(p: ContentPackage) {
  for (const [i, e] of p.exercises.entries()) {
    const old = e.id,
      key = p.privateKeys.find((k) => k.id === e.keyRef)!;
    e.id = `${p.lesson.id.toLowerCase()}-v2-e${i}`;
    e.keyRef = `${p.lesson.id.toLowerCase()}-v2-k${i}`;
    key.id = e.keyRef;
    key.exerciseVersionId = e.id;
    for (const b of p.blocks)
      if (b.type === "exercise" && b.exerciseVersionId === old)
        b.exerciseVersionId = e.id;
  }
  p.packageHash = contentHash(p);
  outputs.push(p);
}
for (const id of ["L114", "L115"]) {
  const { row, source, p } = clone(id);
  const index = id === "L114" ? 3 : 0,
    e = p.exercises[index],
    key = p.privateKeys.find((k) => k.id === e.keyRef)!;
  const word = id === "L114" ? "他们" : "她们";
  e.prompt =
    id === "L114"
      ? "Dữ kiện: nhóm gồm một bạn nam và một bạn nữ. Chọn đại từ viết cho nhóm người này: □是我的朋友。 Không suy giới tính từ âm tāmen."
      : "Dữ kiện: nhóm đang nói đến gồm toàn nữ. Chọn đại từ viết theo dữ kiện: □是我的家人。 Không suy giới tính từ âm tāmen.";
  e.choices = ["他们", "她们", "它们"];
  key.accepted = [word];
  key.feedback =
    id === "L114"
      ? "Chọn 他们 cho nhóm gồm nam và nữ đã nêu. 她们 dùng cho nhóm toàn nữ; 它们 cho vật/con vật. Cùng âm tāmen không quyết định chữ viết."
      : "Chọn 她们 vì đề nêu nhóm toàn nữ. Không đọc tên hay âm tāmen để tự đoán giới tính; 它们 không thay nhóm người trong bài.";
  if (id === "L114") {
    const e5 = p.exercises[5],
      k5 = p.privateKeys.find((k) => k.id === e5.keyRef)!;
    const meaning = p.concepts[3].meaning;
    e5.prompt =
      "Dữ kiện: An và Linh gồm một bạn nam và một bạn nữ. Trong câu “他们都学习汉语。”, 他们 thay cho nhóm nào đã nêu?";
    e5.choices = [
      meaning,
      "họ (nhóm toàn nữ)",
      "nhóm vật hoặc con vật",
      "một người nam",
    ];
    k5.accepted = [meaning];
    k5.feedback =
      "Nhóm gồm nam và nữ nên dùng 他们. 都 chỉ cả nhóm đều học; không biến 他们 thành nhóm toàn nữ.";
    const grammar = p.blocks.find(
      (b) => b.type === "teaching" && b.id === "l114-grammar",
    )!;
    assert(grammar.type === "teaching");
    grammar.text =
      "他们 dùng cho nhóm nam hoặc nhóm gồm nam nữ; 她们 dùng cho nhóm toàn nữ khi dữ kiện đã rõ. 它们 dùng cho vật/con vật, gặp ở bài tiếp. Ba dạng cùng đọc tāmen nên âm thanh riêng không đủ chọn chữ. 男朋友/女朋友 ở đây nói người yêu, khác 朋友. Không suy quan hệ hoặc giới tính chỉ từ tên hay việc cùng có mặt.";
    p.exercises[7].choices = ["他们", "是", "我的朋友。"];
    p.exercises[7].prompt =
      "Nhóm trong đề gồm một bạn nam và một bạn nữ. Xếp câu bắt đầu bằng 他们; giữ nguyên các cụm đã cho.";
    p.privateKeys.find((k) => k.id === p.exercises[7].keyRef)!.feedback =
      "他们是我的朋友。Đề đã nêu nhóm nam/nữ; 她们 không mô tả nhóm hỗn hợp trong tình huống này.";
  }
  finish(p);
  advanced.set(source.lesson.versionId, p);
  row.currentVersion = p.lesson.versionId;
}
for (const old of [...registry.activities]) {
  const row = catalog.lessons.find(
    (r: { currentVersion: string }) => r.currentVersion === old.versionId,
  );
  if (!row || !old.sourceVersions.some((v: string) => advanced.has(v)))
    continue;
  const source = packages.find((p) => p.lesson.versionId === old.versionId)!;
  const { p } = clone(source.lesson.id);
  p.lesson.prerequisites = p.lesson.prerequisites.map(
    (v) => advanced.get(v)?.lesson.versionId ?? v,
  );
  finish(p);
  row.currentVersion = p.lesson.versionId;
  const next = structuredClone(old);
  next.versionId = p.lesson.versionId;
  next.sha256 = p.packageHash;
  next.sourceVersions = next.sourceVersions.map(
    (v: string) => advanced.get(v)?.lesson.versionId ?? v,
  );
  for (const origin of Object.values(next.origins) as {
    versionId: string;
    sha256: string;
    file: string;
  }[]) {
    const target = advanced.get(origin.versionId);
    if (target) {
      origin.versionId = target.lesson.versionId;
      origin.sha256 = target.packageHash;
      origin.file = `${target.lesson.id}.v2.json`;
    }
  }
  registry.activities.push(next);
}
for (const p of outputs) {
  assert.deepEqual(validatePackage(p, [...packages, ...outputs], evidence), []);
  assert(!fs.existsSync(`${dir}/${p.lesson.id}.v2.json`));
}
for (const p of outputs) {
  const file = `${p.lesson.id}.v2.json`;
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(p, null, 2) + "\n", {
    flag: "wx",
  });
  manifest.packages.push({
    file,
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
  });
}
for (const [file, data] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
  ["reviews.json", registry],
] as const)
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(data, null, 2) + "\n");
console.log(
  `${outputs.length} additive versions: plural group evidence repaired; old bytes and aliases retained.`,
);
