import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { syntheticRelease } from "../fixtures/content-release";
import {
  digest,
  verifyRelease,
  wavDuration,
  transitionRelease,
} from "../../src/modules/content/domain/release";
import {
  loadDraftCatalog,
  contentHash,
} from "../../src/modules/content/application/catalog";
import {
  loadContentRelease,
  privateFile,
} from "../../src/modules/content/application/releases";
import { publicProjection } from "../../src/modules/content/domain/package";
import { importAudio } from "../../scripts/content-release";
const root = path.resolve(
    ".local-postgres/sprint12/unit-" + randomBytes(4).toString("hex"),
  ),
  f = syntheticRelease(root, "unit" + randomBytes(3).toString("hex"), 1001),
  evidence = loadDraftCatalog().evidence;
const check = (
  manifest = f.manifest,
  p = f.p,
  trusted = [digest(JSON.stringify(manifest.reviews[0]))],
  technical = true,
) => verifyRelease(manifest, [p], evidence, trusted, technical);
test("Release: trusted synthetic immutable fixture eligible only for technical context", () => {
  assert.equal(check().packages.length, 1);
  assert.throws(
    () => check(f.manifest, f.p, undefined, false),
    /SYNTHETIC_RELEASE_FORBIDDEN/,
  );
  const m = structuredClone(f.manifest);
  m.purpose = "REAL_CONTENT";
  assert.throws(() => check(m), /TRUSTED_REVIEW_REQUIRED/);
});
test("Release: draft/pending/approved/withdrawn manifests never serve learners", () => {
  for (const state of [
    "DRAFT",
    "REVIEW_PENDING",
    "APPROVED",
    "WITHDRAWN",
  ] as const)
    assert.throws(
      () => check({ ...f.manifest, state }),
      /RELEASE_NOT_PUBLISHED/,
    );
});
test("Release: changed bytes, rehash without rereview, missing/untrusted receipt rejected", () => {
  const p = structuredClone(f.p);
  p.lesson.title += " changed";
  assert.throws(() => check(f.manifest, p), /RELEASE_PACKAGE_HASH/);
  p.packageHash = contentHash(p);
  const m = structuredClone(f.manifest);
  m.packages[0].hash = p.packageHash;
  assert.throws(() => check(m, p), /TRUSTED_REVIEW_REQUIRED/);
  assert.throws(() => check(f.manifest, f.p, []), /TRUSTED_REVIEW_REQUIRED/);
  assert.throws(() => check({ ...f.manifest, reviews: [] }));
});
test("Release: a trusted record cannot approve wrong scope, unresolved issues, date or content version", () => {
  for (const mutate of [
    (m: typeof f.manifest) => m.reviews[0].scope.pop(),
    (m: typeof f.manifest) => m.reviews[0].unresolved.push("pending"),
    (m: typeof f.manifest) => (m.reviews[0].versionId = "wrong-v1"),
    (m: typeof f.manifest) =>
      (m.reviews[0].reviewedAt = "2099-01-01T00:00:00.000Z"),
  ]) {
    const m = structuredClone(f.manifest);
    mutate(m);
    assert.throws(() => check(m), /TRUSTED_REVIEW_REQUIRED/);
  }
});
test("Release: package publication, rights, keys, alignment and required reference audio remain mandatory", () => {
  for (const mutate of [
    (p: typeof f.p) => (p.state = "DRAFT"),
    (p: typeof f.p) => (p.rights.licenseDecision = "UNKNOWN"),
    (p: typeof f.p) => (p.privateKeys = []),
    (p: typeof f.p) => (p.media = []),
    (p: typeof f.p) => (p.missingAssessments = ["listening"]),
  ]) {
    const p = structuredClone(f.p),
      m = structuredClone(f.manifest);
    mutate(p);
    p.packageHash = contentHash(p);
    m.packages[0].hash = p.packageHash;
    m.reviews[0].contentHash = p.packageHash;
    assert.throws(
      () => check(m, p),
      /PUBLICATION_CRITERIA_REQUIRED|RELEASE_AUDIO_SET/,
    );
  }
});
test("Release: audio eligibility is independent of content approval", () => {
  const alteredCredit = structuredClone(f.manifest);
  alteredCredit.audio[0].attribution = "Unreviewed replacement credit";
  assert.throws(() => check(alteredCredit), /AUDIO_RELEASE_CRITERIA_REQUIRED/);
  for (const eligible of [false]) {
    const m = structuredClone(f.manifest);
    m.audio[0].eligible = eligible;
    assert.throws(() => check(m), /AUDIO_RELEASE_CRITERIA_REQUIRED/);
  }
});
test("Release: public projections exclude private keys, reviewer identity, receipts and audio provenance", () => {
  const json = JSON.stringify(publicProjection(f.p));
  for (const key of [
    "privateKeys",
    "accepted",
    "keyRef",
    "reviewer",
    "qualification",
    "consentReceipt",
    "permission",
    "sourceSnapshotSha256-secret",
  ])
    assert.equal(json.includes('"' + key + '"'), false);
  assert.ok(json.includes("/api/v1/media/"));
  assert.ok(json.includes("Synthetic test signal, not reference speech"));
});
test("Release: approval and publication are separate guarded transitions", () => {
  let calls = 0;
  const approve = () => {
    calls++;
  };
  assert.throws(
    () =>
      transitionRelease(
        { ...f.manifest, state: "DRAFT" },
        "PUBLISHED",
        approve,
      ),
    /INVALID_RELEASE_TRANSITION/,
  );
  const approved = transitionRelease(
    { ...f.manifest, state: "REVIEW_PENDING" },
    "APPROVED",
    approve,
  );
  assert.equal(approved.state, "APPROVED");
  assert.throws(() => check(approved), /RELEASE_NOT_PUBLISHED/);
  assert.equal(
    transitionRelease(approved, "PUBLISHED", approve).state,
    "PUBLISHED",
  );
  assert.equal(calls, 2);
  assert.throws(
    () =>
      transitionRelease(approved, "PUBLISHED", () => {
        throw Error("NO_AUTHORITY");
      }),
    /NO_AUTHORITY/,
  );
});
test("Release: trusted file hash, traversal, and production test-root rejection", () => {
  fs.writeFileSync(
    root + "/trusted.json",
    JSON.stringify({
      schemaVersion: 1,
      releases: [f.entry],
      reviewHashes: [digest(JSON.stringify(f.review))],
    }),
  );
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "development",
    CSH_APP_MODE: "PRODUCTION_AUTHENTICATED",
    DATABASE_URL:
      "postgresql://csh_runtime:unused@127.0.0.1:5447/csh_release_verify_123456abcdef",
    CSH_CONTENT_TEST_ROOT: root,
    CSH_CONTENT_RELEASE: f.entry.id,
  };
  assert.equal(loadContentRelease(env, "development")?.current.length, 1);
  assert.throws(
    () => loadContentRelease({ ...env, NODE_ENV: "production" }, "production"),
    /CONTENT_TEST_FORBIDDEN/,
  );
  assert.throws(() => privateFile(root, "../database.json"));
  assert.throws(
    () =>
      loadContentRelease(
        { ...env, CSH_CONTENT_RELEASE: "unknown" },
        "development",
      ),
    /RELEASE_UNAVAILABLE/,
  );
});
test("Audio: bounded PCM16 WAV validation rejects corruption, wrong hash, format and duration", () => {
  const a = f.manifest.audio[0],
    bytes = privateFile(root, a.file);
  assert.equal(wavDuration(bytes), 200);
  const bad = Buffer.from(bytes);
  bad.writeUInt32LE(1, 4);
  assert.throws(() => wavDuration(bad));
  assert.throws(() => wavDuration(Buffer.alloc(10)));
  const badRate = Buffer.from(bytes);
  badRate.writeUInt32LE(1, 28);
  assert.throws(() => wavDuration(badRate));
});
test("Audio: idempotent local import preserves metadata and does not grant publication", () => {
  const a = f.manifest.audio[0],
    meta = root + "/audio-metadata.json";
  fs.writeFileSync(meta, JSON.stringify(a));
  const first = importAudio(root + "/" + a.file, meta, root);
  assert.equal(first.publicationAuthorized, false);
  assert.equal(importAudio(root + "/" + a.file, meta, root).hash, a.sha256);
  fs.writeFileSync(meta, JSON.stringify({ ...a, sha256: "0".repeat(64) }));
  assert.throws(
    () => importAudio(root + "/" + a.file, meta, root),
    /AUDIO_METADATA_MISMATCH/,
  );
});

test("Release: serving approved artifacts does not enumerate the pending draft catalog", () => {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "development",
    CSH_APP_MODE: "PRODUCTION_AUTHENTICATED",
    DATABASE_URL:
      "postgresql://csh_runtime:unused@127.0.0.1:5447/csh_release_verify_123456abcdef",
    CSH_CONTENT_TEST_ROOT: root,
    CSH_CONTENT_RELEASE: f.entry.id,
  };
  const blocked = test.mock.method(fs, "readdirSync", () => {
    throw Error("DRAFT_CATALOG_UNAVAILABLE");
  });
  try {
    assert.equal(loadContentRelease(env, "development")?.current.length, 1);
  } finally {
    blocked.mock.restore();
  }
});

test("Review workflow: draft/pending candidates require no invented reviewer or audio", () => {
  const draft = {
    ...f.manifest,
    state: "DRAFT" as const,
    reviews: [],
    audio: [],
  };
  assert.equal(
    transitionRelease(draft, "REVIEW_PENDING", () => {
      throw Error("No authority needed to request review");
    }).state,
    "REVIEW_PENDING",
  );
  assert.throws(() => check({ ...draft, state: "PUBLISHED" }));
});
test("Audio workflow: consented unreviewed import is private and never publication eligible", () => {
  const a = {
    ...f.manifest.audio[0],
    id: "unreviewed-local-asset",
    file: "audio/unreviewed-local-asset.wav",
    review: null,
    linguisticReview: "UNREVIEWED",
    eligible: false,
  };
  const meta = root + "/unreviewed-metadata.json";
  fs.writeFileSync(meta, JSON.stringify(a));
  assert.equal(
    importAudio(root + "/" + f.manifest.audio[0].file, meta, root)
      .publicationAuthorized,
    false,
  );
  fs.writeFileSync(meta, JSON.stringify({ ...a, eligible: true }));
  assert.throws(() =>
    importAudio(root + "/" + f.manifest.audio[0].file, meta, root),
  );
});
