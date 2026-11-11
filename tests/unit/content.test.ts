import { validateAssetHashes } from "../../scripts/validate-content-assets";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  loadDraftCatalog,
  contentHash,
} from "../../src/modules/content/application/catalog";
import {
  packageSchema,
  validatePackage,
  publicProjection,
  gradeContent,
  transition,
} from "../../src/modules/content/domain/package";
import { normalizePinyin } from "../../src/modules/content/domain/pinyin";
import {
  activeWindow,
  classifyDuration,
  type DurationInput,
} from "../../src/modules/learning/domain/duration";
import { draftAnswer } from "../../src/modules/content/domain/commands";
const { packages, evidence } = loadDraftCatalog();
const f1 = packages[0],
  f2 = packages[1],
  l1 = packages[2];
const copy = (p = f1) => structuredClone(p);
function codes(p: unknown, publish = false) {
  return validatePackage(
    p,
    packages,
    evidence,
    "test-package.json",
    publish,
  ).map((x) => x.code);
}
test("Actual authored packages validate, stay bounded/unreviewed, and have no listening evidence", () => {
  for (const p of packages) {
    assert.deepEqual(codes(p), []);
    assert.equal(contentHash(p), p.packageHash);
    assert.equal(p.reviewStatus, "DRAFT_UNREVIEWED");
    assert.equal(p.humanReview, null);
    assert.equal(p.state, "REVIEW_PENDING");
    assert.ok(p.exercises.length <= 8 && p.concepts.length <= 6);
    assert.ok(
      p.exercises.every((e) =>
        ["recognition", "reading", "pinyin"].includes(e.skill),
      ),
    );
    assert.ok(
      p.blocks.filter((b) => b.type === "teaching").length >=
        (p.lesson.classification === "FOUNDATION_INTERNAL" ? 3 : 2),
    );
    assert.deepEqual(p.missingAssessments, ["listening", "pronunciation"]);
  }
  assert.equal(packages[2].alignment.alignmentStatus, "PARTIAL");
  assert.ok(
    packages[2].alignment.vocabularyReferences.some(
      (r) => r.status === "SUPPLEMENTARY",
    ),
  );
});
test("Publication and state transitions fail closed without actual human/media/rights authority", () => {
  for (const p of packages) {
    const found = codes(p, true);
    assert.ok(found.includes("HUMAN_REVIEW_REQUIRED"));
    assert.ok(found.includes("RIGHTS_REQUIRED"));
    assert.ok(found.includes("MEDIA_APPROVAL_REQUIRED"));
  }
  assert.throws(() => transition(f1, "PUBLISHED"), /INVALID/);
  assert.throws(() => transition(f1, "REVIEWED"), /HUMAN_AUTHORITY/);
  const draft = { ...copy(), state: "DRAFT" as const };
  assert.equal(
    transition(
      transition(draft, "VALIDATED", { catalog: packages, evidence }),
      "REVIEW_PENDING",
    ).state,
    "REVIEW_PENDING",
  );
  assert.throws(() => transition(draft, "VALIDATED"), /VALIDATION_REQUIRED/);
});
test("Schema/version, duplicate IDs, missing references, cycles and release mismatch reject with actionable fields", () => {
  const bad: unknown = { ...copy(), schemaVersion: 2 };
  assert.ok(codes(bad).includes("SCHEMA"));
  let p = copy();
  p.concepts.push(p.concepts[0]);
  assert.ok(codes(p).includes("DUPLICATE_ID"));
  p = copy();
  p.exercises[0].conceptId = "missing";
  assert.ok(codes(p).includes("CONCEPT_SKILL"));
  p = copy();
  p.lesson.prerequisites = [p.lesson.versionId];
  assert.ok(codes(p).includes("DAG_CYCLE"));
  p = copy();
  p.lesson.prerequisites = ["missing"];
  assert.ok(codes(p).includes("UNKNOWN_PREREQUISITE"));
  p = copy(f2);
  p.release = { id: "other-release", version: 1 };
  assert.ok(codes(p).includes("RELEASE_MISMATCH"));
  p = copy();
  p.privateKeys = [];
  assert.ok(codes(p).includes("KEY_BINDING"));
  p = copy();
  p.blocks.push({
    id: "bad-block",
    type: "exercise",
    exerciseVersionId: "missing",
  });
  assert.ok(codes(p).includes("UNKNOWN_EXERCISE"));
  p = copy();
  p.concepts[0].referenceIds = ["missing"];
  const details = validatePackage(p, packages, evidence, "F01.v1.json");
  assert.ok(
    details.every(
      (i) => i.file && i.recordId && i.field && i.code && i.message,
    ),
  );
});
test("Actual source contract cannot be replaced by old HSK/GF2021, guessed locator, different sense/reading/level or hash", () => {
  let p = copy(l1);
  p.alignment.vocabularyReferences[0].sourceLocator = null;
  assert.ok(codes(p).includes("SOURCE_LOCATOR"));
  p = copy(l1);
  p.alignment.vocabularyReferences[0].officialLevel = 2;
  assert.ok(codes(p).includes("SOURCE_LEVEL"));
  p = copy(l1);
  p.alignment.vocabularyReferences[0].pinyin = "hào";
  assert.ok(codes(p).includes("SOURCE_ENTRY_MISMATCH"));
  p = copy(l1);
  p.alignment.vocabularyReferences[0].senseId = "invented-polyphonic-sense";
  assert.ok(codes(p).includes("SOURCE_ENTRY_MISMATCH"));
  p = copy(l1);
  p.alignment.taskReferences = [];
  assert.ok(codes(p).includes("SOURCE_DIMENSION"));
  p = copy(l1);
  p.alignment.grammarReferences = [];
  assert.ok(codes(p).includes("SOURCE_DIMENSION"));
  p = copy(l1);
  p.alignment.alignmentStatus = "VERIFIED";
  assert.ok(codes(p).includes("FALSE_ALIGNMENT"));
  p = copy(l1);
  p.alignment.sourceSnapshotSha256 = "a".repeat(64);
  assert.ok(codes(p).includes("SOURCE_VERSION"));
  assert.equal(
    packageSchema.safeParse({
      ...l1,
      alignment: { ...l1.alignment, syllabusId: "gf0025-2021" },
    }).success,
    false,
  );
  assert.equal(
    packageSchema.safeParse({
      ...l1,
      alignment: { ...l1.alignment, sourceUrl: "https://old-hsk.example/list" },
    }).success,
    false,
  );
  assert.ok(evidence.references.length <= 50); // Bound, not proof of official correctness by itself.
});
test("Public allowlist excludes private keys, key references, review receipts and feedback before answering", () => {
  const publicValue = JSON.stringify(publicProjection(f1));
  for (const secret of [
    "privateKeys",
    "keyRef",
    "accepted",
    "feedback",
    "gradingVersion",
    "humanReview",
  ])
    assert.equal(publicValue.includes(`"${secret}"`), false);
  for (const p of packages)
    assert.equal(
      JSON.stringify(publicProjection(p)).includes("privateKeys"),
      false,
    );
  const ex = f1.exercises[0];
  assert.throws(() => gradeContent(f1, ex.id, { text: "m" }), /INVALID/);
  assert.throws(() => gradeContent(f1, "unknown", { choice: 0 }), /UNKNOWN/);
  assert.equal(
    draftAnswer.safeParse({
      exerciseVersionId: ex.id,
      response: { choice: 0 },
      score: 1,
      owner: "fake",
    }).success,
    false,
  );
});
test("Pinyin NFC, ü/v, numeric/marked/neutral, punctuation and tone distinction stay semantic", () => {
  const equal = [
    ["nǚ", "nv3"],
    ["nǚ", "nü3"],
    ["nu\u0308\u030c", "nǚ"],
    ["MǍ。", "ma3"],
    ["ma", "ma0"],
    ["ma5", "ma0"],
    [" nǐ , hǎo! ", "ni3 hao3"],
  ];
  for (const [a, b] of equal)
    assert.equal(normalizePinyin(a), normalizePinyin(b), `${a} / ${b}`);
  for (const bad of ["mã", "mă", "mǎ1", "ma6", "mā́", "ńi"])
    assert.equal(normalizePinyin(bad), null, bad);
  for (const [a, b] of [
    ["mā", "má"],
    ["mǎ", "ma"],
    ["nǚ", "nu3"],
    ["mà", "ma1"],
  ])
    assert.notEqual(normalizePinyin(a), normalizePinyin(b));
  const ex = f2.exercises.at(-1)!;
  assert.equal(gradeContent(f2, ex.id, { text: "ma3" }).correct, true);
  assert.equal(gradeContent(f2, ex.id, { text: "ma" }).correct, false);
  assert.equal(gradeContent(f2, ex.id, { text: "ma4" }).correct, false);
  const p = copy(f2),
    key = p.privateKeys.at(-1)!;
  key.accepted = ["mǎ", "mà"];
  assert.ok(codes(p).includes("AMBIGUOUS_SENSE"));
});
test("Media hashes, assets, skill mapping and immutable package digest changes are detected", () => {
  let p = copy();
  p.exercises[0].requiresAudio = true;
  assert.ok(codes(p).includes("MISSING_AUDIO"));
  p = copy();
  p.exercises[0].mediaIds = ["unknown"];
  assert.ok(codes(p).includes("MEDIA_REFERENCE"));
  assert.equal(
    packageSchema.safeParse({
      ...copy(),
      media: [{ id: "audio", version: 1, type: "audio" }],
    }).success,
    false,
  );
  p = copy();
  p.exercises[0].senseId = "wrong-sense";
  assert.ok(codes(p).includes("CONCEPT_SKILL"));
  p = copy();
  p.privateKeys[0].feedback = "changed";
  assert.notEqual(contentHash(p), f1.packageHash);
});
const now = new Date("2026-10-17T10:00:10Z"),
  issued = new Date("2026-10-17T10:00:00Z"),
  lease = {
    leaseId: "a",
    clientId: "b",
    issuedAt: issued,
    expiresAt: new Date("2026-10-17T10:02:00Z"),
  };
const interval: DurationInput = {
  eventId: "00000000-0000-4000-8000-000000000001",
  leaseId: "a",
  clientId: "b",
  observedStart: "2026-10-17T10:00:00Z",
  observedEnd: "2026-10-17T10:00:10Z",
  lastInteractionAt: "2026-10-17T10:00:00Z",
  activeMs: 10000,
};
test("Foreground/idle60/hidden duration arithmetic never counts background or idle tail", () => {
  assert.deepEqual(activeWindow(0, 5000, 0, true), {
    start: 0,
    end: 5000,
    activeMs: 5000,
  });
  assert.equal(activeWindow(60000, 65000, 0, true), null);
  assert.deepEqual(activeWindow(55000, 65000, 0, true), {
    start: 55000,
    end: 60000,
    activeMs: 5000,
  });
  assert.equal(activeWindow(0, 10000, 0, false), null);
  assert.equal(activeWindow(10, 0, 0, true), null);
});
test("Server telemetry classifies replay-independent bounds, clock skew, overlap, idle, expired/other-tab lease and missing signal", () => {
  assert.equal(classifyDuration(interval, now, lease, false).acceptedMs, 10000);
  for (const [input, clock, current, overlap] of [
    [interval, now, lease, true],
    [{ ...interval, activeMs: 15000 }, now, lease, false],
    [
      { ...interval, lastInteractionAt: "2026-10-17T09:58:00Z" },
      now,
      lease,
      false,
    ],
    [{ ...interval, clientId: "other-tab" }, now, lease, false],
    [interval, new Date("2026-10-17T10:03:00Z"), lease, false],
    [{ ...interval, observedEnd: "2027-10-17T10:00:10Z" }, now, lease, false],
  ] as const) {
    const result = classifyDuration(input, clock, current, overlap);
    assert.equal(result.classification, "SUSPICIOUS_INVALID");
    assert.equal(result.acceptedMs, 0);
  }
  const zero = {
    ...interval,
    observedEnd: interval.observedStart,
    activeMs: 0,
  };
  assert.equal(
    classifyDuration(zero, issued, lease, false).classification,
    "MISSING_INSUFFICIENT",
  );
});

test("Media validator checks actual bytes, path confinement and transcript binding without inventing review", () => {
  const root = path.resolve("test-results", `content-assets-${randomUUID()}`),
    directory = path.join(root, "public");
  fs.mkdirSync(directory, { recursive: true });
  const bytes = Buffer.from("original non-audio test fixture");
  fs.writeFileSync(path.join(directory, "audio.dat"), bytes);
  const p = copy();
  p.media = [
    {
      id: "audio-v1",
      version: 1,
      type: "audio",
      uri: "public/audio.dat",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      transcript: "wrong transcript",
      dictionaryPinyin: "mā",
      spokenPinyin: "mā",
      voice: "test fixture",
      locale: "zh-CN",
      source: "original test bytes",
      rights: "UNKNOWN",
      consentReceipt: null,
      humanReviewReceipt: null,
      reviewedAt: null,
      reviewRecord: null,
    },
  ];
  assert.deepEqual(validateAssetHashes(p, root), []);
  p.media[0].sha256 = "a".repeat(64);
  assert.equal(validateAssetHashes(p, root)[0].code, "ASSET_HASH");
  p.media[0].uri = "../outside";
  assert.equal(validateAssetHashes(p, root)[0].code, "ASSET_PATH");
  p.media[0].uri = "public/missing";
  assert.equal(validateAssetHashes(p, root)[0].code, "ASSET_MISSING");
  p.exercises[0].requiresAudio = true;
  p.exercises[0].mediaIds = ["audio-v1"];
  assert.ok(codes(p).includes("MEDIA_TRANSCRIPT_MISMATCH"));
  assert.ok(codes(p, true).includes("MEDIA_APPROVAL_REQUIRED"));
});
