import fs from "node:fs";
import { loadDraftCatalog } from "../src/modules/content/application/catalog";
import {
  curriculumOutline,
  expansionEnabled,
} from "../src/modules/curriculum/application/local-expansion";
import { validateCurriculum } from "../src/modules/curriculum/domain/catalog";
import { curriculumPackageMetadata } from "../src/modules/curriculum/domain/package-metadata";
import {
  normalizedFileHash,
  sha256,
  type LocalPlanningIndex,
} from "../src/modules/content/application/local-planning-index";

export function buildLocalPlanningIndex() {
  if (!expansionEnabled()) throw Error("LOCAL_EXPANSION_REQUIRED");
  const { packages } = loadDraftCatalog(),
    catalog = validateCurriculum(curriculumOutline(), packages);
  const manifest = JSON.parse(
    fs.readFileSync("content/hsk24/manifest.json", "utf8"),
  );
  const files = new Map(
    manifest.packages.map((m: { versionId: string; file: string }) => [
      m.versionId,
      `content/hsk24/${m.file}`,
    ]),
  );
  const index: LocalPlanningIndex = {
    schemaVersion: 1,
    policy: "LOCAL_VALIDATED_DRAFT_METADATA",
    manifestPackagesSha256: sha256(JSON.stringify(manifest.packages)),
    sourceInputs: {},
    records: {},
    currentByKey: {},
    placements: {},
    roots: [],
    unlockedBy: {},
  };
  for (const file of [
    "content/hsk24/catalog.json",
    "content/hsk24/evidence.json",
    "content/staging/slice/source-pin.json",
    "content/staging/slice/source-evidence.json",
  ])
    index.sourceInputs[file] = normalizedFileHash(file);
  for (const p of packages) {
    // This optimization cannot introduce published or reviewed eligibility.
    if (
      !["DRAFT", "VALIDATED", "REVIEW_PENDING"].includes(p.state) ||
      p.reviewStatus !== "DRAFT_UNREVIEWED" ||
      p.publicationStatus !== "BLOCKED" ||
      p.humanReview !== null ||
      p.media.length
    )
      throw Error("DRAFT_ONLY_INDEX");
    index.records[p.lesson.versionId] = {
      file: String(
        files.get(p.lesson.versionId) ??
          `content/staging/slice/${p.lesson.id}.v${p.lesson.version}.json`,
      ),
      metadata: curriculumPackageMetadata(p),
      draft: true,
    };
  }
  const ordered = [...catalog.lessons].sort((a, b) => {
    const au = catalog.units.find((u) => u.id === a.unitId)!,
      bu = catalog.units.find((u) => u.id === b.unitId)!;
    return (
      catalog.courses.find((c) => c.id === au.courseId)!.order -
        catalog.courses.find((c) => c.id === bu.courseId)!.order ||
      au.order - bu.order ||
      a.order - b.order ||
      a.key.localeCompare(b.key)
    );
  });
  for (const l of catalog.lessons) {
    index.currentByKey[l.key] = l.currentVersion;
    const unit = catalog.units.find((u) => u.id === l.unitId)!,
      course = catalog.courses.find((c) => c.id === unit.courseId)!;
    index.placements[l.key] = {
      lessonUid: l.id,
      unitUid: unit.id,
      courseUid: course.id,
      lessonOrder: l.order,
      unitOrder: unit.order,
      courseOrder: course.order,
      planOrder: ordered.findIndex((x) => x.id === l.id),
      courseCode: course.code,
      courseTitle: course.title,
      unitTitle: unit.title,
      unitSlug: unit.slug,
      releaseRef: course.releaseRef,
      syllabusId: course.syllabusId,
    };
    const deps = index.records[l.currentVersion].metadata.lesson.prerequisites;
    if (!deps.length) index.roots.push(l.key);
    for (const dep of deps) (index.unlockedBy[dep] ??= []).push(l.key);
  }
  const bytes = JSON.stringify(index, null, 2) + "\n";
  fs.writeFileSync("content/hsk24/planning-index.v1.json", bytes);
  manifest.planningIndex = {
    file: "planning-index.v1.json",
    sha256: sha256(bytes),
  };
  fs.writeFileSync(
    "content/hsk24/manifest.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return {
    versions: packages.length,
    current: catalog.lessons.length,
    bytes: Buffer.byteLength(bytes),
    sha256: manifest.planningIndex.sha256,
  };
}
if (
  process.argv[1]
    ?.replaceAll("\\", "/")
    .endsWith("/build-hsk24-planning-index.ts")
)
  console.log(JSON.stringify(buildLocalPlanningIndex()));
