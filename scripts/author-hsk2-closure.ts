import fs from "node:fs";
import { createHash } from "node:crypto";
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
  type SourceReference,
} from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8")),
  dir = "content/hsk24";
const input = read(`${dir}/closure.authoring.json`),
  dims = read("docs/hsk24/five-dimensions.json"),
  manifest = read(`${dir}/manifest.json`),
  catalog = read(`${dir}/catalog.json`),
  extra = read(`${dir}/evidence.json`),
  reviews = read(`${dir}/reviews.json`),
  { packages, evidence } = loadDraftCatalog();
const pdf = fs.readFileSync(".local-postgres/source-research/hsk-2025-11.pdf");
if (createHash("sha256").update(pdf).digest("hex") !== dims.sourceSha256)
  throw Error("SOURCE_DRIFT");
const origins = currentDrafts().filter(
  (p) =>
    p.alignment.targetLevel === 2 &&
    !reviews.activities.some(
      (a: { versionId: string }) => a.versionId === p.lesson.versionId,
    ),
);
const outputs: ContentPackage[] = [],
  added: SourceReference[] = [],
  activities: unknown[] = [];
for (const l of input.lessons) {
  const selected = (l.words as string[]).map((w) => {
    const found = origins
      .flatMap((p) => p.concepts.map((c) => ({ p, c })))
      .filter((s) => s.c.hanzi === w);
    if (found.length !== 1) throw Error(`AMBIGUOUS_SENSE:${w}`);
    return found[0];
  });
  const sources = [...new Set(selected.map((s) => s.p))],
    p = structuredClone(sources[0]),
    prefix = l.id.toLowerCase();
  if (
    manifest.packages.some(
      (m: { versionId: string }) => m.versionId === `${prefix}-draft-v1`,
    )
  )
    throw Error("IMMUTABLE_CLOSURE_EXISTS");
  p.lesson = {
    ...p.lesson,
    id: l.id,
    version: 1,
    versionId: `${prefix}-draft-v1`,
    title: l.title,
    prerequisites: sources.map((p) => p.lesson.versionId),
    objectives: [
      l.objective,
      "Vận dụng trong tình huống mới; không cấp mastery hay chứng nhận nghe/nói.",
    ],
    newGrammarPatterns: [l.title],
  };
  p.concepts = selected.map((s) => s.c);
  for (const field of [
    "vocabularyReferences",
    "grammarReferences",
    "characterReferences",
    "topicReferences",
    "taskReferences",
  ] as const) {
    const refs = sources.flatMap((s) => s.alignment[field]);
    p.alignment[field] = refs.filter(
      (r, i) => refs.findIndex((x) => x.id === r.id) === i,
    );
  }
  const refs: SourceReference[] = [];
  for (const g of l.grammar) {
    const row = dims.grammar.find((x: { id: string }) => x.id === g.row);
    if (!row) throw Error("UNKNOWN_GRAMMAR_ROW");
    refs.push({
      id: `h2-closure-${g.row}`,
      kind: "grammar",
      status: "VERIFIED",
      officialLevel: 2,
      sourceLocator: {
        pdfIndex: row.pdfIndex,
        physicalPage: row.pdfIndex + 1,
        printedPage: row.pdfIndex - 2,
        section: "grammar",
        entry: `table-body-row-${row.tableBodyRow}`,
      },
      written: row.label,
      pinyin: null,
      senseId: null,
      ordinal: null,
      note: `Exact table row ${row.rowSha256}; this activity covers only the explicitly taught subalternative, not every alternative in a row.`,
    });
  }
  for (const id of l.topics) {
    const row = dims.topics.find((x: { id: string }) => x.id === id);
    if (!row) throw Error("UNKNOWN_TOPIC_LEAF");
    refs.push({
      id: `h2-closure-${id}`,
      kind: "topic",
      status: "VERIFIED",
      officialLevel: 2,
      sourceLocator: {
        pdfIndex: row.pdfIndex,
        physicalPage: row.pdfIndex + 1,
        printedPage: row.pdfIndex - 2,
        section: "topic",
        entry: row.path.join(" / "),
      },
      written: row.path.at(-1),
      pinyin: null,
      senseId: null,
      ordinal: null,
      note: "Exact tertiary source topic; written scenario only, not all communication modalities.",
    });
  }
  for (const r of refs) {
    const known = [...evidence.references, ...added].find((x) => x.id === r.id);
    if (known && JSON.stringify(known) !== JSON.stringify(r))
      throw Error("REFERENCE_DRIFT");
    if (!known) added.push(r);
    const field =
      r.kind === "grammar" ? "grammarReferences" : "topicReferences";
    if (!p.alignment[field].some((x) => x.id === r.id))
      p.alignment[field].push(r);
  }
  p.exercises = [];
  p.privateKeys = [];
  const evidenceRows = [];
  for (const [i, item] of [
    ...l.grammar.map(
      (g: {
        question: string;
        choices: string[];
        answer: string;
        explanation: string;
        concept: number;
      }) => ({
        prompt: g.question,
        choices: g.choices,
        answer: g.answer,
        feedback: g.explanation,
        concept: g.concept,
      }),
    ),
    ...l.practice,
  ].entries()) {
    const c = p.concepts[item.concept],
      id = `${prefix}-e${i}`,
      key = `${prefix}-k${i}`;
    if (!c) throw Error("CONCEPT_BINDING");
    const shift = (i + Number(l.id.slice(1))) % item.choices.length,
      choices = [...item.choices.slice(shift), ...item.choices.slice(0, shift)];
    p.exercises.push({
      id,
      version: 1,
      type: "choice",
      skill: "reading",
      conceptId: c.id,
      senseId: c.senseId,
      keyRef: key,
      prompt: item.prompt,
      choices,
      inputHint:
        "Chọn theo tình huống được nêu; không suy ra điểm năng lực độc lập.",
      requiresAudio: false,
      mediaIds: [],
    });
    p.privateKeys.push({
      id: key,
      version: 1,
      exerciseVersionId: id,
      senseId: c.senseId,
      accepted: [item.answer],
      normalizerVersion: "exact-choice-v1",
      gradingVersion: "deterministic-content-v1",
      feedback: item.feedback,
    });
    if (i < l.grammar.length)
      evidenceRows.push({
        rowId: l.grammar[i].row,
        subalternative: l.grammar[i].scope,
        teachingBlockId: `${prefix}-grammar${i}`,
        exerciseId: id,
        state: "TAUGHT_AND_CONTEXT_PRACTICE_DRAFT",
      });
  }
  p.blocks = [
    {
      id: `${prefix}-prereq`,
      type: "teaching",
      title: "Kiến thức hỗ trợ",
      text: l.prerequisite,
      hanzi: "",
      pinyin: "",
      meaning: "",
      readingMinutes: 1,
    },
    ...selected.map((s, i) => {
      const block = s.p.blocks.find(
        (b) => b.type === "teaching" && b.hanzi.includes(s.c.hanzi),
      )!;
      return {
        ...block,
        id: `${prefix}-reminder${i}`,
        title: `Nhắc từ đã học · ${s.c.hanzi}`,
      };
    }),
    ...l.grammar.map(
      (
        g: {
          explanation: string;
          example: string;
          pinyin: string;
          translation: string;
        },
        i: number,
      ) => ({
        id: `${prefix}-grammar${i}`,
        type: "teaching",
        title: `Cách nói ${i + 1}`,
        text: g.explanation,
        hanzi: g.example,
        pinyin: g.pinyin,
        meaning: g.translation,
        readingMinutes: 1,
      }),
    ),
    {
      id: `${prefix}-scene`,
      type: "teaching",
      title: "Tình huống mới",
      text: l.objective,
      hanzi: l.passage[0],
      pinyin: l.passage[1],
      meaning: l.passage[2],
      readingMinutes: 2,
    },
    ...p.exercises.map((e, i) => ({
      id: `${prefix}-b${i}`,
      type: "exercise" as const,
      exerciseVersionId: e.id,
    })),
  ];
  p.packageHash = contentHash(p);
  outputs.push(packageSchema.parse(p));
  const originMap = Object.fromEntries(
    selected.map((s) => [
      s.c.id,
      {
        file: manifest.packages.find(
          (m: { versionId: string }) => m.versionId === s.p.lesson.versionId,
        ).file,
        versionId: s.p.lesson.versionId,
        sha256: s.p.packageHash,
      },
    ]),
  );
  activities.push({
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
    kind: "GAP_CONTEXT",
    origins: originMap,
    sourceVersions: sources.map((s) => s.lesson.versionId),
    characterItems: [],
    grammarEvidence: evidenceRows,
    topicEvidence: l.topics.map((id: string) => ({
      id,
      teachingBlockId: `${prefix}-scene`,
      exerciseIds: p.exercises.slice(4).map((e) => e.id),
      state: "TEXT_SCENARIO_DRAFT",
    })),
    scope:
      "Original transfer scenarios; no new official vocabulary and no oral/listening acceptance.",
  });
  const parent = catalog.lessons.find(
    (x: { currentVersion: string }) =>
      x.currentVersion === sources[0].lesson.versionId,
  );
  catalog.lessons.push({
    ...parent,
    id: `62000000-0000-4000-8000-000000000${l.id.slice(1)}`,
    key: l.id,
    order:
      Math.max(
        ...catalog.lessons
          .filter((x: { unitId: string }) => x.unitId === parent.unitId)
          .map((x: { order: number }) => x.order),
      ) + 1,
    currentVersion: p.lesson.versionId,
  });
}
const merged = { ...evidence, references: [...evidence.references, ...added] };
for (const p of outputs) {
  const problems = validatePackage(p, [...packages, ...outputs], merged);
  if (problems.length) throw Error(JSON.stringify(problems));
  for (const e of p.exercises) {
    const a = p.privateKeys.find((k) => k.id === e.keyRef)!.accepted[0];
    if (!gradeContent(p, e.id, { choice: e.choices.indexOf(a) }).correct)
      throw Error("CLOSURE_KEY_INVALID");
  }
}
for (const p of outputs) {
  const file = `${p.lesson.id}.v1.json`;
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(p, null, 2) + "\n");
  manifest.packages.push({
    file,
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
  });
}
extra.references.push(...added);
reviews.activities.push(...activities);
for (const [file, data] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
  ["evidence.json", extra],
  ["reviews.json", reviews],
] as const)
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(data, null, 2) + "\n");
console.log(
  `${outputs.length} real context lessons; ${activities.length * 4} targeted grammar applications. Vocabulary unchanged.`,
);
