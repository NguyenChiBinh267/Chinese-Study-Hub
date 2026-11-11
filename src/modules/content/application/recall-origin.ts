// Server-only local review aliases preserve the taught sense's existing FSRS card.
import fs from "node:fs";
import { expansionEnabled } from "@/modules/curriculum/application/local-expansion";
import { packageSchema, type ContentPackage } from "../domain/package";
import { contentHash } from "./catalog";
export function recallTemplateId(p: ContentPackage, conceptId: string) {
  const own = `${p.lesson.versionId}:recall:${conceptId}`;
  if (!expansionEnabled() || !fs.existsSync("content/hsk24/reviews.json"))
    return own;
  const data = JSON.parse(
    fs.readFileSync("content/hsk24/reviews.json", "utf8"),
  );
  const activity = data.activities.find(
    (a: { versionId: string }) => a.versionId === p.lesson.versionId,
  );
  if (!activity) return own;
  if (activity.sha256 !== p.packageHash) throw Error("REVIEW_HASH_DRIFT");
  const origin = activity.origins[conceptId];
  // The two immutable HSK1 starters precede the additive expansion manifest.
  // Only these exact audited versions may alias into the fixed base directory.
  const baseOrigins: Record<string, { versionId: string; sha256: string }> = {
    "L001.v2.json": {
      versionId: "l001-draft-v2",
      sha256:
        "142eb9d9ca178c54ebba71e127d99071746a7b63ee79889d2f6705acb4f12284",
    },
    "L002.v2.json": {
      versionId: "l002-draft-v2",
      sha256:
        "4b31fac6b1e849b39f49a56e5c7c01cc1db93931cc6ebffa5acf4384c673cf70",
    },
  };
  const base =
    origin && Object.hasOwn(baseOrigins, origin.file)
      ? baseOrigins[origin.file]
      : undefined;
  if (
    !origin ||
    (!base && !/^L[1234]\d{2,5}\.v[1-9]\d*\.json$/.test(origin.file))
  )
    throw Error("REVIEW_ORIGIN_REQUIRED");
  const manifest = JSON.parse(
    fs.readFileSync("content/hsk24/manifest.json", "utf8"),
  );
  if (
    !p.concepts.some((c) => c.id === conceptId) ||
    !(base
      ? p.alignment.targetLevel === 1 &&
        base.versionId === origin.versionId &&
        base.sha256 === origin.sha256
      : manifest.packages.some(
          (m: { file: string; versionId: string; sha256: string }) =>
            m.file === origin.file &&
            m.versionId === origin.versionId &&
            m.sha256 === origin.sha256,
        ))
  )
    throw Error("REVIEW_ORIGIN_UNREGISTERED");
  const source = packageSchema.parse(
    JSON.parse(
      fs.readFileSync(
        `${base ? "content/staging/slice" : "content/hsk24"}/${origin.file}`,
        "utf8",
      ),
    ),
  );
  if (
    source.lesson.versionId !== origin.versionId ||
    contentHash(source) !== origin.sha256 ||
    source.packageHash !== origin.sha256 ||
    JSON.stringify(source.concepts.find((c) => c.id === conceptId)) !==
      JSON.stringify(p.concepts.find((c) => c.id === conceptId))
  )
    throw Error("REVIEW_SENSE_DRIFT");
  return `${origin.versionId}:recall:${conceptId}`;
}
