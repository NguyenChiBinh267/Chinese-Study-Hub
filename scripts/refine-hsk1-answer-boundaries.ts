// Scope lexical exercises precisely; valid alternative sentences stay valid.
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
const dir = "content/hsk24",
  read = (f: string) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json"),
  registry = read("reviews.json"),
  { packages, evidence } = loadDraftCatalog();
const outputs: ContentPackage[] = [],
  advanced = new Map<string, ContentPackage>();
function clone(id: string) {
  const row = catalog.lessons.find((l: { key: string }) => l.key === id);
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
  const prefix = p.lesson.id.toLowerCase();
  for (const [i, e] of p.exercises.entries()) {
    const before = e.id,
      k = p.privateKeys.find((k) => k.id === e.keyRef)!;
    e.id = `${prefix}-v2-e${i}`;
    e.keyRef = `${prefix}-v2-k${i}`;
    k.id = e.keyRef;
    k.exerciseVersionId = e.id;
    for (const b of p.blocks)
      if (b.type === "exercise" && b.exerciseVersionId === before)
        b.exerciseVersionId = e.id;
  }
  p.packageHash = contentHash(p);
  outputs.push(p);
}
for (const [id, index, cue, feedback] of [
  [
    "L121",
    0,
    "Chọn mục từ MỘT CHỮ có nghĩa học để điền 我□汉语。 Giữ đúng yêu cầu một chữ; 学习 là dạng hai chữ.",
    "Câu hỏi giới hạn một chữ nên chọn 学. 学习 cũng có thể dùng trong câu này nếu không có giới hạn hình thức.",
  ],
  [
    "L124",
    0,
    "Chọn mục từ đọc huì đã học, nói khả năng viết chữ Hán: 我□写汉字。 Câu hỏi này yêu cầu đúng mục từ theo âm đã nêu.",
    "Chọn 会 theo âm huì được yêu cầu. 能 cũng có thể nói khả năng trong ngữ cảnh phù hợp; không kết luận mọi câu dùng 能 ở đây đều sai.",
  ],
  [
    "L125",
    0,
    "Chọn mục từ đọc xiǎng, nói mong muốn thực hiện hành động: 我□喝茶。 Chỉ chọn mục từ có âm đã nêu.",
    "Chọn 想 theo âm xiǎng. 要 cũng có thể biểu đạt mong muốn; đề này giới hạn mục từ, không chấm mọi cách nói mong muốn.",
  ],
  [
    "L132",
    2,
    "Điền mục từ đọc qù đã học trong 我□学校读书。 Chỉ nhập mục từ theo âm qù, không nhập cả câu.",
    "Điền 去 theo âm qù. 到学校读书 có thể là cách nói hợp lệ ở ngữ cảnh khác; câu hỏi này yêu cầu riêng 去.",
  ],
] as const) {
  const { row, source, p } = clone(id),
    ex = p.exercises[index];
  ex.prompt = cue;
  p.privateKeys.find((k) => k.id === ex.keyRef)!.feedback = feedback;
  finish(p);
  row.currentVersion = p.lesson.versionId;
  advanced.set(source.lesson.versionId, p);
}
for (const id of ["L185", "L187", "L197"]) {
  const { row, source, p } = clone(id);
  p.lesson.prerequisites = p.lesson.prerequisites.map(
    (v) => advanced.get(v)?.lesson.versionId ?? v,
  );
  // Review cloze tasks name the requested reading, not an unrestricted paraphrase.
  for (const e of p.exercises)
    if (e.type === "short") {
      const c = p.concepts.find((c) => c.id === e.conceptId)!;
      e.prompt += ` Câu hỏi yêu cầu đúng mục từ đọc ${c.dictionaryPinyin}.`;
      p.privateKeys.find((k) => k.id === e.keyRef)!.feedback +=
        " Giới hạn này xác định mục từ đang ôn, không loại mọi cách diễn đạt khác ngoài đề.";
    }
  finish(p);
  row.currentVersion = p.lesson.versionId;
  const old = registry.activities.find(
    (a: { versionId: string }) => a.versionId === source.lesson.versionId,
  );
  assert(old);
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
for (const [f, v] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
  ["reviews.json", registry],
] as const)
  fs.writeFileSync(`${dir}/${f}`, JSON.stringify(v, null, 2) + "\n");
console.log(
  "4 bounded lexical items +3 current review origins advanced additively; all v1 packages/aliases retained.",
);
