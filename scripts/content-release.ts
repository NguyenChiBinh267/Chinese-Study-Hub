// Explicit local operator tools, never imported by browser or application routes.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { adminConfig } from "./local-db.mjs";
import {
  loadContentRelease,
  privateFile,
} from "../src/modules/content/application/releases";
import {
  audioRecord,
  digest,
  wavDuration,
  releaseManifest,
  trustRegistry,
  transitionRelease,
  verifyRelease,
} from "../src/modules/content/domain/release";
import { loadSourceEvidence } from "../src/modules/content/application/catalog";
export async function installRelease(database: string, env: NodeJS.ProcessEnv) {
  if (
    database !== "csh_local" &&
    !/^csh_release_verify_[a-f0-9]{12}$/.test(database)
  )
    throw Error("LOCAL_DATABASE_REQUIRED");
  const r = loadContentRelease(env, "development");
  if (!r) throw Error("NO_RELEASE_SELECTED");
  if (new URL(env.DATABASE_URL!).pathname !== "/" + database)
    throw Error("DATABASE_TARGET_MISMATCH");
  if (r.technical && !/^csh_release_verify_/.test(database))
    throw Error("SYNTHETIC_IMPORT_FORBIDDEN");
  const c = new pg.Client(adminConfig(database));
  await c.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(82417012)");
    for (const p of r.all) {
      const old = (
        await c.query(
          "SELECT package_hash FROM app_content.packages WHERE version_id=$1",
          [p.lesson.versionId],
        )
      ).rows[0];
      if (old && old.package_hash !== p.packageHash)
        throw Error("IMMUTABLE_PACKAGE_CONFLICT");
      const l = (
        await c.query(
          "SELECT id FROM app_content.lessons WHERE stable_key=$1",
          [p.lesson.id],
        )
      ).rows[0];
      if (!l) throw Error("EXISTING_CURRICULUM_LESSON_REQUIRED");
      await c.query(
        "INSERT INTO app_content.packages(version_id,lesson_id,release_id,package_hash,manifest,state) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(version_id) DO NOTHING",
        [
          p.lesson.versionId,
          p.lesson.id,
          p.release.id,
          p.packageHash,
          p,
          p.state,
        ],
      );
      for (const e of p.exercises) {
        const k = p.privateKeys.find((k) => k.id === e.keyRef)!;
        const old = (
          await c.query(
            "SELECT package_id,key_version,normalizer_version,grading_version FROM app_content.exercise_versions WHERE id=$1",
            [e.id],
          )
        ).rows[0];
        if (
          old &&
          (old.package_id !== p.lesson.versionId ||
            old.key_version !== k.id ||
            old.normalizer_version !== k.normalizerVersion ||
            old.grading_version !== k.gradingVersion)
        )
          throw Error("IMMUTABLE_EXERCISE_CONFLICT");
        await c.query(
          "INSERT INTO app_content.exercise_versions VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",
          [
            e.id,
            p.lesson.versionId,
            k.id,
            k.normalizerVersion,
            k.gradingVersion,
          ],
        );
      }
      await c.query(
        "INSERT INTO app_content.lesson_versions VALUES($1,$2,$3) ON CONFLICT(package_id) DO NOTHING",
        [p.lesson.versionId, l.id, p.lesson.version],
      );
      const binding = (
        await c.query(
          "SELECT lesson_id,version FROM app_content.lesson_versions WHERE package_id=$1",
          [p.lesson.versionId],
        )
      ).rows[0];
      if (binding.lesson_id !== l.id || binding.version !== p.lesson.version)
        throw Error("IMMUTABLE_LESSON_BINDING_CONFLICT");
    }
    await c.query("COMMIT");
    return {
      installed: r.all.length,
      technical: r.technical,
      historyRebound: false,
    };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}
export function importAudio(
  source: string,
  metadataFile: string,
  root: string,
) {
  if (fs.statSync(source).size > 4_000_000) throw Error("AUDIO_SIZE_LIMIT");
  const m = audioRecord.parse(
      JSON.parse(fs.readFileSync(metadataFile, "utf8")),
    ),
    bytes = fs.readFileSync(source);
  if (
    digest(bytes) !== m.sha256 ||
    Math.abs(wavDuration(bytes) - m.durationMs) > 1
  )
    throw Error("AUDIO_METADATA_MISMATCH");
  for (const ref of [m.permission, m.review])
    if (ref && digest(privateFile(root, ref.file)) !== ref.sha256)
      throw Error("AUDIO_RECEIPT_MISMATCH");
  if (!/^audio\/[a-zA-Z0-9._-]+\.wav$/.test(m.file))
    throw Error("AUDIO_DESTINATION_REJECTED");
  const dir = path.join(fs.realpathSync(root), "audio");
  fs.mkdirSync(dir, { recursive: true });
  if (fs.realpathSync(dir) !== dir) throw Error("AUDIO_SYMLINK_REJECTED");
  const target = path.join(dir, path.basename(m.file));
  if (fs.existsSync(target)) {
    if (digest(fs.readFileSync(target)) !== m.sha256)
      throw Error("IMMUTABLE_AUDIO_CONFLICT");
  } else fs.writeFileSync(target, bytes, { flag: "wx" });
  const recordFile = path.join(dir, m.id + ".json"),
    record = JSON.stringify(m, null, 2);
  if (fs.existsSync(recordFile)) {
    if (fs.readFileSync(recordFile, "utf8") !== record)
      throw Error("IMMUTABLE_AUDIO_METADATA_CONFLICT");
  } else fs.writeFileSync(recordFile, record, { flag: "wx" });
  return {
    id: m.id,
    hash: m.sha256,
    durationMs: m.durationMs,
    linguisticReview: m.linguisticReview,
    publicationAuthorized: false,
  };
}
async function main() {
  const [action, ...args] = process.argv.slice(2);
  if (action === "check") {
    const r = loadContentRelease();
    console.log(
      JSON.stringify({
        release: r?.id ?? null,
        eligible: r?.current.length ?? 0,
        technical: r?.technical ?? false,
      }),
    );
  } else if (action === "install")
    console.log(JSON.stringify(await installRelease(args[0], process.env)));
  else if (action === "audio-import")
    console.log(JSON.stringify(importAudio(args[0], args[1], args[2])));
  else if (action === "audio-template") {
    if (fs.statSync(args[0]).size > 4_000_000) throw Error("AUDIO_SIZE_LIMIT");
    const bytes = fs.readFileSync(args[0]);
    fs.writeFileSync(
      args[1],
      JSON.stringify(
        {
          id: null,
          target: null,
          file: null,
          sha256: digest(bytes),
          format: "audio/wav",
          durationMs: wavDuration(bytes),
          creator: null,
          source: null,
          permission: null,
          attribution: "",
          linguisticReview: "UNREVIEWED",
          review: null,
          eligible: false,
        },
        null,
        2,
      ),
      { flag: "wx" },
    );
    console.log(
      "Audio worksheet prepared; fill actual creator/permission/target before import. No voice copied or publication authorized.",
    );
  } else if (action === "transition") {
    const root = path.resolve(args[0]),
      file = args[1],
      next = releaseManifest.shape.state.parse(args[2]);
    const input = releaseManifest.parse(
      JSON.parse(privateFile(root, file).toString("utf8")),
    );
    const registry = trustRegistry.parse(
      JSON.parse(privateFile(root, "trusted.json").toString("utf8")),
    );
    const output = transitionRelease(input, next, () => {
      verifyRelease(
        { ...input, state: "PUBLISHED" },
        input.packages.map((p) =>
          JSON.parse(
            privateFile(root, `packages/${p.versionId}.json`).toString("utf8"),
          ),
        ),
        loadSourceEvidence(),
        registry.reviewHashes,
        false,
      );
      for (const review of input.reviews)
        for (const ref of review.evidence)
          if (digest(privateFile(root, ref.file)) !== ref.sha256)
            throw Error("REVIEW_EVIDENCE_DRIFT");
      for (const audio of input.audio) {
        const bytes = privateFile(root, audio.file);
        if (
          digest(bytes) !== audio.sha256 ||
          Math.abs(wavDuration(bytes) - audio.durationMs) > 1
        )
          throw Error("AUDIO_BYTES_DRIFT");
        for (const ref of [audio.permission, audio.review])
          if (ref && digest(privateFile(root, ref.file)) !== ref.sha256)
            throw Error("AUDIO_EVIDENCE_DRIFT");
      }
    });
    fs.writeFileSync(args[3], JSON.stringify(output, null, 2), { flag: "wx" });
    console.log(
      "Transition validated and written as an untrusted candidate; no active allowlist or database changed.",
    );
  } else if (action === "review-template") {
    const packet = JSON.parse(fs.readFileSync(args[0], "utf8"));
    // A template is neither a receipt nor a signature; no identity/date is invented.
    fs.writeFileSync(
      args[1],
      JSON.stringify(
        {
          packet: args[0],
          version: packet.lessonVersion,
          contentHash: packet.packageHash,
          reviewer: null,
          qualification: null,
          reviewedAt: null,
          scope: [],
          findings: [],
          decision: "PENDING",
          evidence: [],
          unresolved: [],
          instruction:
            "Record the actual review in the original packet. A trusted operator must pin its completed receipt hash; this template cannot authorize publication.",
        },
        null,
        2,
      ),
      { flag: "wx" },
    );
    console.log(
      "Unsigned review worksheet prepared; no approval or allowlist changed.",
    );
  } else
    throw Error(
      "Use check | install <local-database> | audio-import <wav> <metadata-json> <private-root> | review-template <existing-packet> <new-worksheet>",
    );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  void main().catch(() => {
    console.error(
      "Content release operation refused; inspect local inputs/receipts, no credentials printed.",
    );
    process.exitCode = 1;
  });
