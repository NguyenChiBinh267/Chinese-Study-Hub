// Preserve imported v1 bytes; corrected teaching/prompts are separate immutable v2.
import fs from "node:fs";
import {
  contentHash,
  loadDraftCatalog,
} from "../src/modules/content/application/catalog";
import { validatePackage } from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8")),
  dir = "content/hsk24",
  manifest = read(`${dir}/manifest.json`),
  catalog = read(`${dir}/catalog.json`),
  { packages, evidence } = loadDraftCatalog();
const prompts: Record<string, string> = {
  L312: "Viết câu “Đèn còn bật”, dùng mục từ đèn của bài và trợ từ trạng thái 着. Chỉ viết một câu ngắn.",
  L313: "Viết câu “Quản lý muốn tìm hiểu”, dùng đúng hai mục từ quản lý và tìm hiểu đã học. Không thêm tân ngữ.",
  L315: "Viết lời chào “Chào mừng bạn đến”, dùng mục từ chào mừng của bài; người được chào là 你 và cuối câu dùng 来.",
  L316: "Viết “Tôi là một du học sinh”, dùng lượng từ 名 trước danh từ du học sinh.",
};
const outputs = [];
for (const id of ["L309", "L312", "L313", "L315", "L316"]) {
  const old = packages.find(
    (p) => p.lesson.id === id && p.lesson.version === 1,
  )!;
  if (
    !old ||
    manifest.packages.some(
      (m: { versionId: string }) =>
        m.versionId === `${id.toLowerCase()}-draft-v2`,
    )
  )
    throw Error("REFINEMENT_NOT_FRESH");
  const p = structuredClone(old),
    prefix = id.toLowerCase();
  p.lesson.version = 2;
  p.lesson.versionId = `${prefix}-draft-v2`;
  if (id === "L309") {
    const b = p.blocks.find((b) => b.id === `${prefix}-reading`)!;
    if (b.type !== "teaching") throw Error("READING_BINDING");
    b.hanzi = b.hanzi.replace("我想早点儿健康起来", "我想早点儿好起来");
    b.pinyin = b.pinyin.replace(
      "Wǒ xiǎng zǎo diǎnr jiànkāng qǐlái",
      "Wǒ xiǎng zǎo diǎnr hǎo qǐlái",
    );
  }
  if (prompts[id]) p.exercises[5].prompt = prompts[id];
  if (id === "L315") {
    p.exercises[0].prompt =
      "Hỏi chung tất cả các tiết mục của chương trình, gồm kể chuyện và biểu diễn, không chỉ màn biểu diễn: 有什么□？";
    p.exercises[0].choices = p.exercises[0].choices.filter((x) => x !== "表演");
  }
  for (const [i, e] of p.exercises.entries()) {
    const k = p.privateKeys.find((k) => k.id === e.keyRef)!;
    const b = p.blocks.find(
      (b) => b.type === "exercise" && b.exerciseVersionId === e.id,
    )!;
    e.id = `${prefix}-v2-e${i}`;
    e.keyRef = `${prefix}-v2-k${i}`;
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
fs.writeFileSync(
  `${dir}/manifest.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
fs.writeFileSync(
  `${dir}/catalog.json`,
  JSON.stringify(catalog, null, 2) + "\n",
);
console.log(
  "Five v2 refinements selected; every original v1 retained. New selected sandbox required.",
);
