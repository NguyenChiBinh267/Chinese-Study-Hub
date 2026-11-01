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
for (const n of [426, 428]) {
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
  if (n === 426) {
    p.exercises[2].prompt +=
      " Trong hai từ gần nghĩa của bài, nhập đúng dạng chứa chữ 快.";
    p.privateKeys[2].feedback +=
      " 赶紧 cũng tự nhiên trong câu; bài này hỏi riêng dạng có 快, không phủ nhận nghĩa gần nhau.";
  }
  if (n === 428) {
    const b = p.blocks.find((b) => b.id === "l428-reading")!;
    if (b.type !== "teaching") throw Error("READING");
    b.hanzi = b.hanzi.replace(
      "这句话是他的打算，不是已经验证的未来记录。",
      "他对整理后的房间很满意。",
    );
    b.pinyin = b.pinyin.replace(
      "Zhè jù huà shì tā de dǎsuàn, bú shì yǐjīng yànzhèng de wèilái jìlù.",
      "Tā duì zhěnglǐ hòu de fángjiān hěn mǎnyì.",
    );
    b.meaning =
      "Trang tìm thấy túi dưới bàn, đáy có lỗ. Anh treo túi sau cửa, nói không để ở cửa ra vào nữa và hài lòng với phòng đã gọn.";
    const guide = p.blocks[0];
    if (guide.type === "teaching")
      guide.text +=
        " 满意 mǎnyì: hài lòng. Lời hứa là ý định, không phải bằng chứng tương lai.";
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
  "L426/L428 immutable form/style refinements; old versions retained.",
);
