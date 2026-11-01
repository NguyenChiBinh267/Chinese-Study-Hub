import fs from "node:fs";
import { createHash } from "node:crypto";
const dir = ".local-postgres/hsk24",
  read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const digest = (p: string, gitText = false) =>
  createHash("sha256")
    .update(
      gitText
        ? fs.readFileSync(p, "utf8").replaceAll("\r\n", "\n")
        : fs.readFileSync(p),
    )
    .digest("hex");
function sql(file: string, expected: number) {
  const path = `${dir}/${file}`,
    s = fs.readFileSync(path, "utf8");
  if (
    !/fail 0\b/.test(s) ||
    !/skipped 0\b/.test(s) ||
    Number(s.match(/pass (\d+)/)?.[1]) !== expected
  )
    throw Error(`CHECK_NOT_ACCEPTED:${file}`);
  return {
    path,
    passed: expected,
    failed: 0,
    skipped: 0,
    sha256: digest(path),
  };
}
function browser(file: string, expected: number) {
  const path = `${dir}/${file}`,
    r = read(path);
  if (
    r.stats.expected !== expected ||
    r.stats.unexpected ||
    r.stats.skipped ||
    r.errors.length
  )
    throw Error(`BROWSER_NOT_ACCEPTED:${file}`);
  return { path, ...r.stats, sha256: digest(path) };
}
const tests = {
  unit: sql("hsk23-final-unit.log", 118),
  hsk2Sql: sql("hsk23-full-hsk2-sql.log", 95),
  hsk3Sql: sql("hsk23-final-hsk3-sql.log", 20),
  all107ManifestResume: sql("hsk23-manifest-sql.log", 1),
  browser: browser("hsk23-final-browser.json", 6),
  today: browser("hsk23-today-browser.json", 2),
};
const h2 = read("docs/hsk24/hsk2-reconciliation.json"),
  h3 = read("docs/hsk24/hsk3-coverage.json"),
  catalog = read("content/hsk24/catalog.json"),
  manifest = read("content/hsk24/manifest.json"),
  coverage = read("docs/hsk24/coverage.json");
const selected = catalog.lessons.filter((l: { key: string }) =>
    /^L[23]/.test(l.key),
  ),
  level2 = selected.filter((l: { key: string }) => l.key.startsWith("L2")),
  level3 = selected.filter((l: { key: string }) => l.key.startsWith("L3"));
if (
  level2.length !== 91 ||
  level3.length !== 16 ||
  h3.vocabulary.taught !== 96 ||
  coverage.levels.find((l: { level: number }) => l.level === 2)
    .entriesWithDraftTeaching !== 200
)
  throw Error("COUNT_DRIFT");
const build = read(`${dir}/hsk23-build-result.json`),
  prod = read(`${dir}/hsk23-client-isolation.json`),
  dev = read(`${dir}/hsk23-dev-client-isolation.json`);
if (build.exitCode !== 0 || !prod.passed || !dev.passed)
  throw Error("BUILD_OR_ISOLATION_NOT_ACCEPTED");
const nextOrdinals = [
  501, 503, 631, 702, 709, 841, 568, 601, 694, 810, 848, 889, 558, 577, 606,
  812, 824, 901, 507, 509, 758, 822, 887, 897,
];
if (nextOrdinals.some((n) => !h3.vocabulary.remainingOrdinals.includes(n)))
  throw Error("NEXT_SELECTION_CONFLICT");
const next = {
  status: "HSK2_PARTIAL / HSK3_IN_PROGRESS",
  nextHSK3Batch: "HSK3-batch5",
  authoringFileToCreate: "content/hsk24/batch14.authoring.json",
  targetLessonIds: ["L317", "L318", "L319", "L320"],
  exactSelectedOrdinals: nextOrdinals,
  groups: [
    { theme: "Family and relationships", ordinals: nextOrdinals.slice(0, 6) },
    { theme: "Four seasons", ordinals: nextOrdinals.slice(6, 12) },
    { theme: "Clothes and shoes", ordinals: nextOrdinals.slice(12, 18) },
    { theme: "Moving and neighbourhood", ordinals: nextOrdinals.slice(18) },
  ],
  allRemainingHSK3Ordinals: h3.vocabulary.remainingOrdinals,
  hsk2RowsRequiringEvidenceOrTeaching: h2.remainingGrammarRows,
  sourceSha256: h3.sourceSha256,
  requirements:
    "Original coherent teaching and explicit context exercises; preserve sense/readings, immutable versions, secure prerequisites, private keys and DRAFT policy. Reconcile partial HSK2 rows and task bullets alongside HSK3. No publication/mastery implied.",
};
fs.writeFileSync(
  "docs/hsk24/hsk23-next-checkpoint.json",
  JSON.stringify(next, null, 2) + "\n",
);
const importProofs = fs
  .readdirSync(dir)
  .filter((f) => /^import-\d+\.json$/.test(f))
  .map((f) => ({
    path: `${dir}/${f}`,
    ...read(`${dir}/${f}`),
    sha256: digest(`${dir}/${f}`),
  }));
const retained = read(`${dir}/hsk23-retained-pointer.json`),
  pointer = read(`${dir}/current.json`),
  state = read(pointer.stateFile);
const report = {
  status: "HSK2_CURRICULUM_PARTIAL / HSK3_CURRICULUM_PARTIAL",
  branch: "feat/hsk24-curriculum",
  baseCommit: "2ca0b2907dcad06a49eaa063f6f65da98a40fef1",
  HSK3BatchCommits: ["923bbbd", "02852d3", "9d6706b", "07e4eda"],
  commitResolution:
    "git log -1 --format=%H -- docs/hsk24/hsk23-verification.json",
  hsk2: {
    ...h2.summary,
    vocabularyTaught: 200,
    vocabularyDenominator: 200,
    newLessons: 6,
    newExercises: 48,
    totalActivities: 91,
    totalExercises: 728,
    grammarTableRows: 78,
    topicLeaves: 34,
    taskHeads: 17,
    taskBullets: 76,
    recognitionCharactersPracticed: 125,
    handwritingCharactersRequired: 100,
    status: "PARTIAL",
  },
  hsk3: {
    ...h3.summary,
    batchesCompleted: 4,
    newUnits: 16,
    newLessons: 16,
    newExercises: 128,
    vocabularyDenominator: 500,
    remainingVocabulary: 404,
    grammarTableRows: 96,
    topicLeaves: 54,
    taskHeads: 22,
    taskBullets: 109,
    recognitionCharactersRequired: 284,
    handwritingCharactersRequired: 150,
    status: "PARTIAL",
  },
  currentExpandedActivities: 107,
  currentExpandedExercises: 856,
  allCurrentActivities: 111,
  serverPackageVersions: manifest.packages.length + 6,
  historicalExpansionVersions: manifest.packages.length - selected.length,
  tests,
  validation: {
    typecheck: "PASS",
    lint: "PASS",
    productionBuild: build,
    productionClientIsolation: prod,
    developmentClientIsolation: dev,
    sourceAudit: "All declared mappings checked against pinned PDF",
    sourcePin: h3.sourceSha256,
  },
  dataIntegrity: {
    selectedSandbox: state.database,
    previousSandboxRetained: retained.database,
    allOlderSandboxesRetained: true,
    proofs: importProofs.filter((p) =>
      [retained.database, state.database].includes(p.database),
    ),
    personalHistoryImportedOrReset: false,
    cloudWrites: false,
    limitation:
      "All learning tests use synthetic owners. Additive import compares all pre-existing attempt/session/card rows and package hashes during a quiescent window; this is not a full restore test.",
  },
  priorFailures: [
    "First closure browser run included Today after other tests populated due cards; focused groups run with fresh-server fixtures",
    "First batch4 import proof refused equality while concurrent synthetic tests appended rows; quiescent equality rerun passed without relaxing checks",
    "Initial final-browser desktopL315 exceeded15s while command/read/summary requests queued; authoritative lesson remains awaited, optional summary refresh coalesced, held-snapshot regression now included",
    "First held-snapshot cleanup unregistered a pending handler too early; wait-for-handler cleanup repaired before accepted rerun",
  ],
  supersededDrafts: [
    "L235.v1 age distractor corrected in v2",
    "L238.v1 experiencer clarified in v2",
    "L309.v1 recovery wording refined in v2",
    "L312/L313/L315/L316 v1 guided-copy prompts strengthened in v2; L315 programme ambiguity removed",
  ],
  gradingLimit:
    "Short Chinese accepts one explicit normalized answer. Alternate punctuation/spacing normalized; broad valid paraphrases and free writing remain provisional, not automatically accepted.",
  reviewStatus: {
    independentTechnical: "FINAL_EXACT_SHA_REVIEW_PENDING",
    qualifiedLanguageReview: false,
    rights: "ORIGINAL_REVIEW_PENDING",
    publication: "BLOCKED",
    learnerMastery: null,
  },
  audioSpeaking: {
    nativeReviewedAudio: false,
    oralGrading: false,
    TTS: "Optional labelled synthetic zh-CN only where existing UI supports it; never native-audio or mastery evidence",
  },
  nextCheckpoint: "docs/hsk24/hsk23-next-checkpoint.json",
  preview: "http://127.0.0.1:3037/learn/courses/HSK3",
  protectedBoundaries: {
    push: false,
    merge: false,
    deploy: false,
    paidServices: false,
    authRlsRelaxed: false,
    onlineAllowlistExtended: false,
    canonicalBacklogEdited: false,
  },
  trackedTextHashPolicy:
    "UTF8_LF_MATCHES_GIT; ignored local evidence uses actual bytes",
  trackedReports: Object.fromEntries(
    [
      "docs/hsk24/coverage.json",
      "docs/hsk24/hsk2-reconciliation.json",
      "docs/hsk24/hsk3-coverage.json",
      "docs/hsk24/hsk1-targeted-support.json",
      "docs/hsk24/hsk23-performance.json",
      "content/hsk24/reviews.json",
    ].map((p) => [p, digest(p, true)]),
  ),
};
fs.writeFileSync(
  "docs/hsk24/hsk23-verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
const checkpoint = read("docs/hsk24/checkpoint.json");
Object.assign(checkpoint, {
  currentRunBaseCommit: report.baseCommit,
  hsk2Status: "HSK2_VOCABULARY_COMPLETE / HSK2_CURRICULUM_PARTIAL",
  hsk3Status: "HSK3_IN_PROGRESS",
  completedBatch: "HSK3-batch4-plus-HSK2-reconciliation",
  currentLessonCount: 91,
  currentExerciseCount: 728,
  currentExpandedLessonCount: 107,
  currentExpandedExerciseCount: 856,
  HSK3LessonCount: 16,
  HSK3ExerciseCount: 128,
  coverageVocabulary: { HSK2: 200, HSK3: 96, HSK4: 0 },
  remainingNewVocabulary: { HSK2: 0, HSK3: 404, HSK4: 1000 },
  verification: "docs/hsk24/hsk23-verification.json",
  nextCheckpoint: report.nextCheckpoint,
  nextBatchFile: null,
  nextBatchToAuthor: "HSK3-batch5",
  resumeCommand:
    "Continue exact HSK3 batch5 ordinal groups in docs/hsk24/hsk23-next-checkpoint.json; reconcile HSK2 remaining grammar/task subrequirements; preserve all current and historical versions.",
});
fs.writeFileSync(
  "docs/hsk24/checkpoint.json",
  JSON.stringify(checkpoint, null, 2) + "\n",
);
const phase = read("docs/hsk24/hsk23-checkpoint.json");
Object.assign(phase, {
  nextAction:
    "Author HSK3-batch5 alongside remaining HSK2 evidence/teaching gaps",
  nextBatchToAuthor: "HSK3-batch5",
  nextCheckpoint: report.nextCheckpoint,
  milestoneRegression: {
    unit: 118,
    hsk2Sql: 95,
    hsk3Sql: 20,
    all107ManifestResume: 1,
    browser: 8,
    failed: 0,
    skipped: 0,
  },
  verification: "docs/hsk24/hsk23-verification.json",
});
fs.writeFileSync(
  "docs/hsk24/hsk23-checkpoint.json",
  JSON.stringify(phase, null, 2) + "\n",
);
checkpoint.lessons = level2.map(
  (l: { currentVersion: string }) => l.currentVersion,
);
checkpoint.coverageSha256 = report.trackedReports["docs/hsk24/coverage.json"];
checkpoint.historicalVersionCount =
  manifest.packages.filter((m: { file: string }) => m.file.startsWith("L2"))
    .length - level2.length;
checkpoint.historicalExpansionVersionCount = report.historicalExpansionVersions;
checkpoint.newBatchesThisContinuation = 4;
checkpoint.newHSK2GapLessonsThisContinuation = 6;
checkpoint.knownContentIssues = checkpoint.knownContentIssues.map(
  (s: string) =>
    s.includes("historical package versions")
      ? `${checkpoint.historicalVersionCount} historical HSK2 package versions retained; current counts exclude them`
      : s,
);
checkpoint.nextBatchesInOrder = [
  "Author exact HSK3-batch5 ordinal groups alongside remaining HSK2 evidence/teaching gaps",
  "Validate all new practice and preserve DRAFT/qualified-review/publication boundaries",
];
fs.writeFileSync(
  "docs/hsk24/checkpoint.json",
  JSON.stringify(checkpoint, null, 2) + "\n",
);
console.log(
  "HSK2 partial; HSK3 96/500; 107 expanded activities/856 exercises; no publication/mastery.",
);
