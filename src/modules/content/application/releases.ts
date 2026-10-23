import fs from "node:fs";
import path from "node:path";
import type { PoolClient } from "pg";
import {
  digest,
  trustRegistry,
  verifyRelease,
  wavDuration,
} from "../domain/release";
import { loadSourceEvidence } from "./catalog";
import { packageSchema, type ContentPackage } from "../domain/package";
import { contentHash } from "./catalog";
import type { ContentAccess } from "../infrastructure/postgres-content";
import { curriculumWithin } from "@/modules/curriculum/infrastructure/postgres-curriculum";
import { CommandError } from "@/modules/learning/domain/local-foundation";
export function contentTestAllowed(
  env: NodeJS.ProcessEnv = process.env,
  build = process.env.NODE_ENV,
) {
  try {
    const u = new URL(env.DATABASE_URL!);
    return (
      build === "development" &&
      env.NODE_ENV === "development" &&
      env.CSH_APP_MODE === "PRODUCTION_AUTHENTICATED" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) &&
      u.username === "csh_runtime" &&
      /^\/csh_release_verify_[a-f0-9]{12}$/.test(u.pathname)
    );
  } catch {
    return false;
  }
}
export function privateFile(root: string, file: string) {
  const base = fs.realpathSync(root),
    full = fs.realpathSync(path.resolve(base, file)),
    rel = path.relative(base, full);
  if (
    path.isAbsolute(file) ||
    rel.startsWith("..") ||
    path.isAbsolute(rel) ||
    !fs.statSync(full).isFile() ||
    fs.statSync(full).size > 4_000_000
  )
    throw Error("RELEASE_PATH_REJECTED");
  return fs.readFileSync(full);
}
export function loadContentRelease(
  env: NodeJS.ProcessEnv = process.env,
  build = process.env.NODE_ENV,
) {
  const technical = !!env.CSH_CONTENT_TEST_ROOT;
  if (technical && !contentTestAllowed(env, build))
    throw Error("CONTENT_TEST_FORBIDDEN");
  const root = technical
    ? env.CSH_CONTENT_TEST_ROOT!
    : path.join(process.cwd(), "content/releases");
  const registry = trustRegistry.parse(
    JSON.parse(privateFile(root, "trusted.json").toString("utf8")),
  );
  if (
    new Set(registry.releases.map((r) => r.id)).size !==
    registry.releases.length
  )
    throw Error("DUPLICATE_RELEASE");
  const selected = env.CSH_CONTENT_RELEASE;
  if (!selected) {
    if (registry.releases.some((r) => r.state === "PUBLISHED"))
      throw Error("EXPLICIT_RELEASE_SELECTION_REQUIRED");
    return null;
  }
  const active = registry.releases.find((r) => r.id === selected);
  if (!active || active.state !== "PUBLISHED")
    throw Error("RELEASE_UNAVAILABLE");
  const all = new Map<string, ContentPackage>();
  let current: ContentPackage[] = [];
  const media: ReturnType<typeof verifyRelease>["release"]["audio"] = [];
  for (const entry of registry.releases.filter(
    (r) => r.state === "PUBLISHED",
  )) {
    const bytes = privateFile(root, entry.file);
    if (digest(bytes) !== entry.sha256) throw Error("UNTRUSTED_RELEASE_BYTES");
    const input = JSON.parse(bytes.toString("utf8"));
    const manifests = (input.packages ?? []).map((p: { versionId: string }) =>
      JSON.parse(
        privateFile(root, `packages/${p.versionId}.json`).toString("utf8"),
      ),
    );
    const verified = verifyRelease(
      input,
      manifests,
      loadSourceEvidence(),
      registry.reviewHashes,
      technical,
    );
    if (verified.release.id !== entry.id) throw Error("RELEASE_ID_MISMATCH");
    for (const review of verified.release.reviews)
      for (const ref of review.evidence)
        if (digest(privateFile(root, ref.file)) !== ref.sha256)
          throw Error("REVIEW_EVIDENCE_DRIFT");
    for (const a of verified.release.audio) {
      const b = privateFile(root, a.file);
      if (digest(b) !== a.sha256 || Math.abs(wavDuration(b) - a.durationMs) > 1)
        throw Error("AUDIO_BYTES_DRIFT");
      for (const ref of [a.permission, a.review])
        if (ref && digest(privateFile(root, ref.file)) !== ref.sha256)
          throw Error("AUDIO_EVIDENCE_DRIFT");
    }
    for (const p of verified.packages) {
      const old = all.get(p.lesson.versionId);
      if (old && old.packageHash !== p.packageHash)
        throw Error("IMMUTABLE_VERSION_COLLISION");
      all.set(p.lesson.versionId, p);
    }
    for (const a of verified.release.audio) {
      const old = media.find((x) => x.id === a.id);
      if (old && old.sha256 !== a.sha256)
        throw Error("IMMUTABLE_AUDIO_ID_COLLISION");
      if (!old) media.push(a);
    }
    if (entry.id === selected) current = verified.packages;
  }
  if (!current.length) throw Error("EMPTY_CONTENT_RELEASE");
  const activeVersions = new Set(current.map((p) => p.lesson.versionId));
  const packageFor = async (c: PoolClient, version: string) => {
    const p = all.get(version);
    if (!p)
      throw new CommandError(
        404,
        "CONTENT_NOT_ELIGIBLE",
        "Bài chưa phát hành hoặc đã được rút; lịch sử vẫn được giữ.",
      );
    const row = (
      await c.query(
        "SELECT manifest,package_hash,state FROM app_content.packages WHERE version_id=$1",
        [version],
      )
    ).rows[0];
    if (
      !row ||
      row.state !== "PUBLISHED" ||
      row.package_hash !== p.packageHash ||
      contentHash(packageSchema.parse(row.manifest)) !== p.packageHash
    )
      throw Error("REGISTERED_CONTENT_DRIFT");
    return p;
  };
  const template = (id: string) => {
    for (const p of all.values())
      for (const c of p.concepts)
        if (id === `${p.lesson.versionId}:recall:${c.id}`)
          return {
            prompt: `${p.lesson.title} · Nhớ nghĩa và pinyin của ${c.hanzi}.`,
            back: `${c.dictionaryPinyin} · ${c.meaning}`,
          };
    return null;
  };
  const scope = { id: selected, current, all: [...all.values()] };
  const access: ContentAccess = {
    current: () => current,
    packageFor,
    canStart: (v) => activeVersions.has(v),
    reviewStatus: technical ? "TECHNICAL_ONLY" : "HUMAN_REVIEWED",
    authorizeStart: async (c, uid, v) => {
      const catalog = await curriculumWithin(c, uid, scope);
      if (
        !catalog.lessons.some(
          (l) => l.currentVersion === v && l.access.mayPractice,
        )
      )
        throw Error("CONTENT_PREREQUISITES_REQUIRED");
    },
  };
  return {
    id: selected,
    technical,
    current,
    all: [...all.values()],
    access,
    template,
    audio: (id: string) => {
      const a = media.find((a) => a.id === id);
      if (!a) throw Error("AUDIO_NOT_AVAILABLE");
      return { bytes: privateFile(root, a.file), type: a.format };
    },
  };
}
