// One additive repair packet from the independent final-content review.
import fs from "node:fs";
import assert from "node:assert/strict";
import {
  contentHash,
  loadDraftCatalog,
} from "../src/modules/content/application/catalog";
import {
  packageSchema,
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
for (const id of ["L4058", "L4073", "L4079", "L49009"]) {
  const row = catalog.lessons.find((l: { key: string }) => l.key === id);
  const original = packages.find(
    (p) => p.lesson.versionId === row.currentVersion,
  )!;
  assert.equal(
    original.lesson.version,
    ["L4073", "L4079"].includes(id) ? 1 : 2,
  );
  let p = structuredClone(original);
  const v = p.lesson.version + 1,
    prefix = id.toLowerCase();
  p.lesson.version = v;
  p.lesson.versionId = `${prefix}-draft-v${v}`;
  if (id === "L4058") {
    p.exercises[2].prompt +=
      " Yêu cầu hình thức: dùng mục từ hai chữ có chứa 然 của bài. 却 cũng đúng ngữ pháp trong câu này nhưng không đáp ứng hình thức đang hỏi.";
    p.privateKeys.find((k) => k.id === p.exercises[2].keyRef)!.feedback +=
      " 却 cũng có thể dùng trong câu; bài này yêu cầu dạng hai chữ chứa 然, nên chọn 然而.";
  }
  if (id === "L4073") {
    p.alignment.topicReferences = [
      structuredClone(
        packages.find((p) => p.lesson.id === "L4077")!.alignment
          .topicReferences[0],
      ),
    ];
    p.alignment.sourceLocator = structuredClone(
      p.alignment.taskReferences[0].sourceLocator,
    );
    p.lesson.objectives[0] +=
      " Đọc thông báo ở khu dân cư và phân biệt ngày chụp ảnh với ngày thông báo.";
    const b = p.blocks.find(
      (b) => b.type === "teaching" && b.id.endsWith("-reading"),
    )!;
    assert(b.type === "teaching");
    b.hanzi =
      "社区活动室门口贴着照片和公告。公告说附近仓库着火，还用‘纸上的火着了’说明经过。照片上有‘此处无人’的旧标记，但照片太暗，无法看清号码。细心的居民仔细读日期，发现照片拍于前一天。社区管理员请居民区分照片日期与公告日期。不过，这张照片不能证明起火时有没有人。";
    b.pinyin =
      "Shè qū huó dòng shì mén kǒu tiē zhe zhào piàn hé gōng gào. Gōng gào shuō fù jìn cāng kù zháo huǒ, hái yòng ‘zhǐ shàng de huǒ zháo le’ shuō míng jīng guò. Zhào piàn shàng yǒu ‘cǐ chù wú rén’ de jiù biāo jì, dàn zhào piàn tài àn, wú fǎ kàn qīng hào mǎ. Xì xīn de jū mín zǐ xì dú rì qī, fā xiàn zhào piàn pāi yú qián yì tiān. Shè qū guǎn lǐ yuán qǐng jū mín qū fēn zhào piàn rì qī yǔ gōng gào rì qī. Bú guò, zhè zhāng zhào piàn bù néng zhèng míng qǐ huǒ shí yǒu méi yǒu rén.";
    b.meaning =
      "Cư dân đọc thông báo ở phòng sinh hoạt cộng đồng; người quản lý nhắc phân biệt ngày chụp ảnh với ngày thông báo. Ảnh hôm trước không chứng minh lúc cháy có người hay không. Đây là truyện hư cấu, không phải hướng dẫn ứng phó khẩn cấp.";
    p.privateKeys.find((k) => k.id === p.exercises[6].keyRef)!.feedback =
      "Ảnh được chụp hôm trước; không thể coi nó là bằng chứng đầy đủ về người có mặt lúc xảy ra sự việc. " +
      b.meaning;
  }
  if (id === "L4079") {
    p.exercises[0].prompt +=
      " Yêu cầu cụ thể: sơ đồ chỗ ngồi, chọn dạng một chữ của bài.";
  }
  if (id === "L49009") {
    const old = "有效 là tính từ, khác danh từ 效果.",
      replacement =
        "有效 nói có tác dụng/hiệu quả; trong câu này làm vị ngữ, còn 效果 gọi tên kết quả. Không dùng ghi chú này để khẳng định cách phân loại từ của mọi nguồn.";
    let changed = 0;
    for (const b of p.blocks)
      if (b.type === "teaching" && b.text.includes(old)) {
        b.text = b.text.replaceAll(old, replacement);
        changed++;
      }
    for (const k of p.privateKeys)
      if (k.feedback.includes(old)) {
        k.feedback = k.feedback.replaceAll(old, replacement);
        changed++;
      }
    assert(changed >= 2);
  }
  for (const [i, e] of p.exercises.entries()) {
    const old = e.id,
      key = p.privateKeys.find((k) => k.id === e.keyRef)!;
    e.id = `${prefix}-v${v}-e${i}`;
    e.keyRef = `${prefix}-v${v}-k${i}`;
    key.id = e.keyRef;
    key.exerciseVersionId = e.id;
    for (const b of p.blocks)
      if (b.type === "exercise" && b.exerciseVersionId === old)
        b.exerciseVersionId = e.id;
  }
  assert.deepEqual(p.concepts, original.concepts);
  p = packageSchema.parse(p);
  p.packageHash = contentHash(p);
  outputs.push(p);
}
for (const p of outputs) {
  assert(!fs.existsSync(`${dir}/${p.lesson.id}.v${p.lesson.version}.json`));
  assert.deepEqual(validatePackage(p, [...packages, ...outputs], evidence), []);
}
for (const p of outputs) {
  const row = catalog.lessons.find(
      (l: { key: string }) => l.key === p.lesson.id,
    ),
    original = packages.find((q) => q.lesson.versionId === row.currentVersion)!;
  const oldActivity = registry.activities.find(
    (a: { versionId: string }) => a.versionId === original.lesson.versionId,
  );
  if (oldActivity) {
    const a = structuredClone(oldActivity);
    a.versionId = p.lesson.versionId;
    a.sha256 = p.packageHash;
    a.characterItems = a.characterItems.map((x: { exerciseId: string }) => ({
      ...x,
      exerciseId:
        p.exercises[original.exercises.findIndex((e) => e.id === x.exerciseId)]
          .id,
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
  row.currentVersion = p.lesson.versionId;
}
for (const [file, data] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
  ["reviews.json", registry],
] as const)
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(data, null, 2) + "\n");
console.log(
  JSON.stringify({
    additiveFinalContentRepairs: outputs.map((p) => p.lesson.versionId),
    oldVersionsPreserved: true,
  }),
);
