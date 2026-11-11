// Retain already imported v1 bytes; select corrected v2 only in a new sandbox.
import fs from "node:fs";
import {
  contentHash,
  loadDraftCatalog,
} from "../src/modules/content/application/catalog";
import { validatePackage } from "../src/modules/content/domain/package";
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8")),
  dir = "content/hsk24",
  data = read(`${dir}/closure.authoring.json`),
  manifest = read(`${dir}/manifest.json`),
  catalog = read(`${dir}/catalog.json`),
  reviews = read(`${dir}/reviews.json`),
  { packages, evidence } = loadDraftCatalog();
for (const id of ["L235", "L238"]) {
  const old = packages.find(
      (p) => p.lesson.id === id && p.lesson.version === 1,
    )!,
    p = structuredClone(old),
    l = data.lessons.find((l: { id: string }) => l.id === id),
    prefix = id.toLowerCase();
  if (
    manifest.packages.some(
      (m: { versionId: string }) => m.versionId === `${prefix}-draft-v2`,
    )
  )
    throw Error("REPAIR_EXISTS");
  p.lesson.version = 2;
  p.lesson.versionId = `${prefix}-draft-v2`;
  if (id === "L235") {
    const b = p.blocks.find((b) => b.id === `${prefix}-grammar1`)!;
    if (b.type !== "teaching") throw Error("TEACHING_BINDING");
    b.text = l.grammar[1].explanation;
    const e = p.exercises[1];
    e.choices = e.choices.map((x) =>
      x === "他今年是十六岁。" ? "他今年十岁六。" : x,
    );
    p.privateKeys.find((k) => k.id === e.keyRef)!.feedback =
      l.grammar[1].explanation;
  } else {
    const b = p.blocks.find((b) => b.id === `${prefix}-scene`)!;
    if (b.type !== "teaching") throw Error("SCENE_BINDING");
    b.hanzi = l.passage[0];
    b.pinyin = l.passage[1];
    b.meaning = l.passage[2];
  }
  for (const [i, e] of p.exercises.entries()) {
    const key = p.privateKeys.find((k) => k.id === e.keyRef)!;
    const block = p.blocks.find(
      (b) => b.type === "exercise" && b.exerciseVersionId === e.id,
    )!;
    e.id = `${prefix}-v2-e${i}`;
    e.keyRef = `${prefix}-v2-k${i}`;
    key.id = e.keyRef;
    key.exerciseVersionId = e.id;
    if (block.type === "exercise") block.exerciseVersionId = e.id;
  }
  p.packageHash = contentHash(p);
  const issues = validatePackage(p, [...packages, p], evidence);
  if (issues.length) throw Error(JSON.stringify(issues));
  const a = structuredClone(
    reviews.activities.find(
      (a: { versionId: string }) => a.versionId === old.lesson.versionId,
    ),
  );
  a.versionId = p.lesson.versionId;
  a.sha256 = p.packageHash;
  a.grammarEvidence.forEach(
    (g: { exerciseId: string; subalternative: string }, i: number) => {
      g.exerciseId = p.exercises[i].id;
      g.subalternative = l.grammar[i].scope;
    },
  );
  a.topicEvidence.forEach(
    (t: { exerciseIds: string[] }) =>
      (t.exerciseIds = p.exercises.slice(4).map((e) => e.id)),
  );
  reviews.activities.push(a);
  const file = `${id}.v2.json`;
  manifest.packages.push({
    file,
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
  });
  catalog.lessons.find((l: { key: string }) => l.key === id).currentVersion =
    p.lesson.versionId;
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(p, null, 2) + "\n");
}
const a = reviews.activities.find(
  (a: { versionId: string }) => a.versionId === "l236-draft-v1",
);
a.grammarEvidence[2].subalternative = "định ngữ là cụm chủ-vị 我昨天买";
for (const [file, data] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
  ["reviews.json", reviews],
] as const)
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(data, null, 2) + "\n");
console.log("Two corrected versions selected; v1 retained unchanged.");
