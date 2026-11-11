import fs from "node:fs";
import { createHash } from "node:crypto";
import { expansionEnabled } from "@/modules/curriculum/application/local-expansion";
import { packageSchema, type ContentPackage } from "../domain/package";
import type { CurriculumPackageMetadata } from "@/modules/curriculum/domain/package-metadata";

export type PlanningRecord = {
  file: string;
  metadata: CurriculumPackageMetadata;
  draft: true;
};
export type LocalPlanningIndex = {
  schemaVersion: 1;
  policy: "LOCAL_VALIDATED_DRAFT_METADATA";
  manifestPackagesSha256: string;
  sourceInputs: Record<string, string>;
  records: Record<string, PlanningRecord>;
  currentByKey: Record<string, string>;
  placements: Record<
    string,
    {
      lessonUid: string;
      unitUid: string;
      courseUid: string;
      lessonOrder: number;
      unitOrder: number;
      courseOrder: number;
      planOrder: number;
      courseCode: string;
      courseTitle: string;
      unitTitle: string;
      unitSlug: string;
      releaseRef: string | null;
      syllabusId: string | null;
    }
  >;
  roots: string[];
  unlockedBy: Record<string, string[]>;
};
export const sha256 = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
export const normalizedFileHash = (file: string) =>
  sha256(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"));

// Derived at additive import time from the complete validated catalog. Each
// request verifies the small index/input pins, never regenerates it or reads
// all lesson bodies. A changed selected body is rejected when it is opened.
export function loadLocalPlanningIndex(): LocalPlanningIndex {
  if (!expansionEnabled()) throw Error("LOCAL_PLANNING_INDEX_DEV_ONLY");
  const manifest = JSON.parse(
    fs.readFileSync("content/hsk24/manifest.json", "utf8"),
  );
  const ref = manifest.planningIndex;
  if (
    ref?.file !== "planning-index.v1.json" ||
    !/^[a-f0-9]{64}$/.test(ref.sha256 ?? "")
  )
    throw Error("PLANNING_INDEX_REQUIRED");
  const bytes = fs
    .readFileSync("content/hsk24/planning-index.v1.json", "utf8")
    .replace(/\r\n/g, "\n");
  if (sha256(bytes) !== ref.sha256) throw Error("PLANNING_INDEX_DRIFT");
  const index = JSON.parse(bytes) as LocalPlanningIndex;
  if (
    index.schemaVersion !== 1 ||
    index.policy !== "LOCAL_VALIDATED_DRAFT_METADATA" ||
    index.manifestPackagesSha256 !== sha256(JSON.stringify(manifest.packages))
  )
    throw Error("PLANNING_INDEX_STALE");
  for (const [file, hash] of Object.entries(index.sourceInputs)) {
    if (
      ![
        "content/hsk24/catalog.json",
        "content/hsk24/evidence.json",
        "content/staging/slice/source-pin.json",
        "content/staging/slice/source-evidence.json",
      ].includes(file) ||
      normalizedFileHash(file) !== hash
    )
      throw Error("PLANNING_SOURCE_DRIFT");
  }
  if (Object.keys(index.sourceInputs).length !== 4)
    throw Error("PLANNING_SOURCE_PINS_REQUIRED");
  return index;
}

export function indexedDraftPackage(
  version: string,
  index = loadLocalPlanningIndex(),
): ContentPackage {
  const record = index.records[version];
  if (
    !record ||
    !/^(?:content\/hsk24|content\/staging\/slice)\/(?:F\d{2}|L\d{3,6})\.v[1-9]\d*\.json$/.test(
      record.file,
    )
  )
    throw Error("INDEXED_PACKAGE_REQUIRED");
  const p = packageSchema.parse(
    JSON.parse(fs.readFileSync(record.file, "utf8")),
  );
  const { packageHash, ...body } = p;
  if (
    p.lesson.versionId !== version ||
    packageHash !== record.metadata.packageHash ||
    sha256(JSON.stringify(body)) !== packageHash
  )
    throw Error("EXPANSION_MANIFEST_DRIFT");
  return p;
}
