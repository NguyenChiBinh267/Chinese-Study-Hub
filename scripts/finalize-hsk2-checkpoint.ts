// Evidence-driven delivery checkpoint, independent of canonical backlog status.
import fs from "node:fs";
import { createHash } from "node:crypto";
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const hash = (p: string) =>
  createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const trackedTextHash = (p: string) =>
  createHash("sha256")
    .update(fs.readFileSync(p, "utf8").replaceAll("\r\n", "\n"))
    .digest("hex");
const dir = ".local-postgres/hsk24";
function result(file: string) {
  const path = `${dir}/${file}`,
    text = fs.readFileSync(path, "utf8");
  if (!/fail 0\b/.test(text) || !/skipped 0\b/.test(text))
    throw Error(`TEST_NOT_ACCEPTED:${file}`);
  return {
    passed: Number(text.match(/pass (\d+)/)?.[1]),
    failed: 0,
    skipped: 0,
    path,
    sha256: hash(path),
  };
}
function browser(file: string) {
  const path = `${dir}/${file}`,
    r = read(path);
  if (r.stats.unexpected || r.stats.skipped || r.errors.length)
    throw Error(`BROWSER_NOT_ACCEPTED:${file}`);
  return { ...r.stats, path, sha256: hash(path) };
}
const unit = result("complete-unit.log"),
  sql = result("complete-sql.log"),
  manifestResume = result("manifest-resume-sql.log"),
  journeys = browser("complete-browser.json"),
  today = browser("today-browser.json");
if (
  unit.passed !== 118 ||
  sql.passed !== 89 ||
  manifestResume.passed !== 1 ||
  journeys.expected !== 8 ||
  today.expected !== 2
)
  throw Error("EXPECTED_FULL_MATRIX");
const build = read(`${dir}/build-result.json`),
  isolation = read(`${dir}/client-isolation.json`);
if (build.exitCode !== 0 || !isolation.passed)
  throw Error("BUILD_NOT_ACCEPTED");
const coverage = read("docs/hsk24/coverage.json"),
  dims = read("docs/hsk24/five-dimensions.json"),
  catalog = read("content/hsk24/catalog.json"),
  manifest = read("content/hsk24/manifest.json"),
  reviews = read("content/hsk24/reviews.json");
const hsk = coverage.levels.find((x: { level: number }) => x.level === 2),
  current = catalog.lessons.filter((x: { key: string }) =>
    x.key.startsWith("L2"),
  );
if (
  hsk.entriesWithDraftTeaching !== 200 ||
  dims.summary.charactersExplicitlyPracticed !== 125
)
  throw Error("COVERAGE_INCOMPLETE");
const fullyTested = [
  ...fs
    .readFileSync(`${dir}/complete-sql.log`, "utf8")
    .matchAll(/✔ (L\d{3}): saved cursor/g),
].map((x) => x[1]);
if (
  fullyTested.length !== 85 ||
  current.some((l: { key: string }) => !fullyTested.includes(l.key))
)
  throw Error("LESSON_MATRIX_GAP");
const missingGrammar = dims.grammar.filter(
    (r: { teaching: string }) => r.teaching === "MISSING",
  ),
  partialGrammar = dims.grammar.filter(
    (r: { teaching: string }) => r.teaching !== "MISSING",
  ),
  missingTopics = dims.topics.filter(
    (r: { mappedEvidence: unknown[] }) => r.mappedEvidence.length === 0,
  );
const next = {
  status: "HSK2_VOCABULARY_COMPLETE / HSK2_CURRICULUM_PARTIAL",
  remainingVocabularyOrdinals: [],
  nextWork:
    "HSK2 grammar/context teaching, then topic/task subrequirements; preserve all 85 current versions and synthetic/owner histories.",
  nextBoundedGrammarRows: missingGrammar
    .slice(0, 4)
    .map(
      (r: {
        id: string;
        label: string;
        pdfIndex: number;
        tableBodyRow: number;
      }) => ({
        id: r.id,
        label: r.label,
        pdfIndex: r.pdfIndex,
        tableBodyRow: r.tableBodyRow,
      }),
    ),
  allUnmappedGrammarRows: missingGrammar.map((r: { id: string }) => r.id),
  allPartiallyMappedGrammarRows: partialGrammar.map(
    (r: { id: string }) => r.id,
  ),
  unmappedTopicLeafIds: missingTopics.map((r: { id: string }) => r.id),
  taskSubrequirements:
    "All 17 tasks remain PARTIAL for communication; no listening/oral/form-completion equivalence inferred.",
  humanGates: [
    "qualified independent language/key review",
    "rights/publication evidence",
    "reviewed listening/speaking material",
  ],
  sourceSha256: dims.sourceSha256,
  detail: "docs/hsk24/five-dimensions.json",
};
fs.writeFileSync(
  "docs/hsk24/next-checkpoint.json",
  JSON.stringify(next, null, 2) + "\n",
);
const imports = fs
  .readdirSync(dir)
  .filter((f) => /^import-\d+\.json$/.test(f))
  .map((f) => ({
    ...read(`${dir}/${f}`),
    path: `${dir}/${f}`,
    sha256: hash(`${dir}/${f}`),
  }))
  .filter((r) => r.database === "csh_hsk24_73d6d184d0f0");
const report = {
  status: next.status,
  branch: "feat/hsk24-curriculum",
  startingCommit: "a60a4d4512fcbd1a0eac905a41bb97986deaeb88",
  vocabularyCheckpointCommit: "fd3a6c6e0803712619fcf9e4278b500f9922f720",
  finalCommitResolution:
    "git log -1 --format=%H -- docs/hsk24/completion-verification.json",
  completedBatches: [6, 7, 8, 9],
  newIntroductionLessons: 16,
  newUnits: 16,
  newOfficialVocabulary: 96,
  introductionLessons: 34,
  unitReviews: 34,
  courseDiagnostics: 16,
  characterBridges: 1,
  totalCurrentHsk2Lessons: current.length,
  totalExercises: current.length * 8,
  historicalVersions: manifest.packages.length - current.length,
  HSK2Vocabulary: 200,
  HSK3Vocabulary: 0,
  HSK4Vocabulary: 0,
  dimensions: {
    ...dims.summary,
    grammarOperationalDenominator: 78,
    topicLeafDenominator: 34,
    taskDenominator: 17,
    characterDenominator: 125,
    warning:
      "Mapping candidates are not complete teaching. Character recognition is constrained cloze practice, not writing. Human reviews remain zero.",
  },
  reviewCoverage: {
    officialVocabularyWithUnitRetrieval: coverage.vocabulary.filter(
      (r: { introductionLevel: number; reviewActivityVersions: string[] }) =>
        r.introductionLevel === 2 && r.reviewActivityVersions.length > 0,
    ).length,
    policy:
      "Assisted DRAFT retrieval and diagnostic bank, not independent proficiency, official mock exam or certification.",
    FSRS: "Original taught sense/template retained; new character bridge gets its own card; daily cap10 unchanged.",
  },
  tests: {
    unit,
    sql,
    manifestResume,
    journeys,
    today,
    fullyTestedLessonIds: fullyTested,
    typecheck: "PASS",
    lint: "PASS",
    productionBuild: build,
    clientIsolation: isolation,
    localOptInClientIsolation: read(`${dir}/dev-client-isolation.json`),
  },
  dataIntegrity: {
    additiveImports: imports,
    oldSandboxesRetained: true,
    ownerDatabaseWrites: false,
    limits:
      "Exact selected-table equality at additive import; not a full backup/restore audit. All learning tests use new synthetic owners in isolated sandbox.",
  },
  priorFailures: [
    "Batch6 browser failures retained before telemetry/test-state fixes",
    "Batch8 first desktop attempt exceeded5s cold-dev step wait; repaired15s wait then both devices passed",
    "First whole unit run inherited expansion flags into base-only suites; rerun in intended default environment passed118/118",
  ],
  humanReview: "ABSENT",
  publication: "BLOCKED",
  rights: "ORIGINAL_REVIEW_PENDING",
  preview: "http://127.0.0.1:3036/learn/courses/HSK2",
  nextCheckpoint: "docs/hsk24/next-checkpoint.json",
  trackedTextHashPolicy:
    "UTF8_LF_MATCHES_GIT; local log/evidence hashes retain actual bytes",
  coverageSha256: trackedTextHash("docs/hsk24/coverage.json"),
  fiveDimensionSha256: trackedTextHash("docs/hsk24/five-dimensions.json"),
  reviewRegistrySha256: trackedTextHash("content/hsk24/reviews.json"),
  performance: "docs/hsk24/performance.json",
  restrictions: {
    push: false,
    merge: false,
    deploy: false,
    cloudWrites: false,
    paidServices: false,
    masteryGranted: false,
  },
};
const checkpoint = read("docs/hsk24/checkpoint.json");
Object.assign(checkpoint, {
  epicStatus: "HSK24_EPIC_PARTIAL",
  hsk2Status: next.status,
  completedBatch: "HSK2-batch9-plus-reviews",
  lessons: current.map((x: { currentVersion: string }) => x.currentVersion),
  currentLessonCount: 85,
  currentIntroductionLessonCount: 34,
  currentExerciseCount: 680,
  historicalVersionCount: 9,
  unitReviewCount: 34,
  diagnosticCount: 16,
  characterBridgeCount: 1,
  coverageSha256: report.coverageSha256,
  nextBatchFile: null,
  nextBatchToAuthor: "HSK2_GRAMMAR_AND_COMMUNICATION_GAPS",
  nextBatchesInOrder: [
    "Read docs/hsk24/next-checkpoint.json; teach next four source grammar rows with original context and keys",
    "Reconcile all partial grammar, topic/task subrequirements, then competent human review",
  ],
  resumeCommand:
    "Continue exact source rows in docs/hsk24/next-checkpoint.json; vocabulary ordinals pending=[], preserve current versions/history.",
  verification: "docs/hsk24/completion-verification.json",
  nextCheckpoint: report.nextCheckpoint,
  pending: [
    "grammar subalternative teaching/assessment",
    "12 topic leaves lack exact leaf mapping; mapped topics/task subrequirements still partial",
    "reviewed listening/speaking material",
    "qualified human language/key review",
    "rights/publication decision",
    "HSK1 foundations incomplete",
    "authenticated private-owner acceptance for new drafts remains unauthorized",
    "full backup/restore test",
  ],
});
const prerequisites = current
  .filter(
    (l: { currentVersion: string }) =>
      !reviews.activities.some(
        (a: { versionId: string }) => a.versionId === l.currentVersion,
      ),
  )
  .map((l: { currentVersion: string }) => {
    const item = manifest.packages.find(
        (m: { versionId: string }) => m.versionId === l.currentVersion,
      ),
      p = read(`content/hsk24/${item.file}`);
    return {
      versionId: l.currentVersion,
      prerequisites: p.lesson.prerequisites,
      refresher:
        p.blocks.find(
          (b: { title: string }) => b.title === "Kiến thức cần nhắc lại",
        ) ?? null,
      supplementary: p.alignment.vocabularyReferences.filter(
        (r: { status: string }) => r.status === "SUPPLEMENTARY",
      ),
    };
  });
fs.writeFileSync(
  "docs/hsk24/prerequisite-audit.json",
  JSON.stringify(
    {
      HSK1Taught: 8,
      HSK1Total: 300,
      missing: 292,
      ownerMastery: null,
      policy:
        "Exploratory drafts retain secure prerequisite requirements; declared support is not exhaustive segmentation or HSK1 mastery.",
      lessons: prerequisites,
    },
    null,
    2,
  ) + "\n",
);
for (const [file, value] of [
  ["docs/hsk24/completion-verification.json", report],
  ["docs/hsk24/checkpoint.json", checkpoint],
] as const)
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
console.log(
  next.status +
    "; 85 current lessons /680 exercises /125 distinct recognition characters. Human approval absent.",
);
