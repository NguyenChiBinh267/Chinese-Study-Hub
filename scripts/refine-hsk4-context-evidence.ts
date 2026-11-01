// Additive supplementary-assessment repair. No old content or history is edited.
import fs from "node:fs";
import assert from "node:assert/strict";
import {
  contentHash,
  loadDraftCatalog,
} from "../src/modules/content/application/catalog";
import {
  validatePackage,
  type ContentPackage,
} from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const dir = "content/hsk24",
  read = (f: string) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json"),
  registry = read("reviews.json");
const { packages, evidence } = loadDraftCatalog();
const outputs: ContentPackage[] = [];
for (const row of catalog.lessons as {
  key: string;
  currentVersion: string;
}[]) {
  const n = Number(row.key.slice(1));
  if (!((n >= 4025 && n <= 4084) || (n >= 49005 && n <= 49014))) continue;
  const original = packages.find(
    (p) => p.lesson.versionId === row.currentVersion,
  )!;
  if (
    original.exercises[6].evidenceScope === "CONTEXT_ONLY" &&
    original.exercises[7].evidenceScope === "CONTEXT_ONLY" &&
    !(
      n === 4048 &&
      JSON.stringify(original.alignment.sourceLocator) !==
        JSON.stringify(original.alignment.taskReferences[0].sourceLocator)
    )
  )
    continue;
  const p = structuredClone(original),
    v = p.lesson.version + 1,
    prefix = p.lesson.id.toLowerCase();
  p.lesson.version = v;
  p.lesson.versionId = `${prefix}-draft-v${v}`;
  p.exercises[6].evidenceScope = "CONTEXT_ONLY";
  p.exercises[7].evidenceScope = "CONTEXT_ONLY";
  if (p.lesson.id === "L4054" || p.lesson.id === "L4055") {
    const e = p.exercises[0],
      k = p.privateKeys.find((k) => k.id === e.keyRef)!;
    const ambiguous = p.lesson.id === "L4054" ? "用于" : "证明";
    e.choices = e.choices.map((a) => (a === ambiguous ? "速度" : a));
    k.feedback +=
      p.lesson.id === "L4054"
        ? " 用于 cũng có thể dùng trong câu này, nên không dùng nó làm phương án sai."
        : " 证明 cũng có thể làm danh từ trong câu này, nên không dùng nó làm phương án sai.";
  }
  if (p.lesson.id === "L4053") {
    const old = "有效 là tính từ, khác danh từ 效果.",
      replacement =
        "有效 nói có tác dụng/hiệu quả; trong câu này làm vị ngữ, còn 效果 gọi tên kết quả. Không dùng ghi chú này để khẳng định cách phân loại từ của mọi nguồn.";
    for (const b of p.blocks)
      if (b.type === "teaching") b.text = b.text.replaceAll(old, replacement);
    for (const k of p.privateKeys)
      k.feedback = k.feedback.replaceAll(old, replacement);
  }
  if (p.lesson.id === "L4048") {
    p.alignment.topicReferences = [
      structuredClone(
        packages
          .flatMap((p) => p.alignment.topicReferences)
          .find((r) => r.written === "教学情况" && r.status === "VERIFIED")!,
      ),
    ];
    p.alignment.taskReferences = [
      structuredClone(
        packages
          .flatMap((p) => p.alignment.taskReferences)
          .find(
            (r) =>
              r.written === "谈论教学、学习情况" && r.status === "VERIFIED",
          )!,
      ),
    ];
  }
  if (p.lesson.id === "L4048")
    p.alignment.sourceLocator = structuredClone(
      p.alignment.taskReferences[0].sourceLocator,
    );
  for (const [i, e] of p.exercises.entries()) {
    const old = e.id,
      k = p.privateKeys.find((k) => k.id === e.keyRef)!;
    e.id = `${prefix}-v${v}-e${i}`;
    e.keyRef = `${prefix}-v${v}-k${i}`;
    k.id = e.keyRef;
    k.exerciseVersionId = e.id;
    for (const b of p.blocks)
      if (b.type === "exercise" && b.exerciseVersionId === old)
        b.exerciseVersionId = e.id;
  }
  assert.deepEqual(p.concepts, original.concepts);
  p.packageHash = contentHash(p);
  outputs.push(p);
}
assert(outputs.length > 0);
for (const p of outputs) {
  assert(!fs.existsSync(`${dir}/${p.lesson.id}.v${p.lesson.version}.json`));
  assert.deepEqual(validatePackage(p, [...packages, ...outputs], evidence), []);
}
for (const p of outputs) {
  const oldVersion = catalog.lessons.find(
    (l: { key: string }) => l.key === p.lesson.id,
  ).currentVersion;
  const old = registry.activities.find(
    (a: { versionId: string }) => a.versionId === oldVersion,
  );
  if (old) {
    const a = structuredClone(old);
    a.versionId = p.lesson.versionId;
    a.sha256 = p.packageHash;
    a.characterItems = a.characterItems.map((x: { exerciseId: string }) => ({
      ...x,
      exerciseId:
        p.exercises[
          packages
            .find((q) => q.lesson.versionId === oldVersion)!
            .exercises.findIndex((e) => e.id === x.exerciseId)
        ].id,
    }));
    registry.activities.push(a);
  }
  const file = `${p.lesson.id}.v${p.lesson.version}.json`;
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
for (const [file, data] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
  ["reviews.json", registry],
] as const)
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(data, null, 2) + "\n");
console.log(
  JSON.stringify({
    supplementaryContextVersions: outputs.map((p) => p.lesson.versionId),
    legacyVersionsPreserved: true,
  }),
);
