// Two periodic assisted activities, preserving exact origin senses and card identity.
import fs from "node:fs";
import { localCurriculumUuid } from "../src/modules/curriculum/domain/local-identifiers";
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
const batch = Number(process.argv[2]);
const schedule = [4, 6, 8, 9, 18, 21, 24, 27, 30, 33, 36, 39, 42];
const pair = schedule.indexOf(batch);
if (pair < 0) throw Error("PERIODIC_BATCH_REQUIRED");
const dir = "content/hsk24",
  read = (f: string) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json"),
  registry = read("reviews.json");
const { packages, evidence } = loadDraftCatalog();
const intros = currentDrafts().filter(
  (p) =>
    p.alignment.targetLevel === 4 &&
    !registry.activities.some(
      (a: { versionId: string }) => a.versionId === p.lesson.versionId,
    ),
);
if (intros.length < batch * 4) throw Error("INTRODUCTIONS_FIRST");
const rows = JSON.parse(
  fs.readFileSync("docs/hsk24/hsk4-coverage.json", "utf8"),
).recognition as { character: string }[];
const chars = new Set(rows.map((r) => r.character));
const used = new Set<string>(
  registry.activities
    .filter((a: { versionId: string }) => a.versionId.startsWith("l4"))
    .flatMap((a: { characterItems: { character: string }[] }) =>
      a.characterItems.map((x) => x.character),
    ),
);
type Selection = {
  p: ContentPackage;
  c: ContentPackage["concepts"][number];
  char?: string;
};
const outputs: ContentPackage[] = [];
for (const kind of ["UNIT_REVIEW", "CHARACTER_DIAGNOSTIC"] as const) {
  const base =
    pair < 4
      ? 481 + pair * 2
      : pair < 6
        ? 493 + (pair - 4) * 2
        : 49001 + (pair - 6) * 2;
  const number = base + (kind === "CHARACTER_DIAGNOSTIC" ? 1 : 0),
    id = `L${number}`,
    prefix = id.toLowerCase();
  if (catalog.lessons.some((l: { key: string }) => l.key === id))
    throw Error("IMMUTABLE_REVIEW_EXISTS");
  const firstRecent =
    batch >= 22 ? 4001 + (batch - 23) * 4 : 401 + (batch - 2) * 4;
  const unit = intros.find((p) => p.lesson.id === `L${firstRecent}`)!;
  if (!unit) throw Error("SOURCE_UNIT_MISSING");
  const selected: Selection[] =
    kind === "UNIT_REVIEW" ? unit.concepts.map((c) => ({ p: unit, c })) : [];
  if (kind === "CHARACTER_DIAGNOSTIC")
    for (const p of [
      ...intros.filter((p) => Number(p.lesson.id.slice(1)) >= firstRecent),
      ...intros,
    ])
      for (const c of p.concepts) {
        const char = [...c.hanzi].find(
          (x) =>
            chars.has(x) && !used.has(x) && !selected.some((s) => s.char === x),
        );
        if (
          char &&
          selected.length < 6 &&
          !selected.some((s) => s.c.id === c.id)
        ) {
          selected.push({ p, c, char });
          used.add(char);
        }
      }
  if (selected.length !== 6) throw Error("SIX_SOURCE_SENSES_REQUIRED");
  const sources = [...new Set(selected.map((s) => s.p))],
    first = sources[0],
    p = structuredClone(first);
  p.lesson = {
    ...p.lesson,
    id,
    version: 1,
    versionId: `${prefix}-draft-v1`,
    title:
      kind === "UNIT_REVIEW"
        ? `Ôn HSK4 sau batch ${batch} · ${first.lesson.title}`
        : `Chẩn đoán nhận diện HSK4 · mốc batch ${batch}`,
    estimatedMinutes: 15,
    prerequisites: sources.map((s) => s.lesson.versionId),
    objectives: [
      "Ôn từ/cấu trúc đã học trong ngữ cảnh quen; không thêm từ vựng.",
      "Có hỗ trợ, không phải đề HSK, không cấp mastery hay đánh giá viết tay.",
    ],
  };
  p.concepts = selected.map((s) => structuredClone(s.c));
  for (const field of [
    "vocabularyReferences",
    "grammarReferences",
    "topicReferences",
    "taskReferences",
    "characterReferences",
  ] as const) {
    const refs = sources.flatMap((s) => s.alignment[field]);
    p.alignment[field] = refs.filter(
      (v, i) => refs.findIndex((x) => x.id === v.id) === i,
    );
  }
  p.alignment.alignmentCheckedAt = new Date().toISOString();
  p.exercises = [];
  p.privateKeys = [];
  const characterItems: { character: string; exerciseId: string }[] = [];
  function add(
    concept: (typeof p.concepts)[number],
    type: (typeof p.exercises)[number]["type"],
    prompt: string,
    choices: string[],
    accepted: string[],
    feedback: string,
    skill: (typeof p.exercises)[number]["skill"] = "reading",
  ) {
    const n = p.exercises.length,
      eid = `${prefix}-e${n}`,
      kid = `${prefix}-k${n}`;
    if (type === "choice") {
      const shift = (n + 1) % choices.length;
      choices = [...choices.slice(shift), ...choices.slice(0, shift)];
    }
    p.exercises.push({
      id: eid,
      version: 1,
      type,
      skill,
      conceptId: concept.id,
      senseId: concept.senseId,
      keyRef: kid,
      prompt,
      choices,
      inputHint: "Phạm vi có giới hạn trong đề; không chấm văn viết tự do.",
      requiresAudio: false,
      mediaIds: [],
    });
    p.privateKeys.push({
      id: kid,
      version: 1,
      exerciseVersionId: eid,
      senseId: concept.senseId,
      accepted,
      normalizerVersion:
        type === "choice"
          ? "exact-choice-v1"
          : type === "sequence"
            ? "token-order-v1"
            : type === "pinyin"
              ? "pinyin-nfc-tone-v1"
              : "hanzi-nfc-exact-v1",
      gradingVersion: "deterministic-content-v1",
      feedback,
    });
    return eid;
  }
  for (const [i, s] of selected.entries()) {
    if (kind === "CHARACTER_DIAGNOSTIC") {
      const char = s.char!,
        masked = s.c.hanzi.replace(char, "□");
      const other = [...chars].filter((x) => x !== char);
      const start = (i * 47 + pair * 13) % (other.length - 3);
      const eid = add(
        s.c,
        "choice",
        `Nhận diện từ đã học “${s.c.meaning}”: ${masked} (${s.c.dictionaryPinyin}). Chọn chữ điền ô.`,
        [char, ...other.slice(start, start + 3)],
        [char],
        `Chữ ${char} thuộc từ ${s.c.hanzi}; đây là nhận diện có gợi ý, chưa đánh giá viết tay.`,
        "recognition",
      );
      characterItems.push({ character: char, exerciseId: eid });
    } else {
      const old = s.p.exercises.find((e) => e.conceptId === s.c.id)!,
        key = s.p.privateKeys.find((k) => k.id === old.keyRef)!;
      if (i % 2 === 0)
        add(
          s.c,
          "pinyin",
          `Ôn cách đọc ${s.c.hanzi} trong nghĩa “${s.c.meaning}”.`,
          [],
          [s.c.dictionaryPinyin],
          `Đọc ${s.c.dictionaryPinyin}, đúng nghĩa đã học.`,
          "pinyin",
        );
      else
        add(
          s.c,
          old.type,
          `Ôn trong phạm vi nghĩa đã học · ${old.prompt}`,
          old.choices,
          key.accepted,
          key.feedback,
          old.skill,
        );
    }
  }
  for (const index of [6, 7]) {
    const e = first.exercises[index],
      key = first.privateKeys.find((k) => k.id === e.keyRef)!;
    add(
      p.concepts[0],
      e.type,
      `Đọc lại ngữ cảnh nhắc dưới đây · ${e.prompt}`,
      e.choices,
      key.accepted,
      key.feedback,
      e.skill,
    );
    p.exercises.at(-1)!.evidenceScope = "CONTEXT_ONLY";
  }
  const reminders =
    kind === "UNIT_REVIEW"
      ? first.blocks.filter((b) => b.type === "teaching")
      : selected
          .map(
            (s) =>
              s.p.blocks.find(
                (b) => b.type === "teaching" && b.hanzi.includes(s.c.hanzi),
              )!,
          )
          .concat(
            first.blocks.filter(
              (b) =>
                b.type === "teaching" &&
                (b.id.endsWith("-reading") || b.id.endsWith("-grammar")),
            ),
          );
  p.blocks = [
    {
      id: `${prefix}-guide`,
      type: "teaching",
      title: "Ôn có hỗ trợ · không phải bài thi",
      text: "Nên thử nhớ trước khi xem phần nhắc. Các ví dụ và ngữ cảnh được lặp có chủ đích để ôn; không tính thêm từ, không xác nhận năng lực độc lập.",
      hanzi: "",
      pinyin: "",
      meaning: "",
      readingMinutes: 1,
    },
    ...reminders.map((b, i) => ({ ...b, id: `${prefix}-reminder${i}` })),
    ...p.exercises.map((e, i) => ({
      id: `${prefix}-b${i}`,
      type: "exercise" as const,
      exerciseVersionId: e.id,
    })),
  ];
  p.packageHash = contentHash(p);
  outputs.push(p);
  registry.activities.push({
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
    kind,
    sourceVersions: sources.map((s) => s.lesson.versionId),
    origins: Object.fromEntries(
      selected.map((s) => [
        s.c.id,
        {
          versionId: s.p.lesson.versionId,
          sha256: s.p.packageHash,
          file: manifest.packages.find(
            (m: { versionId: string }) => m.versionId === s.p.lesson.versionId,
          ).file,
        },
      ]),
    ),
    characterItems,
    scope:
      kind === "UNIT_REVIEW"
        ? "Six original senses, altered recall modes, familiar written comprehension and grammar ordering. No new vocabulary."
        : "Six sampled HSK4 characters with meaning/pinyin support plus familiar reading/ordering. No comprehensive recognition, listening or handwriting claim.",
  });
  const sourceLesson = catalog.lessons.find(
    (l: { currentVersion: string }) =>
      l.currentVersion === first.lesson.versionId,
  );
  const order =
    1 +
    Math.max(
      0,
      ...catalog.lessons
        .filter((l: { unitId: string }) => l.unitId === sourceLesson.unitId)
        .map((l: { order: number }) => l.order),
    );
  catalog.lessons.push({
    ...sourceLesson,
    id: localCurriculumUuid(number),
    key: id,
    order,
    currentVersion: p.lesson.versionId,
  });
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
  `Batch${batch}:2 HSK4 assisted activities/16 exercises; zero new vocabulary.`,
);
