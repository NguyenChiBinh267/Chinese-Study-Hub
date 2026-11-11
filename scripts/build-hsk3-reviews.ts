// Assisted local reviews: reused immutable senses, no extra vocabulary or mastery.
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
import { PINYIN_NORMALIZER } from "../src/modules/content/domain/pinyin";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const dir = "content/hsk24",
  read = (f: string) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json"),
  registry = read("reviews.json"),
  { packages, evidence } = loadDraftCatalog();
const intros = currentDrafts().filter(
  (p) =>
    p.alignment.targetLevel === 3 &&
    !registry.activities.some(
      (a: { versionId: string }) => a.versionId === p.lesson.versionId,
    ),
);
if (
  intros.length !== 84 ||
  new Set(intros.flatMap((p) => p.concepts.map((c) => c.senseId))).size !== 500
)
  throw Error("HSK3_VOCABULARY_FIRST");
type Selection = {
  p: ContentPackage;
  c: ContentPackage["concepts"][number];
  char?: string;
};
const chars = JSON.parse(
  fs.readFileSync("docs/hsk24/hsk3-coverage.json", "utf8"),
).characters.map((r: { character: string }) => r.character) as string[];
const used = new Set<string>(),
  outputs: ContentPackage[] = [];
function build(
  n: number,
  kind: "UNIT_REVIEW" | "GRAMMAR_DIAGNOSTIC" | "CHARACTER_DIAGNOSTIC",
  selections: Selection[],
) {
  const id = `L${n}`,
    prefix = id.toLowerCase(),
    sources = [...new Set(selections.map((s) => s.p))],
    p = structuredClone(sources[0]);
  if (catalog.lessons.some((l: { key: string }) => l.key === id))
    throw Error("IMMUTABLE_ACTIVITY_EXISTS");
  p.lesson = {
    ...p.lesson,
    id,
    version: 1,
    versionId: `${prefix}-draft-v1`,
    title:
      kind === "UNIT_REVIEW"
        ? `Ôn sau bài · ${sources[0].lesson.title}`
        : kind === "GRAMMAR_DIAGNOSTIC"
          ? "Chẩn đoán điều kiện · có hỗ trợ, không phải đề HSK"
          : `Nhận diện mẫu chữ HSK3 · ${n - 389}`,
    estimatedMinutes: 20,
    prerequisites: sources.map((s) => s.lesson.versionId),
    newGrammarPatterns: [],
    objectives: [
      "Ôn nghĩa/chữ/cấu trúc đã học; không thêm từ, không phải đề thi chính thức.",
      "Bằng chứng có hỗ trợ; chưa xác nhận năng lực độc lập, nghe, nói hay viết tay.",
    ],
  };
  p.concepts = selections.map((s) => structuredClone(s.c));
  for (const f of [
    "vocabularyReferences",
    "grammarReferences",
    "taskReferences",
    "topicReferences",
    "characterReferences",
  ] as const) {
    const refs = sources.flatMap((s) => s.alignment[f]);
    p.alignment[f] = refs.filter(
      (r, i) => refs.findIndex((v) => v.id === r.id) === i,
    );
  }
  p.alignment.alignmentCheckedAt = new Date().toISOString();
  p.alignment.alignmentEvidence = [
    "Assisted review of source-checked taught senses; original contextual teaching unreviewed. No vocabulary increase or publication approval.",
  ];
  p.exercises = [];
  p.privateKeys = [];
  const characterItems: { character: string; exerciseId: string }[] = [];
  function add(
    c: Selection["c"],
    type: ContentPackage["exercises"][number]["type"],
    prompt: string,
    choices: string[],
    answer: string,
    feedback: string,
    skill: ContentPackage["exercises"][number]["skill"] = "reading",
  ) {
    const i = p.exercises.length,
      eid = `${prefix}-e${i}`,
      kid = `${prefix}-k${i}`;
    if (type === "choice") {
      const shift = (i + 1) % choices.length;
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
      inputHint: "Phạm vi đáp án được ghi trong đề; chưa chấm văn viết tự do.",
      requiresAudio: false,
      mediaIds: [],
    });
    p.privateKeys.push({
      id: kid,
      version: 1,
      exerciseVersionId: eid,
      senseId: c.senseId,
      accepted: [answer],
      normalizerVersion:
        type === "choice"
          ? "exact-choice-v1"
          : type === "pinyin"
            ? PINYIN_NORMALIZER
            : type === "sequence"
              ? "token-order-v1"
              : "hanzi-nfc-exact-v1",
      gradingVersion: "deterministic-content-v1",
      feedback,
    });
    return eid;
  }
  if (kind === "CHARACTER_DIAGNOSTIC")
    for (const s of selections) {
      const c = s.char!,
        at = s.c.hanzi.indexOf(c),
        masked = s.c.hanzi.slice(0, at) + "□" + s.c.hanzi.slice(at + 1);
      const options = [
        c,
        ...chars
          .filter((x) => x !== c)
          .slice(
            (chars.indexOf(c) + 11) % 250,
            ((chars.indexOf(c) + 11) % 250) + 3,
          ),
      ];
      const eid = add(
        s.c,
        "choice",
        `Nhận diện chữ theo nghĩa đã học: “${s.c.meaning}” (${s.c.dictionaryPinyin}), ${masked}. Điền chữ vào □.`,
        options,
        c,
        `${s.c.hanzi}: chữ cần nhận diện là ${c}; đây là nhận diện có gợi ý, không phải viết tay.`,
        "recognition",
      );
      characterItems.push({ character: c, exerciseId: eid });
      used.add(c);
    }
  else if (kind === "GRAMMAR_DIAGNOSTIC") {
    const cs = p.concepts;
    add(
      cs[0],
      "choice",
      "Giả thiết chưa xảy ra, chọn từ nghĩa nếu: □明天下雨，我们就改天去。",
      ["如果", "因为", "虽然"],
      "如果",
      "如果 dẫn giả thiết, không xác nhận trời đã mưa.",
    );
    add(
      cs[1],
      "short",
      "Điền đúng dấu hai chữ sau giả thiết: 明天没空□，就周末去。",
      [],
      "的话",
      "的话 đứng sau cụm điều kiện; không đứng đầu trước 明天.",
    );
    add(
      cs[2],
      "choice",
      "Chọn cụm nghĩa chỉ cần, nêu điều kiện đủ trong quy tắc: □交表，就能登记。",
      ["只要", "只有", "除了"],
      "只要",
      "只要…就… nêu đủ; 只有…才… nêu cần. Đây là quy tắc hư cấu trong đoạn.",
    );
    add(
      cs[3],
      "pinyin",
      "Viết pinyin của 只有, cụm nêu điều kiện cần trong 只有…才…。",
      [],
      cs[3].dictionaryPinyin,
      "只有 zhǐ yǒu; không đổi thành 只要 zhǐ yào.",
      "pinyin",
    );
    add(
      cs[4],
      "choice",
      "Người nói tự chọn chỉ xem, chưa nêu bị hạn chế khả năng: 我今天□看，不买。",
      ["只", "只能", "已经"],
      "只",
      "只 giới hạn hành động chọn làm; 只能 thêm ý không có lựa chọn khác.",
    );
    add(
      cs[5],
      "short",
      "Xa quá nên chỉ có thể đi xe. Điền đúng cụm hai chữ đã học: 太远了，我们□坐车。",
      [],
      "只能",
      "只能 là giới hạn khả năng/lựa chọn trong ngữ cảnh, chưa phải mệnh lệnh ngoài đời.",
    );
  } else
    for (const [i, s] of selections.entries()) {
      const old = s.p.exercises.find((e) => e.conceptId === s.c.id)!,
        key = s.p.privateKeys.find((k) => k.id === old.keyRef)!;
      if (old.type === "pinyin")
        add(
          s.c,
          "short",
          `Ôn truy hồi đúng mục từ: ${s.c.meaning}; pinyin ${s.c.dictionaryPinyin}. Chỉ nhập mục từ được nhắc.`,
          [],
          s.c.hanzi,
          `${s.c.hanzi} · ${s.c.dictionaryPinyin} · ${s.c.meaning}`,
        );
      else if (i % 2 === 0)
        add(
          s.c,
          "pinyin",
          `Ôn cách đọc ${s.c.hanzi} trong nghĩa ${s.c.meaning}.`,
          [],
          s.c.dictionaryPinyin,
          `${s.c.dictionaryPinyin}; đọc theo nghĩa đã nêu, không thay bằng cách đọc đồng hình khác.`,
          "pinyin",
        );
      else
        add(
          s.c,
          old.type,
          `Ôn ngữ cảnh quen · ${old.prompt}`,
          old.choices,
          key.accepted[0],
          key.feedback,
          old.skill,
        );
    }
  const first = sources[0];
  if (kind === "GRAMMAR_DIAGNOSTIC") {
    add(
      p.concepts[0],
      "choice",
      "Quy tắc nói 只有老师同意才能去. Kết luận nào đủ căn cứ?",
      [
        "Sự đồng ý là điều kiện cần",
        "Đã chắc chắn được đồng ý",
        "Đã chắc chắn chuyến đi xảy ra",
      ],
      "Sự đồng ý là điều kiện cần",
      "Điều kiện cần chưa tự là điều kiện đủ hoặc sự kiện đã xảy ra.",
    );
    add(
      p.concepts[3],
      "sequence",
      "Xếp điều kiện cần, bắt đầu bằng 只有老师同意.",
      ["才去", "只有老师同意", "我们"],
      "1,2,0",
      "只有…才… nêu điều kiện cần, khác 只要…就….",
    );
  } else if (kind === "UNIT_REVIEW")
    for (const i of [6, 7]) {
      const e = first.exercises[i],
        k = first.privateKeys.find((k) => k.id === e.keyRef)!;
      add(
        p.concepts.find((c) => c.id === e.conceptId)!,
        e.type,
        `Ôn đoạn đã học · ${e.prompt}`,
        e.choices,
        k.accepted[0],
        k.feedback,
        e.skill,
      );
    }
  else {
    const candidates = sources.flatMap((s) =>
        s.exercises
          .filter((e) => p.concepts.some((c) => c.id === e.conceptId))
          .map((e) => ({ s, e })),
      ),
      chosen = [
        ...candidates.filter((x) => x.e.type === "sequence"),
        ...candidates.filter((x) => x.e.type === "choice"),
      ];
    for (const x of chosen.slice(0, 2)) {
      const k = x.s.privateKeys.find((k) => k.id === x.e.keyRef)!;
      add(
        p.concepts.find((c) => c.id === x.e.conceptId)!,
        x.e.type,
        `Ôn ngữ cảnh đã gặp · ${x.e.prompt}`,
        x.e.choices,
        k.accepted[0],
        k.feedback,
        x.e.skill,
      );
    }
  }
  const guide = {
    id: `${prefix}-guide`,
    type: "teaching" as const,
    title: "Ôn/chẩn đoán có hỗ trợ · không phải đề HSK",
    text: "Nên thử trước khi đọc phần nhắc lại. Bài vẫn có gợi ý; không suy từ điểm này ra mastery. Nghe, nói, viết tay và viết tự do chưa được đánh giá.",
    hanzi: "",
    pinyin: "",
    meaning: "",
    readingMinutes: 1,
  };
  const reminders =
    kind === "UNIT_REVIEW"
      ? first.blocks.filter((b) => b.type === "teaching")
      : selections.map(
          (s) =>
            s.p.blocks.find(
              (b) => b.type === "teaching" && b.hanzi.includes(s.c.hanzi),
            )!,
        );
  const context =
    kind === "UNIT_REVIEW"
      ? []
      : first.blocks.filter(
          (b) =>
            b.type === "teaching" &&
            (b.id.endsWith("-reading") || b.id.endsWith("-grammar")),
        );
  p.blocks = [
    guide,
    ...[...reminders, ...context].map((b, i) => ({
      ...b,
      id: `${prefix}-reminder${i}`,
    })),
    ...p.exercises.map((e, i) => ({
      id: `${prefix}-b${i}`,
      type: "exercise" as const,
      exerciseVersionId: e.id,
    })),
  ];
  p.packageHash = contentHash(p);
  outputs.push(p);
  const origins = Object.fromEntries(
    selections.map((s) => [
      s.c.id,
      {
        versionId: s.p.lesson.versionId,
        sha256: s.p.packageHash,
        file: manifest.packages.find(
          (m: { versionId: string }) => m.versionId === s.p.lesson.versionId,
        ).file,
      },
    ]),
  );
  registry.activities.push({
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
    kind,
    sourceVersions: sources.map((s) => s.lesson.versionId),
    origins,
    characterItems,
    scope:
      kind === "CHARACTER_DIAGNOSTIC"
        ? "Six sampled source-listed characters with familiar meaning/pinyin cues, plus reused context; not comprehensive recognition or handwriting assessment."
        : kind === "GRAMMAR_DIAGNOSTIC"
          ? "New bounded condition contrasts, needed-vs-sufficient distinction and typed/ordered clauses; assisted, not independent mastery."
          : "All six taught senses from one unit, familiar-context reading and grammar ordering. New retrieval mode, no new vocabulary.",
  });
  const sourceLesson = catalog.lessons.find(
      (l: { currentVersion: string }) =>
        l.currentVersion === first.lesson.versionId,
    ),
    order =
      Math.max(
        0,
        ...catalog.lessons
          .filter((l: { unitId: string }) => l.unitId === sourceLesson.unitId)
          .map((l: { order: number }) => l.order),
      ) + 1;
  catalog.lessons.push({
    ...sourceLesson,
    id: `62000000-0000-4000-8000-000000000${n}`,
    key: id,
    order,
    currentVersion: p.lesson.versionId,
  });
}
for (const [i, id] of ["L317", "L328", "L365", "L374"].entries()) {
  const p = intros.find((p) => p.lesson.id === id)!;
  build(
    385 + i,
    "UNIT_REVIEW",
    p.concepts.map((c) => ({ p, c })),
  );
}
{
  const p = intros.find((p) => p.lesson.id === "L375")!;
  build(
    389,
    "GRAMMAR_DIAGNOSTIC",
    p.concepts.map((c) => ({ p, c })),
  );
}
for (let i = 0; i < 10; i++) {
  const selected: Selection[] = [];
  for (const p of intros)
    for (const c of p.concepts) {
      const char = [...c.hanzi].find(
        (ch) =>
          chars.includes(ch) &&
          !used.has(ch) &&
          !selected.some((s) => s.char === ch),
      );
      if (char && selected.length < 6 && !selected.some((s) => s.c.id === c.id))
        selected.push({ p, c, char });
    }
  if (selected.length !== 6) throw Error("SAMPLE_CHARACTERS_MISSING");
  build(390 + i, "CHARACTER_DIAGNOSTIC", selected);
}
for (const p of outputs) {
  const issues = validatePackage(p, [...packages, ...outputs], evidence);
  if (issues.length) throw Error(JSON.stringify(issues));
  if (p.exercises.length !== 8) throw Error("REVIEW_SIZE");
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
  const file = `${p.lesson.id}.v1.json`;
  if (fs.existsSync(`${dir}/${file}`)) throw Error("IMMUTABLE_EXISTS");
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(p, null, 2) + "\n");
  manifest.packages.push({
    file,
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
  });
}
for (const [f, v] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
  ["reviews.json", registry],
] as const)
  fs.writeFileSync(`${dir}/${f}`, JSON.stringify(v, null, 2) + "\n");
console.log(
  `15 assisted HSK3 activities /120 exercises; ${used.size}/284 sampled characters. Zero new vocabulary or mastery.`,
);
