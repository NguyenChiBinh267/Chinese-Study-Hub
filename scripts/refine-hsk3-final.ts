// Second correction bundle: preserve every imported version and its history.
import fs from "node:fs";
import {
  contentHash,
  currentDrafts,
  loadDraftCatalog,
} from "../src/modules/content/application/catalog";
import {
  gradeContent,
  validatePackage,
  type ContentPackage,
} from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const dir = "content/hsk24",
  read = (f: string) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json"),
  { packages, evidence } = loadDraftCatalog();
const current = currentDrafts(),
  outputs: ContentPackage[] = [];
function replace(p: ContentPackage, pairs: [string, string][]) {
  const walk = (v: unknown): unknown =>
    typeof v === "string"
      ? pairs.reduce((s, [a, b]) => s.replaceAll(a, b), v)
      : Array.isArray(v)
        ? v.map(walk)
        : v && typeof v === "object"
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
          : v;
  return walk(p) as ContentPackage;
}
function gloss(p: ContentPackage, text: string) {
  const b = p.blocks.find((b) => b.id.endsWith("-prereq"))!;
  if (b.type !== "teaching") throw Error("PREREQ");
  b.text += " " + text;
}
for (const n of [319, 331, 342, 346, 350, 355, 356, 365, 371]) {
  let p = structuredClone(current.find((p) => p.lesson.id === `L${n}`)!);
  const version = p.lesson.version + 1;
  if (version !== (n === 319 ? 3 : 2)) throw Error("NOT_FRESH");
  p.lesson.version = version;
  p.lesson.versionId = `l${n}-draft-v${version}`;
  p.alignment.alignmentCheckedAt = new Date().toISOString();
  if (n === 319)
    p = replace(p, [
      ["Chiếc áo này rất hợp với quần.", "Chiếc áo này rất vừa/phù hợp."],
    ]);
  if (n === 331) {
    p = replace(p, [
      ["天空中出来了月亮", "天空中升起了一轮月亮"],
      ["出来了月亮", "升起了一轮月亮"],
      [
        "tiānkōng zhōng chūlái le yuèliang",
        "tiānkōng zhōng shēng qǐ le yì lún yuèliang",
      ],
    ]);
    gloss(
      p,
      "升起 shēng qǐ: lên/nhô lên; 轮 lún: lượng từ mặt trăng trong câu; từ hỗ trợ, chưa xác minh cấp.",
    );
  }
  if (n === 342)
    p.exercises[2].prompt =
      "Xác nhận đã nhận được thư, dùng mục từ hai chữ có 到 nhấn kết quả: 我已经□邮件了。";
  if (n === 346)
    p = replace(p, [
      ["这个房间的大小很一般。", "这家店的服务很一般。"],
      [
        "Zhège fángjiān de dàxiǎo hěn yìbān.",
        "Zhè jiā diàn de fúwù hěn yìbān.",
      ],
      [
        "Kích cỡ phòng này khá bình thường.",
        "Dịch vụ quán này khá bình thường.",
      ],
    ]);
  if (n === 350) {
    p = replace(p, [
      ["合孩子的兴趣", "符合孩子的兴趣"],
      ["合兴趣", "符合兴趣"],
      ["hé xìngqù", "fúhé xìngqù"],
    ]);
    gloss(
      p,
      "符合 fúhé: phù hợp/đáp ứng; hỗ trợ cách kết hợp từ, chưa xác minh cấp; 不说合兴趣.",
    );
  }
  if (n === 355) {
    const e = p.exercises[7],
      k = p.privateKeys.find((k) => k.id === e.keyRef)!;
    e.prompt = "Sắp xếp mốc bắt đầu từ chín giờ, bắt đầu bằng 从九点起.";
    e.choices = ["我先看要求", "从九点起"];
    k.accepted = ["1,0"];
    k.feedback =
      "从九点起 nêu mốc bắt đầu; 我先看要求 là hành động sau mốc. Chưa cho biết giờ hoàn thành.";
  }
  if (n === 356)
    p = replace(p, [
      ["后年才打算留学", "他打算后年才去留学"],
      ["hòunián cái dǎsuàn liúxué", "tā dǎsuàn hòunián cái qù liúxué"],
    ]);
  if (n === 365) {
    p = replace(p, [
      ["他被家人照顾", "他被家人照顾得很好"],
      ["Tā bèi jiārén zhàogù,", "Tā bèi jiārén zhàogù de hěn hǎo,"],
    ]);
    p.exercises[7].choices = p.exercises[7].choices.map((x) =>
      x === "照顾" ? "照顾得很好" : x,
    );
    gloss(
      p,
      "得 de + 很好 hěn hǎo: bổ ngữ cách thức/mức độ trong 被家人照顾得很好, không phải chứng nhận y khoa.",
    );
  }
  if (n === 371) {
    p = replace(p, [
      [
        "新年假期，小林想跟家人一起过。",
        "新年假期，小林想跟家人一起过；假期以后，他回学校。",
      ],
      [
        "Xīnnián jiàqī, Xiǎo Lín xiǎng gēn jiārén yìqǐ guò.",
        "Xīnnián jiàqī, Xiǎo Lín xiǎng gēn jiārén yìqǐ guò; jiàqī yǐhòu, tā huí xuéxiào.",
      ],
      [
        "Kỳ nghỉ năm mới Lâm muốn gặp gia đình.",
        "Kỳ nghỉ năm mới Lâm muốn gặp gia đình. Sau kỳ nghỉ cậu về trường.",
      ],
    ]);
    const e = p.exercises[7],
      k = p.privateKeys.find((k) => k.id === e.keyRef)!;
    e.prompt = "Xếp mốc sau kỳ nghỉ, bắt đầu bằng 假期以后.";
    e.choices = ["他回学校", "假期以后"];
    k.accepted = ["1,0"];
    k.feedback =
      "假期以后 nêu sau kỳ nghỉ; không phải 过去的假期 nói những kỳ nghỉ trong quá khứ.";
  }
  for (const [i, e] of p.exercises.entries()) {
    const k = p.privateKeys.find((k) => k.id === e.keyRef)!,
      b = p.blocks.find(
        (b) => b.type === "exercise" && b.exerciseVersionId === e.id,
      )!;
    e.id = `l${n}-v${version}-e${i}`;
    e.keyRef = `l${n}-v${version}-k${i}`;
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
  const file = `${p.lesson.id}.v${p.lesson.version}.json`;
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
  "Nine current immutable corrections validated; all original versions retained. New selected sandbox required.",
);
