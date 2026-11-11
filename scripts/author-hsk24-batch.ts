import fs from "node:fs";
import { localCurriculumUuid } from "../src/modules/curriculum/domain/local-identifiers";
import { execFileSync } from "node:child_process";
import {
  packageSchema,
  type ContentPackage,
  type SourceReference,
  validatePackage,
  gradeContent,
} from "../src/modules/content/domain/package";
import {
  contentHash,
  loadDraftCatalog,
} from "../src/modules/content/application/catalog";
import { PINYIN_NORMALIZER } from "../src/modules/content/domain/pinyin";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
import { glyphPrompt } from "./hsk24-glyph-prompt";
type LessonInput = {
  version?: number;
  id: string;
  unit: string;
  title: string;
  unitTitle?: string;
  objective: string;
  prerequisite: string;
  grammar: [string, string, number, string, string];
  task: [string, string, number, string];
  topic: [string, string, number, string];
  words: string[][];
  passage: string[];
  comprehension: [string, string[], string, string];
  sequence: [string, string[], string];
  supplementary?: string[][];
  // Explicit supporting characters must occur in teaching text and the pinned list.
  characterTargets?: string[];
  prerequisiteVersions?: string[];
  practice?: {
    concept: number;
    type: "choice" | "short" | "pinyin";
    prompt: string;
    choices: string[];
    accepted: string[];
    feedback: string;
    skill?: "recognition";
  }[];
};
const file = process.argv[2];
if (
  !expansionEnabled() ||
  !/^content\/hsk24\/batch\d+\.authoring\.json$/.test(file ?? "")
)
  throw Error("BOUNDED_LOCAL_BATCH_REQUIRED");
const input = JSON.parse(fs.readFileSync(file, "utf8")) as {
  batch: string;
  targetLevel?: 1 | 2 | 3 | 4;
  sourceCheckedAt?: string;
  lessons: LessonInput[];
};
const level = input.targetLevel ?? 2;
if (![1, 2, 3, 4].includes(level))
  throw Error("SUPPORTED_LOCAL_LEVEL_REQUIRED");
if (input.lessons.some((l) => !l.id.startsWith(`L${level}`)))
  throw Error("LESSON_LEVEL_PREFIX");
if (
  input.lessons.length < 4 ||
  input.lessons.length > 6 ||
  input.lessons.some((l) => l.words.length < 4 || l.words.length > 6)
)
  throw Error("BOUNDED_BATCH_SIZE");
const lessonIds = input.lessons.map((l) => l.id),
  unitSlugs = input.lessons.map((l) => l.unit);
if (
  new Set(lessonIds).size !== lessonIds.length ||
  (level !== 1 && new Set(unitSlugs).size !== unitSlugs.length)
)
  throw Error("DUPLICATE_BATCH_LESSON_OR_UNIT");
const notes = input.lessons.flatMap((l) => l.words.map((w) => w[3].trim()));
if (new Set(notes).size !== notes.length) throw Error("DUPLICATE_EXPLANATION");
function grams(s: string) {
  const t = s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/);
  return new Set(t.slice(0, -2).map((_, i) => t.slice(i, i + 3).join(" ")));
}
for (let i = 0; i < notes.length; i++)
  for (let j = 0; j < i; j++) {
    const a = grams(notes[i]),
      b = grams(notes[j]);
    if (
      a.size > 8 &&
      b.size > 8 &&
      [...a].filter((x) => b.has(x)).length / Math.min(a.size, b.size) > 0.9
    )
      throw Error("NEAR_DUPLICATE_EXPLANATION");
  }
const checked = JSON.parse(
  execFileSync(
    process.env.CSH_PYTHON ??
      "C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
    ["-X", "utf8", "scripts/prepare-hsk24-batch.py", file],
    { encoding: "utf8", windowsHide: true },
  ),
);
const dir = "content/hsk24";
const manifest = JSON.parse(fs.readFileSync(`${dir}/manifest.json`, "utf8"));
const catalog = JSON.parse(fs.readFileSync(`${dir}/catalog.json`, "utf8"));
for (const l of input.lessons) {
  const same = catalog.lessons.find((x: { key: string }) => x.key === l.id);
  if (!same && !/^[a-z][a-z-]*$/.test(l.unit))
    throw Error("INVALID_NEW_UNIT_SLUG");
  if (!same && level === 4 && l.sequence[1].length < 3)
    throw Error("MEANINGFUL_HSK4_ORDERING_REQUIRED");
  if (
    !same &&
    l.practice?.some(
      (item) =>
        item.prompt.startsWith("Nhận diện chữ") && item.skill !== "recognition",
    )
  )
    throw Error("GLYPH_RECOGNITION_SKILL_REQUIRED");
  if (
    same &&
    !manifest.packages.some(
      (m: { versionId: string }) => m.versionId === same.currentVersion,
    )
  )
    throw Error("LESSON_ID_COLLISION");
  if (
    !same &&
    level !== 1 &&
    catalog.units.some((u: { slug: string }) => u.slug === l.unit)
  )
    throw Error("UNIT_SLUG_COLLISION");
}
const evidence = JSON.parse(fs.readFileSync(`${dir}/evidence.json`, "utf8"));
const { packages, evidence: allEvidence } = loadDraftCatalog();
const coverage = JSON.parse(
  fs.readFileSync("docs/hsk24/coverage.json", "utf8"),
);
const template = packageSchema.parse(
  JSON.parse(fs.readFileSync(`${dir}/L201.v1.json`, "utf8")),
);
const refs: SourceReference[] = [];
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
    officialLevel: level,
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
    note: "Checked exact pinned PDF entry/reading/category. Original Vietnamese sense/teaching interpretation remains DRAFT without human approval.",
  };
}
const outputs: ContentPackage[] = [];
// Digits disambiguate official entries, not characters a learner should type.
const teachingHanzi = (w: string[]) => w[0].replace(/\d+$/, "");
for (const l of input.lessons) {
  const prefix = l.id.toLowerCase(),
    version = l.version ?? 1;
  const vocab = l.words.map((w) => {
    const s = checked.words[`${w[0]}@${w[1].replaceAll(" ", "")}`];
    const row = coverage.vocabulary.find(
      (r: { ordinal: number }) => r.ordinal === s.ordinal,
    );
    if (!row || row.introductionLevel !== level)
      throw Error("COVERAGE_SOURCE_DRIFT");
    return {
      ...ref(
        `${prefix}-v-${s.ordinal}`,
        "vocabulary",
        w[0],
        s.page,
        `ordinal ${s.ordinal}`,
        s.ordinal,
        s.pinyin,
      ),
      note: `${s.annotation}; ${w[3]} Original teaching sense unreviewed.`,
    };
  });
  const mapping = (
    x: [string, string, number, string, string?],
    kind: SourceReference["kind"],
  ) => ref(x[0], kind, x[1], x[2], x[3]);
  const grammar = mapping(l.grammar, "grammar"),
    task = mapping(l.task, "task"),
    topic = mapping(l.topic, "topic");
  // Reuse exact existing source records when identifiers overlap.
  const sourceRefs = [
    ...vocab,
    grammar,
    task,
    topic,
    ...[
      ...new Set([
        ...l.words.flatMap((w) => [...w[0]]),
        ...(l.characterTargets ?? []),
      ]),
    ]
      .filter((c) => checked.characters[c])
      .map((c) =>
        ref(
          `h${level}-char-${checked.characters[c].ordinal}`,
          "character",
          c,
          checked.characters[c].page,
          `${checked.characters[c].ordinal}`,
          checked.characters[c].ordinal,
        ),
      ),
  ].map((r) => {
    const old =
      evidence.references.find((e: SourceReference) => e.id === r.id) ??
      refs.find((e) => e.id === r.id);
    if (old) {
      const tuple = (x: SourceReference) =>
        JSON.stringify([
          x.kind,
          x.officialLevel,
          x.sourceLocator,
          x.written,
          x.pinyin,
          x.ordinal,
          x.senseId,
        ]);
      if (tuple(old) !== tuple(r))
        throw Error("REFERENCE_ID_COLLISION:" + r.id);
    }
    return old ?? r;
  });
  refs.push(
    ...sourceRefs.filter(
      (r) =>
        !refs.some((e) => e.id === r.id) &&
        !evidence.references.some((e: SourceReference) => e.id === r.id),
    ),
  );
  const concepts = l.words.map((w, i) => ({
    id: `${prefix}-c${i}`,
    version: 1 as const,
    senseId: vocab[i].senseId!,
    hanzi: teachingHanzi(w),
    dictionaryPinyin: w[1],
    meaning: w[2],
    skills: ["recognition", "reading", "pinyin"] as (
      | "recognition"
      | "reading"
      | "pinyin"
    )[],
    referenceIds: [vocab[i].id],
    scope: "TARGET" as const,
  }));
  const exercises: ContentPackage["exercises"] = [],
    keys: ContentPackage["privateKeys"] = [];
  function ex(
    concept: number,
    type: ContentPackage["exercises"][number]["type"],
    prompt: string,
    choices: string[],
    answer: string,
    feedback: string,
  ) {
    const n = exercises.length,
      id = `${prefix}-v${version}-e${n}`,
      key = `${prefix}-v${version}-k${n}`;
    if (type === "choice") {
      const shift = (n + 1) % choices.length;
      choices = [...choices.slice(shift), ...choices.slice(0, shift)];
    }
    exercises.push({
      id,
      version: 1,
      type,
      skill: type === "pinyin" ? "pinyin" : "reading",
      conceptId: concepts[concept].id,
      senseId: concepts[concept].senseId,
      keyRef: key,
      prompt,
      choices,
      inputHint:
        type === "short"
          ? "Chỉ nhập từ được hỏi; không chấm văn viết tự do."
          : "",
      requiresAudio: false,
      mediaIds: [],
    });
    keys.push({
      id: key,
      version: 1,
      exerciseVersionId: id,
      senseId: concepts[concept].senseId,
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
  }
  if (l.practice) {
    if (
      l.practice.length !== 6 ||
      new Set(l.practice.map((x) => x.concept)).size !== l.words.length ||
      l.practice.some((x) => x.concept < 0 || x.concept >= l.words.length)
    )
      throw Error("EXPLICIT_PRACTICE_MATRIX_REQUIRED");
    for (const item of l.practice) {
      if (item.skill === "recognition") {
        const w = l.words[item.concept];
        item.prompt = glyphPrompt(
          teachingHanzi(w),
          item.accepted[0],
          w[2],
          w[1],
          w[4],
        );
      }
      ex(
        item.concept,
        item.type,
        item.prompt,
        item.choices,
        item.accepted[0],
        item.feedback,
      );
      keys.at(-1)!.accepted = item.accepted;
      if (item.skill) exercises.at(-1)!.skill = item.skill;
    }
  } else
    l.words.forEach((w, i) => {
      if (i % 3 === 0)
        ex(
          i,
          "choice",
          `Trong câu “${w[4]}”, ${teachingHanzi(w)} mang nghĩa nào?`,
          l.words.map((x) => x[2]),
          w[2],
          `${teachingHanzi(w)}: ${w[2]}. ${w[3]} ${w[6]}`,
        );
      else if (i % 3 === 1)
        ex(
          i,
          "pinyin",
          `Viết pinyin của ${teachingHanzi(w)} trong nghĩa “${w[2]}”.`,
          [],
          w[1],
          `Đọc ${w[1]}. ${w[3]}`,
        );
      else
        ex(
          i,
          "short",
          `Chỉ nhập mục từ tiếng Trung của bài có nghĩa “${w[2]}”.`,
          [],
          teachingHanzi(w),
          `Đáp án giới hạn: ${teachingHanzi(w)}. ${w[3]}`,
        );
    });
  ex(
    0,
    "choice",
    l.comprehension[0],
    l.comprehension[1],
    l.comprehension[2],
    l.comprehension[3],
  );
  ex(
    3,
    "sequence",
    l.sequence[0],
    l.sequence[1],
    l.sequence[2],
    `Xem lại cách đặt các thành phần trong ví dụ. ${l.grammar[4]}`,
  );
  exercises[6].evidenceScope = "CONTEXT_ONLY";
  exercises[7].evidenceScope = "CONTEXT_ONLY";
  const supplemental = (l.supplementary ?? []).map((w, i) => ({
    id: `${prefix}-extra${i}`,
    kind: "vocabulary" as const,
    status: "SUPPLEMENTARY" as const,
    officialLevel: null,
    sourceLocator: null,
    written: w[0],
    pinyin: w[1],
    senseId: `${prefix}-extra${i}-sense`,
    ordinal: null,
    note: w[2],
  }));
  const p = packageSchema.parse({
    ...template,
    ...(level === 1 ? { course: { id: "hsk1-local-course", version: 1 } } : {}),
    packageHash: "0".repeat(64),
    unit: { id: l.unit, version: 1 },
    lesson: {
      ...template.lesson,
      id: l.id,
      version,
      versionId: `${prefix}-draft-v${version}`,
      title: l.title,
      estimatedMinutes: 20,
      objectives: [
        l.objective,
        "Luyện đọc và nhớ từ; kết quả nháp không phải mastery.",
      ],
      newGrammarPatterns: [l.grammar[1]],
      prerequisites: l.prerequisiteVersions ?? template.lesson.prerequisites,
    },
    alignment: {
      ...template.alignment,
      alignmentCheckedAt:
        input.sourceCheckedAt ?? template.alignment.alignmentCheckedAt,
      targetLevel: level,
      sourceLocator: task.sourceLocator,
      alignmentEvidence: [
        "Original teaching batch; exact PDF reference check; Vietnamese sense interpretation unreviewed.",
      ],
      vocabularyReferences: [
        ...sourceRefs.filter((r) => r.kind === "vocabulary"),
        ...supplemental,
      ],
      grammarReferences: sourceRefs.filter((r) => r.kind === "grammar"),
      taskReferences: sourceRefs.filter((r) => r.kind === "task"),
      topicReferences: sourceRefs.filter((r) => r.kind === "topic"),
      characterReferences: sourceRefs.filter((r) => r.kind === "character"),
    },
    concepts,
    blocks: [
      {
        id: `${prefix}-prereq`,
        type: "teaching",
        title: "Kiến thức cần nhắc lại",
        text: l.prerequisite,
        hanzi: "",
        pinyin: "",
        meaning: "",
        readingMinutes: 1,
      },
      ...l.words.map((w, i) => ({
        id: `${prefix}-t${i}`,
        type: "teaching",
        title: `${teachingHanzi(w)} · ${w[2]}`,
        text: w[3],
        hanzi: w[4],
        pinyin: w[5],
        meaning: w[6],
        readingMinutes: 1,
      })),
      {
        id: `${prefix}-grammar`,
        type: "teaching",
        title: "Cách nói trong ngữ cảnh",
        text: l.grammar[4],
        hanzi: "",
        pinyin: "",
        meaning: "",
        readingMinutes: 2,
      },
      {
        id: `${prefix}-reading`,
        type: "teaching",
        title: "Đọc và hiểu tình huống",
        text: "Đọc lời từng người; chỉ trả lời theo thông tin trong đoạn. Chưa có audio tham chiếu, đây là luyện đọc.",
        hanzi: l.passage[0],
        pinyin: l.passage[1],
        meaning: l.passage[2],
        readingMinutes: 2,
      },
      ...exercises.map((e, i) => ({
        id: `${prefix}-b${i}`,
        type: "exercise",
        exerciseVersionId: e.id,
      })),
    ],
    exercises,
    privateKeys: keys,
  });
  p.packageHash = contentHash(p);
  outputs.push(p);
}
const candidateOrdinals = outputs.flatMap((p) =>
  p.alignment.vocabularyReferences
    .filter((r) => r.status === "VERIFIED")
    .map((r) => r.ordinal),
);
if (new Set(candidateOrdinals).size !== candidateOrdinals.length)
  throw Error("DUPLICATE_BATCH_TARGET_ENTRY");
const mergedEvidence = {
  ...allEvidence,
  references: [...allEvidence.references, ...refs],
};
for (const p of outputs) {
  const issues = validatePackage(p, [...packages, ...outputs], mergedEvidence);
  if (issues.length) throw Error(JSON.stringify(issues));
  for (const c of p.concepts) {
    if (
      !p.blocks.some(
        (b) => b.type === "teaching" && b.hanzi.includes(c.hanzi),
      ) ||
      !p.exercises.some((e) => e.conceptId === c.id)
    )
      throw Error("UNTAUGHT_CONCEPT");
  }
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
      throw Error("ANSWER_CONTRACT");
  }
  const old = manifest.packages.find(
    (m: { versionId: string }) => m.versionId === p.lesson.versionId,
  );
  if (old && old.sha256 !== p.packageHash)
    throw Error("IMMUTABLE_VERSION_CONFLICT:" + p.lesson.id);
  if (!old) {
    for (const r of p.alignment.vocabularyReferences.filter(
      (r) => r.status === "VERIFIED",
    ))
      if (
        packages.some(
          (q) =>
            q.lesson.id !== p.lesson.id &&
            q.alignment.targetLevel === level &&
            q.alignment.vocabularyReferences.some(
              (x) =>
                x.ordinal === r.ordinal &&
                q.concepts.some((c) => c.referenceIds.includes(x.id)),
            ),
        )
      )
        throw Error("DUPLICATE_TARGET_ENTRY");
  }
}
// Every candidate is validated before the first write; existing immutable versions are skipped.
for (const p of outputs) {
  if (
    manifest.packages.some(
      (m: { versionId: string }) => m.versionId === p.lesson.versionId,
    )
  )
    continue;
  const file = `${p.lesson.id}.v${p.lesson.version}.json`;
  const bytes = JSON.stringify(p, null, 2) + "\n";
  if (fs.existsSync(`${dir}/${file}`)) {
    if (
      fs.readFileSync(`${dir}/${file}`, "utf8").replaceAll("\r\n", "\n") !==
      bytes
    )
      throw Error("IMMUTABLE_ORPHAN_CONFLICT");
  } else fs.writeFileSync(`${dir}/${file}`, bytes, { flag: "wx" });
  manifest.packages.push({
    file,
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
  });
  const existingLesson = catalog.lessons.find(
    (l: { key: string }) => l.key === p.lesson.id,
  );
  if (existingLesson) {
    existingLesson.currentVersion = p.lesson.versionId;
    continue;
  }
  const number = Number(p.lesson.id.slice(1));
  const reusedUnit =
    level === 1
      ? catalog.units.find(
          (u: { slug: string; courseId: string }) =>
            u.slug === p.unit.id && u.courseId === catalog.courses[1].id,
        )
      : undefined;
  const unitId = reusedUnit?.id ?? localCurriculumUuid(number - 100);
  if (!reusedUnit)
    catalog.units.push({
      id: unitId,
      slug: p.unit.id,
      courseId: catalog.courses[level].id,
      order: catalog.units.filter(
        (u: { courseId: string }) => u.courseId === catalog.courses[level].id,
      ).length,
      title:
        input.lessons.find((l) => l.id === p.lesson.id)!.unitTitle ??
        p.lesson.title,
      objective: p.lesson.objectives[0],
      prerequisites:
        level === 1
          ? [
              ...new Set(
                p.lesson.prerequisites
                  .map(
                    (v) =>
                      catalog.lessons.find(
                        (x: { currentVersion: string }) =>
                          x.currentVersion === v,
                      )?.unitId,
                  )
                  .filter(Boolean),
              ),
            ]
          : [catalog.units[3].id],
      availability: "PRACTICE_ONLY",
    });
  catalog.lessons.push({
    id: localCurriculumUuid(number),
    key: p.lesson.id,
    unitId,
    order:
      level === 1
        ? catalog.lessons.filter((x: { unitId: string }) => x.unitId === unitId)
            .length
        : 0,
    currentVersion: p.lesson.versionId,
    localDraftAllowed: true,
    requirements: [
      ...(level === 1
        ? catalog.lessons.find((x: { key: string }) => x.key === "L001")
            .requirements
        : catalog.lessons[3].requirements),
      ...(level >= 3
        ? [{ conceptId: "l234-c0", skill: "reading", rule: "secure" }]
        : []),
      ...(level === 4
        ? [{ conceptId: "l375-c3", skill: "reading", rule: "secure" }]
        : []),
    ],
  });
}
evidence.references.push(...refs);
// The description remains stable across future additive imports.
catalog.courses[2].description =
  "Học liệu HSK2 nháp cục bộ theo batch. Phạm vi hiện có chưa phải hoàn tất toàn cấp; mastery và publication vẫn bị khóa.";
if (level === 3)
  Object.assign(catalog.courses[3], {
    releaseRef: template.release.id,
    availability: "PRACTICE_ONLY",
    coverageVerified: false,
    description:
      "Học liệu HSK3 nháp cục bộ theo batch; đang xây dựng, chưa đủ toàn cấp. Luyện khám phá không xác nhận prerequisite hay mastery.",
  });
if (level === 4)
  Object.assign(catalog.courses[4], {
    releaseRef: template.release.id,
    availability: "PRACTICE_ONLY",
    coverageVerified: false,
    description:
      "Học liệu HSK4 nháp cục bộ theo batch; đang xây dựng, chưa đủ toàn cấp. Luyện khám phá không xác nhận prerequisite hay mastery.",
  });
for (const [file, data] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
  ["evidence.json", evidence],
] as const)
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(data, null, 2) + "\n");
console.log(
  `${input.batch}: validated ${outputs.length} lessons / ${outputs.reduce((n, p) => n + p.concepts.length, 0)} concepts. Existing versions unchanged; no publication.`,
);
