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
  { packages, evidence } = loadDraftCatalog(),
  outputs = [];
for (const n of [405, 406, 408, 409, 411]) {
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
  let count = 0;
  for (const [i, e] of p.exercises.entries()) {
    const k = p.privateKeys.find((k) => k.id === e.keyRef)!,
      b = p.blocks.find(
        (b) => b.type === "exercise" && b.exerciseVersionId === e.id,
      )!;
    if (e.prompt.startsWith("Nhận diện chữ")) {
      e.skill = "recognition";
      count++;
    }
    e.id = `l${n}-v2-e${i}`;
    e.keyRef = `l${n}-v2-k${i}`;
    k.id = e.keyRef;
    k.exerciseVersionId = e.id;
    if (b.type === "exercise") b.exerciseVersionId = e.id;
  }
  if (count !== 1) throw Error("ONE_GLYPH_ITEM_REQUIRED");
  p.packageHash = contentHash(p);
  outputs.push(p);
}
for (const p of outputs)
  if (validatePackage(p, [...packages, ...outputs], evidence).length)
    throw Error("PACKAGE");
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
] as const)
  fs.writeFileSync(`${dir}/${f}`, JSON.stringify(v, null, 2) + "\n");
console.log(
  "Five immutable skill-tag corrections; old packages/attempts/cards retained.",
);
