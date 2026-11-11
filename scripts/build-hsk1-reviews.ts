// Original, assisted review contexts. Reuse exact origin concepts/cards, not word credit.
import fs from "node:fs";
import assert from "node:assert/strict";
import { localCurriculumUuid } from "../src/modules/curriculum/domain/local-identifiers";
import {
  loadDraftCatalog,
  currentDrafts,
  contentHash,
} from "../src/modules/content/application/catalog";
import {
  validatePackage,
  gradeContent,
  type ContentPackage,
} from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
type Item = [string, string, string, string, string]; // source lesson, word, original example, pinyin, VN
type Spec = {
  id: number;
  kind: "UNIT_REVIEW" | "CHARACTER_DIAGNOSTIC";
  title: string;
  items: Item[];
  passage: [string, string, string];
  question: string;
  answers: string[];
  chunks: string[];
  glyphs?: [string, string[]][];
};
const specs: Spec[] = [
  {
    id: 181,
    kind: "UNIT_REVIEW",
    title: "Ôn nhóm gặp gỡ: hỏi đúng và hiểu đúng lời đáp",
    items: [
      ["L101", "好", "好，我叫林。", "Hǎo, wǒ jiào Lín.", "Được, tôi tên Lâm."],
      ["L101", "不", "我不喝茶。", "Wǒ bù hē chá.", "Tôi không uống trà."],
      [
        "L102",
        "名字",
        "他的名字是文。",
        "Tā de míng zi shì Wén.",
        "Tên anh ấy là Văn.",
      ],
      [
        "L103",
        "她",
        "她不是安，她叫林。",
        "Tā bú shì Ān, tā jiào Lín.",
        "Cô ấy không phải An, cô ấy tên Lâm.",
      ],
      [
        "L104",
        "谢谢",
        "谢谢，我喜欢茶。",
        "Xiè xie, wǒ xǐ huan chá.",
        "Cảm ơn, tôi thích trà.",
      ],
      [
        "L105",
        "那个",
        "那个是你的茶吗？",
        "Nà ge shì nǐ de chá ma?",
        "Cái kia là trà của bạn phải không?",
      ],
    ],
    passage: [
      "A：请喝茶！\nB：谢谢！那个是你的茶吗？\nA：不是，那是林的茶。\nB：她喜欢茶吗？\nA：喜欢。",
      "A: Qǐng hē chá! B: Xiè xie! Nà ge shì nǐ de chá ma? A: Bú shì, nà shì Lín de chá. B: Tā xǐ huan chá ma? A: Xǐ huan.",
      "B hỏi về cốc trà kia. A nói đó là trà của Lâm và xác nhận cô ấy thích trà.",
    ],
    question: "Cái được chỉ bằng 那个 là trà của ai?",
    answers: ["林", "A", "B"],
    chunks: ["那", "是", "林的茶。"],
  },
  {
    id: 182,
    kind: "UNIT_REVIEW",
    title: "Ôn gia đình và số: phân biệt quan hệ với số đếm",
    items: [
      [
        "L106",
        "谁",
        "你姐姐是谁？",
        "Nǐ jiě jie shì shéi?",
        "Ai là chị gái của bạn?",
      ],
      [
        "L106",
        "我们",
        "我们认识你妈妈。",
        "Wǒ men rèn shi nǐ mā ma.",
        "Chúng tôi biết mẹ bạn.",
      ],
      [
        "L107",
        "爸爸",
        "他爸爸叫文。",
        "Tā bà ba jiào Wén.",
        "Bố anh ấy tên Văn.",
      ],
      [
        "L108",
        "姐姐",
        "我姐姐认识你。",
        "Wǒ jiě jie rèn shi nǐ.",
        "Chị gái tôi biết bạn.",
      ],
      ["L109", "四", "三、四、五。", "Sān, sì, wǔ.", "Ba, bốn, năm."],
      ["L110", "九", "八、九、十。", "Bā, jiǔ, shí.", "Tám, chín, mười."],
    ],
    passage: [
      "A：她是你妈妈吗？\nB：不是，她是我姐姐。\nA：她叫什么名字？\nB：她叫林。\nA：我认识她。",
      "A: Tā shì nǐ mā ma ma? B: Bú shì, tā shì wǒ jiě jie. A: Tā jiào shén me míng zi? B: Tā jiào Lín. A: Wǒ rèn shi tā.",
      "A hỏi có phải mẹ của B không. B sửa lại là chị gái tên Lâm; A nói biết cô ấy.",
    ],
    question: "Quan hệ nào được B xác nhận?",
    answers: ["姐姐", "妈妈", "妹妹"],
    chunks: ["我姐姐", "认识", "你。"],
  },
  {
    id: 183,
    kind: "UNIT_REVIEW",
    title: "Ôn đồ vật và quan hệ: dùng đúng lượng từ và đại từ",
    items: [
      [
        "L111",
        "书",
        "我喜欢那本书。",
        "Wǒ xǐ huan nà běn shū.",
        "Tôi thích quyển sách kia.",
      ],
      [
        "L111",
        "本",
        "这是我的一本书。",
        "Zhè shì wǒ de yì běn shū.",
        "Đây là một quyển sách của tôi.",
      ],
      ["L112", "字", "那个字是“女”。", "Nà ge zì shì “nǚ”.", "Chữ kia là 女."],
      [
        "L113",
        "有",
        "我妈妈有一本书。",
        "Wǒ mā ma yǒu yì běn shū.",
        "Mẹ tôi có một quyển sách.",
      ],
      [
        "L114",
        "爱",
        "我爱我爸爸和我妈妈。",
        "Wǒ ài wǒ bà ba hé wǒ mā ma.",
        "Tôi yêu thương bố và mẹ tôi.",
      ],
      [
        "L115",
        "它",
        "它不是你的狗，它是我的狗。",
        "Tā bú shì nǐ de gǒu, tā shì wǒ de gǒu.",
        "Nó không phải chó của bạn, nó là chó của tôi.",
      ],
    ],
    passage: [
      "A：这本书是你的吗？\nB：不是，是我姐姐的。\nA：你有书吗？\nB：有，我有三本书。",
      "A: Zhè běn shū shì nǐ de ma? B: Bú shì, shì wǒ jiě jie de. A: Nǐ yǒu shū ma? B: Yǒu, wǒ yǒu sān běn shū.",
      "Quyển được chỉ là của chị gái B. B có ba quyển sách riêng; không gộp hai thông tin thành một.",
    ],
    question: "B nói mình có bao nhiêu quyển sách?",
    answers: ["三本书", "一本书", "Không có sách"],
    chunks: ["我妈妈", "有", "一本书。"],
  },
  {
    id: 184,
    kind: "UNIT_REVIEW",
    title: "Ôn trường học và miêu tả: người học, nơi học, đặc điểm",
    items: [
      [
        "L116",
        "猫",
        "那只猫不是我的。",
        "Nà zhī māo bú shì wǒ de.",
        "Con mèo kia không phải của tôi.",
      ],
      [
        "L116",
        "小",
        "我的学校很小。",
        "Wǒ de xué xiào hěn xiǎo.",
        "Trường tôi nhỏ.",
      ],
      [
        "L117",
        "新",
        "那是我的新书。",
        "Nà shì wǒ de xīn shū.",
        "Kia là sách mới của tôi.",
      ],
      [
        "L118",
        "老师",
        "我认识你的老师。",
        "Wǒ rèn shi nǐ de lǎo shī.",
        "Tôi biết giáo viên của bạn.",
      ],
      [
        "L119",
        "小学生",
        "我弟弟也是小学生。",
        "Wǒ dì di yě shì xiǎo xué shēng.",
        "Em trai tôi cũng là học sinh tiểu học.",
      ],
      [
        "L120",
        "汉语",
        "我和我姐姐喜欢汉语。",
        "Wǒ hé wǒ jiě jie xǐ huan Hàn yǔ.",
        "Tôi và chị gái tôi thích tiếng Trung.",
      ],
    ],
    passage: [
      "A：你是小学生吗？\nB：不是，我是大学生。\nA：你弟弟呢？\nB：他是小学生。我们喜欢汉语。",
      "A: Nǐ shì xiǎo xué shēng ma? B: Bú shì, wǒ shì dà xué shēng. A: Nǐ dì di ne? B: Tā shì xiǎo xué shēng. Wǒ men xǐ huan Hàn yǔ.",
      "B là sinh viên đại học, em trai B học tiểu học. B nói cả hai thích tiếng Trung; không suy tuổi cụ thể.",
    ],
    question: "Ai được nói là 小学生?",
    answers: ["Em trai của B", "B", "Giáo viên của A"],
    chunks: ["我的学校", "很", "小。"],
  },
  {
    id: 196,
    kind: "CHARACTER_DIAGNOSTIC",
    title: "Chẩn đoán nhận diện sáu chữ đầu: có gợi ý, không chấm viết",
    items: [
      [
        "L101",
        "是",
        "那是我的朋友。",
        "Nà shì wǒ de péng you.",
        "Kia là bạn của tôi.",
      ],
      [
        "L102",
        "名字",
        "我姐姐的名字是林。",
        "Wǒ jiě jie de míng zi shì Lín.",
        "Tên chị gái tôi là Lâm.",
      ],
      ["L105", "这", "这不是茶。", "Zhè bú shì chá.", "Đây không phải trà."],
      ["L107", "家", "我爱我家。", "Wǒ ài wǒ jiā.", "Tôi yêu gia đình tôi."],
      [
        "L108",
        "姐姐",
        "我姐姐喜欢狗。",
        "Wǒ jiě jie xǐ huan gǒu.",
        "Chị gái tôi thích chó.",
      ],
      [
        "L115",
        "狗",
        "那是你姐姐的狗。",
        "Nà shì nǐ jiě jie de gǒu.",
        "Kia là chó của chị gái bạn.",
      ],
    ],
    glyphs: [
      ["是", ["足", "走", "定"]],
      ["名", ["各", "右", "石"]],
      ["这", ["文", "过", "还"]],
      ["家", ["字", "安", "室"]],
      ["姐", ["妹", "好", "如"]],
      ["狗", ["猫", "狼", "猪"]],
    ],
    passage: [
      "A：那是你的狗吗？\nB：不是，是我姐姐的。\nA：你姐姐叫什么名字？\nB：她叫林。",
      "A: Nà shì nǐ de gǒu ma? B: Bú shì, shì wǒ jiě jie de. A: Nǐ jiě jie jiào shén me míng zi? B: Tā jiào Lín.",
      "B xác nhận chó là của chị gái tên Lâm. Đoạn chỉ để luyện đọc hỗ trợ, không đánh giá nghe.",
    ],
    question: "Ai là chủ con chó trong đoạn?",
    answers: ["Chị gái của B", "A", "B"],
    chunks: ["那", "是", "我姐姐的狗。"],
  },
];
const continuationFile =
  "content/hsk24/hsk1-review-continuation.authoring.json";
if (fs.existsSync(continuationFile)) {
  const extra = JSON.parse(fs.readFileSync(continuationFile, "utf8")) as Spec[];
  for (const spec of extra) {
    assert(
      (spec.id >= 185 && spec.id <= 194) || (spec.id >= 197 && spec.id <= 199),
    );
    assert(["UNIT_REVIEW", "CHARACTER_DIAGNOSTIC"].includes(spec.kind));
    assert.equal(spec.items.length, 6);
    assert(!specs.some((s) => s.id === spec.id));
    specs.push(spec);
  }
}
const dir = "content/hsk24",
  read = (f: string) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json"),
  registry = read("reviews.json");
const { packages, evidence } = loadDraftCatalog(),
  current = currentDrafts(),
  outputs: ContentPackage[] = [];
const requested = process.argv[2] ? Number(process.argv[2]) : undefined;
if (requested !== undefined && !specs.some((s) => s.id === requested))
  throw Error("UNKNOWN_REVIEW_BATCH");
for (const spec of specs.filter(
  (s) => requested === undefined || s.id === requested,
)) {
  const id = `L${spec.id}`,
    prefix = id.toLowerCase();
  assert(
    !catalog.lessons.some((l: { key: string }) => l.key === id),
    "IMMUTABLE_REVIEW_EXISTS",
  );
  const selections = spec.items.map(([lesson, word]) => {
    const source = current.find((p) => p.lesson.id === lesson)!;
    assert(source);
    assert.equal(source.alignment.targetLevel, 1);
    const concept = source.concepts.find((c) => c.hanzi === word)!;
    assert(concept);
    return { source, concept };
  });
  const sources = [...new Set(selections.map((s) => s.source))],
    p = structuredClone(sources[0]);
  p.lesson = {
    ...p.lesson,
    id,
    version: 1,
    versionId: `${prefix}-draft-v1`,
    title: spec.title,
    estimatedMinutes: 20,
    objectives: [
      "Ôn các nghĩa đã học trong tình huống viết mới; không thêm từ mục tiêu.",
      "Bài nháp có hỗ trợ, không phải đề thi, không đo nghe/nói/viết tay hay cấp mastery.",
    ],
    prerequisites: sources.map((s) => s.lesson.versionId),
    newGrammarPatterns: [],
  };
  p.concepts = selections.map((s) => structuredClone(s.concept));
  p.exercises = [];
  p.privateKeys = [];
  for (const field of [
    "vocabularyReferences",
    "grammarReferences",
    "characterReferences",
    "topicReferences",
    "taskReferences",
  ] as const)
    p.alignment[field] = sources
      .flatMap((s) => s.alignment[field])
      .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i);
  const characterItems: { character: string; exerciseId: string }[] = [];
  const add = (
    i: number,
    type: ContentPackage["exercises"][number]["type"],
    prompt: string,
    choices: string[],
    accepted: string[],
    feedback: string,
    skill: ContentPackage["exercises"][number]["skill"] = "reading",
  ) => {
    const n = p.exercises.length,
      eid = `${prefix}-e${n}`,
      kid = `${prefix}-k${n}`,
      c = p.concepts[i];
    if (type === "choice") {
      assert.equal(new Set(choices).size, choices.length);
      const shift = (n + 1) % choices.length;
      choices = [...choices.slice(shift), ...choices.slice(0, shift)];
    }
    p.exercises.push({
      id: eid,
      version: 1,
      type,
      skill,
      conceptId: c.id,
      senseId: c.senseId,
      keyRef: kid,
      prompt,
      choices,
      inputHint: "Trả lời đúng phạm vi đề; không chấm văn viết tự do.",
      requiresAudio: false,
      mediaIds: [],
    });
    p.privateKeys.push({
      id: kid,
      version: 1,
      exerciseVersionId: eid,
      senseId: c.senseId,
      accepted,
      normalizerVersion:
        type === "choice"
          ? "exact-choice-v1"
          : type === "pinyin"
            ? "pinyin-nfc-tone-v1"
            : type === "sequence"
              ? "token-order-v1"
              : "hanzi-nfc-exact-v1",
      gradingVersion: "deterministic-content-v1",
      feedback,
    });
    return eid;
  };
  for (const [i, s] of selections.entries()) {
    const c = s.concept,
      example = spec.items[i][2];
    if (spec.glyphs) {
      const [glyph, others] = spec.glyphs[i];
      assert(c.hanzi.includes(glyph));
      assert(
        p.alignment.characterReferences.some(
          (r) => r.status === "VERIFIED" && r.written === glyph,
        ),
      );
      const eid = add(
        i,
        "choice",
        `Nhận diện chữ còn thiếu trong ${c.hanzi.replace(glyph, "□")} (${c.dictionaryPinyin}), nghĩa “${c.meaning}”. Chỉ chọn một chữ, giữ nguyên phần đã hiện.`,
        [glyph, ...others],
        [glyph],
        `Chữ cần chọn là ${glyph}; bài có gợi ý từ/pinyin, không đo viết tay hay nhớ độc lập.`,
        "recognition",
      );
      characterItems.push({ character: glyph, exerciseId: eid });
    } else if (i % 3 === 0)
      add(
        i,
        "pinyin",
        `Ghi pinyin từ điển của ${c.hanzi} theo nghĩa “${c.meaning}”. Ví dụ mới: ${example}`,
        [],
        c.hanzi === "谁" ? ["shéi", "shuí"] : [c.dictionaryPinyin],
        `Mục từ ghi ${c.dictionaryPinyin}; cách đọc trong câu có thể có biến điệu.`,
        "pinyin",
      );
    else if (i % 3 === 1)
      add(
        i,
        "short",
        `Điền đúng mục từ đọc ${c.dictionaryPinyin}, nghĩa “${c.meaning}”: ${example.replace(c.hanzi, "□")} Chỉ nhập mục từ được hỏi, không chấm mọi cách diễn đạt ngoài đề.`,
        [],
        [c.hanzi],
        `Điền ${c.hanzi}. ${spec.items[i][4]}`,
      );
    else
      add(
        i,
        "choice",
        `Trong câu mới “${example}”, ${c.hanzi} mang nghĩa nào theo bài?`,
        p.concepts.map((c) => c.meaning),
        [c.meaning],
        `${c.hanzi}: ${c.meaning}. ${spec.items[i][4]}`,
      );
  }
  add(
    0,
    "choice",
    spec.question,
    spec.answers,
    [spec.answers[0]],
    spec.passage[2],
  );
  p.exercises.at(-1)!.evidenceScope = "CONTEXT_ONLY";
  add(
    0,
    "sequence",
    `Xếp các cụm thành câu mẫu đã nhắc, bắt đầu bằng “${spec.chunks[0]}”; không tách cụm hoặc thêm từ.`,
    spec.chunks,
    [spec.chunks.map((_, i) => i).join(",")],
    `Câu: ${spec.chunks.join("")}`,
  );
  p.exercises.at(-1)!.evidenceScope = "CONTEXT_ONLY";
  p.blocks = [
    {
      id: `${prefix}-guide`,
      type: "teaching",
      title: "Ôn có hỗ trợ",
      text: "Thử nhớ rồi đọc lại phần nhắc. Đây là ngữ cảnh mới của các nghĩa đã học; hoàn tất luyện không xác nhận mastery. Nhận diện chữ có lựa chọn khác với viết tay. Các từ hỗ trợ đều đã gặp trong nhóm trước.",
      hanzi: "",
      pinyin: "",
      meaning: "",
      readingMinutes: 1,
    },
    ...spec.items.map((item, i) => ({
      id: `${prefix}-reminder${i}`,
      type: "teaching" as const,
      title: `${p.concepts[i].hanzi} · ${p.concepts[i].meaning}`,
      text: `Nhắc nghĩa đã học: ${p.concepts[i].meaning}. Đọc ví dụ mới, phân biệt với các mục còn lại; không đổi nghĩa gốc hay thẻ ôn.`,
      hanzi: item[2],
      pinyin: item[3],
      meaning: item[4],
      readingMinutes: 1,
    })),
    {
      id: `${prefix}-reading`,
      type: "teaching",
      title: "Tình huống ôn mới",
      text: "Đọc toàn bộ lời đáp, kể cả phần phủ định. Đây là đọc chữ, chưa có audio tham chiếu được duyệt.",
      hanzi: spec.passage[0],
      pinyin: spec.passage[1],
      meaning: spec.passage[2],
      readingMinutes: 2,
    },
    ...p.exercises.map((e, i) => ({
      id: `${prefix}-b${i}`,
      type: "exercise" as const,
      exerciseVersionId: e.id,
    })),
  ];
  if (spec.kind === "CHARACTER_DIAGNOSTIC")
    p.unit = structuredClone(
      current.find((p) => p.lesson.id === spec.items.at(-1)![0])!.unit,
    );
  p.packageHash = contentHash(p);
  outputs.push(p);
  registry.activities.push({
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
    kind: spec.kind,
    sourceVersions: sources.map((s) => s.lesson.versionId),
    origins: Object.fromEntries(
      selections.map((s) => [
        s.concept.id,
        {
          versionId: s.source.lesson.versionId,
          sha256: s.source.packageHash,
          file: manifest.packages.find(
            (m: { versionId: string }) =>
              m.versionId === s.source.lesson.versionId,
          ).file,
        },
      ]),
    ),
    characterItems,
    scope:
      "Six exact taught senses in original written review contexts; assisted only, zero new vocabulary; no oral, handwriting or comprehensive exam claim.",
  });
  const sourceLesson = catalog.lessons.find(
    (l: { currentVersion: string }) =>
      l.currentVersion ===
      (spec.kind === "CHARACTER_DIAGNOSTIC"
        ? current.find((p) => p.lesson.id === spec.items.at(-1)![0])!.lesson
            .versionId
        : sources[0].lesson.versionId),
  );
  catalog.lessons.push({
    ...sourceLesson,
    id: localCurriculumUuid(spec.id),
    key: id,
    currentVersion: p.lesson.versionId,
    order:
      1 +
      Math.max(
        ...catalog.lessons
          .filter((l: { unitId: string }) => l.unitId === sourceLesson.unitId)
          .map((l: { order: number }) => l.order),
      ),
  });
}
for (const p of outputs) {
  assert.deepEqual(validatePackage(p, [...packages, ...outputs], evidence), []);
  for (const e of p.exercises) {
    const a = p.privateKeys.find((k) => k.id === e.keyRef)!.accepted[0];
    assert(
      gradeContent(
        p,
        e.id,
        e.type === "choice"
          ? { choice: e.choices.indexOf(a) }
          : e.type === "sequence"
            ? { order: a.split(",").map(Number) }
            : { text: a },
      ).correct,
    );
  }
}
for (const p of outputs) {
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
for (const [file, data] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
  ["reviews.json", registry],
] as const)
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(data, null, 2) + "\n");
console.log(
  `${outputs.length} HSK1 assisted review activities/${outputs.length * 8} exercises; zero new vocabulary.`,
);
