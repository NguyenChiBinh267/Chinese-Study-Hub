// Original, bounded local drafts. This authoring utility never supplies human approval.
import fs from "node:fs";
import { createHash } from "node:crypto";
const dir = "content/staging/slice";
fs.mkdirSync(dir, { recursive: true });
if (fs.existsSync(`${dir}/F01.v1.json`))
  throw new Error(
    "Immutable v1 packages already exist. Author a new version instead of overwriting.",
  );
const url = "https://hsk.cn-bj.ufileos.com/3.0/新版HSK考试大纲1219.pdf";
const checkedAt = new Date().toISOString();
const refs = [];
function reference(id, kind, written, index, entry, extra = {}) {
  const ref = {
    id,
    kind,
    status: "VERIFIED",
    officialLevel: 1,
    sourceLocator: {
      pdfIndex: index,
      physicalPage: index + 1,
      printedPage: index - 2,
      section: kind,
      entry,
    },
    written,
    pinyin: null,
    senseId: null,
    ordinal: null,
    note: "Direct reading of the exact official PDF; narrow factual locator, not redistribution permission.",
    ...extra,
  };
  refs.push(ref);
  return ref;
}
const vocab = [
  ["nihao", "你好", "nǐhǎo", 147, 82, "greeting"],
  ["wo", "我", "wǒ", 221, 84, "speaker"],
  ["ni", "你", "nǐ", 146, 82, "addressee"],
  ["jiao", "叫", "jiào", 91, 81, "be-called"],
  ["ne", "呢", "ne", 144, 82, "question-particle"],
  ["xihuan", "喜欢", "xǐhuan", 225, 84, "like"],
  ["cha", "茶", "chá", 17, 79, "tea"],
  ["he", "喝", "hē", 77, 80, "drink"],
];
for (const [id, w, pinyin, n, page, sense] of vocab)
  reference(`v-${id}`, "vocabulary", w, page, `ordinal ${n}`, {
    pinyin,
    ordinal: n,
    senseId: `sense-${sense}`,
    note:
      id === "jiao"
        ? "HSK1 verb reading jiào; higher-level preposition sense excluded."
        : id === "ne"
          ? "Entry/reading verified; precise pragmatic sense still needs language review."
          : "Entry/reading observed; Vietnamese gloss is original and unreviewed.",
  });
for (const [w, n, page] of [
  ["你", 126, 355],
  ["好", 65, 355],
  ["我", 186, 356],
  ["叫", 84, 355],
  ["呢", 124, 355],
  ["喜", 192, 356],
  ["欢", 73, 355],
  ["茶", 17, 355],
  ["喝", 67, 355],
])
  reference(`c-${n}`, "character", w, page, `recognition ordinal ${n}`, {
    ordinal: n,
  });
reference("task-personal", "task", "问答个人基本信息", 4, "一");
reference("task-social", "task", "日常言语交往", 5, "六");
reference("task-food", "task", "问答饮食喜好", 5, "七");
reference("topic-personal", "topic", "个人信息", 58, "基本信息 / 个人信息");
reference("topic-social", "topic", "基本礼貌行为", 58, "日常生活 / 交往");
reference("topic-food", "topic", "食物饮品", 58, "日常生活 / 饮食");
reference(
  "g-verb",
  "grammar",
  "动词谓语句",
  386,
  "句子的类型 / 句型 / 主谓句1",
);
reference("g-object", "grammar", "动宾短语", 386, "短语 / 基本结构类型 (3)");
reference("g-ne", "grammar", "呢", 385, "词类 / 助词 / 语气助词");
const evidence = {
  schemaVersion: 1,
  syllabusId: "hsk-exam-2025-11",
  sourceUrl: url,
  title: "HSK 考试大纲",
  issuer: "中外语言交流合作中心",
  published: "2025-11",
  implementation: "2026-07",
  physicalPages: 406,
  sourceSnapshotSha256: null,
  checkedAt,
  method:
    "Exact PDF read via web PDF parser; cover/TOC and selected page locators inspected. Local download incomplete: no retained full-snapshot checksum claimed.",
  rights: "UNKNOWN / REFERENCE_ONLY",
  references: refs,
};
fs.writeFileSync(
  `${dir}/source-evidence.json`,
  JSON.stringify(evidence, null, 2) + "\n",
);
function base(id, title, classification) {
  return {
    schemaVersion: 1,
    packageHash: "0".repeat(64),
    course: { id: "chinese-study-local", version: 1 },
    unit: { id: "foundation-slice", version: 1 },
    release: { id: "local-development-phase4", version: 1 },
    lesson: {
      id,
      version: 1,
      versionId: `${id.toLowerCase()}-draft-v1`,
      title,
      classification,
      estimatedMinutes: 15,
      objectives: [],
      prerequisites: [],
      newGrammarPatterns: [],
    },
    locale: "vi",
    contentLanguage: "zh-Hans",
    state: "REVIEW_PENDING",
    reviewStatus: "DRAFT_UNREVIEWED",
    publicationStatus: "BLOCKED",
    humanReview: null,
    rights: {
      authorship: "PROJECT_ORIGINAL_DRAFT",
      licenseDecision: "ORIGINAL_REVIEW_PENDING",
      sourceUse: "REFERENCE_ONLY",
      publicationReceipt: null,
    },
    alignment: {
      syllabusId: "hsk-exam-2025-11",
      syllabusVersion: "2025-11",
      sourceId: "S01",
      sourceUrl: url,
      sourceLocator: null,
      targetLevel: classification === "FOUNDATION_INTERNAL" ? null : 1,
      alignmentStatus:
        classification === "FOUNDATION_INTERNAL" ? "NOT_APPLICABLE" : "PARTIAL",
      alignmentEvidence:
        classification === "FOUNDATION_INTERNAL"
          ? ["Internally authored foundation; no official HSK unit claim."]
          : [
              "Narrow entry locators checked in source-evidence.json; exact teaching-pattern interpretation remains unreviewed.",
            ],
      alignmentCheckedAt: checkedAt,
      sourceSnapshotSha256: null,
      taskReferences: [],
      topicReferences: [],
      vocabularyReferences: [],
      characterReferences: [],
      grammarReferences: [],
    },
    concepts: [],
    blocks: [],
    exercises: [],
    privateKeys: [],
    media: [],
    missingAssessments: ["listening", "pronunciation"],
  };
}
function concept(
  p,
  id,
  hanzi,
  pinyin,
  meaning,
  referenceIds = [],
  scope = "FOUNDATION_INTERNAL",
) {
  const c = {
    id: `${p.lesson.id.toLowerCase()}-${id}`,
    version: 1,
    senseId: `${p.lesson.id.toLowerCase()}-sense-${id}`,
    hanzi,
    dictionaryPinyin: pinyin,
    meaning,
    skills: ["recognition", "pinyin", "reading"],
    referenceIds,
    scope,
  };
  p.concepts.push(c);
  return c;
}
function teach(p, title, text, hanzi = "", pinyin = "", meaning = "") {
  p.blocks.push({
    id: `${p.lesson.versionId}-b${p.blocks.length + 1}`,
    type: "teaching",
    title,
    text,
    hanzi,
    pinyin,
    meaning,
    readingMinutes: 2,
  });
}
function exercise(p, c, prompt, choices, expected, feedback, type = "choice") {
  const id = `${p.lesson.versionId}-e${p.exercises.length + 1}`,
    key = `${id}-key-v1`;
  p.exercises.push({
    id,
    version: 1,
    type,
    skill: type === "pinyin" ? "pinyin" : "recognition",
    conceptId: c.id,
    senseId: c.senseId,
    keyRef: key,
    prompt,
    choices,
    inputHint:
      type === "pinyin"
        ? "Nhập dấu thanh hoặc số 1–4. Thanh nhẹ dùng 0/5 hoặc không dấu. v được nhận thay ü."
        : "Chọn một đáp án.",
    requiresAudio: false,
    mediaIds: [],
  });
  p.privateKeys.push({
    id: key,
    version: 1,
    exerciseVersionId: id,
    senseId: c.senseId,
    accepted: [expected],
    normalizerVersion:
      type === "pinyin" ? "pinyin-nfc-tone-v1" : "exact-choice-v1",
    gradingVersion: "deterministic-content-v1",
    feedback,
  });
  p.blocks.push({ id: `${id}-block`, type: "exercise", exerciseVersionId: id });
}
const f1 = base("F01", "Đọc bước đầu với pinyin", "FOUNDATION_INTERNAL");
f1.lesson.objectives = [
  "Hiểu pinyin ghi cách đọc, không phải bản dịch.",
  "Nhận ra phần đầu và phần vần trong các âm tiết đã học.",
  "Đọc đúng ký hiệu dấu thanh trong ví dụ viết; chưa đánh giá nghe/phát âm.",
];
const ma = concept(f1, "ma", "妈", "mā", "mẹ"),
  ni = concept(f1, "ni", "你", "nǐ", "bạn"),
  nu = concept(f1, "nu", "女", "nǚ", "nữ");
teach(
  f1,
  "Pinyin là chiếc cầu để đọc chữ",
  "Chữ Hán biểu thị đơn vị ngôn ngữ; pinyin dùng chữ cái Latin và dấu thanh để ghi cách đọc tiếng Phổ thông. Nghĩa tiếng Việt là một phần riêng. Đọc mā không phải đọc theo quy tắc chữ Việt. Trong bài này mình quan sát ký hiệu, chưa kết luận bạn phát âm đúng.",
  "妈",
  "mā",
  "mẹ",
);
teach(
  f1,
  "Tách phần đầu và phần vần",
  "Trong mā, phần đầu viết là m và phần vần là a; dấu ngang đặt trên a. Trong nǐ, phần đầu viết là n và phần vần là i. Không phải âm tiết nào cũng có phụ âm đầu viết ra; ta bắt đầu bằng hai ví dụ đơn giản này.",
  "你",
  "nǐ",
  "bạn",
);
exercise(
  f1,
  ma,
  "Trong mā, phần đầu được viết bằng chữ nào?",
  ["a", "m", "am"],
  "m",
  "m là phần đầu; a là phần vần của ví dụ mā.",
);
exercise(
  f1,
  ma,
  "Trong mā, phần vần được viết như thế nào?",
  ["m", "am", "a"],
  "a",
  "Phần vần của mā là a. Dấu thanh nằm trên nguyên âm.",
);
teach(
  f1,
  "Đọc cấu tạo thay vì đảo chữ",
  "nǐ có cấu tạo n + i, không phải i + n. Chỉ cần nhận ra thứ tự của ký hiệu trong ví dụ đã học. Chữ 你 có pinyin từ điển nǐ; dấu ǎ/ǐ là dấu thanh 3. Việc nghe và thực hiện thanh sẽ cần mẫu âm được duyệt.",
  "你",
  "nǐ",
  "bạn",
);
exercise(
  f1,
  ni,
  "Chọn cách tách phần chữ của nǐ.",
  ["i + n", "n + i", "n + a"],
  "n + i",
  "Giữ đúng thứ tự n trước, i sau.",
);
exercise(
  f1,
  ma,
  "Dạng nào dùng dấu thanh pinyin đã học cho mā?",
  ["mă", "mā", "mã"],
  "mā",
  "Dấu ngang ā biểu thị thanh 1; ă và ã không phải hai dấu thanh này trong pinyin.",
);
teach(
  f1,
  "Thử gõ ký hiệu",
  "Bạn có thể nhập nǐ hoặc ni3; server sẽ giữ thông tin thanh, không bỏ dấu để chấm. Chữ ü khác u. Trong ô nhập của ứng dụng, v được nhận như cách gõ thay ü: nv3 tương ứng nǚ. Đây chỉ là quy ước nhập liệu, không phải phát âm chữ v tiếng Việt.",
  "女",
  "nǚ",
  "nữ",
);
exercise(
  f1,
  ni,
  "Nhập pinyin của 你 theo ví dụ (dấu thanh hoặc số).",
  [],
  "nǐ",
  "nǐ / ni3 khớp thanh từ điển 3 của ví dụ.",
  "pinyin",
);
exercise(
  f1,
  nu,
  "Nhập nǚ (có thể dùng nv3).",
  [],
  "nǚ",
  "nǚ / nü3 / nv3 giữ cả ü và thanh 3. nu3 thiếu ü nên không khớp.",
  "pinyin",
);
const f2 = base("F02", "Đọc dấu thanh, không đoán âm", "FOUNDATION_INTERNAL");
f2.lesson.prerequisites = [f1.lesson.versionId];
f2.lesson.objectives = [
  "Phân biệt ký hiệu thanh 1–4 và thanh nhẹ bằng chữ.",
  "Đặt dấu trên nguyên âm theo ví dụ đã dạy.",
  "Giữ nguyên thanh từ điển, không suy phát âm hay năng lực nghe từ bài chữ.",
];
const tones = [
  ["ma1", "妈", "mā", "mẹ"],
  ["ma2", "麻", "má", "cây gai / vật liệu gai"],
  ["ma3", "马", "mǎ", "ngựa"],
  ["ma4", "骂", "mà", "mắng"],
  ["ma0", "吗", "ma", "trợ từ nghi vấn thanh nhẹ"],
  ["nu3", "女", "nǚ", "nữ"],
].map((x) => concept(f2, ...x));
teach(
  f2,
  "Cùng chữ cái, khác thanh",
  "Pinyin không chỉ có phần chữ. mā, má, mǎ, mà có cùng m + a nhưng thanh khác nhau và có thể chỉ những từ khác nghĩa. Bài này kiểm tra ký hiệu viết; chưa có audio tham chiếu để kiểm tra nghe hoặc phát âm.",
  "妈 麻 马 骂",
  "mā má mǎ mà",
  "mẹ · cây gai · ngựa · mắng",
);
teach(
  f2,
  "Bốn dấu thanh cơ bản",
  "Thanh 1 dùng dấu ngang ā; thanh 2 dùng dấu sắc á; thanh 3 dùng dấu ǎ; thanh 4 dùng dấu huyền à. Số tương ứng là 1, 2, 3, 4. Đây là ký hiệu pinyin, không bảo đảm phát âm giống các dấu tiếng Việt.",
);
for (let i = 0; i < 4; i++)
  exercise(
    f2,
    tones[i],
    `${tones[i].dictionaryPinyin} trong ví dụ mang thanh mấy?`,
    ["Thanh 1", "Thanh 2", "Thanh 3", "Thanh 4"],
    `Thanh ${i + 1}`,
    `${tones[i].dictionaryPinyin}: ký hiệu thanh ${i + 1}. Không tính thành năng lực nghe.`,
  );
teach(
  f2,
  "Thanh nhẹ không phải thanh đầy đủ thứ năm",
  "Trong ví dụ 吗 ma, âm tiết không mang dấu thanh từ điển và được đọc thanh nhẹ trong cách dùng này. Ô nhập nhận ma, ma0 hoặc ma5; 0/5 là quy ước ghi thanh nhẹ ở đây. Không gán một đường nét cố định thứ năm như bốn thanh đầy đủ.",
  "吗",
  "ma",
  "trợ từ nghi vấn",
);
exercise(
  f2,
  tones[4],
  "Trong quy ước bài này, ma0 biểu thị gì?",
  ["Thanh 4", "Thanh nhẹ", "Thiếu dữ liệu: luôn đúng mọi thanh"],
  "Thanh nhẹ",
  "ma0/ma5/ma là thanh nhẹ theo quy ước nhập, không thay thế mā/má/mǎ/mà.",
);
teach(
  f2,
  "Đặt dấu ở đâu?",
  "Trong âm tiết có a hoặc e thì dấu đặt ở a hoặc e. Với ou, đặt ở o; khi không có các trường hợp đó thì đặt trên nguyên âm cuối. Ví dụ hǎo đặt ở a, liú đặt ở u, guì đặt ở i. Với ü phải giữ hai chấm; thanh 3 của nü được viết nǚ. Các ví dụ đặt dấu là minh họa ký hiệu bổ trợ, không thêm mục từ HSK.",
  "女",
  "nǚ",
  "nữ",
);
exercise(
  f2,
  tones[5],
  "Chọn cách viết có ü và thanh 3 đúng trong ví dụ.",
  ["nǔ", "nǚ", "nù"],
  "nǚ",
  "nǚ giữ nguyên ü; nǔ dùng u là một dạng khác.",
);
teach(
  f2,
  "Thanh từ điển và lời nói",
  "Pinyin trên thẻ ghi dạng từ điển. Trong câu, thanh có thể biến đổi theo ngữ cảnh; chẳng hạn chuỗi thanh 3 có quy tắc biến điệu. Ta chưa chấm biến điệu, độ chuẩn hay phát âm từ bài chữ. Khi chưa có audio được duyệt, nghe/phát âm vẫn là CHƯA ĐÁNH GIÁ.",
);
exercise(
  f2,
  tones[5],
  "Gõ nǚ bằng dấu thanh hoặc quy ước v.",
  [],
  "nǚ",
  "nǚ / nü3 / nv3 khớp. ü và thanh đều được giữ.",
  "pinyin",
);
exercise(
  f2,
  tones[2],
  "Gõ pinyin của 马 trong ví dụ: thanh 3.",
  [],
  "mǎ",
  "mǎ / ma3 khớp. ma, mā hoặc ma4 không được đổi thành thanh 3.",
  "pinyin",
);
function map(p, ids) {
  for (const ref of refs.filter((r) => ids.includes(r.id))) {
    const field = {
      task: "taskReferences",
      topic: "topicReferences",
      vocabulary: "vocabularyReferences",
      character: "characterReferences",
      grammar: "grammarReferences",
    }[ref.kind];
    p.alignment[field].push(ref);
  }
  p.alignment.sourceLocator =
    p.alignment.taskReferences[0]?.sourceLocator ?? null;
}
function unresolved(id, written, note, status = "UNVERIFIED") {
  return {
    id,
    kind: status === "SUPPLEMENTARY" ? "vocabulary" : "grammar",
    status,
    officialLevel: null,
    sourceLocator: null,
    written,
    pinyin: null,
    senseId: null,
    ordinal: null,
    note,
  };
}
const l1 = base("L001", "Lời chào và tên của mình", "HSK_ALIGNED_DRAFT");
l1.lesson.prerequisites = [f1.lesson.versionId, f2.lesson.versionId];
l1.lesson.objectives = [
  "Đọc một lời chào và giới thiệu tên theo mẫu gốc.",
  "Hiểu nghĩa của 你好 và 我叫… trong đoạn ngắn.",
];
l1.lesson.newGrammarPatterns = ["我叫 + tên"];
map(l1, [
  "task-personal",
  "task-social",
  "topic-personal",
  "topic-social",
  "v-nihao",
  "v-wo",
  "v-ni",
  "v-jiao",
  "v-ne",
  "c-126",
  "c-65",
  "c-186",
  "c-84",
  "c-124",
  "g-verb",
  "g-ne",
]);
l1.alignment.grammarReferences.push(
  unresolved(
    "g-jiao-pattern",
    "我叫 + tên",
    "Generic verb-predicate category verified; exact pedagogical pattern is an authored interpretation, not an official named grammar entry.",
  ),
);
l1.alignment.vocabularyReferences.push(
  unresolved(
    "v-an",
    "安",
    "Proper-name example only; no checked HSK1 vocabulary entry. Not counted as HSK coverage.",
    "SUPPLEMENTARY",
  ),
);
const hello = concept(
  l1,
  "hello",
  "你好",
  "nǐ hǎo",
  "xin chào",
  ["v-nihao", "c-126", "c-65"],
  "TARGET",
);
concept(l1, "wo", "我", "wǒ", "tôi", ["v-wo", "c-186"], "TARGET");
concept(l1, "ni", "你", "nǐ", "bạn", ["v-ni", "c-126"], "TARGET");
const called = concept(
  l1,
  "jiao",
  "叫",
  "jiào",
  "tên là / được gọi",
  ["v-jiao", "c-84"],
  "TARGET",
);
concept(
  l1,
  "ne",
  "呢",
  "ne",
  "trợ từ hỏi lại trong ví dụ",
  ["v-ne", "g-ne", "c-124"],
  "TARGET",
);
concept(l1, "an", "安", "Ān", "tên riêng An", ["v-an"], "SUPPLEMENTARY");
teach(
  l1,
  "Chào một người mới",
  "你好 là một lời chào. Đọc riêng dạng từ điển nǐ hǎo; cách thể hiện hai thanh 3 trong lời nói phải học cùng mẫu âm được duyệt. Bản nháp này chưa chấm phát âm.",
  "你好",
  "nǐ hǎo",
  "Xin chào.",
);
exercise(
  l1,
  hello,
  "Trong đoạn chào, 你好 có nghĩa nào?",
  ["Tạm biệt", "Xin chào", "Tôi thích trà"],
  "Xin chào",
  "Đây là cách dùng chào hỏi trong đoạn gốc.",
);
teach(
  l1,
  "Nói tên của mình",
  "Mẫu mới: 我叫 + tên. 我 là tôi, 叫 dùng để nói mình được gọi bằng tên gì. Trong ví dụ 我叫安, 安 là tên riêng minh họa bổ trợ, chưa xác minh là mục từ HSK1 và không tính vào coverage.",
  "我叫安。",
  "wǒ jiào Ān",
  "Tôi tên là An.",
);
exercise(
  l1,
  called,
  "我叫安 trong ví dụ giới thiệu điều gì?",
  ["Tên của người nói", "Thời tiết", "Món ăn yêu thích"],
  "Tên của người nói",
  "我叫… giới thiệu tên trong bản nháp này. Ngôn ngữ và đáp án còn chờ người duyệt.",
);
teach(
  l1,
  "Đoạn hội thoại tự viết",
  "A: 你好！我叫安。你呢？ B: 你好！我叫安。 你呢？ là một cách hỏi lại ngắn trong ngữ cảnh đang giới thiệu. Hai người trong ví dụ cùng tên chỉ để tránh thêm mục từ; khi tự luyện, thay bằng tên mình. Không coi câu mẫu là đề thi chính thức.",
  "你呢？",
  "nǐ ne",
  "Còn bạn thì sao?",
);
const l2 = base("L002", "Một sở thích, một câu hỏi lại", "HSK_ALIGNED_DRAFT");
l2.lesson.prerequisites = [l1.lesson.versionId];
l2.lesson.objectives = [
  "Đọc lời nói về sở thích với 喜欢.",
  "Hỏi lại bằng cụm 你呢 đã gặp trong L001.",
];
l2.lesson.newGrammarPatterns = ["Chủ ngữ + 喜欢 + cụm chỉ điều thích"];
map(l2, [
  "task-personal",
  "task-food",
  "topic-personal",
  "topic-food",
  "v-wo",
  "v-ni",
  "v-xihuan",
  "v-cha",
  "v-he",
  "v-ne",
  "c-186",
  "c-126",
  "c-192",
  "c-73",
  "c-17",
  "c-67",
  "c-124",
  "g-verb",
  "g-object",
  "g-ne",
]);
l2.alignment.grammarReferences.push(
  unresolved(
    "g-like-pattern",
    "喜欢 + cụm chỉ sở thích",
    "Vocabulary and broad verb-predicate/object categories verified; this exact teaching pattern is an original pedagogical interpretation requiring review.",
  ),
);
concept(l2, "wo", "我", "wǒ", "tôi", ["v-wo"], "TARGET");
concept(l2, "ni", "你", "nǐ", "bạn", ["v-ni"], "TARGET");
const like = concept(
  l2,
  "like",
  "喜欢",
  "xǐ huan",
  "thích",
  ["v-xihuan", "c-192", "c-73"],
  "TARGET",
);
const tea = concept(l2, "tea", "茶", "chá", "trà", ["v-cha", "c-17"], "TARGET");
concept(l2, "drink", "喝", "hē", "uống", ["v-he", "c-67"], "TARGET");
concept(l2, "ne", "呢", "ne", "trợ từ hỏi lại", ["v-ne", "g-ne"], "TARGET");
teach(
  l2,
  "Một mẫu nói về điều mình thích",
  "我喜欢茶 có nghĩa tôi thích trà. Dùng 喜欢 để nói điều mình thích; đây là mẫu chính của bài. Mục 喜欢 và 茶 có locator HSK1; diễn giải ngữ pháp tiếng Việt và đáp án vẫn chưa được người có năng lực duyệt.",
  "我喜欢茶。",
  "wǒ xǐ huan chá",
  "Tôi thích trà.",
);
exercise(
  l2,
  tea,
  "Người nói trong 我喜欢茶 thích gì?",
  ["Trà", "Một người tên An", "Thời tiết"],
  "Trà",
  "茶 được dùng với nghĩa trà trong ví dụ gốc.",
);
teach(
  l2,
  "Thêm việc làm và hỏi lại",
  "我喜欢喝茶 diễn tả thích việc uống trà. 喝 nghĩa là uống. Cụm 你呢？ đã gặp ở L001 dùng để hỏi lại trong ngữ cảnh này; không coi nó là một câu hỏi tự đủ trong mọi tình huống.",
  "我喜欢喝茶。你呢？",
  "wǒ xǐ huan hē chá. nǐ ne",
  "Tôi thích uống trà. Còn bạn?",
);
exercise(
  l2,
  like,
  "Trong đoạn trên, 喜欢 thể hiện điều gì?",
  ["Một sở thích", "Một địa điểm", "Một thời điểm"],
  "Một sở thích",
  "喜欢 nói về điều thích. Bản nháp không chứng nhận khả năng giao tiếp.",
);
for (const p of [f1, f2, l1, l2]) {
  const { packageHash, ...rest } = p;
  void packageHash;
  p.packageHash = createHash("sha256")
    .update(JSON.stringify(rest))
    .digest("hex");
  fs.writeFileSync(
    `${dir}/${p.lesson.id}.v1.json`,
    JSON.stringify(p, null, 2) + "\n",
  );
}
console.log(
  "Four original unreviewed draft packages authored; no publication or human approval.",
);
