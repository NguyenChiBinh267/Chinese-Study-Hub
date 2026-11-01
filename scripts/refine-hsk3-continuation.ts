// Reviewer corrections are new immutable versions; original attempts stay pinned.
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
  read = (f: string) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json"),
  { packages, evidence } = loadDraftCatalog();
const outputs = [];
for (let n = 317; n <= 328; n++) {
  const id = `L${n}`,
    old = packages.find((p) => p.lesson.id === id && p.lesson.version === 1);
  if (
    !old ||
    manifest.packages.some(
      (m: { versionId: string }) => m.versionId === `l${n}-draft-v2`,
    )
  )
    throw Error("REFINEMENT_NOT_FRESH");
  const p = structuredClone(old);
  p.lesson.version = 2;
  p.lesson.versionId = `l${n}-draft-v2`;
  // This is the actual recheck time, never a copied template attestation.
  p.alignment.alignmentCheckedAt = new Date().toISOString();
  if (n === 317) {
    const b = p.blocks.find((b) => b.id === "l317-reading")!;
    if (b.type !== "teaching") throw Error("BLOCK");
    b.hanzi = b.hanzi.replace("他们什么时候结婚的？", "他们是什么时候结婚的？");
  }
  if (n === 319) {
    const b = p.blocks.find((b) => b.id === "l319-t4")!;
    if (b.type !== "teaching") throw Error("BLOCK");
    b.hanzi = "这件上衣很合适。";
    b.pinyin = "Zhè jiàn shàngyī hěn héshì.";
    b.meaning = "Chiếc áo này rất vừa/phù hợp.";
  }
  for (const [i, e] of p.exercises.entries()) {
    const k = p.privateKeys.find((k) => k.id === e.keyRef)!,
      b = p.blocks.find(
        (b) => b.type === "exercise" && b.exerciseVersionId === e.id,
      )!;
    if (e.type === "sequence") {
      const first = e.choices[Number(k.accepted[0].split(",")[0])];
      e.prompt += ` Bắt đầu bằng “${first}”.`;
    }
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
  const issues = validatePackage(p, [...packages, ...outputs], evidence);
  if (issues.length) throw Error(JSON.stringify(issues));
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
for (const [file, value] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
] as const)
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(value, null, 2) + "\n");
console.log(
  "12 immutable v2 packages: corrected source-check dates, bounded ordering and two transcript/collocation corrections. Old versions retained.",
);
