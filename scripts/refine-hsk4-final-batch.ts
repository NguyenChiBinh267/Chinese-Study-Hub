import fs from "node:fs";
import {
  contentHash,
  loadDraftCatalog,
} from "../src/modules/content/application/catalog";
import { validatePackage } from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const dir = "content/hsk24",
  manifest = JSON.parse(fs.readFileSync(`${dir}/manifest.json`, "utf8")),
  catalog = JSON.parse(fs.readFileSync(`${dir}/catalog.json`, "utf8")),
  sourceEvidence = JSON.parse(fs.readFileSync(`${dir}/evidence.json`, "utf8")),
  { packages, evidence } = loadDraftCatalog(),
  outputs = [];
const base = packages.find((p) => p.lesson.versionId === "l433-draft-v1")!;
const task = {
  ...structuredClone(base.alignment.taskReferences[0]),
  id: "h4-cont-task-campus-thirteen",
  written: "交流校园生活",
  sourceLocator: {
    pdfIndex: 24,
    physicalPage: 25,
    printedPage: 22,
    section: "task" as const,
    entry: "十三",
  },
};
if (sourceEvidence.references.some((r: { id: string }) => r.id === task.id))
  throw Error("REFERENCE_EXISTS");
sourceEvidence.references.push(task);
const candidateEvidence = {
  ...evidence,
  references: [...evidence.references, task],
};
for (const n of [433, 436]) {
  if (
    manifest.packages.some(
      (m: { versionId: string }) => m.versionId === `l${n}-draft-v2`,
    )
  )
    throw Error("IMMUTABLE_EXISTS");
  const p = structuredClone(
    packages.find((p) => p.lesson.versionId === `l${n}-draft-v1`)!,
  );
  p.lesson.version = 2;
  p.lesson.versionId = `l${n}-draft-v2`;
  p.alignment.alignmentCheckedAt = new Date().toISOString();
  if (n === 433) {
    p.alignment.taskReferences = [task];
    p.alignment.sourceLocator = task.sourceLocator;
  }
  if (n === 436) {
    const b = p.blocks.find((b) => b.id === "l436-reading")!;
    if (b.type !== "teaching") throw Error("READING");
    b.hanzi = b.hanzi.replace(
      "他从中学到走路时先看路的重要。",
      "他从中明白了走路时看清路很重要。",
    );
    b.pinyin = b.pinyin.replace(
      "Tā cóngzhōng xué dào zǒu lù shí xiān kàn lù de zhòngyào.",
      "Tā cóngzhōng míngbai le zǒu lù shí kàn qīng lù hěn zhòngyào.",
    );
  }
  for (const [i, e] of p.exercises.entries()) {
    const k = p.privateKeys.find((k) => k.id === e.keyRef)!,
      b = p.blocks.find(
        (b) => b.type === "exercise" && b.exerciseVersionId === e.id,
      )!;
    e.id = `l${n}-v2-e${i}`;
    e.keyRef = `l${n}-v2-k${i}`;
    k.id = e.keyRef;
    k.exerciseVersionId = e.id;
    if (b.type === "exercise") b.exerciseVersionId = e.id;
  }
  p.packageHash = contentHash(p);
  outputs.push(p);
}
for (const p of outputs) {
  const issues = validatePackage(
    p,
    [...packages, ...outputs],
    candidateEvidence,
  );
  if (issues.length) throw Error(JSON.stringify(issues));
}
for (const p of outputs) {
  const file = `${p.lesson.id}.v2.json`;
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(p, null, 2) + "\n");
  manifest.packages.push({
    file,
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
  });
  catalog.lessons.find(
    (l: { key: string }) => l.key === p.lesson.id,
  ).currentVersion = p.lesson.versionId;
}
for (const [f, v] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
  ["evidence.json", sourceEvidence],
] as const)
  fs.writeFileSync(`${dir}/${f}`, JSON.stringify(v, null, 2) + "\n");
console.log(
  "L433/L436 immutable source-task and Mandarin-predicate refinements; originals retained.",
);
