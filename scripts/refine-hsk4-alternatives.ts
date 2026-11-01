import fs from "node:fs";
import {
  contentHash,
  loadDraftCatalog,
} from "../src/modules/content/application/catalog";
import {
  validatePackage,
  gradeContent,
} from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const dir = "content/hsk24",
  manifest = JSON.parse(fs.readFileSync(`${dir}/manifest.json`, "utf8")),
  catalog = JSON.parse(fs.readFileSync(`${dir}/catalog.json`, "utf8")),
  { packages, evidence } = loadDraftCatalog();
if (
  manifest.packages.some(
    (m: { versionId: string }) => m.versionId === "l416-draft-v3",
  )
)
  throw Error("IMMUTABLE_EXISTS");
const p = structuredClone(
  packages.find((p) => p.lesson.versionId === "l416-draft-v2")!,
);
p.lesson.version = 3;
p.lesson.versionId = "l416-draft-v3";
p.alignment.alignmentCheckedAt = new Date().toISOString();
for (const [i, e] of p.exercises.entries()) {
  const k = p.privateKeys.find((k) => k.id === e.keyRef)!,
    b = p.blocks.find(
      (b) => b.type === "exercise" && b.exerciseVersionId === e.id,
    )!;
  e.id = `l416-v3-e${i}`;
  e.keyRef = `l416-v3-k${i}`;
  k.id = e.keyRef;
  k.exerciseVersionId = e.id;
  if (e.type === "sequence") {
    e.prompt =
      "Xếp câu kết quả, bắt đầu bằng 既然发现错误; giữ nguyên từng mảnh đã cho.";
    e.choices = ["改", "我们", "就马上", "既然发现错误"];
    k.accepted = ["3,1,2,0"];
    k.feedback +=
      " 就马上改 và 马上就改 đều tự nhiên; bài này giữ liền mảnh 就马上, không chấm biến thể tách mảnh.";
  }
  if (b.type === "exercise") b.exerciseVersionId = e.id;
}
p.packageHash = contentHash(p);
if (validatePackage(p, [...packages, p], evidence).length)
  throw Error("PACKAGE");
const e = p.exercises[7],
  k = p.privateKeys.find((k) => k.id === e.keyRef)!;
for (const a of k.accepted)
  if (!gradeContent(p, e.id, { order: a.split(",").map(Number) }).correct)
    throw Error("VALID_ORDER_REJECTED");
fs.writeFileSync(`${dir}/L416.v3.json`, JSON.stringify(p, null, 2) + "\n");
manifest.packages.push({
  file: "L416.v3.json",
  versionId: p.lesson.versionId,
  sha256: p.packageHash,
});
catalog.lessons.find((l: { key: string }) => l.key === "L416").currentVersion =
  p.lesson.versionId;
fs.writeFileSync(
  `${dir}/manifest.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
fs.writeFileSync(
  `${dir}/catalog.json`,
  JSON.stringify(catalog, null, 2) + "\n",
);
console.log(
  "L416v3 uses uniquely ordered chunks and acknowledges natural adverb variants; prior versions retained.",
);
