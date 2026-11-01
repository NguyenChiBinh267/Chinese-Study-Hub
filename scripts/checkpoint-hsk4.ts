import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  currentDrafts,
  contentHash,
  loadDraftCatalog,
} from "../src/modules/content/application/catalog";
import { validatePackage } from "../src/modules/content/domain/package";
const batch = Number(process.argv[2]);
if (!Number.isInteger(batch) || batch < 2 || batch > 24)
  throw Error("BOUNDED_BATCH_REQUIRED");
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const digest = (p: string) =>
  createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const log = `.local-postgres/hsk24/hsk4-batch${batch}-sql.log`;
const text = fs.readFileSync(log, "utf8");
if (
  !/(?:ℹ|#) fail 0\b/.test(text) ||
  !/(?:ℹ|#) skipped 0\b/.test(text) ||
  !/(?:ℹ|#) pass [1-9]\d*\b/.test(text)
)
  throw Error("BATCH_SQL_NOT_PASSED");
const registry = read("content/hsk24/reviews.json");
const reviewIds = new Set(
  registry.activities.map((a: { versionId: string }) => a.versionId),
);
const all = currentDrafts().filter((p) => p.alignment.targetLevel === 4);
const intros = all.filter((p) => !reviewIds.has(p.lesson.versionId));
const ords = intros.flatMap((p) =>
  p.alignment.vocabularyReferences
    .filter(
      (v) =>
        v.status === "VERIFIED" &&
        p.concepts.some((c) => c.referenceIds.includes(v.id)),
    )
    .map((v) => v.ordinal!),
);
if (new Set(ords).size !== ords.length || ords.length !== batch * 24)
  throw Error("INTRODUCTION_COVERAGE_DRIFT");
const { packages, evidence } = loadDraftCatalog();
for (const p of all)
  if (
    contentHash(p) !== p.packageHash ||
    validatePackage(p, packages, evidence).length
  )
    throw Error("PACKAGE_VALIDATION_FAILED");
const pointer = read(".local-postgres/hsk24/current.json");
const state = read(pointer.stateFile);
const baseline = read(".local-postgres/hsk24/hsk4-production-before.json");
if (baseline.database !== state.database) throw Error("DATABASE_SWITCHED");
const file = "docs/hsk24/hsk4-production-checkpoint.json";
const previous = fs.existsSync(file) ? read(file) : { acceptedBatches: [] };
const descriptor = `content/hsk24/batch${30 + batch}.authoring.json`;
const imported = `.local-postgres/hsk24/hsk4-batch${batch}-import.log`;
const entry = {
  batch,
  descriptor,
  descriptorSha256: digest(descriptor),
  sqlLog: log,
  sqlLogSha256: digest(log),
  importLog: imported,
  importLogSha256: digest(imported),
  preliminaryLanguageQA:
    "Separate read-only AI review; never qualified human approval",
};
const result = {
  status: "HSK4_PARTIAL / HSK24_EPIC_PARTIAL",
  baseline: "4fab1cc1d3697bdc1d58b843204e47f6415dcaf4",
  database: state.database,
  completedBatch: batch,
  introductionLessons: intros.length,
  reviewActivities: all.length - intros.length,
  exercises: all.reduce((n, p) => n + p.exercises.length, 0),
  vocabularyTaught: ords.length,
  denominator: 1000,
  remainingOrdinals: Array.from({ length: 1000 }, (_, i) => i + 1001).filter(
    (n) => !ords.includes(n),
  ),
  nextBatch: batch + 1,
  nextLessonIds: Array.from({ length: 4 }, (_, i) => `L${401 + batch * 4 + i}`),
  nextAuthoringFile: `content/hsk24/batch${31 + batch}.authoring.json`,
  acceptedBatches: [
    ...previous.acceptedBatches.filter(
      (x: { batch: number }) => x.batch !== batch,
    ),
    entry,
  ],
  qualifiedHumanReview: false,
  publication: "BLOCKED",
  mastery: null,
  preservation:
    "Full existing rows compared by each additive import; original selected database remains unchanged. Synthetic test owners add new rows.",
};
fs.writeFileSync(file, JSON.stringify(result, null, 2) + "\n");
console.log(
  `HSK4 batch${batch}: ${ords.length}/1000 entries,${intros.length} introductions,${result.reviewActivities} reviews; ${result.remainingOrdinals.length} missing.`,
);
