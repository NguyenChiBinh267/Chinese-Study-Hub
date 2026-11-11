// Derived educational evidence; never writes Master Plan task status.
import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { currentDrafts } from "../src/modules/content/application/catalog";
const read = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const requirements = read("docs/hsk24/hsk1-closure-source-requirements.json");
const baseline = read("docs/hsk24/hsk1-progress.json");
const all = currentDrafts().filter((p) => p.alignment.targetLevel === 1);
const byId = new Map(all.map((p) => [p.lesson.id, p]));
const specs = read("content/hsk24/hsk1-closure.authoring.json");
const registry = read("content/hsk24/reviews.json");
const unique = (x: string[]) => [...new Set(x)].sort();
function evidence(
  lesson: string,
  block: string,
  exercises: string[],
  scope: string,
  practiceKind: string,
) {
  const p = byId.get(lesson)!;
  assert(p, lesson);
  assert(
    p.blocks.some((b) => b.id === block && b.type === "teaching"),
    `${lesson}:${block}`,
  );
  for (const id of exercises)
    assert(
      p.exercises.some((e) => e.id === id),
      id,
    );
  return {
    lesson,
    version: p.lesson.versionId,
    packageHash: p.packageHash,
    teachingBlock: block,
    exerciseIds: exercises,
    scope,
    practiceKind,
    humanAccepted: false,
  };
}
// Independently audited reuse: these are subalternatives, not whole-row acceptance.
const reuse: Record<string, ReturnType<typeof evidence>[]> = {
  "g-385-1": [
    evidence(
      "L170",
      "l170-grammar",
      ["l170-v1-e0"],
      "第+number only; 小-prefix unresolved",
      "FORM_CUED",
    ),
  ],
  "g-385-2": [
    evidence(
      "L106",
      "l106-grammar",
      ["l106-v1-e1", "l106-v1-e7"],
      "们 only; 边 suffix formation unresolved",
      "GLYPH_AND_CONTROLLED_ORDER",
    ),
  ],
  "g-385-6": [
    evidence(
      "L124",
      "l124-grammar",
      ["l124-v2-e2", "l124-v2-e4"],
      "可以 permission subset",
      "FORM_CUED_MEANING",
    ),
  ],
  "g-385-17": [
    evidence(
      "L167",
      "l167-grammar",
      ["l167-v1-e3", "l167-v1-e7"],
      "正在V subset",
      "FORM_CUED_AND_CONTROLLED_ORDER",
    ),
  ],
  "g-385-25": [
    evidence(
      "L154",
      "l154-grammar",
      ["l154-v1-e7"],
      "Completion 了1 in controlled sentence",
      "CONTROLLED_ORDER",
    ),
  ],
  "g-386-1": [
    evidence(
      "L155",
      "l155-grammar",
      ["l155-v1-e7"],
      "和 links nouns; internal phrase remains bundled",
      "CONTEXTUAL_RECONSTRUCTION",
    ),
  ],
  "g-386-2": [
    evidence(
      "L1105",
      "l1105-grammar",
      ["l1105-e6"],
      "Nominal modifier-head subset; not every 偏正 phrase",
      "CONTROLLED_CHOICE",
    ),
  ],
  "g-386-6": [
    evidence(
      "L134",
      "l134-grammar",
      ["l134-v1-e7"],
      "Preverbal 在+place",
      "CONTROLLED_ORDER",
    ),
  ],
  "g-386-9": [
    evidence(
      "L168",
      "l168-grammar",
      ["l168-v1-e7"],
      "Age/quantity predicate subset",
      "CONTROLLED_ORDER",
    ),
  ],
  "g-386-10": [
    evidence(
      "L117",
      "l117-grammar",
      ["l117-v1-e7"],
      "Adjectival predicate model",
      "CONTROLLED_ORDER",
    ),
    evidence(
      "L001",
      "l001-draft-v2-b3",
      ["l001-draft-v2-e2", "l001-draft-v2-e3"],
      "我叫+name verbal predicate",
      "CONTROLLED_PRODUCTION",
    ),
  ],
  "g-386-11": [
    evidence(
      "L120",
      "l120-grammar",
      ["l120-v1-e7"],
      "Noun object model; other categories not accepted",
      "CONTROLLED_ORDER",
    ),
  ],
  "g-386-20": [
    evidence(
      "L101",
      "l101-grammar",
      ["l101-v1-e2", "l101-v1-e5"],
      "吗 question subset",
      "FORM_CUED_MEANING",
    ),
  ],
  "g-386-31": [
    evidence(
      "L170",
      "l170-grammar",
      ["l170-v1-e7"],
      "给 recipient/object; recipient bundled with 给",
      "CONTROLLED_ORDER",
    ),
  ],
};
const bindings = read("docs/hsk24/hsk1-grammar-row-bindings.json").bindings;
const rows = requirements.grammarPhysicalRows.map(
  (r: { id: string; label: string }) => {
    const newEvidence = specs
      .filter(
        (s: { grammar?: { row: string }; id: number }) =>
          s.grammar?.row === r.id && byId.has(`L${s.id}`),
      )
      .map((s: { id: number; grammar: { form: string } }) =>
        evidence(
          `L${s.id}`,
          `l${s.id}-grammar`,
          [5, 6, 7].map((i) => `l${s.id}-e${i}`),
          s.grammar.form,
          "CONTROLLED_ORDER_AND_CHOICES_CONTEXT_ONLY",
        ),
      );
    const candidates = bindings
      .filter((b: { sourceRowId: string }) => b.sourceRowId === r.id)
      .map((b: { lessonId: string }) => {
        const p = byId.get(b.lessonId)!;
        return {
          lesson: b.lessonId,
          version: p.lesson.versionId,
          teachingBlock: `${b.lessonId.toLowerCase()}-grammar`,
          stage: "PRIMARY_BINDING_CANDIDATE_NOT_ATOMIC_ACCEPTANCE",
        };
      });
    return {
      id: r.id,
      literalSourceLabel: r.label,
      metadataReferenced: all.some((p) =>
        p.alignment.grammarReferences.some(
          (ref) => ref.sourceLocator?.entry === r.id,
        ),
      ),
      existingPrimaryBindingCandidates: candidates,
      auditedPartialEvidence: [...(reuse[r.id] ?? []), ...newEvidence],
      fullPhysicalRowAccepted: false,
      humanAccepted: false,
    };
  },
);
const glyphRows = requirements.recognitionGlyphs.map(
  (r: { glyph: string; ordinal: number; page: number }) => {
    const practice = all.flatMap((p) =>
      p.exercises
        .filter(
          (e) =>
            e.skill === "recognition" && e.prompt.startsWith("Nhận diện chữ"),
        )
        .flatMap((e) => {
          const key = p.privateKeys.find((k) => k.id === e.keyRef)!;
          if (key.accepted.length !== 1 || key.accepted[0] !== r.glyph)
            return [];
          if (/^L11[5-7]\d$/.test(p.lesson.id)) {
            const activity = registry.activities.find(
              (a: { versionId: string }) => a.versionId === p.lesson.versionId,
            );
            assert(
              activity?.characterItems.some(
                (item: { character: string; exerciseId: string }) =>
                  item.character === r.glyph && item.exerciseId === e.id,
              ),
            );
          }
          const c = p.concepts.find((c) => c.id === e.conceptId)!;
          const spec = specs.find(
            (s: { id: number }) => `L${s.id}` === p.lesson.id,
          );
          const n = spec?.glyphs?.findIndex(
            (g: [string, string[]]) => g[0] === r.glyph,
          );
          return [
            {
              lesson: p.lesson.id,
              version: p.lesson.versionId,
              packageHash: p.packageHash,
              exerciseId: e.id,
              word: c.hanzi,
              explicitGlyphInstruction:
                n !== undefined && n >= 0
                  ? `${p.lesson.id.toLowerCase()}-reminder${n}`
                  : null,
              hasLiteralDictionaryPinyinCue: e.prompt.includes(
                c.dictionaryPinyin,
              ),
              support:
                "Word meaning/context and recent instruction remain; not unaided long-term recall",
              humanAccepted: false,
            },
          ];
        }),
    );
    return {
      ...r,
      sourceMappedInWords: all.some((p) =>
        p.alignment.characterReferences.some(
          (ref) => ref.status === "VERIFIED" && ref.written === r.glyph,
        ),
      ),
      practice,
      hasPositionAndContrastInstruction: practice.some(
        (e) => e.explicitGlyphInstruction !== null,
      ),
      handwritingAssessed: false,
      learnerMasteryClaimed: false,
    };
  },
);
assert.equal(glyphRows.length, 246);
assert(glyphRows.every((r: { practice: unknown[] }) => r.practice.length > 0));
const vocab = unique(
  all.flatMap((p) =>
    p.alignment.vocabularyReferences
      .filter((r) => r.status === "VERIFIED" && r.officialLevel === 1)
      .map((r) => String(r.ordinal)),
  ),
);
assert.equal(vocab.length, 300);
const topicEvidence: Record<string, ReturnType<typeof evidence>[]> = {
  课后活动: [
    evidence(
      "L1101",
      "l1101-reading",
      ["l1101-e4"],
      "After-class arrangement in written dialogue",
      "WRITTEN_COMPREHENSION",
    ),
  ],
  工作评价: [
    evidence(
      "L1102",
      "l1102-reading",
      ["l1102-e4"],
      "Work evaluation in written dialogue",
      "WRITTEN_COMPREHENSION",
    ),
  ],
  传统饮品: [
    evidence(
      "L002",
      "l002-draft-v2-b3",
      ["l002-draft-v2-e1", "l002-draft-v2-e4"],
      "Existing tea example reused, not regenerated",
      "CONTROLLED_LANGUAGE",
    ),
    evidence(
      "L1103",
      "l1103-reading",
      ["l1103-e4"],
      "Original menu with tea/food and prices",
      "WRITTEN_MENU_COMPREHENSION",
    ),
  ],
};
const topics = requirements.topicLeaves.map((r: { written: string }) => ({
  ...r,
  metadataReferenced: all.some((p) =>
    p.alignment.topicReferences.some(
      (ref) => ref.status === "VERIFIED" && ref.written === r.written,
    ),
  ),
  auditedPartialScenarioEvidence: topicEvidence[r.written] ?? [],
  allScenariosAccepted: false,
}));
const tasks = requirements.taskHeads.flatMap(
  (h: {
    id: string;
    bullets: { id: string; literalText: string; pdfIndex: number }[];
  }) =>
    h.bullets.map((b) => ({
      ...b,
      parentId: h.id,
      practice:
        b.id === "h1-task-15-b3"
          ? [
              evidence(
                "L1103",
                "l1103-reading",
                ["l1103-e4"],
                "Reading tea entry/price on a short original menu; partial scenario only",
                "WRITTEN_MENU_COMPREHENSION",
              ),
            ]
          : [],
      spokenInteractionAssessed: false,
      listeningAssessed: false,
      fullBulletAccepted: false,
    })),
);
const newActivities = all.filter((p) =>
  /^L11(?:0\d|1[01]|[5-7]\d)$/.test(p.lesson.id),
);
assert.equal(newActivities.length, 39);
const report = {
  kind: "LOCAL_DRAFT_CURRICULUM_COVERAGE_DELTA",
  baselineCommit: "bb3a0064969e993185586cb2b8349db58b2f52e7",
  checkedAtUTC: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  sourceSha256: requirements.sourceSha256,
  status: "HSK1_VOCABULARY_COMPLETE / HSK1_CURRICULUM_PARTIAL",
  vocabulary: {
    identified: 300,
    mapped: vocab.length,
    newOfficialEntries: 0,
    regeneratedIntroductions: 0,
  },
  grammar: {
    identifiedPhysicalRows: 70,
    metadataReferencedRows: rows.filter(
      (r: { metadataReferenced: boolean }) => r.metadataReferenced,
    ).length,
    rowsWithExplicitAuditedPartialLinks: rows.filter(
      (r: { auditedPartialEvidence: unknown[] }) =>
        r.auditedPartialEvidence.length,
    ).length,
    newGrammarCommunicationActivities: 11,
    newContextOnlyPracticeItems: 44,
    rows,
    legacyLocatorLabels: baseline.grammar.legacyUnresolvedRowLabels,
    fullPhysicalRowsAccepted: 0,
    note: "Primary bindings are candidates. Audited links cover named subalternatives and controlled tasks, not every clause/category on a physical row.",
  },
  hanzi: {
    identifiedRecognitionGlyphs: 246,
    mappedInWords: glyphRows.filter(
      (r: { sourceMappedInWords: boolean }) => r.sourceMappedInWords,
    ).length,
    beforePromptedGlyphs: baseline.recognition.practiceTargets.length,
    afterPromptedGlyphs: glyphRows.filter(
      (r: { practice: unknown[] }) => r.practice.length,
    ).length,
    newUniquePromptedGlyphs: 163,
    newCharacterActivities: 28,
    newGlyphExerciseInstances: 168,
    repeatedPreviouslyPracticedTargets: 5,
    glyphsWithNewPositionAndContrastInstruction: glyphRows.filter(
      (r: { hasPositionAndContrastInstruction: boolean }) =>
        r.hasPositionAndContrastInstruction,
    ).length,
    rows: glyphRows,
    sharedWritingDenominator: 100,
    handwritingAssessed: 0,
  },
  topics: {
    identifiedLeaves: 30,
    metadataReferencedLeaves: topics.filter(
      (r: { metadataReferenced: boolean }) => r.metadataReferenced,
    ).length,
    rows: topics,
    note: "Three newly audited scenes do not establish complete coverage of all30leaves.",
  },
  tasks: {
    identifiedHeads: 15,
    identifiedPhysicalBullets: 59,
    rows: tasks,
    fullBulletsAccepted: 0,
    note: "Only the specific written menu task is linked at bullet level. Spoken dialogue proxies are not oral/listening evidence; other59-bullet teaching/practice audits remain open.",
  },
  delivery: {
    newActivities: 39,
    newCurrentExercises: newActivities.reduce(
      (n, p) => n + p.exercises.length,
      0,
    ),
    currentHsk1Activities: all.length,
    currentHsk1Exercises: all.reduce((n, p) => n + p.exercises.length, 0),
    additiveRepairVersions: [
      "l114-draft-v2",
      "l115-draft-v2",
      "l183-draft-v2",
      "l196-draft-v2",
    ],
  },
  technicalValidation:
    "Package/hash/key/source and SQL checks reported separately in delivery report; links are statically checked here.",
  humanReviewed: 0,
  published: 0,
  learnerMasteryGranted: 0,
  remaining: [
    "Atomic grammar alternatives and full-row acceptance, including subject-predicate phrase/category distinctions.",
    "Quality audit of existing glyph instruction not given new position/contrast blocks; no unaided retention claim.",
    "All100 shared handwriting glyphs; listening/speaking/recording and competent audio review.",
    "Remaining physical task bullets and full topic scenarios; source references alone do not close these.",
    "Competent human language/rights/publication evidence and unresolved cold/503 transport gate.",
  ],
};
fs.writeFileSync(
  "docs/hsk24/hsk1-closure-coverage-delta.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    vocabulary: vocab.length,
    grammarMetadataRows: report.grammar.metadataReferencedRows,
    grammarAuditedPartialRows:
      report.grammar.rowsWithExplicitAuditedPartialLinks,
    recognitionBefore: 83,
    recognitionAfter: report.hanzi.afterPromptedGlyphs,
    explicitNewGlyphInstruction:
      report.hanzi.glyphsWithNewPositionAndContrastInstruction,
    topicsReferenced: report.topics.metadataReferencedLeaves,
    newActivities: report.delivery.newActivities,
    newExercises: report.delivery.newCurrentExercises,
  }),
);
