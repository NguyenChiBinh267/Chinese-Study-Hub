import fs from "node:fs";
import { createHash } from "node:crypto";
const batch = Number(process.argv[2]);
if (!Number.isInteger(batch) || batch < 6 || batch > 9)
  throw Error("EXPECTED_BATCH_6_TO_9");
const dir = ".local-postgres/hsk24",
  read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const sql = fs.readFileSync(`${dir}/batch${batch}-sql.log`, "utf8"),
  browser = read(`${dir}/batch${batch}-browser.json`);
if (
  !/fail 0\b/.test(sql) ||
  !browser.stats ||
  browser.stats.unexpected !== 0 ||
  browser.stats.skipped !== 0 ||
  browser.stats.expected < 2
)
  throw Error("BATCH_TESTS_NOT_ACCEPTED");
const coverage = read("docs/hsk24/coverage.json"),
  checkpoint = read("docs/hsk24/checkpoint.json"),
  catalog = read("content/hsk24/catalog.json");
const hsk = coverage.levels.find((x: { level: number }) => x.level === 2);
const manifest = read("content/hsk24/manifest.json");
const historical =
  manifest.packages.length -
  catalog.lessons.filter((x: { key: string }) => x.key.startsWith("L2")).length;
Object.assign(checkpoint, {
  currentRunBaseCommit: "a60a4d4512fcbd1a0eac905a41bb97986deaeb88",
  newBatchesThisContinuation: batch - 5,
  historicalVersionCount: historical,
  verification: "docs/hsk24/completion-verification.json",
});
checkpoint.knownContentIssues = checkpoint.knownContentIssues.map(
  (s: string) =>
    s.includes("historical package versions")
      ? `${historical} historical package versions retained; only catalog currentVersion contributes to current coverage`
      : s,
);
const pending = coverage.vocabulary
  .filter(
    (x: { introductionLevel: number; status: string }) =>
      x.introductionLevel === 2 && x.status === "NOT_MAPPED",
  )
  .map((x: { ordinal: number }) => x.ordinal);
Object.assign(checkpoint, {
  completedBatch: `HSK2-batch${batch}`,
  completedBatches: [
    ...new Set([...checkpoint.completedBatches, `HSK2-batch${batch}`]),
  ],
  lessons: catalog.lessons
    .filter((x: { key: string }) => x.key.startsWith("L2"))
    .map((x: { currentVersion: string }) => x.currentVersion),
  currentLessonCount: catalog.lessons.filter((x: { key: string }) =>
    x.key.startsWith("L2"),
  ).length,
  currentExerciseCount:
    catalog.lessons.filter((x: { key: string }) => x.key.startsWith("L2"))
      .length * 8,
  coverageVocabulary: { HSK2: hsk.entriesWithDraftTeaching, HSK3: 0, HSK4: 0 },
  remainingNewVocabulary: { HSK2: pending.length, HSK3: 500, HSK4: 1000 },
  pendingVocabularyOrdinals: pending,
  coverageSha256: createHash("sha256")
    .update(
      fs
        .readFileSync("docs/hsk24/coverage.json", "utf8")
        .replaceAll("\r\n", "\n"),
    )
    .digest("hex"),
  nextBatchFile:
    batch < 9 ? `content/hsk24/batch${batch + 1}.authoring.json` : null,
  nextBatchToAuthor: null,
  nextBatchesInOrder:
    batch < 9
      ? [
          `Validate/import/test batch${batch + 1} from its original authoring file`,
          `Continue remaining HSK2 batches then five-dimension audit/reviews/diagnostics`,
        ]
      : [
          "Five-dimensional audit reconciliation, missing teaching, unit reviews and course diagnostics",
          "Full-corpus runtime/security/performance checks",
        ],
  resumeCommand:
    batch < 9
      ? `Continue batch${batch + 1} using existing author/import pipeline; current counts exclude historical versions`
      : "Reconcile five dimensions and run unit reviews/course diagnostics; do not call vocabulary completion curriculum completion",
});
const report = {
  batch: `HSK2-batch${batch}`,
  source: "hsk-exam-2025-11",
  vocabularyTaught: hsk.entriesWithDraftTeaching,
  remaining: pending,
  sql: {
    passed: Number(sql.match(/pass (\d+)/)?.[1]),
    failed: 0,
    log: `${dir}/batch${batch}-sql.log`,
  },
  browser: { ...browser.stats, log: `${dir}/batch${batch}-browser.json` },
  publication: "BLOCKED",
  review: "DRAFT_UNREVIEWED",
};
fs.mkdirSync("docs/hsk24/batches", { recursive: true });
fs.writeFileSync(
  `docs/hsk24/batches/batch${batch}.json`,
  JSON.stringify(report, null, 2) + "\n",
);
fs.writeFileSync(
  "docs/hsk24/checkpoint.json",
  JSON.stringify(checkpoint, null, 2) + "\n",
);
console.log(
  `Checkpoint ${hsk.entriesWithDraftTeaching}/200; stage checkpoint and coverage together in the same Git commit.`,
);
