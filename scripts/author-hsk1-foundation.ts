// Additive local foundation bridge; existing F01/F02/L001/L002 are never edited.
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
import { PINYIN_NORMALIZER } from "../src/modules/content/domain/pinyin";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const dir = "content/hsk24",
  read = (f: string) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json");
const { packages, evidence } = loadDraftCatalog();
const definitions = [
  {
    id: "F03",
    slug: "hsk-one-initials",
    title: "Ghép âm đầu với vần: đọc pinyin từng bước",
    prereq: "f02-draft-v1",
    intro:
      "Mục tiêu là tiếng Phổ thông với chữ giản thể. Pinyin ghi âm, chữ Hán ghi đơn vị ngôn ngữ, nghĩa Việt giúp hiểu; ba phần không thay thế nhau. Quay lại các hình minh họa và hộp gợi ý của F01/F02 khi cần; không cần bật âm thanh để tiếp tục.",
    notes: [
      "Bắt đầu từ m/n trong F01 rồi học theo nhóm: b p m f; d t n l; g k h; j q x; zh ch sh r; z c s. Đây là 21 phụ âm đầu thường được học. y/w còn tham gia cách viết âm tiết không có phụ âm đầu; đừng đọc chúng như chữ Việt rồi tự suy cả âm tiết.",
      "b/p, d/t, g/k, j/q, zh/ch, z/c khác nhau về cách bật hơi; không chỉ là b/p hay đ/t tiếng Việt. Đặt tờ giấy trước miệng có thể giúp quan sát hơi khi tự thử, nhưng ứng dụng không chấm tờ giấy hay xác nhận phát âm. Dùng diagram/gợi ý đã có trong F01 và coach pinyin để quan sát vị trí môi, lưỡi.",
      "j q x đi với nhóm vần i/ü; zh ch sh r và z c s cần quan sát vị trí lưỡi khác. Không thêm một nguyên âm Việt vào sau phụ âm khi ghép. Nhìn jī = j + i, qī = q + i; hãy giữ cả dấu thanh, không chỉ phần chữ.",
      "Luyện bằng chữ dưới đây kiểm tra ký hiệu và cách ghép, không kiểm tra nghe hay phát âm. Nút TTS nếu có chỉ dùng giọng zh-CN cục bộ, tổng hợp/chưa duyệt; thiếu giọng thì bỏ qua. Không cần dịch vụ trả phí.",
    ],
    words: [
      ["八", "bā", "ví dụ âm b + a, thanh 1"],
      ["怕", "pà", "ví dụ âm p + a, thanh 4"],
      ["大", "dà", "ví dụ d + a, thanh 4"],
      ["他", "tā", "ví dụ t + a, thanh 1"],
      ["鸡", "jī", "ví dụ j + i, thanh 1"],
      ["七", "qī", "ví dụ q + i, thanh 1"],
    ],
    question: "Trong qī, phần đầu viết bằng chữ nào?",
    choices: ["q", "i", "k"],
    answer: "q",
    tokens: ["qī", "=", "q", "+ i"],
    conclusion:
      "Giữ thứ tự âm đầu + vần và dấu thanh; chưa kết luận đã phát âm đúng.",
  },
  {
    id: "F04",
    slug: "hsk-one-finals",
    title: "Vần, ü và cách viết âm tiết",
    prereq: "f03-draft-v1",
    intro:
      "Ôn các dấu ā á ǎ à trong F02. Học từng nhóm vần nhỏ, không cố đọc thuộc cả bảng trong một lần. Ví dụ chữ ở đây là minh họa phát âm, không tự cộng vào coverage từ vựng HSK1.",
    notes: [
      "Nhóm nguyên âm cơ bản: a o e i u ü. Các vần ghép thường gặp: ai ei ao ou; ia ie iao iu; ua uo uai ui; üe. Các nhóm có âm cuối mũi: an en ang eng ong; ian in iang ing iong; uan un uang; üan ün. er là một trường hợp riêng. Đây là bảng định hướng để quay lại tra, không phải bài chứng nhận đã sử dụng mọi tổ hợp.",
      "ü giữ môi tròn nhưng vị trí lưỡi gần i; khác u. Sau n/l, dấu hai chấm cần giữ: nǚ, lǜ. Sau j/q/x, hai chấm được lược theo chính tả: qù thuộc nhóm ü nhưng viết qù, không viết qǜ trong cách viết chuẩn. Dùng các minh họa u/ü và ju của coach F01 để đối chiếu, không đoán từ dấu Latin tiếng Việt.",
      "Một số cách viết rút gọn: iou viết iu khi theo âm đầu (liú); uei viết ui (shuǐ); uen viết un theo quy tắc chính tả. Dấu vẫn đặt theo F02: liú trên u, shuǐ trên i. Khi không có phụ âm đầu, y/w giúp ghi âm tiết: yi, wu, yu; đừng tính chúng thành một bộ thanh mới.",
      "Pinyin trên thẻ là dạng từ điển. 一 ghi yī, 不 ghi bù; trong lời nói chúng có thể biến điệu tùy âm sau. Chuỗi thanh 3 như 你好 thường được thực hiện khác hai thanh 3 đứng riêng. Coach F02 có minh họa; bài chữ không chấm biến điệu. Âm thanh tổng hợp chỉ để tham khảo.",
    ],
    words: [
      ["女", "nǚ", "giữ ü sau n"],
      ["去", "qù", "ü sau q được viết u theo chính tả"],
      ["书", "shū", "u sau sh, khác nhóm ü"],
      ["水", "shuǐ", "vần ui và dấu trên i"],
      ["二", "èr", "vần er, không tách thành hai âm tiết"],
      ["一", "yī", "cách ghi từ điển; chưa chấm biến điệu"],
    ],
    question: "Pinyin chuẩn của 去 trong ví dụ này là gì?",
    choices: ["qù", "qǜ", "chù"],
    answer: "qù",
    tokens: ["水", "đọc là", "shuǐ", "(dấu trên i)"],
    conclusion:
      "Giữ chính tả và thanh từ điển; không dùng kết quả chữ để suy điểm nghe/nói.",
  },
  {
    id: "F05",
    slug: "hsk-one-reading-bridge",
    title: "Từ chữ Hán đến câu đầu tiên và cách nhập bài",
    prereq: "f04-draft-v1",
    intro:
      "Một chữ Hán thường ghi một âm tiết; một từ có thể có một hoặc nhiều chữ. 你 là một chữ, 你好 có hai chữ và là một mục từ/lời chào. Không ghép nghĩa từng chữ máy móc để đoán mọi từ. Học chữ giản thể trong khóa này; không suy các dạng gần nhau là cùng một chữ.",
    notes: [
      "Nhìn số nét và phần cấu tạo: 一 một nét ngang; 人 có hai nét chính; 大 thêm nét ngang so với 人; 口 là khung kín; 日 có thêm nét trong; 我 phức tạp hơn nên nhận diện toàn hình trước. Đây là mô tả để nhận diện, không phải bộ chấm nét viết hay xác nhận thứ tự nét của mọi chữ.",
      "Thử viết tay trên giấy: từ trái sang phải, trên xuống dưới là các nguyên tắc hay gặp, có ngoại lệ; cần tra mẫu cụ thể khi chưa rõ. Bài lựa chọn hình không đo viết tay. Danh mục viết dùng chung HSK1–2 có100 chữ, khác danh mục nhận diện246 chữ của HSK1; chỉ làm bài nhận diện không hoàn thành yêu cầu viết.",
      "Câu đơn bắt đầu từ người + hành động + đối tượng: 我喝茶 = tôi + uống + trà. Câu 我叫安 = tôi + tên là + An. Giữ thứ tự, không đưa tân ngữ lên đầu tùy ý. L001/L002 sẽ cho hội thoại ngắn, câu hỏi lại và phản hồi từng bước; không cần học thuật ngữ ngữ pháp trước khi hiểu ví dụ.",
      "Cách làm bài: với câu lựa chọn, bấm một phương án; với pinyin có thể gõ dấu hoặc số như ni3. Khi đề yêu cầu chữ Hán, bật bàn phím pinyin của máy, gõ rồi chọn đúng chữ; có thể dùng sao chép để luyện có hỗ trợ, nhưng đó không phải bằng chứng nhớ độc lập. Không nhập nghĩa Việt vào ô chữ Hán. Chỉ báo đã lưu khi server xác nhận; đóng/mở lại để tiếp tục phiên cũ.",
      "Sau bài này, đi đến L001 rồi L002 và phần mở rộng HSK1. DRAFT cho phép luyện theo thứ tự, không tự biến việc bấm hoàn tất thành mastery hay điều kiện tiên quyết đã kiểm chứng. Today còn ưu tiên thẻ FSRS đến hạn; phiên đang dở vẫn được giữ.",
    ],
    words: [
      ["一", "yī", "nhận diện một nét ngang"],
      ["人", "rén", "nhận diện hai nét chính"],
      ["大", "dà", "phân biệt 大 với 人"],
      ["口", "kǒu", "nhận diện khung kín"],
      ["日", "rì", "phân biệt 日 với 口"],
      ["我", "wǒ", "chủ thể tôi trong câu 我喝茶"],
    ],
    question:
      "Sau khi làm lựa chọn hình chữ, có thể kết luận đã viết tay đúng chưa?",
    choices: [
      "Chưa; đó là kỹ năng khác",
      "Có, tự động đạt viết tay",
      "Có, tự động đạt phát âm",
    ],
    answer: "Chưa; đó là kỹ năng khác",
    tokens: ["我", "喝", "茶", "。"],
    conclusion:
      "我喝茶 theo thứ tự người–hành động–đối tượng. Kết quả nháp không chứng minh năng lực viết hay phát âm.",
  },
];
const outputs: ContentPackage[] = [];
for (const d of definitions) {
  assert(!catalog.lessons.some((l: { key: string }) => l.key === d.id));
  const p = structuredClone(packages.find((p) => p.lesson.id === "F02")!);
  const prefix = d.id.toLowerCase();
  p.state = "DRAFT";
  p.packageHash = "0".repeat(64);
  p.unit.id = d.slug;
  p.lesson = {
    ...p.lesson,
    id: d.id,
    version: 1,
    versionId: `${prefix}-draft-v1`,
    title: d.title,
    prerequisites: [d.prereq],
    objectives: [d.intro, d.conclusion],
    newGrammarPatterns: [],
  };
  p.alignment = {
    ...p.alignment,
    alignmentEvidence: [
      "Original supplementary foundation; no official vocabulary/skill completion claim.",
    ],
    alignmentCheckedAt: new Date().toISOString(),
  };
  p.concepts = d.words.map((w, i) => ({
    id: `${prefix}-c${i}`,
    version: 1,
    senseId: `${prefix}-sense${i}`,
    hanzi: w[0],
    dictionaryPinyin: w[1],
    meaning: w[2],
    skills: ["pinyin", "reading"],
    referenceIds: [],
    scope: "FOUNDATION_INTERNAL",
  }));
  p.exercises = [];
  p.privateKeys = [];
  const teach = (
    id: string,
    title: string,
    text: string,
    hanzi = "",
    pinyin = "",
    meaning = "",
  ): ContentPackage["blocks"][number] => ({
    id,
    type: "teaching",
    title,
    text,
    hanzi,
    pinyin,
    meaning,
    readingMinutes: 1,
  });
  p.blocks = [
    teach(`${prefix}-intro`, "Cách học bài này", d.intro),
    ...d.notes.map((n, i) => teach(`${prefix}-note${i}`, `Bước ${i + 1}`, n)),
    ...d.words.map((w, i) =>
      teach(`${prefix}-word${i}`, `${w[0]} · ${w[1]}`, w[2], w[0], w[1], w[2]),
    ),
  ];
  for (let i = 0; i < 8; i++) {
    const ci = i < 6 ? i : 0,
      key = `${prefix}-v1-k${i}`,
      id = `${prefix}-v1-e${i}`,
      w = d.words[ci];
    const type = i < 6 ? "pinyin" : i === 6 ? "choice" : "sequence";
    p.exercises.push({
      id,
      version: 1,
      type,
      skill: i < 6 ? "pinyin" : "reading",
      conceptId: p.concepts[ci].id,
      senseId: p.concepts[ci].senseId,
      keyRef: key,
      prompt:
        i < 6
          ? `Theo ví dụ ${w[0]} (${w[2]}), nhập pinyin được ghi trong bài. Đây là bài ký hiệu, không phải chấm phát âm.`
          : i === 6
            ? d.question
            : "Ghép các cụm theo thứ tự đã giải thích, giữ nguyên cụm.",
      choices: i < 6 ? [] : i === 6 ? d.choices : d.tokens,
      inputHint: i < 6 ? "Dấu thanh hoặc số; không thu âm." : "",
      requiresAudio: false,
      mediaIds: [],
      ...(i >= 6 ? { evidenceScope: "CONTEXT_ONLY" as const } : {}),
    });
    p.privateKeys.push({
      id: key,
      version: 1,
      exerciseVersionId: id,
      senseId: p.concepts[ci].senseId,
      accepted: [i < 6 ? w[1] : i === 6 ? d.answer : "0,1,2,3"],
      normalizerVersion:
        i < 6
          ? PINYIN_NORMALIZER
          : i === 6
            ? "exact-choice-v1"
            : "token-order-v1",
      gradingVersion: "deterministic-content-v1",
      feedback:
        i < 6
          ? `${w[0]} ghi ${w[1]}: ${w[2]}. Chỉ xác nhận biểu diễn chữ, chưa xác nhận âm thực tế.`
          : d.conclusion,
    });
    p.blocks.push({
      id: `${prefix}-b${i}`,
      type: "exercise",
      exerciseVersionId: id,
    });
  }
  const parsed = packageSchema.parse(p);
  parsed.packageHash = contentHash(parsed);
  outputs.push(parsed);
}
for (const p of outputs)
  assert.deepEqual(validatePackage(p, [...packages, ...outputs], evidence), []);
for (const p of outputs) {
  const n = Number(p.lesson.id.slice(1)),
    id = `63000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const prev = catalog.lessons.find(
    (l: { currentVersion: string }) =>
      l.currentVersion === p.lesson.prerequisites[0],
  );
  const priorNew = outputs.find(
    (q) => q.lesson.versionId === p.lesson.prerequisites[0],
  );
  const priorId =
    prev?.unitId ??
    `63000000-0000-4000-8000-${String(Number(priorNew!.lesson.id.slice(1))).padStart(12, "0")}`;
  catalog.units.push({
    id,
    slug: p.unit.id,
    courseId: catalog.courses[0].id,
    order: n - 1,
    title: p.lesson.title,
    objective: p.lesson.objectives[0],
    prerequisites: [priorId],
    availability: "PRACTICE_ONLY",
  });
  catalog.lessons.push({
    id,
    key: p.lesson.id,
    unitId: id,
    order: 0,
    currentVersion: p.lesson.versionId,
    localDraftAllowed: true,
    requirements: [],
  });
  const file = `${p.lesson.id}.v1.json`;
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(p, null, 2) + "\n", {
    flag: "wx",
  });
  manifest.packages.push({
    file,
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
  });
}
fs.writeFileSync(
  `${dir}/catalog.json`,
  JSON.stringify(catalog, null, 2) + "\n",
);
fs.writeFileSync(
  `${dir}/manifest.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  "Added F03–F05:3 original foundation bridges,24 written exercises; old versions and vocabulary coverage unchanged.",
);
