// One additive repair round from independent AI review; never rewrites v1/history.
import fs from "node:fs";
import assert from "node:assert/strict";
import {
  contentHash,
  loadDraftCatalog,
} from "../src/modules/content/application/catalog";
import {
  gradeContent,
  validatePackage,
  type ContentPackage,
} from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const dir = "content/hsk24";
const manifest = JSON.parse(fs.readFileSync(`${dir}/manifest.json`, "utf8"));
const catalog = JSON.parse(fs.readFileSync(`${dir}/catalog.json`, "utf8"));
const { packages, evidence } = loadDraftCatalog();
const outputs: ContentPackage[] = [];
for (const id of ["L4008", "L4017", "L4020"]) {
  const original = packages.find(
    (p) => p.lesson.versionId === `${id.toLowerCase()}-draft-v1`,
  )!;
  assert(original);
  const p = structuredClone(original);
  p.lesson.version = 2;
  p.lesson.versionId = `${id.toLowerCase()}-draft-v2`;
  if (id === "L4008") {
    assert(p.exercises[1].skill === "recognition");
    p.exercises[1].prompt = p.exercises[1].prompt.replace(
      " Ghi pinyin của đúng từ 稍微, không viết dạng rút gọn 稍.",
      " Chỉ chọn một chữ để hoàn thành từ, không nhập pinyin.",
    );
  }
  if (id === "L4017") {
    assert(p.exercises[2].skill === "recognition");
    p.exercises[2].prompt = p.exercises[2].prompt.replace(
      " Dùng từ hai chữ có chữ 谊, không dùng từ đồng nghĩa 友情.",
      " Chỉ chọn chữ còn thiếu trong 友□; không nhập cả từ.",
    );
  }
  if (id === "L4020") {
    const ref = packages
      .filter((q) => q.alignment.targetLevel === 4)
      .flatMap((q) => q.alignment.topicReferences)
      .find((r) => r.written === "就餐" && r.status === "VERIFIED");
    assert(ref);
    p.alignment.topicReferences = [structuredClone(ref)];
    p.exercises[0].prompt +=
      " Yêu cầu từ hai chữ kết thúc bằng 品; 食物 cũng có thể hợp nghĩa nhưng không đúng dạng chữ được yêu cầu.";
    p.privateKeys.find((k) => k.id === p.exercises[0].keyRef)!.feedback +=
      " 食物 cũng có thể dùng về nghĩa trong câu này; đề đang phân biệt đúng dạng từ kết thúc bằng 品, không phủ nhận cách dùng 食物.";
  }
  assert.deepEqual(p.concepts, original.concepts);
  assert.deepEqual(p.lesson.prerequisites, original.lesson.prerequisites);
  for (const [i, e] of p.exercises.entries()) {
    const oldId = e.id;
    const k = p.privateKeys.find((k) => k.id === e.keyRef)!;
    e.id = `${id.toLowerCase()}-v2-e${i}`;
    e.keyRef = `${id.toLowerCase()}-v2-k${i}`;
    k.id = e.keyRef;
    k.exerciseVersionId = e.id;
    for (const b of p.blocks)
      if (b.type === "exercise" && b.exerciseVersionId === oldId)
        b.exerciseVersionId = e.id;
  }
  p.packageHash = contentHash(p);
  outputs.push(p);
}
for (const p of outputs) {
  assert(!fs.existsSync(`${dir}/${p.lesson.id}.v2.json`));
  assert.deepEqual(validatePackage(p, [...packages, ...outputs], evidence), []);
  for (const e of p.exercises) {
    const a = p.privateKeys.find((k) => k.id === e.keyRef)!.accepted[0];
    assert(
      gradeContent(
        p,
        e.id,
        e.type === "choice"
          ? { choice: e.choices.indexOf(a) }
          : e.type === "sequence"
            ? { order: a.split(",").map(Number) }
            : { text: a },
      ).correct,
    );
  }
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
  catalog.lessons.find(
    (l: { key: string }) => l.key === p.lesson.id,
  ).currentVersion = p.lesson.versionId;
}
fs.writeFileSync(
  `${dir}/manifest.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
fs.writeFileSync(
  `${dir}/catalog.json`,
  JSON.stringify(catalog, null, 2) + "\n",
);
console.log(
  "Three additive v2 repairs validated; all v1/concept/origin/history identities retained; no approval.",
);
