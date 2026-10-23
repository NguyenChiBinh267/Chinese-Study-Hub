import { z } from "zod";
import {
  normalizePinyin,
  PINYIN_NORMALIZER,
  validDictionaryPinyin,
} from "./pinyin";
export const SYLLABUS_ID = "hsk-exam-2025-11";
export const SOURCE_URL =
  "https://hsk.cn-bj.ufileos.com/3.0/新版HSK考试大纲1219.pdf";
const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const meta = z.strictObject({ id, version: z.literal(1) });
const locator = z.strictObject({
  pdfIndex: z.int().min(0).max(405),
  physicalPage: z.int().min(1).max(406),
  printedPage: z.int().min(1).max(404),
  section: z.enum(["task", "topic", "vocabulary", "character", "grammar"]),
  entry: z.string().min(1),
});
export const referenceSchema = z.strictObject({
  id,
  kind: z.enum(["task", "topic", "vocabulary", "character", "grammar"]),
  status: z.enum(["VERIFIED", "UNVERIFIED", "SUPPLEMENTARY"]),
  officialLevel: z.int().min(1).max(9).nullable(),
  sourceLocator: locator.nullable(),
  written: z.string(),
  pinyin: z.string().nullable(),
  senseId: z.string().nullable(),
  ordinal: z.int().positive().nullable(),
  note: z.string(),
});
export const packageSchema = z.strictObject({
  schemaVersion: z.literal(1),
  packageHash: sha,
  course: meta,
  unit: meta,
  release: meta,
  lesson: z.strictObject({
    id: z.string().regex(/^(F\d{2}|L\d{3})$/),
    version: z.int().min(1),
    versionId: id,
    title: z.string().min(1),
    classification: z.enum(["FOUNDATION_INTERNAL", "HSK_ALIGNED_DRAFT"]),
    estimatedMinutes: z.int().min(10).max(20),
    objectives: z.array(z.string().min(1)).min(1),
    prerequisites: z.array(id),
    newGrammarPatterns: z.array(z.string()).max(1),
  }),
  locale: z.literal("vi"),
  contentLanguage: z.literal("zh-Hans"),
  state: z.enum([
    "DRAFT",
    "VALIDATED",
    "REVIEW_PENDING",
    "REVIEWED",
    "PUBLISHED",
    "RETIRED",
  ]),
  reviewStatus: z.enum([
    "DRAFT_UNREVIEWED",
    "NEEDS_CORRECTION",
    "HUMAN_REVIEWED",
  ]),
  publicationStatus: z.enum(["BLOCKED", "READY_FOR_REVIEW", "APPROVED"]),
  humanReview: z
    .strictObject({
      receiptId: id,
      reviewedAt: z.iso.datetime(),
      reviewerType: z.enum(["human", "synthetic"]),
      keyVersions: z.array(id),
    })
    .nullable(),
  rights: z.strictObject({
    authorship: z.literal("PROJECT_ORIGINAL_DRAFT"),
    licenseDecision: z.enum([
      "UNKNOWN",
      "ORIGINAL_REVIEW_PENDING",
      "PERMITTED",
    ]),
    sourceUse: z.literal("REFERENCE_ONLY"),
    publicationReceipt: z.string().nullable(),
  }),
  alignment: z.strictObject({
    syllabusId: z.literal(SYLLABUS_ID),
    syllabusVersion: z.literal("2025-11"),
    sourceId: z.literal("S01"),
    sourceUrl: z.literal(SOURCE_URL),
    sourceLocator: locator.nullable(),
    targetLevel: z.int().min(1).max(4).nullable(),
    alignmentStatus: z.enum([
      "VERIFIED",
      "PARTIAL",
      "UNVERIFIED",
      "NOT_APPLICABLE",
    ]),
    alignmentEvidence: z.array(z.string()),
    alignmentCheckedAt: z.iso.datetime().nullable(),
    sourceSnapshotSha256: sha.nullable(),
    taskReferences: z.array(referenceSchema),
    topicReferences: z.array(referenceSchema),
    vocabularyReferences: z.array(referenceSchema),
    characterReferences: z.array(referenceSchema),
    grammarReferences: z.array(referenceSchema),
  }),
  concepts: z
    .array(
      z.strictObject({
        id,
        version: z.literal(1),
        senseId: id,
        hanzi: z.string().min(1),
        dictionaryPinyin: z
          .string()
          .refine(validDictionaryPinyin, "Invalid dictionary Pinyin"),
        meaning: z.string().min(1),
        skills: z.array(z.enum(["recognition", "reading", "pinyin"])).min(1),
        referenceIds: z.array(id),
        scope: z.enum(["FOUNDATION_INTERNAL", "TARGET", "SUPPLEMENTARY"]),
      }),
    )
    .min(1)
    .max(6),
  blocks: z
    .array(
      z.discriminatedUnion("type", [
        z.strictObject({
          id,
          type: z.literal("teaching"),
          title: z.string(),
          text: z.string().min(1),
          hanzi: z.string(),
          pinyin: z.string(),
          meaning: z.string(),
          readingMinutes: z.int().min(1).max(3),
        }),
        z.strictObject({
          id,
          type: z.literal("exercise"),
          exerciseVersionId: id,
        }),
      ]),
    )
    .min(1),
  exercises: z
    .array(
      z.strictObject({
        id,
        version: z.literal(1),
        type: z.enum(["choice", "pinyin", "sequence", "short"]),
        skill: z.enum(["recognition", "reading", "pinyin"]),
        conceptId: id,
        senseId: id,
        keyRef: id,
        prompt: z.string().min(1),
        choices: z.array(z.string()).max(6),
        inputHint: z.string(),
        requiresAudio: z.boolean(),
        mediaIds: z.array(id),
      }),
    )
    .min(1)
    .max(8),
  privateKeys: z.array(
    z.strictObject({
      id,
      version: z.literal(1),
      exerciseVersionId: id,
      senseId: id,
      accepted: z.array(z.string().min(1)).min(1).max(6),
      normalizerVersion: z.enum([
        "exact-choice-v1",
        PINYIN_NORMALIZER,
        "token-order-v1",
        "hanzi-nfc-exact-v1",
      ]),
      gradingVersion: z.literal("deterministic-content-v1"),
      feedback: z.string().min(1),
    }),
  ),
  media: z.array(
    z.strictObject({
      id,
      version: z.literal(1),
      type: z.literal("audio"),
      sha256: sha,
      uri: z.string().min(1),
      transcript: z.string().min(1),
      dictionaryPinyin: z.string(),
      spokenPinyin: z.string(),
      voice: z.string(),
      locale: z.literal("zh-CN"),
      source: z.string(),
      attribution: z.string().min(1).optional(),
      rights: z.enum(["UNKNOWN", "PERMITTED"]),
      consentReceipt: z.string().nullable(),
      humanReviewReceipt: z.string().nullable(),
      reviewedAt: z.iso.datetime().nullable(),
      reviewRecord: z
        .strictObject({
          quality: z.enum(["UNREVIEWED", "NEEDS_CORRECTION", "ACCEPTABLE"]),
          corrections: z.array(z.string()),
          decision: z.enum([
            "PENDING",
            "CHANGES_REQUIRED",
            "HUMAN_APPROVED",
            "TECHNICAL_APPROVED",
          ]),
          decidedAt: z.iso.datetime().nullable(),
        })
        .nullable(),
    }),
  ),
  missingAssessments: z.array(z.enum(["listening", "pronunciation"])),
});
export type ContentPackage = z.infer<typeof packageSchema>;
export type SourceReference = z.infer<typeof referenceSchema>;
export type SourceEvidence = {
  sourceUrl: string;
  syllabusId: string;
  sourceSnapshotSha256: string | null;
  references: SourceReference[];
  snapshotHashes?: string[];
};
export type ValidationIssue = {
  file: string;
  recordId: string;
  field: string;
  code: string;
  message: string;
};
export function references(p: ContentPackage) {
  const a = p.alignment;
  return [
    ...a.taskReferences,
    ...a.topicReferences,
    ...a.vocabularyReferences,
    ...a.characterReferences,
    ...a.grammarReferences,
  ];
}
export function validatePackage(
  input: unknown,
  catalog: ContentPackage[],
  evidence: SourceEvidence,
  file = "<package>",
  publication = false,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (
    code: string,
    field: string,
    message: string,
    recordId = "package",
  ) => issues.push({ file, recordId, field, code, message });
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues)
      add("SCHEMA", issue.path.join("."), issue.message);
    return issues;
  }
  const p = parsed.data;
  if (!p.lesson.versionId.endsWith(`-v${p.lesson.version}`))
    add(
      "VERSION_BINDING",
      "lesson.versionId",
      "Version ID must match immutable lesson version",
    );
  if (p.lesson.version > 1 && !p.alignment.sourceSnapshotSha256)
    add(
      "SOURCE_PIN_REQUIRED",
      "alignment.sourceSnapshotSha256",
      "New versions require the checked full PDF pin",
    );
  for (const [field, items] of Object.entries({
    concepts: p.concepts,
    exercises: p.exercises,
    privateKeys: p.privateKeys,
    blocks: p.blocks,
    media: p.media,
    references: references(p),
  })) {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.id))
        add("DUPLICATE_ID", field, "Duplicate ID", item.id);
      seen.add(item.id);
    }
  }
  const referenceList = references(p);
  for (const r of referenceList) {
    if (r.status !== "VERIFIED") continue;
    const l = r.sourceLocator;
    const ranges = {
      task: [4, 7],
      topic: [58, 59],
      vocabulary: [79, 85],
      character: [355, 356],
      grammar: [385, 387],
    };
    if (
      !l ||
      l.physicalPage !== l.pdfIndex + 1 ||
      l.printedPage !== l.pdfIndex - 2 ||
      l.section !== r.kind ||
      l.pdfIndex < ranges[r.kind][0] ||
      l.pdfIndex > ranges[r.kind][1]
    )
      add(
        "SOURCE_LOCATOR",
        `alignment.${r.id}`,
        "Missing/inconsistent HSK1 page locator",
        r.id,
      );
    if (r.officialLevel !== 1)
      add(
        "SOURCE_LEVEL",
        `alignment.${r.id}`,
        "Verified mapping requires observed level 1",
        r.id,
      );
    const known = evidence.references.find((e) => e.id === r.id);
    if (!known || JSON.stringify(known) !== JSON.stringify(r))
      add(
        "SOURCE_ENTRY_MISMATCH",
        `alignment.${r.id}`,
        "Entry, sense, reading or locator differs from checked evidence",
        r.id,
      );
  }
  if (
    p.alignment.sourceUrl !== evidence.sourceUrl ||
    p.alignment.syllabusId !== evidence.syllabusId ||
    (p.alignment.sourceSnapshotSha256 !== evidence.sourceSnapshotSha256 &&
      !evidence.snapshotHashes?.includes(
        p.alignment.sourceSnapshotSha256 ?? "",
      ))
  )
    add("SOURCE_VERSION", "alignment", "Pinned source/version/hash mismatch");
  if (p.lesson.classification === "HSK_ALIGNED_DRAFT") {
    if (p.alignment.targetLevel !== 1)
      add("SOURCE_LEVEL", "alignment.targetLevel", "Draft targets HSK1");
    for (const field of [
      "taskReferences",
      "topicReferences",
      "vocabularyReferences",
      "characterReferences",
      "grammarReferences",
    ] as const)
      if (!p.alignment[field].length)
        add(
          "SOURCE_DIMENSION",
          `alignment.${field}`,
          "Required alignment dimension missing",
        );
  }
  if (
    p.alignment.alignmentStatus === "VERIFIED" &&
    (!referenceList.length ||
      referenceList.some((r) => r.status !== "VERIFIED") ||
      p.concepts.some((c) => c.scope === "TARGET" && !c.referenceIds.length))
  )
    add(
      "FALSE_ALIGNMENT",
      "alignment",
      "Unresolved/supplementary mappings cannot count as verified coverage",
    );
  for (const concept of p.concepts) {
    for (const ref of concept.referenceIds)
      if (!referenceList.some((r) => r.id === ref))
        add(
          "UNKNOWN_REFERENCE",
          "concepts.referenceIds",
          "Reference is not declared",
          concept.id,
        );
  }
  for (const ex of p.exercises) {
    const concept = p.concepts.find((c) => c.id === ex.conceptId);
    if (
      !concept ||
      concept.senseId !== ex.senseId ||
      !concept.skills.includes(ex.skill)
    )
      add("CONCEPT_SKILL", "exercises", "Unknown concept/sense/skill", ex.id);
    const key = p.privateKeys.find((k) => k.id === ex.keyRef);
    if (!key || key.exerciseVersionId !== ex.id || key.senseId !== ex.senseId)
      add(
        "KEY_BINDING",
        "exercises.keyRef",
        "Missing or mismatched immutable key",
        ex.id,
      );
    if (
      ex.type === "choice" &&
      (ex.choices.length < 2 ||
        new Set(ex.choices.map((c) => c.normalize("NFC").trim())).size !==
          ex.choices.length ||
        key?.accepted.length !== 1 ||
        !ex.choices.includes(key.accepted[0]))
    )
      add(
        "ANSWER_SET",
        "exercises.choices",
        "Choice key must uniquely match one option",
        ex.id,
      );
    if (
      ex.type === "pinyin" &&
      (ex.choices.length !== 0 ||
        key?.normalizerVersion !== PINYIN_NORMALIZER ||
        key?.accepted.some((a) => !normalizePinyin(a)))
    )
      add("ANSWER_SET", "privateKeys", "Invalid Pinyin answer contract", ex.id);
    if (
      ex.type === "pinyin" &&
      key &&
      new Set(key.accepted.map((a) => normalizePinyin(a))).size !== 1
    )
      add(
        "AMBIGUOUS_SENSE",
        "privateKeys",
        "Different tones/readings need distinct senses and exercises",
        ex.id,
      );
    if (ex.type === "choice" && key?.normalizerVersion !== "exact-choice-v1")
      add("NORMALIZER", "privateKeys", "Choice normalizer mismatch", ex.id);
    if (
      ex.type === "sequence" &&
      (ex.choices.length < 2 ||
        new Set(ex.choices).size !== ex.choices.length ||
        key?.normalizerVersion !== "token-order-v1" ||
        key.accepted.length !== 1 ||
        !validOrder(key.accepted[0].split(",").map(Number), ex.choices.length))
    )
      add(
        "ANSWER_SET",
        "privateKeys",
        "Sequence needs one exact permutation of unique public tokens",
        ex.id,
      );
    if (
      ex.type === "short" &&
      (ex.choices.length ||
        key?.normalizerVersion !== "hanzi-nfc-exact-v1" ||
        !key.accepted.every((a) => normalizeShortChinese(a)) ||
        new Set(key.accepted.map(normalizeShortChinese)).size !== 1)
    )
      add(
        "ANSWER_SET",
        "privateKeys",
        "Short Chinese uses one explicit normalized semantic answer; no fuzzy matching",
        ex.id,
      );
    if (ex.mediaIds.some((id) => !p.media.some((m) => m.id === id)))
      add("MEDIA_REFERENCE", "exercises.mediaIds", "Unknown media", ex.id);
    if (ex.requiresAudio && !ex.mediaIds.length)
      add(
        "MISSING_AUDIO",
        "exercises.mediaIds",
        "Audio exercise requires an asset",
        ex.id,
      );
    if (
      ex.requiresAudio &&
      concept &&
      ex.mediaIds.some((id) => {
        const media = p.media.find((m) => m.id === id);
        return (
          media &&
          (media.transcript.normalize("NFC").trim() !==
            concept.hanzi.normalize("NFC").trim() ||
            normalizePinyin(media.dictionaryPinyin) !==
              normalizePinyin(concept.dictionaryPinyin))
        );
      })
    )
      add(
        "MEDIA_TRANSCRIPT_MISMATCH",
        "exercises.mediaIds",
        "Required audio must match concept transcript/dictionary reading",
        ex.id,
      );
  }
  for (const key of p.privateKeys)
    if (!p.exercises.some((e) => e.keyRef === key.id))
      add("ORPHAN_KEY", "privateKeys", "Unreferenced key", key.id);
  const exBlocks = p.blocks.filter((b) => b.type === "exercise");
  for (const b of exBlocks)
    if (!p.exercises.some((e) => e.id === b.exerciseVersionId))
      add("UNKNOWN_EXERCISE", "blocks", "Unknown exercise", b.id);
  for (const ex of p.exercises)
    if (exBlocks.filter((b) => b.exerciseVersionId === ex.id).length !== 1)
      add(
        "EXERCISE_BLOCK",
        "blocks",
        "Exercise must occur exactly once",
        ex.id,
      );
  const versions = new Map(catalog.map((c) => [c.lesson.versionId, c]));
  versions.set(p.lesson.versionId, p);
  for (const dep of p.lesson.prerequisites) {
    const other = versions.get(dep);
    if (!other)
      add(
        "UNKNOWN_PREREQUISITE",
        "lesson.prerequisites",
        "Dependency missing",
        dep,
      );
    else if (JSON.stringify(other.release) !== JSON.stringify(p.release))
      add(
        "RELEASE_MISMATCH",
        "lesson.prerequisites",
        "Cross-release dependency mismatch",
        dep,
      );
  }
  const visiting = new Set<string>(),
    done = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) {
      add(
        "DAG_CYCLE",
        "lesson.prerequisites",
        "Prerequisite cycle/self-dependency",
        id,
      );
      return;
    }
    if (done.has(id)) return;
    visiting.add(id);
    for (const d of versions.get(id)?.lesson.prerequisites ?? []) visit(d);
    visiting.delete(id);
    done.add(id);
  }
  visit(p.lesson.versionId);
  if (publication || p.state === "PUBLISHED") {
    if (
      p.lesson.classification === "HSK_ALIGNED_DRAFT" &&
      !p.alignment.sourceSnapshotSha256
    )
      add(
        "SOURCE_PIN_REQUIRED",
        "alignment.sourceSnapshotSha256",
        "Publication needs a new manifest bound directly to the checked full source snapshot",
      );
    if (
      p.reviewStatus !== "HUMAN_REVIEWED" ||
      !p.humanReview ||
      p.privateKeys.some((k) => !p.humanReview?.keyVersions.includes(k.id))
    )
      add(
        "HUMAN_REVIEW_REQUIRED",
        "humanReview",
        "Human language/key approval absent",
      );
    if (
      p.rights.licenseDecision !== "PERMITTED" ||
      p.publicationStatus !== "APPROVED" ||
      !p.rights.publicationReceipt
    )
      add(
        "RIGHTS_REQUIRED",
        "rights",
        "Explicit rights/publication authorization required",
      );
    if (
      p.lesson.classification === "HSK_ALIGNED_DRAFT" &&
      p.alignment.alignmentStatus !== "VERIFIED"
    )
      add("ALIGNMENT_REQUIRED", "alignment", "Required mapping unresolved");
    if (
      p.missingAssessments.length ||
      !p.media.length ||
      p.media.some(
        (m) =>
          m.rights !== "PERMITTED" ||
          !m.humanReviewReceipt ||
          !m.consentReceipt ||
          !m.reviewedAt ||
          !m.spokenPinyin ||
          m.reviewRecord?.quality !== "ACCEPTABLE" ||
          (m.reviewRecord?.decision !== "HUMAN_APPROVED" &&
            !(
              p.humanReview?.reviewerType === "synthetic" &&
              m.reviewRecord?.decision === "TECHNICAL_APPROVED"
            )) ||
          !m.reviewRecord?.decidedAt,
        // Quality/correction metadata alone is not a human approval receipt.
      )
    )
      add(
        "MEDIA_APPROVAL_REQUIRED",
        "media",
        "Reviewed reference audio/rights/transcript required",
      );
  }
  return issues;
}
export function transition(
  p: ContentPackage,
  next: ContentPackage["state"],
  context?: { catalog: ContentPackage[]; evidence: SourceEvidence },
): ContentPackage {
  const allowed: Record<ContentPackage["state"], string[]> = {
    DRAFT: ["VALIDATED"],
    VALIDATED: ["REVIEW_PENDING"],
    REVIEW_PENDING: ["REVIEWED", "DRAFT"],
    REVIEWED: ["PUBLISHED", "DRAFT"],
    PUBLISHED: ["RETIRED"],
    RETIRED: [],
  };
  if (!allowed[p.state].includes(next))
    throw new Error("INVALID_CONTENT_TRANSITION");
  if (
    next === "VALIDATED" &&
    (!context || validatePackage(p, context.catalog, context.evidence).length)
  )
    throw new Error("CONTENT_VALIDATION_REQUIRED");
  if (next === "REVIEWED" || next === "PUBLISHED")
    throw new Error(
      "HUMAN_AUTHORITY_REQUIRED: no reviewer/publisher adapter enabled in Phase4",
    );
  return { ...p, state: next };
}
export function publicProjection(p: ContentPackage) {
  return {
    lesson: p.lesson,
    packageHash: p.packageHash,
    locale: p.locale,
    contentLanguage: p.contentLanguage,
    state: p.state,
    reviewStatus: p.reviewStatus,
    publicationStatus: p.publicationStatus,
    alignment: p.alignment,
    objectives: p.lesson.objectives,
    concepts: p.concepts,
    blocks: p.blocks,
    exercises: p.exercises.map((e) => ({
      id: e.id,
      type: e.type,
      skill: e.skill,
      conceptId: e.conceptId,
      prompt: e.prompt,
      choices: e.choices,
      inputHint: e.inputHint,
    })),
    missingAssessments: p.missingAssessments,
    reviewKind: p.humanReview?.reviewerType ?? "unreviewed",
    audio:
      p.state === "PUBLISHED"
        ? p.media.map((m) => ({
            id: m.id,
            attribution: m.attribution ?? "",
            src: `/api/v1/media/${encodeURIComponent(m.id)}`,
          }))
        : [],
  };
}
export type PublicLesson = ReturnType<typeof publicProjection>;
export function gradeContent(
  p: ContentPackage,
  exerciseId: string,
  response: { choice?: number; text?: string; order?: number[] },
) {
  const ex = p.exercises.find((e) => e.id === exerciseId);
  if (!ex) throw new Error("UNKNOWN_EXERCISE");
  const key = p.privateKeys.find((k) => k.id === ex.keyRef)!;
  let actual: string | null = null;
  if (
    ex.type === "choice" &&
    Number.isInteger(response.choice) &&
    response.choice! >= 0 &&
    response.choice! < ex.choices.length &&
    response.text === undefined &&
    response.order === undefined
  )
    actual = ex.choices[response.choice!];
  else if (
    ex.type === "pinyin" &&
    typeof response.text === "string" &&
    response.choice === undefined &&
    response.order === undefined
  )
    actual = normalizePinyin(response.text);
  else if (
    ex.type === "sequence" &&
    response.choice === undefined &&
    response.text === undefined &&
    response.order &&
    validOrder(response.order, ex.choices.length)
  )
    actual = response.order.join(",");
  else if (
    ex.type === "short" &&
    response.choice === undefined &&
    response.order === undefined &&
    typeof response.text === "string"
  )
    actual = normalizeShortChinese(response.text);
  else throw new Error("INVALID_ANSWER");
  return {
    correct:
      actual !== null &&
      key.accepted.some(
        (a) =>
          (ex.type === "pinyin"
            ? normalizePinyin(a)
            : ex.type === "short"
              ? normalizeShortChinese(a)
              : a) === actual,
      ),
    feedback: key.feedback,
    keyVersion: key.id,
    normalizerVersion: key.normalizerVersion,
    gradingVersion: key.gradingVersion,
  };
}

export function normalizeShortChinese(value: string) {
  return value
    .normalize("NFC")
    .replace(/[\s，。！？,.!?;；:：]+/g, "")
    .trim();
}
function validOrder(order: number[], count: number) {
  return (
    order.length === count &&
    new Set(order).size === count &&
    order.every((i) => Number.isInteger(i) && i >= 0 && i < count)
  );
}
