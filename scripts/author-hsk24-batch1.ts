// Original bounded teaching batch. Does not grant review/publication approval.
import fs from "node:fs";
import { contentHash } from "../src/modules/content/application/catalog";
import {
  packageSchema,
  type SourceReference,
} from "../src/modules/content/domain/package";
const dir = "content/hsk24";
fs.mkdirSync(dir, { recursive: true });
const write = (file: string, data: unknown) =>
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(data, null, 2) + "\n");
const sourceHash =
  "ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941";
const sourceUrl = "https://hsk.cn-bj.ufileos.com/3.0/新版HSK考试大纲1219.pdf";
function ref(
  id: string,
  kind: SourceReference["kind"],
  written: string,
  page: number,
  entry: string,
  ordinal: number | null = null,
  pinyin: string | null = null,
): SourceReference {
  return {
    id,
    kind,
    status: "VERIFIED",
    officialLevel: 2,
    sourceLocator: {
      pdfIndex: page,
      physicalPage: page + 1,
      printedPage: page - 2,
      section: kind,
      entry,
    },
    written,
    pinyin,
    senseId: kind === "vocabulary" ? `${id}-sense` : null,
    ordinal,
    note: "Exact pinned PDF entry/reading/category observed. Vietnamese teaching interpretation and sense restriction are original DRAFT, not human approved.",
  };
}
const batches = [
  {
    id: "L201",
    title: "Chọn đồ dùng: màu sắc và chiều dài",
    slug: "school-shopping",
    unit: "Chọn đồ dùng học tập",
    objective: "Đọc mô tả đồ dùng và so sánh chiều dài bằng 比.",
    words: [
      ["白色", "báisè", "màu trắng", 303, 86],
      ["本子", "běnzi", "vở ghi", 308, 86],
      [
        "笔",
        "bǐ",
        "bút (danh từ; không dùng nghĩa lượng từ cấp cao hơn)",
        310,
        86,
      ],
      ["长", "cháng", "dài (không phải cách đọc zhǎng)", 314, 86],
    ],
    grammar: ref(
      "h2-g-compare",
      "grammar",
      "A比B+形容词",
      389,
      "特殊句式 / 比较句1 / (1)",
    ),
    task: ref("h2-task-objects", "task", "问答物品情况", 8, "三"),
    topic: ref(
      "h2-topic-objects",
      "topic",
      "物品信息",
      60,
      "基本信息 / 物品信息",
    ),
    chars: [
      ref("h2-char-bi", "character", "笔", 357, "5", 5),
      ref("h2-char-chang", "character", "长", 357, "116", 116),
    ],
    teaching: [
      [
        "Chọn vở và bút",
        "白色 chỉ màu trắng. 本子 là vở; khi đếm dùng 一本本子. 笔 ở đây là danh từ ‘bút’, dùng 一支笔. 支 (zhī) là lượng từ bổ sung SUPPLEMENTARY cho vật thon dài; chưa xác minh cấp trong syllabus, không tính vào 200 mục từ HSK2. 长 đọc cháng khi nói chiều dài. Không đổi thành zhǎng trong nghĩa này.",
        "这是白色的本子。这支笔很长。",
        "Zhè shì báisè de běnzi. Zhè zhī bǐ hěn cháng.",
        "Đây là vở màu trắng. Cây bút này dài.",
      ],
      [
        "So sánh hai vật",
        "Đặt vật A trước 比, vật B sau 比, rồi tính từ: A 比 B 长. Muốn nói A dài hơn B, không thêm 很 trước 长 trong mẫu này. Đảo A và B sẽ đảo ý so sánh. Chỉ dùng nghĩa dài của 长.",
        "这支笔比那支笔长。",
        "Zhè zhī bǐ bǐ nà zhī bǐ cháng.",
        "Cây bút này dài hơn cây bút kia.",
      ],
      [
        "Đọc trong cửa hàng",
        "Đọc câu hỏi để phân biệt chọn màu với so sánh chiều dài. Ở câu trả lời cuối, người mua chọn cây dài hơn, chưa có thông tin về giá. Không tự suy ra cây dài hơn đắt hơn.",
        "甲：你要什么颜色的本子？乙：我要白色的。甲：这支笔比那支笔长。乙：我要这支。",
        "Jiǎ: Nǐ yào shénme yánsè de běnzi? Yǐ: Wǒ yào báisè de. Jiǎ: Zhè zhī bǐ bǐ nà zhī bǐ cháng. Yǐ: Wǒ yào zhè zhī.",
        "A: Bạn muốn vở màu gì? B: Tôi muốn màu trắng. A: Cây bút này dài hơn cây kia. B: Tôi muốn cây này.",
      ],
    ],
    questions: [
      [
        0,
        "Trong đoạn đọc, người mua muốn vở màu gì?",
        ["Màu trắng", "Màu đen", "Chưa nói màu"],
        "Màu trắng",
        "白色 là màu trắng; đoạn đọc có 我要白色的.",
      ],
      [
        3,
        "这支笔比那支笔长 cho biết điều gì?",
        [
          "Cây này dài hơn cây kia",
          "Cây kia dài hơn cây này",
          "Hai cây dài bằng nhau",
        ],
        "Cây này dài hơn cây kia",
        "Vật đứng trước 比 là vật có chiều dài lớn hơn trong câu này.",
      ],
      [
        2,
        "Trong 一支笔, 笔 thuộc nghĩa nào?",
        ["Bút, danh từ", "Lượng từ cho khoản tiền", "Vở ghi"],
        "Bút, danh từ",
        "Bài chỉ dạy nghĩa danh từ bǐ. Nghĩa lượng từ chưa thuộc phạm vi bài.",
      ],
    ],
    sequence: [
      "Xếp câu: cây bút này dài hơn cây bút kia.",
      ["长", "那支笔", "这支笔", "比"],
      "2,3,1,0",
    ],
    short: [
      "Chỉ nhập từ tiếng Trung có nghĩa ‘vở ghi’, không viết cả câu.",
      "本子",
    ],
  },
  {
    id: "L202",
    title: "Đến ga: chọn tàu điện hay xe buýt",
    slug: "travel-choice",
    unit: "Chọn cách đi lại",
    objective: "Đọc và trả lời câu hỏi chọn phương tiện bằng 还是.",
    words: [
      ["车站", "chēzhàn", "ga hoặc trạm xe theo ngữ cảnh", 315, 86],
      ["地铁", "dìtiě", "tàu điện ngầm", 335, 87],
      ["公交车", "gōngjiāochē", "xe buýt công cộng", 346, 87],
      ["打车", "dǎchē", "bắt taxi hoặc gọi xe để đi", 328, 87],
    ],
    grammar: ref(
      "h2-g-alternative",
      "grammar",
      "用“还是”连接的选择问句",
      389,
      "句类 / 疑问句",
    ),
    task: ref("h2-task-choice", "task", "日常言语交往", 9, "六 / 做出选择"),
    topic: ref(
      "h2-topic-transport",
      "topic",
      "出行方式",
      60,
      "日常生活 / 交通出行 / 出行方式",
    ),
    chars: [
      ref("h2-char-zhan", "character", "站", 357, "115", 115),
      ref("h2-char-tie", "character", "铁", 357, "86", 86),
    ],
    teaching: [
      [
        "Phương tiện và điểm đến",
        "车站 là ga/trạm xe, cần đọc ngữ cảnh để biết loại trạm. 地铁 là tàu điện ngầm; 公交车 là xe buýt công cộng. Nói 坐地铁, 坐公交车. 打车 tự mang nghĩa bắt taxi/gọi xe; không hiểu thành ‘đánh xe’.",
        "我们坐地铁去车站。他打车去。",
        "Wǒmen zuò dìtiě qù chēzhàn. Tā dǎchē qù.",
        "Chúng tôi đi tàu điện ngầm đến ga. Anh ấy đi bằng taxi/xe gọi.",
      ],
      [
        "Hỏi chọn một phương án",
        "Dùng 还是 để đưa hai phương án trong câu hỏi. 你坐地铁还是坐公交车？ hỏi người nghe chọn cách nào; trả lời trực tiếp một phương án. Không cần thêm 吗 ở cuối câu hỏi lựa chọn này. Bài chỉ dạy 还是 trong câu hỏi lựa chọn, không dạy mọi nghĩa của từ.",
        "你坐地铁还是坐公交车？我坐地铁。",
        "Nǐ zuò dìtiě háishi zuò gōngjiāochē? Wǒ zuò dìtiě.",
        "Bạn đi tàu điện ngầm hay xe buýt? Tôi đi tàu điện ngầm.",
      ],
      [
        "Đọc tin nhắn hẹn đi",
        "Chú ý phân biệt kế hoạch của người nói và người được nhắc tới. Hai người chọn tàu điện ngầm, còn anh trai đi bằng taxi/xe gọi. Đoạn văn không cung cấp giá vé hay thời gian đến.",
        "甲：我们怎么去车站？坐地铁还是坐公交车？乙：坐地铁吧。甲：好。我哥哥打车去。",
        "Jiǎ: Wǒmen zěnme qù chēzhàn? Zuò dìtiě háishi zuò gōngjiāochē? Yǐ: Zuò dìtiě ba. Jiǎ: Hǎo. Wǒ gēge dǎchē qù.",
        "A: Chúng ta đến ga thế nào? Tàu điện ngầm hay xe buýt? B: Đi tàu điện ngầm nhé. A: Được. Anh trai tôi đi taxi/xe gọi.",
      ],
    ],
    questions: [
      [
        1,
        "Trong tin nhắn, hai người chọn phương tiện nào?",
        ["Tàu điện ngầm", "Xe buýt", "Taxi"],
        "Tàu điện ngầm",
        "乙 nói 坐地铁吧 và 甲 đồng ý 好. 打车 là cách anh trai đi.",
      ],
      [
        3,
        "我哥哥打车去 cho biết anh trai đi bằng cách nào?",
        ["Bắt taxi/gọi xe", "Tự lái xe buýt", "Đi bộ"],
        "Bắt taxi/gọi xe",
        "打车 là một cách nói đi bằng taxi/xe gọi, không phải đánh vào chiếc xe.",
      ],
      [
        2,
        "Câu nào hỏi lựa chọn giữa tàu điện ngầm và xe buýt?",
        ["你坐地铁还是坐公交车？", "你坐地铁还是坐公交车吗？", "你坐地铁。"],
        "你坐地铁还是坐公交车？",
        "还是 nối hai phương án trong câu hỏi lựa chọn; mẫu đang học không thêm 吗.",
      ],
    ],
    sequence: [
      "Xếp câu hỏi: bạn đi tàu điện ngầm hay xe buýt?",
      ["还是", "你", "坐公交车", "坐地铁"],
      "1,3,0,2",
    ],
    short: ["Chỉ nhập từ tiếng Trung có nghĩa ‘tàu điện ngầm’.", "地铁"],
  },
];
const evidence: SourceReference[] = [];
const manifest: { file: string; versionId: string; sha256: string }[] = [];
const catalog = JSON.parse(
  fs.readFileSync("content/curriculum/catalog.v1.json", "utf8"),
);
catalog.courses[2].releaseRef = "local-development-phase4";
catalog.courses[2].availability = "PRACTICE_ONLY";
catalog.courses[2].description =
  "Batch cục bộ: đồ dùng và đi lại. 8/200 mục từ mới có bài nháp; chưa phải toàn cấp HSK2.";
for (const [index, b] of batches.entries()) {
  const prefix = b.id.toLowerCase();
  const vocab = b.words.map(([h, p, , ordinal, page]) =>
    ref(
      `${prefix}-v-${ordinal}`,
      "vocabulary",
      String(h),
      Number(page),
      `ordinal ${ordinal}`,
      Number(ordinal),
      String(p),
    ),
  );
  evidence.push(...vocab, b.grammar, b.task, b.topic, ...b.chars);
  const spaced: Record<string, string> = {
    白色: "bái sè",
    本子: "běn zi",
    车站: "chē zhàn",
    地铁: "dì tiě",
    公交车: "gōng jiāo chē",
    打车: "dǎ chē",
  };
  const concepts = b.words.map(([h, p, m], i) => ({
    id: `${prefix}-c${i}`,
    version: 1,
    senseId: vocab[i].senseId!,
    hanzi: String(h),
    dictionaryPinyin: spaced[String(h)] ?? String(p),
    meaning: String(m),
    skills: ["recognition", "reading", "pinyin"],
    referenceIds: [vocab[i].id],
    scope: "TARGET",
  }));
  const exercises: unknown[] = [],
    privateKeys: unknown[] = [];
  function exercise(
    i: number,
    type: string,
    prompt: string,
    choices: string[],
    accepted: string,
    normalizer: string,
    feedback: string,
  ) {
    if (type === "choice") {
      const shift = (exercises.length + 1) % choices.length;
      choices = [...choices.slice(shift), ...choices.slice(0, shift)];
    }
    const n = exercises.length,
      id = `${prefix}-v1-e${n}`,
      key = `${prefix}-v1-k${n}`;
    exercises.push({
      id,
      version: 1,
      type,
      skill: type === "pinyin" ? "pinyin" : "reading",
      conceptId: concepts[i].id,
      senseId: concepts[i].senseId,
      keyRef: key,
      prompt,
      choices,
      inputHint:
        type === "short"
          ? "Chỉ nhập đúng từ được hỏi; không chấm bài viết tự do."
          : "",
      requiresAudio: false,
      mediaIds: [],
    });
    privateKeys.push({
      id: key,
      version: 1,
      exerciseVersionId: id,
      senseId: concepts[i].senseId,
      accepted: [accepted],
      normalizerVersion: normalizer,
      gradingVersion: "deterministic-content-v1",
      feedback,
    });
  }
  for (const q of b.questions)
    exercise(
      Number(q[0]),
      "choice",
      String(q[1]),
      q[2] as string[],
      String(q[3]),
      "exact-choice-v1",
      String(q[4]),
    );
  exercise(
    3,
    "sequence",
    String(b.sequence[0]),
    b.sequence[1] as string[],
    String(b.sequence[2]),
    "token-order-v1",
    "Đặt các thành phần theo mẫu trong phần giải thích. Đọc lại vai trò của từng thành phần trước khi đổi thứ tự.",
  );
  exercise(
    1,
    "short",
    String(b.short[0]),
    [],
    String(b.short[1]),
    "hanzi-nfc-exact-v1",
    `Đáp án nháp có giới hạn: ${b.short[1]}. Câu hỏi yêu cầu một từ, không đánh giá văn viết tự do.`,
  );
  for (const i of [0, 2, 3])
    exercise(
      i,
      "pinyin",
      `Viết pinyin của ${concepts[i].hanzi} theo nghĩa ‘${concepts[i].meaning}’.`,
      [],
      concepts[i].dictionaryPinyin,
      "pinyin-nfc-numeric-v1",
      `Đọc ${concepts[i].dictionaryPinyin}. Giữ đúng thanh và cách đọc của nghĩa được hỏi.`,
    );
  // Use the existing normalizer ID, not a new grading implementation.
  const base = JSON.parse(
    fs.readFileSync("content/staging/slice/L001.v2.json", "utf8"),
  );
  const pinyinNormalizer = base.privateKeys.find(
    (k: { normalizerVersion: string }) =>
      k.normalizerVersion.startsWith("pinyin"),
  ).normalizerVersion;
  for (const k of privateKeys as { normalizerVersion: string }[])
    if (k.normalizerVersion.startsWith("pinyin"))
      k.normalizerVersion = pinyinNormalizer;
  const p = packageSchema.parse({
    ...base,
    packageHash: "0".repeat(64),
    unit: { id: b.slug, version: 1 },
    lesson: {
      id: b.id,
      version: 1,
      versionId: `${prefix}-draft-v1`,
      title: b.title,
      classification: "HSK_ALIGNED_DRAFT",
      estimatedMinutes: 15,
      objectives: [
        b.objective,
        "Luyện đọc và nhớ từ; không xác nhận nghe, phát âm hay mastery.",
      ],
      prerequisites: ["l002-draft-v2"],
      newGrammarPatterns: [b.grammar.written],
    },
    state: "DRAFT",
    reviewStatus: "DRAFT_UNREVIEWED",
    publicationStatus: "BLOCKED",
    humanReview: null,
    alignment: {
      ...base.alignment,
      targetLevel: 2,
      alignmentStatus: "PARTIAL",
      sourceSnapshotSha256: sourceHash,
      sourceLocator: b.task.sourceLocator,
      alignmentCheckedAt: "2026-10-23T00:00:00Z",
      alignmentEvidence: [
        "Exact PDF locators checked; original teaching/sense interpretation remains unreviewed. Supporting HSK1 prerequisite gap remains open.",
      ],
      vocabularyReferences:
        b.id === "L201"
          ? [
              ...vocab,
              {
                id: "h2-extra-zhi",
                kind: "vocabulary",
                status: "SUPPLEMENTARY",
                officialLevel: null,
                sourceLocator: null,
                written: "支",
                pinyin: "zhī",
                senseId: "extra-zhi-measure",
                ordinal: null,
                note: "Supporting classifier for pens; level unverified; excluded from target counts.",
              },
            ]
          : vocab,
      grammarReferences: [b.grammar],
      taskReferences: [b.task],
      topicReferences: [b.topic],
      characterReferences: b.chars,
    },
    concepts,
    blocks: [
      ...b.teaching.map((t, i) => ({
        id: `${prefix}-t${i}`,
        type: "teaching",
        title: t[0],
        text: t[1],
        hanzi: t[2],
        pinyin: t[3],
        meaning: t[4],
        readingMinutes: 3,
      })),
      ...(exercises as { id: string }[]).map((e, i) => ({
        id: `${prefix}-b${i}`,
        type: "exercise",
        exerciseVersionId: e.id,
      })),
    ],
    exercises,
    privateKeys,
    media: [],
    missingAssessments: ["listening", "pronunciation"],
  });
  p.packageHash = contentHash(p);
  const file = `${b.id}.v1.json`;
  write(file, p);
  manifest.push({ file, versionId: p.lesson.versionId, sha256: p.packageHash });
  const unitId = `62000000-0000-4000-8000-00000000010${index + 1}`;
  catalog.units.push({
    id: unitId,
    slug: b.slug,
    courseId: catalog.courses[2].id,
    order: index,
    title: b.unit,
    objective: b.objective,
    prerequisites: [catalog.units[3].id],
    availability: "PRACTICE_ONLY",
  });
  catalog.lessons.push({
    id: `62000000-0000-4000-8000-00000000020${index + 1}`,
    key: b.id,
    unitId,
    order: 0,
    currentVersion: p.lesson.versionId,
    localDraftAllowed: true,
    requirements: catalog.lessons[3].requirements,
  });
}
write("manifest.json", {
  schemaVersion: 1,
  policy: "LOCAL_DEVELOPMENT_ONLY",
  packages: manifest,
});
write("catalog.json", catalog);
write("evidence.json", {
  syllabusId: "hsk-exam-2025-11",
  sourceUrl,
  sourceSnapshotSha256: sourceHash,
  references: evidence,
});
console.log(
  "Authored 2 original DRAFT lessons, 8 concepts, 16 deterministic exercises. No publication.",
);
