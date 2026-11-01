import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  indexedDraftPackage,
  loadLocalPlanningIndex,
  type LocalPlanningIndex,
} from "./local-planning-index";
import {
  curriculumOutline,
  expansionEnabled,
} from "@/modules/curriculum/application/local-expansion";
import {
  packageSchema,
  validatePackage,
  type ContentPackage,
  type SourceEvidence,
} from "../domain/package";
export function contentHash(p: ContentPackage) {
  const { packageHash, ...body } = p;
  void packageHash;
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}
export function loadSourceEvidence() {
  const dir = path.join(process.cwd(), "content/staging/slice");
  const pin = JSON.parse(
    fs.readFileSync(path.join(dir, "source-pin.json"), "utf8"),
  );
  const evidenceBytes = fs
    .readFileSync(path.join(dir, "source-evidence.json"), "utf8")
    .replace(/\r\n/g, "\n");
  if (
    pin.pdfSha256 !==
      "ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941" ||
    pin.evidenceFileSha256 !==
      createHash("sha256").update(evidenceBytes).digest("hex")
  )
    throw new Error("SOURCE_SNAPSHOT_OR_EVIDENCE_DRIFT");
  const evidence = JSON.parse(
    fs.readFileSync(path.join(dir, "source-evidence.json"), "utf8"),
  ) as SourceEvidence;
  evidence.snapshotHashes = [pin.pdfSha256];
  if (expansionEnabled()) {
    const extra = JSON.parse(
      fs.readFileSync("content/hsk24/evidence.json", "utf8"),
    );
    if (extra.sourceSnapshotSha256 !== pin.pdfSha256)
      throw Error("EXPANSION_SOURCE_DRIFT");
    evidence.references.push(...extra.references);
  }
  return evidence;
}
export function loadDraftCatalog() {
  const dir = path.join(process.cwd(), "content/staging/slice");
  const evidence = loadSourceEvidence();
  const files = fs
    .readdirSync(dir)
    .filter((name) => /^(F\d{2}|L\d{3,6})\.v[1-9]\d*\.json$/.test(name))
    .sort(
      (a, b) =>
        Number(a.match(/\.v(\d+)\./)![1]) - Number(b.match(/\.v(\d+)\./)![1]) ||
        a.localeCompare(b),
    );
  const packages = files.map((file) =>
    packageSchema.parse(
      JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")),
    ),
  );
  if (expansionEnabled()) {
    const manifest = JSON.parse(
      fs.readFileSync("content/hsk24/manifest.json", "utf8"),
    );
    for (const item of manifest.packages) {
      const p = packageSchema.parse(
        JSON.parse(
          fs.readFileSync(path.join("content/hsk24", item.file), "utf8"),
        ),
      );
      if (
        contentHash(p) !== item.sha256 ||
        p.lesson.versionId !== item.versionId
      )
        throw Error("EXPANSION_MANIFEST_DRIFT");
      packages.push(p);
    }
  }
  const ids = packages.map((p) => p.lesson.versionId);
  if (new Set(ids).size !== ids.length) throw new Error("DUPLICATE_PACKAGE");
  const exerciseIds = packages.flatMap((p) => p.exercises.map((e) => e.id));
  if (new Set(exerciseIds).size !== exerciseIds.length)
    throw new Error("DUPLICATE_EXERCISE_VERSION");
  const problems = packages.flatMap((p) => [
    ...validatePackage(
      p,
      packages,
      evidence,
      `${p.lesson.id}.v${p.lesson.version}.json`,
    ),
    ...(p.media.length
      ? [
          {
            file: p.lesson.id,
            recordId: p.lesson.versionId,
            field: "media",
            code: "MEDIA_ADAPTER_NOT_ENABLED",
            message:
              "Phase4 runtime supports text drafts only; reviewed media requires a separate adapter/version",
          },
        ]
      : []),
    ...(contentHash(p) !== p.packageHash
      ? [
          {
            file: p.lesson.id,
            recordId: p.lesson.versionId,
            field: "packageHash",
            code: "CONTENT_HASH",
            message: "Immutable package hash mismatch",
          },
        ]
      : []),
  ]);
  if (problems.length) throw new Error(JSON.stringify(problems));
  return { packages, evidence };
}
export function findContentTemplate(templateId: string) {
  if (expansionEnabled())
    return indexedContentTemplate(
      templateId,
      loadLocalPlanningIndex(),
      new Map(),
    );
  return contentTemplateIndex().get(templateId) ?? null;
}
export function indexedContentTemplate(
  templateId: string,
  index: LocalPlanningIndex,
  packages: Map<string, ContentPackage>,
) {
  const split = templateId.indexOf(":recall:");
  if (split < 1) return null;
  const version = templateId.slice(0, split),
    id = templateId.slice(split + 8);
  if (!Object.hasOwn(index.records, version)) return null;
  const p = packages.get(version) ?? indexedDraftPackage(version, index);
  packages.set(version, p);
  const concept = p.concepts.find((c) => c.id === id);
  return concept
    ? {
        prompt: `${p.lesson.id} · DRAFT chưa duyệt · Nhớ nghĩa và pinyin của ${concept.hanzi}.`,
        back: `${concept.dictionaryPinyin} · ${concept.meaning} (draft chưa duyệt)`,
      }
    : null;
}
// A fresh, validated snapshot per request/command; never a mutable global cache.
export function contentTemplateIndex() {
  const { packages } = loadDraftCatalog();
  const index = new Map<string, { prompt: string; back: string }>();
  for (const p of packages)
    for (const c of p.concepts)
      index.set(`${p.lesson.versionId}:recall:${c.id}`, {
        prompt: `${p.lesson.id} · DRAFT chưa duyệt · Nhớ nghĩa và pinyin của ${c.hanzi}.`,
        back: `${c.dictionaryPinyin} · ${c.meaning} (draft chưa duyệt)`,
      });
  return index;
}

export function currentDrafts() {
  const { packages } = loadDraftCatalog();
  return (
    curriculumOutline().lessons as { currentVersion: string; key: string }[]
  ).map((l) => {
    const p = packages.find(
      (p) => p.lesson.versionId === l.currentVersion && p.lesson.id === l.key,
    );
    if (!p) throw new Error("MISSING_CURRENT_CURRICULUM_VERSION");
    return p;
  });
}
