// Original synthetic pipeline content; never a Mandarin review or production grant.
import fs from "node:fs";
import path from "node:path";
import {
  contentHash,
  loadDraftCatalog,
} from "../../src/modules/content/application/catalog";
import { packageSchema } from "../../src/modules/content/domain/package";
import {
  digest,
  reviewRecord,
  type Release,
} from "../../src/modules/content/domain/release";
export function syntheticRelease(
  root: string,
  suffix: string,
  version: number,
) {
  fs.mkdirSync(path.join(root, "packages"), { recursive: true });
  fs.mkdirSync(path.join(root, "audio"), { recursive: true });
  const now = new Date().toISOString(),
    id = `technical-release-${suffix}`,
    vid = `synthetic-f01-${suffix}-v${version}`,
    receipt = `synthetic-review-${suffix}`,
    mediaId = `synthetic-audio-${suffix}`;
  const source = Buffer.from(
    "SYNTHETIC TEST ONLY: original generated non-speech PCM. No human voice, rights attestation or language review.",
  );
  const evidenceFile = `evidence-${suffix}.txt`,
    evidence = { file: evidenceFile, sha256: digest(source) };
  fs.writeFileSync(path.join(root, evidenceFile), source);
  const wav = Buffer.alloc(44 + 3200 * 2);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(6400, 40);
  for (let i = 0; i < 3200; i++)
    wav.writeInt16LE(
      Math.round(1000 * Math.sin((i * 2 * Math.PI * 220) / 16000)),
      44 + i * 2,
    );
  const audioFile = `audio/${mediaId}.wav`;
  fs.writeFileSync(path.join(root, audioFile), wav);
  const p = structuredClone(
    loadDraftCatalog().packages.find((p) => p.lesson.id === "F01")!,
  );
  p.release = { id, version: 1 };
  p.lesson = {
    ...p.lesson,
    version,
    versionId: vid,
    title: "Kiểm thử phát hành · ký hiệu tổng hợp",
    objectives: [
      "Kiểm tra chấm bài và lưu phiên bản; không phải học liệu được duyệt.",
    ],
    estimatedMinutes: 10,
    prerequisites: [],
  };
  p.state = "PUBLISHED";
  p.reviewStatus = "HUMAN_REVIEWED";
  p.publicationStatus = "APPROVED";
  p.humanReview = {
    receiptId: receipt,
    reviewedAt: now,
    reviewerType: "synthetic",
    keyVersions: [`${vid}-e1-key-v1`, `${vid}-e2-key-v1`],
  };
  p.rights = {
    ...p.rights,
    licenseDecision: "PERMITTED",
    publicationReceipt: evidence.sha256,
  };
  p.alignment.sourceSnapshotSha256 =
    "ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941";
  p.concepts = [
    {
      id: `symbol-${suffix}`,
      version: 1,
      senseId: `sense-${suffix}`,
      hanzi: "甲",
      dictionaryPinyin: "jiǎ",
      meaning: "ký hiệu tổng hợp để thử pipeline",
      skills: ["recognition"],
      referenceIds: [],
      scope: "FOUNDATION_INTERNAL",
    },
  ];
  p.concepts.push({
    ...p.concepts[0],
    id: `symbol-b-${suffix}`,
    senseId: `sense-b-${suffix}`,
    hanzi: "乙",
    dictionaryPinyin: "yǐ",
  });
  p.exercises = [1, 2].map((n) => ({
    id: `${vid}-e${n}`,
    version: 1,
    type: "choice",
    skill: "recognition",
    conceptId: p.concepts[0].id,
    senseId: p.concepts[0].senseId,
    keyRef: `${vid}-e${n}-key-v1`,
    prompt: `Chọn ký hiệu ${n === 1 ? "A" : "B"} để kiểm tra pipeline.`,
    choices: ["PIPELINE_TOKEN_A", "PIPELINE_TOKEN_B"],
    inputHint: "Chỉ kiểm thử kỹ thuật.",
    requiresAudio: false,
    mediaIds: [],
  }));
  p.exercises[1] = {
    ...p.exercises[1],
    conceptId: p.concepts[1].id,
    senseId: p.concepts[1].senseId,
  };
  p.privateKeys = p.exercises.map((e, i) => ({
    id: e.keyRef,
    version: 1,
    exerciseVersionId: e.id,
    senseId: e.senseId,
    accepted: [e.choices[i]],
    normalizerVersion: "exact-choice-v1",
    gradingVersion: "deterministic-content-v1",
    feedback:
      "Phản hồi kỹ thuật từ server; không phải nhận xét năng lực tiếng Trung.",
  }));
  p.blocks = [
    {
      id: `${vid}-intro`,
      type: "teaching",
      title: "Bộ thử kỹ thuật",
      text: "Nội dung tổng hợp chỉ dùng kiểm tra adapter, chấm bài và PostgreSQL.",
      hanzi: "甲",
      pinyin: "jiǎ",
      meaning: "Ký hiệu thử kỹ thuật",
      readingMinutes: 1,
    },
    ...p.exercises.map((e, i) => ({
      id: `${vid}-b${i}`,
      type: "exercise" as const,
      exerciseVersionId: e.id,
    })),
  ];
  p.media = [
    {
      id: mediaId,
      version: 1,
      type: "audio",
      sha256: digest(wav),
      uri: `/api/v1/media/${mediaId}`,
      transcript: "SYNTHETIC NON-SPEECH TEST",
      dictionaryPinyin: "jiǎ",
      spokenPinyin: "jiǎ",
      voice: "SYNTHETIC_TEST_NO_HUMAN_VOICE",
      locale: "zh-CN",
      source: "Generated PCM non-speech fixture",
      attribution: "Synthetic test signal, not reference speech",
      rights: "PERMITTED",
      consentReceipt: evidence.sha256,
      humanReviewReceipt: evidence.sha256,
      reviewedAt: now,
      reviewRecord: {
        quality: "ACCEPTABLE",
        corrections: [],
        decision: "TECHNICAL_APPROVED",
        decidedAt: now,
      },
    },
  ];
  p.missingAssessments = [];
  const parsed = packageSchema.parse(p);
  parsed.packageHash = contentHash(parsed);
  const review = reviewRecord.parse({
    id: receipt,
    versionId: vid,
    contentHash: parsed.packageHash,
    kind: "synthetic",
    reviewer: "SYNTHETIC_PIPELINE_FIXTURE",
    qualification: "TEST_ONLY_NO_LANGUAGE_AUTHORITY",
    reviewedAt: now,
    scope: ["language", "keys", "alignment", "rights", "audio"],
    findings: [],
    unresolved: [],
    decision: "APPROVED",
    evidence: [evidence],
  });
  const manifest: Release = {
    schemaVersion: 1,
    id,
    state: "PUBLISHED",
    purpose: "TECHNICAL_TEST",
    createdAt: now,
    packages: [{ versionId: vid, hash: parsed.packageHash, reviewId: receipt }],
    reviews: [review],
    audio: [
      {
        id: mediaId,
        target: vid,
        file: audioFile,
        sha256: digest(wav),
        format: "audio/wav",
        durationMs: 200,
        creator: "SYNTHETIC_GENERATOR_NO_HUMAN",
        source: "SYNTHETIC_TEST",
        permission: evidence,
        attribution: "Synthetic test signal, not reference speech",
        linguisticReview: "TECHNICAL_ONLY",
        review: evidence,
        eligible: true,
      },
    ],
  };
  fs.writeFileSync(
    path.join(root, `packages/${vid}.json`),
    JSON.stringify(parsed, null, 2),
  );
  const file = `${id}.json`,
    bytes = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(path.join(root, file), bytes);
  return {
    p: parsed,
    manifest,
    review,
    entry: { id, file, sha256: digest(bytes), state: "PUBLISHED" as const },
  };
}
