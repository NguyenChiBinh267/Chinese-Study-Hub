import { z } from "zod";
import { createHash } from "node:crypto";
import { packageSchema, validatePackage, type SourceEvidence } from "./package";
const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const digest = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
export const releaseStates = [
  "DRAFT",
  "REVIEW_PENDING",
  "APPROVED",
  "PUBLISHED",
  "WITHDRAWN",
] as const;
export const evidenceRef = z.strictObject({
  file: z.string().min(1).max(240),
  sha256: sha,
});
export const reviewRecord = z.strictObject({
  id,
  versionId: id,
  contentHash: sha,
  kind: z.enum(["human", "synthetic"]),
  reviewer: z.string().min(3),
  qualification: z.string().min(3),
  reviewedAt: z.iso.datetime(),
  scope: z
    .array(z.enum(["language", "keys", "alignment", "rights", "audio"]))
    .min(1),
  findings: z.array(z.string()),
  unresolved: z.array(z.string()),
  decision: z.enum(["APPROVED", "CHANGES_REQUIRED"]),
  evidence: z.array(evidenceRef).min(1),
});
export const audioRecord = z
  .strictObject({
    id,
    target: id,
    file: z.string().min(1).max(240),
    sha256: sha,
    format: z.literal("audio/wav"),
    durationMs: z.number().min(100).max(30000),
    creator: z.string().min(3),
    source: z.enum(["ORIGINAL", "LICENSED", "SYNTHETIC_TEST"]),
    permission: evidenceRef,
    attribution: z.string(),
    linguisticReview: z.enum([
      "UNREVIEWED",
      "HUMAN_APPROVED",
      "TECHNICAL_ONLY",
    ]),
    review: evidenceRef.nullable(),
    eligible: z.boolean(),
  })
  .superRefine((a, ctx) => {
    if (a.eligible && (!a.review || a.linguisticReview === "UNREVIEWED"))
      ctx.addIssue({
        code: "custom",
        message: "Eligible audio requires a completed review",
      });
    if (
      a.source === "SYNTHETIC_TEST" &&
      a.linguisticReview === "HUMAN_APPROVED"
    )
      ctx.addIssue({
        code: "custom",
        message: "Synthetic signal is not human reference speech",
      });
  });
export const releaseManifest = z.strictObject({
  schemaVersion: z.literal(1),
  id,
  state: z.enum(releaseStates),
  purpose: z.enum(["REAL_CONTENT", "TECHNICAL_TEST"]),
  createdAt: z.iso.datetime(),
  packages: z
    .array(z.strictObject({ versionId: id, hash: sha, reviewId: id }))
    .min(1)
    .max(4),
  reviews: z.array(reviewRecord).max(4),
  audio: z.array(audioRecord).max(32),
});
export const trustRegistry = z.strictObject({
  schemaVersion: z.literal(1),
  releases: z.array(
    z.strictObject({
      id,
      sha256: sha,
      state: z.enum(releaseStates),
      file: z.string().min(1),
    }),
  ),
  reviewHashes: z.array(sha),
});
export type Release = z.infer<typeof releaseManifest>;
export type AudioRecord = z.infer<typeof audioRecord>;
export function transitionRelease(
  input: unknown,
  next: Release["state"],
  validate: () => void,
) {
  const r = releaseManifest.parse(input);
  const allowed: Record<Release["state"], Release["state"][]> = {
    DRAFT: ["REVIEW_PENDING"],
    REVIEW_PENDING: ["DRAFT", "APPROVED"],
    APPROVED: ["PUBLISHED", "WITHDRAWN"],
    PUBLISHED: ["WITHDRAWN"],
    WITHDRAWN: [],
  };
  if (!allowed[r.state].includes(next))
    throw Error("INVALID_RELEASE_TRANSITION");
  if (next === "APPROVED" || next === "PUBLISHED") validate();
  return { ...r, state: next };
}
export function verifyRelease(
  input: unknown,
  manifests: unknown[],
  evidence: SourceEvidence,
  trustedReviews: string[],
  technical: boolean,
) {
  const r = releaseManifest.parse(input),
    packages = manifests.map((p) => packageSchema.parse(p));
  const fail = (code: string): never => {
    throw new Error(code);
  };
  if (r.state !== "PUBLISHED") fail("RELEASE_NOT_PUBLISHED");
  if (r.purpose === "TECHNICAL_TEST" && !technical)
    fail("SYNTHETIC_RELEASE_FORBIDDEN");
  if (
    packages.length !== r.packages.length ||
    new Set(r.packages.map((p) => p.versionId)).size !== packages.length
  )
    fail("RELEASE_PACKAGE_SET");
  const mediaIds = packages.flatMap((p) => p.media.map((m) => m.id));
  if (
    new Set(r.audio.map((a) => a.id)).size !== r.audio.length ||
    r.audio.length !== mediaIds.length ||
    r.audio.some((a) => !mediaIds.includes(a.id))
  )
    fail("RELEASE_AUDIO_SET");
  if (
    r.reviews.length !== packages.length ||
    new Set(r.reviews.map((x) => x.id)).size !== r.reviews.length
  )
    fail("RELEASE_REVIEW_SET");
  if (
    new Set(packages.flatMap((p) => p.exercises.map((e) => e.id))).size !==
    packages.reduce((n, p) => n + p.exercises.length, 0)
  )
    fail("DUPLICATE_EXERCISE_VERSION");
  for (const p of packages) {
    const ref = r.packages.find((x) => x.versionId === p.lesson.versionId);
    const { packageHash, ...body } = p;
    if (
      !ref ||
      digest(JSON.stringify(body)) !== packageHash ||
      ref.hash !== packageHash ||
      p.release.id !== r.id
    )
      fail("RELEASE_PACKAGE_HASH");
    const review = r.reviews.find((x) => x.id === ref!.reviewId);
    if (
      !review ||
      !trustedReviews.includes(digest(JSON.stringify(review))) ||
      review.versionId !== p.lesson.versionId ||
      review.contentHash !== packageHash ||
      review.decision !== "APPROVED" ||
      review.unresolved.length ||
      ["language", "keys", "alignment", "rights", "audio"].some(
        (s) => !review.scope.includes(s as (typeof review.scope)[number]),
      ) ||
      Date.parse(review.reviewedAt) > Date.now() ||
      (r.purpose === "REAL_CONTENT" && review.kind !== "human") ||
      (review.kind === "synthetic" && !technical) ||
      p.humanReview?.receiptId !== review.id ||
      p.humanReview.reviewerType !== review.kind ||
      p.humanReview.reviewedAt !== review.reviewedAt ||
      !review.evidence.some((e) => e.sha256 === p.rights.publicationReceipt)
    )
      fail("TRUSTED_REVIEW_REQUIRED");
    if (
      p.state !== "PUBLISHED" ||
      validatePackage(p, packages, evidence, undefined, true).length
    )
      fail("PUBLICATION_CRITERIA_REQUIRED");
    for (const media of p.media) {
      const a = r.audio.find((x) => x.id === media.id);
      if (
        !a ||
        !a.eligible ||
        !a.review ||
        a.sha256 !== media.sha256 ||
        a.target !== p.lesson.versionId ||
        (media.attribution !== undefined &&
          media.attribution !== a.attribution) ||
        (r.purpose === "REAL_CONTENT" && !media.attribution) ||
        (r.purpose === "TECHNICAL_TEST" &&
          a.linguisticReview !== "TECHNICAL_ONLY") ||
        (r.purpose === "REAL_CONTENT" &&
          (a.source === "SYNTHETIC_TEST" ||
            a.linguisticReview !== "HUMAN_APPROVED")) ||
        media.consentReceipt !== a.permission.sha256 ||
        media.humanReviewReceipt !== a.review.sha256
      )
        fail("AUDIO_RELEASE_CRITERIA_REQUIRED");
    }
  }
  if (new Set(packages.map((p) => p.lesson.id)).size !== packages.length)
    fail("DUPLICATE_CURRENT_LESSON");
  return { release: r, packages };
}
// WAV is the deliberately bounded first import format; no transcoding or TTS claim.
export function wavDuration(bytes: Buffer) {
  if (
    bytes.length < 44 ||
    bytes.length > 4_000_000 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WAVE" ||
    bytes.readUInt32LE(4) + 8 !== bytes.length
  )
    throw Error("INVALID_WAV");
  let rate = 0,
    data = 0;
  for (let at = 12; at + 8 <= bytes.length; ) {
    const tag = bytes.toString("ascii", at, at + 4),
      n = bytes.readUInt32LE(at + 4),
      end = at + 8 + n;
    if (end > bytes.length) throw Error("INVALID_WAV_CHUNK");
    if (tag === "fmt ") {
      if (
        n < 16 ||
        bytes.readUInt16LE(at + 8) !== 1 ||
        ![1, 2].includes(bytes.readUInt16LE(at + 10)) ||
        ![16].includes(bytes.readUInt16LE(at + 22))
      )
        throw Error("PCM16_WAV_REQUIRED");
      const channels = bytes.readUInt16LE(at + 10),
        sampleRate = bytes.readUInt32LE(at + 12);
      rate = bytes.readUInt32LE(at + 16);
      if (
        sampleRate < 8000 ||
        sampleRate > 96000 ||
        rate !== sampleRate * channels * 2 ||
        bytes.readUInt16LE(at + 20) !== channels * 2
      )
        throw Error("INVALID_WAV_RATE");
    }
    if (tag === "data") data += n;
    at = end + (n % 2);
  }
  const ms = (data / rate) * 1000;
  if (!rate || ms < 100 || ms > 30000) throw Error("INVALID_WAV_DURATION");
  return ms;
}
