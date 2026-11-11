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
import { validateCurriculum } from "../src/modules/curriculum/domain/catalog";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
type Item = [string, string, string, string, string];
type Spec = {
  id: number;
  group: string;
  kind: "UNIT_REVIEW" | "CHARACTER_DIAGNOSTIC";
  title: string;
  items: Item[];
  passage: [string, string, string];
  question: string;
  answers: string[];
  chunks: string[];
  glyphs?: [string, string[]][];
  glyphNotes?: string[];
  grammar?: {
    row: string;
    form: string;
    text: string;
    example: [string, string, string];
  };
  topic?: [string, number];
  task?: string;
  checks?: { prompt: string; choices: string[]; feedback: string }[];
};
const specs = JSON.parse(
  fs.readFileSync("content/hsk24/hsk1-closure.authoring.json", "utf8"),
) as Spec[];
for (const s of specs) {
  assert((s.id >= 1101 && s.id <= 1111) || (s.id >= 1151 && s.id <= 1178));
  assert(s.items.length === (s.grammar ? 4 : 6));
}
const dir = "content/hsk24",
  read = (f: string) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json"),
  registry = read("reviews.json"),
  extraEvidence = read("evidence.json");
const { packages, evidence } = loadDraftCatalog(),
  current = currentDrafts(),
  outputs: ContentPackage[] = [];
const group = process.argv[2];
assert(["grammar", "chars1", "chars2", "chars3", "chars4"].includes(group));
const groupIndex = ["grammar", "chars1", "chars2", "chars3", "chars4"].indexOf(
  group,
);
const unitSlug = `hsk-one-closure-${group.replace("1", "one").replace("2", "two").replace("3", "three").replace("4", "four")}`;
let unit = catalog.units.find((u: { slug: string }) => u.slug === unitSlug);
if (!unit) {
  const base = catalog.units.find(
    (u: { slug: string }) => u.slug === "hsk-one-be",
  );
  unit = {
    ...structuredClone(base),
    id: localCurriculumUuid(91000 + groupIndex),
    slug: unitSlug,
    order:
      Math.max(
        ...catalog.units
          .filter((u: { courseId: string }) => u.courseId === base.courseId)
          .map((u: { order: number }) => u.order),
      ) + 1,
    title:
      group === "grammar"
        ? "Ngữ pháp và giao tiếp còn thiếu"
        : `Nhận diện chữ có hỗ trợ · nhóm ${groupIndex}`,
    objective:
      "Bổ sung khoảng trống đã kiểm tra; không thêm từ mới, không cấp mastery.",
    prerequisites: [base.id],
  };
  catalog.units.push(unit);
}
for (const spec of specs.filter((s) => s.group === group)) {
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
  p.state = "DRAFT";
  p.reviewStatus = "DRAFT_UNREVIEWED";
  p.publicationStatus = "BLOCKED";
  p.humanReview = null;
  p.media = [];
  p.rights.publicationReceipt = null;
  p.alignment.alignmentCheckedAt = new Date().toISOString();
  p.alignment.alignmentEvidence.push(
    "Original supplementary HSK1 grammar/character practice. Reused word identities; zero new vocabulary; technical mapping is not human approval.",
  );
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
    newGrammarPatterns: spec.grammar ? [`h1-closure-${spec.id}-grammar`] : [],
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
  p.unit = { id: unitSlug, version: 1 };
  if (spec.grammar) {
    const [, page, row] = spec.grammar.row.split("-");
    const ref = {
      id: `h1-closure-${spec.id}-grammar`,
      kind: "grammar" as const,
      status: "VERIFIED" as const,
      officialLevel: 1,
      sourceLocator: {
        pdfIndex: Number(page),
        physicalPage: Number(page) + 1,
        printedPage: Number(page) - 2,
        section: "grammar" as const,
        entry: spec.grammar.row,
      },
      written: spec.grammar.form,
      pinyin: null,
      senseId: null,
      ordinal: null,
      note: `Pinned PDF physical body row${row}; only the explicitly taught subalternative is claimed. Vietnamese instruction is original unreviewed DRAFT.`,
    };
    assert(
      !extraEvidence.references.some((r: { id: string }) => r.id === ref.id),
    );
    extraEvidence.references.push(ref);
    evidence.references.push(ref);
    p.alignment.grammarReferences = [ref];
  }
  if (spec.topic) {
    const [written, page] = spec.topic;
    const ref = {
      id: `h1-closure-${spec.id}-topic`,
      kind: "topic" as const,
      status: "VERIFIED" as const,
      officialLevel: 1,
      sourceLocator: {
        pdfIndex: page,
        physicalPage: page + 1,
        printedPage: page - 2,
        section: "topic" as const,
        entry: written,
      },
      written,
      pinyin: null,
      senseId: null,
      ordinal: null,
      note: "Exact official HSK1 leaf observed in pinned PDF. Written scenario only, not full modality coverage.",
    };
    extraEvidence.references.push(ref);
    evidence.references.push(ref);
    p.alignment.topicReferences = [ref];
  }
  if (spec.task) {
    const ref = evidence.references.find(
      (r) =>
        r.officialLevel === 1 && r.kind === "task" && r.written === spec.task,
    );
    assert(ref);
    p.alignment.taskReferences = [structuredClone(ref)];
  }
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
        `Nhận diện chữ còn thiếu trong ${c.hanzi.replaceAll(glyph, "□")}${i < 3 ? ` (${c.dictionaryPinyin})` : ""}, nghĩa “${c.meaning}”. Chọn một chữ để điền mọi ô trống giống nhau; giữ nguyên phần còn lại.`,
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
  for (const check of spec.checks ?? []) {
    add(
      0,
      "choice",
      check.prompt,
      check.choices,
      [check.choices[0]],
      check.feedback,
    );
    p.exercises.at(-1)!.evidenceScope = "CONTEXT_ONLY";
  }
  assert.equal(p.exercises.length, 8);
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
      text: spec.glyphs
        ? `${spec.glyphNotes![i]} Đối chiếu hình đầy đủ của chữ ${spec.glyphs[i][0]} với ${spec.glyphs[i][1].join(" / ")}; các chữ khác là phương án nhiễu, không được tính là đã học. Đây là nhận diện sau hướng dẫn; không phải viết tay hoặc nhớ dài hạn độc lập.`
        : `Nhắc nghĩa đã học: ${p.concepts[i].meaning}. Đọc ví dụ trong phạm vi nghĩa đã học; không đổi thẻ ôn.`,
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
  if (spec.grammar)
    p.blocks.splice(1, 0, {
      id: `${prefix}-grammar`,
      type: "teaching",
      title: "Cách nói và lỗi thường gặp",
      text: spec.grammar.text,
      hanzi: spec.grammar.example[0],
      pinyin: spec.grammar.example[1],
      meaning: spec.grammar.example[2],
      readingMinutes: 3,
    });
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
          file:
            manifest.packages.find(
              (m: { versionId: string }) =>
                m.versionId === s.source.lesson.versionId,
            )?.file ?? `${s.source.lesson.id}.v${s.source.lesson.version}.json`,
        },
      ]),
    ),
    characterItems,
    scope:
      "Exact existing word senses/cards plus explicit context-only grammar tasks or prompted glyph targets; zero new vocabulary, no oral/handwriting/comprehensive claim.",
  });
  const sourceLesson = catalog.lessons.find(
    (l: { key: string }) => l.key === "L170",
  );
  catalog.lessons.push({
    ...sourceLesson,
    id: localCurriculumUuid(spec.id),
    key: id,
    unitId: unit.id,
    currentVersion: p.lesson.versionId,
    order:
      1 +
      Math.max(
        0,
        ...catalog.lessons
          .filter((l: { unitId: string }) => l.unitId === unit.id)
          .map((l: { order: number }) => l.order),
      ),
  });
}
validateCurriculum(catalog, [...packages, ...outputs]);
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
  ["evidence.json", extraEvidence],
] as const)
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(data, null, 2) + "\n");
console.log(
  `${outputs.length} HSK1 assisted review activities/${outputs.length * 8} exercises; zero new vocabulary.`,
);
