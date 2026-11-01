import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import pinnedSelection from "../../../../content/private-preview/selection.json";
import { z } from "zod";
import type { PoolClient } from "pg";
import { contentHash, loadSourceEvidence } from "./catalog";
import { packageSchema, validatePackage } from "../domain/package";
import type { ContentAccess } from "../infrastructure/postgres-content";
import { CommandError, uuid } from "@/modules/learning/domain/local-foundation";

export const PRIVATE_POLICY = "PRIVATE_OWNER_PREVIEW";
// T053 authorizes only this production alias/project and the unchanged four
// immutable DRAFT hashes. Preview environments and local flags cannot enable it.
export function privatePreviewAllowed(
  env: NodeJS.ProcessEnv = process.env,
  build = process.env.NODE_ENV,
) {
  try {
    if (env.CSH_PRIVATE_OWNER_PREVIEW === "cloud-v1") {
      const db = new URL(env.DATABASE_URL!);
      return (
        build === "production" &&
        env.NODE_ENV === "production" &&
        env.VERCEL === "1" &&
        env.VERCEL_ENV === "production" &&
        env.CSH_APP_MODE === "PRODUCTION_AUTHENTICATED" &&
        env.CSH_APP_ORIGIN === "https://chinese-study-hub-owner.vercel.app" &&
        env.CSH_AUTH_URL === "https://yartjbdapoyqcxfagsrj.supabase.co" &&
        db.hostname === "aws-0-ap-southeast-1.pooler.supabase.com" &&
        db.username === "csh_runtime.yartjbdapoyqcxfagsrj" &&
        db.pathname === "/postgres" &&
        db.port === "6543" &&
        db.searchParams.get("sslmode") === "verify-full" &&
        !env.CSH_CONTENT_RELEASE &&
        !env.CSH_CONTENT_TEST_ROOT &&
        !env.CSH_AUTH_TECHNICAL_FIXTURE &&
        !env.CSH_LOCAL_DATABASE &&
        !env.CSH_LOCAL_OWNER_ID &&
        !env.CSH_LOCAL_SESSION_SECRET
      );
    }
    const urls = [env.CSH_APP_ORIGIN, env.CSH_AUTH_URL, env.DATABASE_URL].map(
      (u) => new URL(u!),
    );
    return (
      env.CSH_PRIVATE_OWNER_PREVIEW === "local-v1" &&
      build === "development" &&
      env.NODE_ENV === "development" &&
      env.CSH_APP_MODE === "PRODUCTION_AUTHENTICATED" &&
      !env.CSH_CONTENT_RELEASE &&
      !env.CSH_CONTENT_TEST_ROOT &&
      !env.CSH_AUTH_TECHNICAL_FIXTURE &&
      urls.every((u) =>
        ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname),
      ) &&
      urls[2].username === "csh_runtime" &&
      /^\/csh_private_verify_[a-f0-9]{12}$/.test(urls[2].pathname)
    );
  } catch {
    return false;
  }
}
const selectionSchema = z.strictObject({
  policy: z.literal(PRIVATE_POLICY),
  id: z.literal("private-owner-preview-v1"),
  onlineActivation: z.literal("PENDING_OWNER_APPROVAL"),
  packages: z
    .array(
      z.strictObject({
        file: z.string().regex(/^(F\d{2}|L\d{3})\.v\d+\.json$/),
        versionId: z.string(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .length(4),
});
export function loadPrivatePackages(bundle?: string) {
  const root = path.join(process.cwd(), "content/private-preview");
  const selection = selectionSchema.parse(pinnedSelection);
  // The production source/export contains no private package files. A sensitive
  // server environment value supplies the compressed originals; hashes below
  // authenticate every byte of content before it can be used for grading.
  const supplied =
    bundle === undefined
      ? undefined
      : z
          .array(packageSchema)
          .length(4)
          .parse(
            JSON.parse(
              gunzipSync(Buffer.from(bundle, "base64"), {
                maxOutputLength: 262144,
              }).toString("utf8"),
            ),
          );
  const all = selection.packages.map((entry) => {
    const p = packageSchema.parse(
      supplied
        ? supplied.find((p) => p.lesson.versionId === entry.versionId)
        : JSON.parse(fs.readFileSync(path.join(root, entry.file), "utf8")),
    );
    if (
      p.lesson.versionId !== entry.versionId ||
      p.packageHash !== entry.sha256 ||
      contentHash(p) !== entry.sha256 ||
      p.state !== "DRAFT" ||
      p.reviewStatus !== "DRAFT_UNREVIEWED" ||
      p.publicationStatus !== "BLOCKED" ||
      p.humanReview !== null ||
      p.rights.publicationReceipt !== null ||
      p.rights.licenseDecision !== "ORIGINAL_REVIEW_PENDING" ||
      p.media.length
    )
      throw Error("PRIVATE_PREVIEW_PACKAGE_REJECTED");
    return p;
  });
  if (
    new Set(all.map((p) => p.lesson.id)).size !== 4 ||
    !["F01", "F02", "L001", "L002"].every((id) =>
      all.some((p) => p.lesson.id === id),
    )
  )
    throw Error("PRIVATE_PREVIEW_SELECTION_REJECTED");
  const evidence = loadSourceEvidence();
  for (const p of all)
    if (validatePackage(p, all, evidence).length)
      throw Error("PRIVATE_PREVIEW_VALIDATION_FAILED");
  return { selection, all };
}
export function loadPrivateOwnerPreview(
  env: NodeJS.ProcessEnv = process.env,
  build = process.env.NODE_ENV,
) {
  if (!env.CSH_PRIVATE_OWNER_PREVIEW) return null;
  if (!privatePreviewAllowed(env, build))
    throw Error("PRIVATE_PREVIEW_LOCAL_ONLY");
  if (
    env.CSH_PRIVATE_OWNER_PREVIEW === "cloud-v1" &&
    !env.CSH_PRIVATE_PACKAGE_BUNDLE
  )
    throw Error("PRIVATE_SERVER_BUNDLE_REQUIRED");
  const { selection, all } = loadPrivatePackages(
    env.CSH_PRIVATE_OWNER_PREVIEW === "cloud-v1"
      ? env.CSH_PRIVATE_PACKAGE_BUNDLE
      : undefined,
  );
  const packageFor = async (c: PoolClient, version: string) => {
    const p = all.find((p) => p.lesson.versionId === version);
    if (!p)
      throw new CommandError(
        404,
        "CONTENT_NOT_ELIGIBLE",
        "Phiên bản không thuộc lựa chọn preview riêng tư.",
      );
    const row = (
      await c.query(
        "SELECT manifest,package_hash,state FROM app_content.packages WHERE version_id=$1",
        [version],
      )
    ).rows[0];
    if (
      !row ||
      row.state !== "DRAFT" ||
      row.package_hash !== p.packageHash ||
      contentHash(packageSchema.parse(row.manifest)) !== p.packageHash
    )
      throw Error("PRIVATE_PREVIEW_REGISTERED_DRIFT");
    return p;
  };
  const access: ContentAccess = {
    current: () => all,
    packageFor,
    canStart: (v) => all.some((p) => p.lesson.versionId === v),
    reviewStatus: "DRAFT_UNREVIEWED",
    summaryVersions: () => all.map((p) => p.lesson.versionId),
    preserveMasteryProjection: true,
  };
  return {
    id: selection.id,
    technical: false,
    privateOwnerPreview: true as const,
    current: all,
    all,
    access,
    template: (id: string) => {
      for (const p of all)
        for (const c of p.concepts)
          if (id === `${p.lesson.versionId}:recall:${c.id}`)
            return {
              prompt: `DRAFT · AI-reviewed · ${c.hanzi}`,
              back: `${c.dictionaryPinyin} · ${c.meaning} (chưa duyệt bởi người có chuyên môn)`,
            };
      return null;
    },
    audio: (id: string): { bytes: Buffer; type: string } => {
      void id;
      throw new CommandError(
        404,
        "AUDIO_NOT_AVAILABLE",
        "Preview chỉ có TTS tùy chọn; chưa có audio được duyệt.",
      );
    },
  };
}

// Run before any cached idempotency receipt is returned. Historical receipts
// never authorize a target removed from the current private selection.
export async function assertPrivatePath(
  c: PoolClient,
  uid: string,
  path: string,
  r: NonNullable<ReturnType<typeof loadPrivateOwnerPreview>>,
) {
  const parts = path.split("/");
  if (parts[0] === "content" && parts[1] === "sessions" && parts.length === 4) {
    const row = (
      await c.query(
        "SELECT lesson_version_id FROM app_private.lesson_sessions WHERE user_id=$1 AND id=$2",
        [uid, uuid.parse(parts[2])],
      )
    ).rows[0];
    if (!row)
      throw new CommandError(
        404,
        "SESSION_NOT_FOUND",
        "Không có phiên preview của bạn.",
      );
    if (
      row.lesson_version_id === "local-review-activity-v1" &&
      ["lease", "duration"].includes(parts[3])
    )
      return;
    await r.access.packageFor(c, row.lesson_version_id);
  } else if (
    parts[0] === "content" &&
    parts.length === 3 &&
    parts[2] === "start"
  ) {
    await r.access.packageFor(c, parts[1]);
  } else if (parts[0] === "cards" && parts.length === 3) {
    const row = (
      await c.query(
        "SELECT template_version_id FROM app_private.cards WHERE user_id=$1 AND id=$2",
        [uid, uuid.parse(parts[1])],
      )
    ).rows[0];
    if (!row || !r.template(row.template_version_id))
      throw new CommandError(
        404,
        "CARD_NOT_FOUND",
        "Thẻ không thuộc lựa chọn preview hiện tại.",
      );
  }
}
