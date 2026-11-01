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
const changes: Record<number, [string, string[], string]> = {
  407: [
    "Xếp chỉ dẫn theo bước, bắt đầu bằng 首先.",
    ["查找名单", "首先", "然后去销售部", "在一楼"],
    "1,3,0,2",
  ],
  410: [
    "Xếp so sánh, bắt đầu bằng 跟去年相比.",
    ["更", "今年的气温", "跟去年相比", "高"],
    "2,1,0,3",
  ],
  412: [
    "Xếp lời cảnh báo, bắt đầu bằng 先.",
    ["可能走错路", "否则", "先", "确认地址"],
    "2,3,1,0",
  ],
  414: [
    "Xếp giả thiết, bắt đầu bằng 要是材料不全.",
    ["补齐", "就", "先", "要是材料不全"],
    "3,1,2,0",
  ],
  415: [
    "Xếp bối cảnh thời gian, bắt đầu bằng 当护士问他时.",
    ["鼻子", "当护士问他时", "他", "指了指"],
    "1,2,3,0",
  ],
  416: [
    "Xếp lập luận, bắt đầu bằng 既然发现错误.",
    ["改", "马上", "既然发现错误", "就"],
    "2,3,1,0",
  ],
};
const outputs = [];
for (const n of [407, 410, 412, 413, 414, 415, 416]) {
  const old = packages.find(
    (p) => p.lesson.id === `L${n}` && p.lesson.version === 1,
  )!;
  if (
    !old ||
    manifest.packages.some(
      (m: { versionId: string }) => m.versionId === `l${n}-draft-v2`,
    )
  )
    throw Error("FRESH_REFINEMENT_REQUIRED");
  const p = structuredClone(old);
  p.lesson.version = 2;
  p.lesson.versionId = `l${n}-draft-v2`;
  p.alignment.alignmentCheckedAt = new Date().toISOString();
  for (const [i, e] of p.exercises.entries()) {
    const k = p.privateKeys.find((k) => k.id === e.keyRef)!,
      block = p.blocks.find(
        (b) => b.type === "exercise" && b.exerciseVersionId === e.id,
      )!;
    if (e.type === "sequence" && changes[n]) {
      e.prompt = changes[n][0];
      e.choices = changes[n][1];
      k.accepted = [changes[n][2]];
    }
    if (e.prompt.startsWith("Nhận diện chữ")) e.skill = "recognition";
    e.id = `l${n}-v2-e${i}`;
    e.keyRef = `l${n}-v2-k${i}`;
    k.id = e.keyRef;
    k.exerciseVersionId = e.id;
    if (block.type === "exercise") block.exerciseVersionId = e.id;
  }
  if (n === 413) {
    const b = p.blocks.find((b) => b.id === "l413-reading")!;
    if (b.type !== "teaching") throw Error("READING");
    b.hanzi = b.hanzi.replace(
      "甲店还要收十元运费",
      "两家商品的价格都是一百元。甲店还要收十元运费",
    );
    b.pinyin = b.pinyin.replace(
      "Jiǎ diàn hái yào shōu shí yuán",
      "Liǎng jiā shāngpǐn de jiàgé dōu shì yì bǎi yuán. Jiǎ diàn hái yào shōu shí yuán",
    );
    b.meaning +=
      " Giá hàng ban đầu ở cả hai nơi đều là 100 tệ; tổng giá lần lượt là 110 và 100 tệ.";
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
  if (fs.existsSync(`${dir}/${file}`)) throw Error("IMMUTABLE_EXISTS");
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
  "Seven immutable v2 refinements; originals retained, no history/card migration or approval.",
);
