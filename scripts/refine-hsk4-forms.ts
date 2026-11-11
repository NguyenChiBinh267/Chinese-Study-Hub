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
    (m: { versionId: string }) => m.versionId === "l423-draft-v2",
  )
)
  throw Error("IMMUTABLE_EXISTS");
const p = structuredClone(
  packages.find((p) => p.lesson.versionId === "l423-draft-v1")!,
);
p.lesson.version = 2;
p.lesson.versionId = "l423-draft-v2";
p.alignment.alignmentCheckedAt = new Date().toISOString();
for (const [i, e] of p.exercises.entries()) {
  const k = p.privateKeys.find((k) => k.id === e.keyRef)!,
    b = p.blocks.find(
      (b) => b.type === "exercise" && b.exerciseVersionId === e.id,
    )!;
  if (i === 4)
    e.prompt += " Yêu cầu đúng dạng hai chữ đã học, không chọn dạng một chữ.";
  if (i === 5)
    e.prompt += " Yêu cầu đúng dạng một chữ, không nhập dạng hai chữ.";
  if (i === 4 || i === 5)
    k.feedback +=
      " 各 và 各个 đều có thể phù hợp nghĩa trong câu này; đề chỉ phân biệt dạng một/hai chữ đã yêu cầu.";
  e.id = `l423-v2-e${i}`;
  e.keyRef = `l423-v2-k${i}`;
  k.id = e.keyRef;
  k.exerciseVersionId = e.id;
  if (b.type === "exercise") b.exerciseVersionId = e.id;
}
p.packageHash = contentHash(p);
if (validatePackage(p, [...packages, p], evidence).length)
  throw Error("PACKAGE");
for (const e of p.exercises) {
  const a = p.privateKeys.find((k) => k.id === e.keyRef)!.accepted[0];
  if (
    !gradeContent(
      p,
      e.id,
      e.type === "choice"
        ? { choice: e.choices.indexOf(a) }
        : e.type === "sequence"
          ? { order: a.split(",").map(Number) }
          : { text: a },
    ).correct
  )
    throw Error("KEY");
}
fs.writeFileSync(`${dir}/L423.v2.json`, JSON.stringify(p, null, 2) + "\n");
manifest.packages.push({
  file: "L423.v2.json",
  versionId: p.lesson.versionId,
  sha256: p.packageHash,
});
catalog.lessons.find((l: { key: string }) => l.key === "L423").currentVersion =
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
  "L423v2 explicitly distinguishes one/two-character forms; original retained.",
);
