// Derived local curriculum checkpoint; never writes Master Plan task status.
import fs from "node:fs";
import {
  loadDraftCatalog,
  currentDrafts,
} from "../src/modules/content/application/catalog";
const { packages } = loadDraftCatalog();
const current = currentDrafts().filter((p) => p.alignment.targetLevel === 1);
const union = (values: (string | number)[]) =>
  [...new Set(values)].sort((a, b) =>
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b)),
  );
const refs = (
  kind:
    | "vocabularyReferences"
    | "grammarReferences"
    | "characterReferences"
    | "topicReferences"
    | "taskReferences",
) =>
  current
    .flatMap((p) => p.alignment[kind])
    .filter((r) => r.status === "VERIFIED" && r.officialLevel === 1);
const vocab = union(
  refs("vocabularyReferences")
    .filter((r) => r.status === "VERIFIED" && r.officialLevel === 1)
    .map((r) => r.ordinal!),
);
const grammarEntries = union(
  refs("grammarReferences").flatMap((r) =>
    r.sourceLocator ? [r.sourceLocator.entry] : [],
  ),
);
const grammarRows = new Set<string>(
  JSON.parse(fs.readFileSync("docs/hsk24/hsk1-source-audit.json", "utf8"))
    .grammar.stableRowIds,
);
const report = {
  status:
    vocab.length === 300
      ? "HSK1_VOCABULARY_COMPLETE / HSK1_CURRICULUM_PARTIAL"
      : "HSK1_CURRICULUM_PARTIAL",
  checkedAt: new Date().toISOString(),
  syllabus: "hsk-exam-2025-11",
  sourceSnapshotSha256:
    "ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941",
  currentLessons: current.map((p) => ({
    id: p.lesson.id,
    version: p.lesson.versionId,
    hash: p.packageHash,
    exercises: p.exercises.length,
  })),
  foundation: packages
    .filter((p) => /^F0[1-5]$/.test(p.lesson.id))
    .map((p) => ({ version: p.lesson.versionId, hash: p.packageHash })),
  vocabulary: {
    denominator: 300,
    sourceMappedUniqueOrdinals: vocab,
    taughtWithPracticeDraft: vocab.length,
  },
  grammar: {
    denominatorPhysicalRows: 70,
    sourceMappedPhysicalRows: grammarEntries.filter((r) =>
      grammarRows.has(String(r)),
    ),
    legacyUnresolvedRowLabels: grammarEntries.filter(
      (r) => !grammarRows.has(String(r)),
    ),
    fullRowCompletionClaimed: false,
    note: "Rows contain multiple subalternatives. A reference to one alternative is not completion of the row.",
  },
  recognition: {
    denominatorGlyphs: 246,
    sourceMappedGlyphs: union(
      refs("characterReferences").map((r) => r.written),
    ),
    practiceTargets: union(
      current.flatMap((p) =>
        p.exercises
          .filter(
            (e) =>
              e.skill === "recognition" && e.prompt.startsWith("Nhận diện chữ"),
          )
          .flatMap(
            (e) => p.privateKeys.find((k) => k.id === e.keyRef)!.accepted,
          )
          .filter(
            (glyph) =>
              [...glyph].length === 1 &&
              p.alignment.characterReferences.some(
                (r) => r.status === "VERIFIED" && r.written === glyph,
              ),
          ),
      ),
    ),
    note: "Mapped glyphs in words are not independent character teaching or writing evidence.",
  },
  writing: {
    denominatorGlyphsSharedHsk1And2: 100,
    assessedHandwriting: 0,
    note: "Shared official HSK1-2 list, not an exclusive HSK1 subset. Keyboard/choice work does not assess handwriting.",
  },
  topics: {
    denominatorLeaves: 30,
    referencedTopicLabels: union(refs("topicReferences").map((r) => r.written)),
    note: "Labels may include existing parent topics; not a count of covered official leaves.",
    completeScenarioCoverageClaimed: false,
  },
  tasks: {
    denominatorHeads: 15,
    denominatorPhysicalBullets: 59,
    referencedHeads: union(refs("taskReferences").map((r) => r.written)),
    fullModalityCoverageClaimed: false,
    note: "Written scenes do not prove listening/speaking or all bullets under a parent head.",
  },
  humanApproved: 0,
  published: 0,
  masteryGrantedByThisReport: 0,
  evidenceLimit:
    "Technical source mapping and DRAFT practice only; competent language review, audio and full skill coverage remain open.",
};
fs.writeFileSync(
  "docs/hsk24/hsk1-progress.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    status: report.status,
    vocabulary: vocab.length,
    currentLessons: current.length,
    exercises: current.reduce((n, p) => n + p.exercises.length, 0),
  }),
);
