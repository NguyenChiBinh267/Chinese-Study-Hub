import fs from "node:fs";
import { createHash } from "node:crypto";
const n = Number(process.argv[2]);
if (!Number.isInteger(n) || n < 1 || n > 4)
  throw Error("EXPECTED_INITIAL_HSK3_BATCH");
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8")),
  h3 = read("docs/hsk24/hsk3-coverage.json"),
  sqlPath = `.local-postgres/hsk24/hsk3-batch${n}-sql.log`,
  sql = fs.readFileSync(sqlPath, "utf8");
if (!/fail 0\b/.test(sql) || !/skipped 0\b/.test(sql))
  throw Error("SQL_NOT_ACCEPTED");
const checkpoint = {
  status: "HSK2_CURRICULUM_PARTIAL / HSK3_IN_PROGRESS",
  baseCommit: "2ca0b2907dcad06a49eaa063f6f65da98a40fef1",
  hsk2ReconciliationCommit: "5be56f3eb48e037c5928149d152ae359ed84621c",
  completedHSK3Batches: Array.from({ length: n }, (_, i) => i + 1),
  HSK3Vocabulary: h3.vocabulary.taught,
  HSK3Denominator: 500,
  HSK3Lessons: h3.lessonVersions.length,
  HSK3Exercises: h3.exercises,
  remainingHSK3Ordinals: h3.vocabulary.remainingOrdinals,
  nextBatchFile: n < 4 ? `content/hsk24/batch${n + 10}.authoring.json` : null,
  nextAction:
    n < 4
      ? "Validate/author/import next existing original batch, focusedSQL then atomic checkpoint+coverage commit"
      : "Full relevant regression; reconcile source gaps, prerequisites and independent review",
  sourceSha256: h3.sourceSha256,
  coverageSha256: createHash("sha256")
    .update(
      fs
        .readFileSync("docs/hsk24/coverage.json", "utf8")
        .replaceAll("\r\n", "\n"),
    )
    .digest("hex"),
  sqlEvidence: {
    path: sqlPath,
    passed: Number(sql.match(/pass (\d+)/)?.[1]),
    failed: 0,
    skipped: 0,
    sha256: createHash("sha256").update(fs.readFileSync(sqlPath)).digest("hex"),
  },
  independentTechnicalReview: "PENDING_FINAL_CANDIDATE",
  qualifiedLanguageReview: false,
  published: false,
  learnerMastered: null,
};
if (checkpoint.HSK3Vocabulary !== n * 24 || checkpoint.HSK3Lessons !== n * 4)
  throw Error("UNEXPECTED_VERIFIED_COUNTS");
fs.mkdirSync("docs/hsk24/hsk3-batches", { recursive: true });
for (const [path, value] of [
  [`docs/hsk24/hsk3-batches/batch${n}.json`, checkpoint],
  ["docs/hsk24/hsk23-checkpoint.json", checkpoint],
] as const)
  fs.writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
console.log(
  `HSK3 ${checkpoint.HSK3Vocabulary}/500, ${checkpoint.HSK3Lessons} lessons. No publication/mastery.`,
);
