// Local review activities reuse taught senses, never count as new vocabulary.
import fs from "node:fs";
import {
  currentDrafts,
  loadDraftCatalog,
  contentHash,
} from "../src/modules/content/application/catalog";
import {
  packageSchema,
  validatePackage,
  gradeContent,
  type ContentPackage,
} from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
import { PINYIN_NORMALIZER } from "../src/modules/content/domain/pinyin";
if (!expansionEnabled()) throw Error("LOCAL_EXPANSION_REQUIRED");
const dir = "content/hsk24",
  read = (f: string) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json"),
  { packages, evidence } = loadDraftCatalog();
if (fs.existsSync(`${dir}/reviews.json`))
  throw Error("REVIEW_BATCH_ALREADY_EXISTS");
const intros = currentDrafts().filter((p) => p.alignment.targetLevel === 2);
if (intros.length !== 34) throw Error("COMPLETE_INTRODUCTIONS_FIRST");
const charSource = JSON.parse(
  fs.readFileSync("docs/hsk24/five-dimensions.json", "utf8"),
).characters as { character: string }[];
const chars = charSource.map((c) => c.character),
  used = new Set<string>();
type Origin = { versionId: string; sha256: string; file: string };
type Item = { character: string; exerciseId: string };
type Activity = {
  versionId: string;
  sha256: string;
  kind: string;
  sourceVersions: string[];
  origins: Record<string, Origin>;
  characterItems: Item[];
  scope: string;
};
const activities: Activity[] = [],
  outputs: ContentPackage[] = [];
function build(
  id: string,
  title: string,
  sources: ContentPackage[],
  selections: {
    p: ContentPackage;
    c: ContentPackage["concepts"][number];
    char?: string;
  }[],
  kind: string,
) {
  const p = structuredClone(sources[0]),
    prefix = id.toLowerCase();
  p.lesson = {
    ...p.lesson,
    id,
    version: 1,
    versionId: `${prefix}-draft-v1`,
    title,
    prerequisites: sources.map((s) => s.lesson.versionId),
    objectives: [
      kind === "UNIT_REVIEW"
        ? "Ôn các nghĩa đã học bằng dạng truy hồi khác; không tính thêm từ mới."
        : "Chẩn đoán mẫu chữ và ngữ cảnh đã học; kết quả từng câu, không chứng nhận trình độ.",
      "Làm lại sau một khoảng nghỉ; thẻ FSRS giữ nguyên danh tính từ bài gốc.",
    ],
    newGrammarPatterns: [],
  };
  p.concepts = selections.map((s) => structuredClone(s.c));
  p.alignment.alignmentEvidence = [
    "Review of taught draft senses; source mapping only, no new vocabulary or competent approval.",
  ];
  for (const field of [
    "vocabularyReferences",
    "grammarReferences",
    "characterReferences",
    "taskReferences",
    "topicReferences",
  ] as const) {
    const refs = sources.flatMap((s) => s.alignment[field]);
    p.alignment[field] = refs.filter(
      (r, i) => refs.findIndex((x) => x.id === r.id) === i,
    );
  }
  p.exercises = [];
  p.privateKeys = [];
  const characterItems: Item[] = [];
  function add(
    c: ContentPackage["concepts"][number],
    type: ContentPackage["exercises"][number]["type"],
    prompt: string,
    choices: string[],
    answer: string,
    feedback: string,
    skill: ContentPackage["exercises"][number]["skill"] = "reading",
  ) {
    const n = p.exercises.length,
      exId = `${prefix}-e${n}`,
      key = `${prefix}-k${n}`;
    if (type === "choice") {
      const shift = (n + 1) % choices.length;
      choices = [...choices.slice(shift), ...choices.slice(0, shift)];
    }
    p.exercises.push({
      id: exId,
      version: 1,
      type,
      skill,
      conceptId: c.id,
      senseId: c.senseId,
      keyRef: key,
      prompt,
      choices,
      inputHint: "Đáp án giới hạn theo nghĩa đã học; chưa chấm viết tự do.",
      requiresAudio: false,
      mediaIds: [],
    });
    p.privateKeys.push({
      id: key,
      version: 1,
      exerciseVersionId: exId,
      senseId: c.senseId,
      accepted: [answer],
      normalizerVersion:
        type === "choice"
          ? "exact-choice-v1"
          : type === "sequence"
            ? "token-order-v1"
            : type === "pinyin"
              ? PINYIN_NORMALIZER
              : "hanzi-nfc-exact-v1",
      gradingVersion: "deterministic-content-v1",
      feedback,
    });
    return exId;
  }
  function recognition(s: (typeof selections)[number], char: string) {
    const at = s.c.hanzi.indexOf(char),
      masked = s.c.hanzi.slice(0, at) + "□" + s.c.hanzi.slice(at + 1);
    const options = [
      char,
      ...chars
        .filter((x) => x !== char)
        .slice(
          (chars.indexOf(char) + 7) % 100,
          ((chars.indexOf(char) + 7) % 100) + 3,
        ),
    ];
    const exId = add(
      s.c,
      "choice",
      `Nhận diện chữ: từ mang nghĩa “${s.c.meaning}” (${s.c.dictionaryPinyin}) viết ${masked}. Điền chữ nào vào □?`,
      options,
      char,
      `${s.c.hanzi} · ${s.c.dictionaryPinyin} · ${s.c.meaning}. Chữ cần nhận diện là ${char}.`,
      "recognition",
    );
    characterItems.push({ character: char, exerciseId: exId });
    used.add(char);
  }
  if (kind === "UNIT_REVIEW") {
    for (const s of selections) {
      const first = s.p.exercises.find((e) => e.conceptId === s.c.id)!;
      if (first.type === "pinyin")
        add(
          s.c,
          "choice",
          `Ôn nghĩa: ${s.c.hanzi} (${s.c.dictionaryPinyin}) trong bài đã học có nghĩa nào?`,
          p.concepts.map((c) => c.meaning),
          s.c.meaning,
          `${s.c.hanzi}: ${s.c.meaning}.`,
        );
      else if (first.type === "short")
        add(
          s.c,
          "pinyin",
          `Ôn cách đọc của ${s.c.hanzi} trong nghĩa “${s.c.meaning}”.`,
          [],
          s.c.dictionaryPinyin,
          `${s.c.dictionaryPinyin} · ${s.c.meaning}`,
          "pinyin",
        );
      else
        add(
          s.c,
          "short",
          `Ôn truy hồi: nhập mục từ của bài có nghĩa “${s.c.meaning}” (${s.c.dictionaryPinyin}).`,
          [],
          s.c.hanzi,
          `${s.c.hanzi} · ${s.c.meaning}.`,
        );
    }
    const s =
      selections.find((s) =>
        [...s.c.hanzi].some((c) => chars.includes(c) && !used.has(c)),
      ) ??
      selections.find((s) => [...s.c.hanzi].some((c) => chars.includes(c)))!;
    const char =
      [...s.c.hanzi].find((c) => chars.includes(c) && !used.has(c)) ??
      [...s.c.hanzi].find((c) => chars.includes(c));
    if (!char) throw Error("NO_RECOGNITION_CHARACTER");
    recognition(s, char);
  } else for (const s of selections) recognition(s, s.char!);
  const source = sources[0];
  const candidates = sources.flatMap((source) =>
    source.exercises
      .filter((e) => p.concepts.some((c) => c.id === e.conceptId))
      .map((e) => ({ source, e })),
  );
  const extra = [
    ...candidates.filter((x) => x.e.type === "sequence"),
    ...candidates.filter((x) => x.e.type === "choice").slice(-1),
    ...candidates.filter((x) => x.e.type !== "sequence"),
  ];
  // Reuse the taught passage/order task explicitly; changed retrieval above is new.
  while (p.exercises.length < 8) {
    const item =
        extra[
          (p.exercises.length -
            selections.length -
            (kind === "UNIT_REVIEW" ? 1 : 0) +
            (kind === "UNIT_REVIEW" && Number(id.slice(1)) % 2 === 0 ? 1 : 0)) %
            extra.length
        ],
      e = item.e,
      c = p.concepts.find((c) => c.id === e.conceptId)!;
    const key = item.source.privateKeys.find((k) => k.id === e.keyRef)!;
    add(
      c,
      e.type,
      `Ôn ngữ cảnh đã học · ${p.exercises.length + 1}: ${e.prompt}`,
      e.choices,
      key.accepted[0],
      key.feedback,
      e.skill,
    );
  }
  p.blocks = [
    {
      id: `${prefix}-guide`,
      type: "teaching",
      title:
        kind === "UNIT_REVIEW"
          ? "Ôn tập sau bài"
          : "Chẩn đoán mẫu · không phải đề HSK",
      text: "Hãy nghỉ rồi quay lại làm trước khi mở lại gợi ý. Có thể xem phần nhắc lại, vì vậy đây là luyện tập có hỗ trợ, không phải điểm năng lực độc lập. Nghe, nói và viết tự do chưa được đánh giá.",
      hanzi: "",
      pinyin: "",
      meaning: "",
      readingMinutes: 1,
    },
    ...sources.flatMap((s) =>
      s.blocks
        .filter((b) => b.type === "teaching")
        .map((b) => ({
          ...b,
          id: `${prefix}-t${sources.indexOf(s)}-${b.id}`,
          title: `Nhắc lại · ${b.title}`,
        })),
    ),
    ...p.exercises.map((e, i) => ({
      id: `${prefix}-b${i}`,
      type: "exercise" as const,
      exerciseVersionId: e.id,
    })),
  ];
  // Diagnostic reminders are bounded to six selected senses and one source passage.
  if (kind !== "UNIT_REVIEW") {
    const reminders = selections.map(
      (s) =>
        s.p.blocks.find(
          (b) => b.type === "teaching" && b.hanzi.includes(s.c.hanzi),
        )!,
    );
    const context = sources.flatMap((s) =>
      s.blocks.filter((b) => b.type === "teaching").slice(-1),
    );
    p.blocks = [
      p.blocks[0],
      ...reminders.map((b, i) => ({ ...b, id: `${prefix}-reminder${i}` })),
      ...context.map((b, i) => ({ ...b, id: `${prefix}-context${i}` })),
      ...p.exercises.map((e, i) => ({
        id: `${prefix}-b${i}`,
        type: "exercise" as const,
        exerciseVersionId: e.id,
      })),
    ];
  }
  p.packageHash = contentHash(p);
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
  activities.push({
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
    kind,
    sourceVersions: sources.map((s) => s.lesson.versionId),
    origins,
    characterItems,
    scope:
      kind === "UNIT_REVIEW"
        ? "All senses of one introduction; one explicit character item plus context/order retrieval. No new words."
        : "Six sampled characters from taught words plus a reused reading/order context. Not a comprehensive exam.",
  });
  outputs.push(packageSchema.parse(p));
  const sourceLesson = catalog.lessons.find(
    (l: { currentVersion: string }) =>
      l.currentVersion === source.lesson.versionId,
  );
  const order =
    kind === "UNIT_REVIEW"
      ? 1
      : Math.max(
          1,
          ...catalog.lessons
            .filter((l: { unitId: string }) => l.unitId === sourceLesson.unitId)
            .map((l: { order: number }) => l.order),
        ) + 1;
  catalog.lessons.push({
    ...sourceLesson,
    id: `62000000-0000-4000-8000-000000000${id.slice(1)}`,
    key: id,
    order,
    currentVersion: p.lesson.versionId,
  });
}
for (const [i, p] of intros.entries())
  build(
    `L${241 + i}`,
    `Ôn tập · ${p.lesson.title}`,
    [p],
    p.concepts.map((c) => ({ p, c })),
    "UNIT_REVIEW",
  );
for (let i = 0; i < 21; i++) {
  const selections: {
    p: ContentPackage;
    c: ContentPackage["concepts"][number];
    char: string;
  }[] = [];
  for (const p of intros)
    for (const c of p.concepts) {
      const char = [...c.hanzi].find(
        (x) =>
          chars.includes(x) &&
          !used.has(x) &&
          !selections.some((s) => s.char === x),
      );
      if (
        char &&
        selections.length < 6 &&
        !selections.some((s) => s.c.id === c.id)
      )
        selections.push({ p, c, char });
    }
  if (selections.length === 0) break;
  if (selections.length < 4)
    for (const p of intros)
      for (const c of p.concepts) {
        const char = [...c.hanzi].find((x) => chars.includes(x));
        if (
          char &&
          selections.length < 4 &&
          !selections.some((s) => s.c.id === c.id)
        )
          selections.push({ p, c, char });
      }
  const sources = [...new Set(selections.map((s) => s.p))];
  build(
    `L${275 + i}`,
    `Chẩn đoán mẫu chữ và ngữ cảnh · ${i + 1}`,
    sources,
    selections,
    "COURSE_DIAGNOSTIC",
  );
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
      throw Error("REVIEW_ANSWER_INVALID");
  }
}
for (const p of outputs) {
  const file = `${p.lesson.id}.v1.json`;
  if (fs.existsSync(`${dir}/${file}`)) throw Error("IMMUTABLE_REVIEW_EXISTS");
  manifest.packages.push({
    file,
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
  });
}
for (const p of outputs)
  fs.writeFileSync(
    `${dir}/${p.lesson.id}.v1.json`,
    JSON.stringify(p, null, 2) + "\n",
  );
for (const [file, data] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
  [
    "reviews.json",
    {
      schemaVersion: 1,
      policy: "LOCAL_DRAFT_ONLY",
      newVocabulary: 0,
      activities,
    },
  ],
] as const)
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(data, null, 2) + "\n");
console.log(
  `${outputs.length} review/diagnostic activities; ${used.size}/125 explicit character items; zero new vocabulary.`,
);
