import { z } from "zod";

const text = z.string().min(3).max(650);
const id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const versionRef = z.string().regex(/^[a-z][a-z0-9-]*-v[1-9]\d*$/);
export const articulationSchema = z.strictObject({
  lips: text,
  tongueTip: text,
  tongueBody: text,
  jaw: text,
  airflow: text,
  voicing: text,
  tone: text,
  timing: text,
});
export const illustrationSchema = z.strictObject({
  id: versionRef,
  version: z.int().positive(),
  kind: z.enum(["TRACT", "TONE", "TEXT"]),
  place: z.enum([
    "LIPS",
    "DENTAL",
    "PALATAL",
    "POSTALVEOLAR",
    "VELAR",
    "FRONT_VOWEL",
    "BACK_VOWEL",
    "NONE",
  ]),
  manner: z.enum([
    "STOP",
    "AFFRICATE",
    "FRICATIVE",
    "APPROXIMANT",
    "VOWEL",
    "NONE",
  ]),
  aspiration: z.enum(["ASPIRATED", "UNASPIRATED", "CONTINUOUS", "NONE"]),
  mouth: z.enum(["NEUTRAL", "SPREAD", "ROUND", "CLOSED"]),
  contour: z.enum([
    "LEVEL",
    "RISE",
    "DIP",
    "LOW",
    "FALL",
    "NEUTRAL",
    "SANDHI",
    "NONE",
  ]),
  description: text,
  limitations: text,
  provenance: z.literal("PROJECT_ORIGINAL_AI_ASSISTED_SVG"),
  reviewStatus: z.literal("DRAFT_UNREVIEWED"),
  rights: z.literal("ORIGINAL_REVIEW_PENDING"),
  sourceIds: z.array(id).min(1),
});
export const noteSchema = z.strictObject({
  id,
  version: z.int().positive(),
  versionId: versionRef,
  target: z.string().min(1).max(70),
  pinyin: z.string().min(1).max(100),
  category: z.enum([
    "INITIAL",
    "FINAL",
    "SYLLABLE",
    "LEXICAL_TONE",
    "CONTEXTUAL_TONE",
    "MINIMAL_PAIR",
    "LEARNER_ERROR",
  ]),
  group: z.enum([
    "ASPIRATION",
    "FRONT",
    "PALATAL",
    "RETROFLEX",
    "VOWELS",
    "TONES",
    "CONTEXT",
    "COMPARE",
  ]),
  title: text,
  quickTip: text,
  explanation: text,
  articulation: articulationSchema,
  steps: z.array(text).min(2).max(4),
  commonMistakes: z.array(text).min(1).max(3),
  correction: z.strictObject({ mayBeWrong: text, change: text, nextTry: text }),
  selfCheck: text,
  technical: text,
  illustrationRefs: z.array(versionRef).min(1).max(2),
  comparisonRefs: z.array(versionRef).max(2),
  audioRefs: z.array(versionRef).length(0),
  references: z.array(z.strictObject({ sourceId: id, locator: text })).min(1),
  provenance: z.literal("PROJECT_ORIGINAL_AI_ASSISTED_DRAFT"),
  rights: z.literal("ORIGINAL_REVIEW_PENDING"),
  reviewStatus: z.literal("DRAFT_UNREVIEWED"),
  publication: z.literal("LOCAL_DEVELOPMENT_ONLY"),
  humanReview: z.null(),
  limitations: text,
});
export const pronunciationReleaseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: versionRef,
  author: text,
  sources: z
    .array(
      z.strictObject({
        id,
        title: text,
        url: z.url().startsWith("https://"),
        consultedOn: z.iso.date(),
        use: z.literal("REFERENCE_ONLY_NO_TEXT_IMAGE_AUDIO_REUSE"),
        scope: text,
      }),
    )
    .min(1),
  illustrations: z.array(illustrationSchema).min(1),
  notes: z.array(noteSchema).min(1).max(40),
  lessonBindings: z.strictObject({
    F01: z.array(versionRef).min(1),
    F02: z.array(versionRef).min(1),
  }),
});
export type PronunciationNote = z.infer<typeof noteSchema>;
export type Illustration = z.infer<typeof illustrationSchema>;
export type PronunciationRelease = z.infer<typeof pronunciationReleaseSchema>;
export interface PronunciationNoteRepository {
  load(): PronunciationRelease;
}
export function validatePronunciation(raw: unknown): PronunciationRelease {
  const r = pronunciationReleaseSchema.parse(raw);
  function unique(values: string[]) {
    if (new Set(values).size !== values.length)
      throw new Error("DUPLICATE_PRONUNCIATION_REFERENCE");
  }
  unique(r.sources.map((s) => s.id));
  unique(r.illustrations.map((i) => i.id));
  unique(r.notes.map((n) => n.versionId));
  unique(r.notes.map((n) => `${n.id}:${n.version}`));
  for (const n of r.notes) {
    if (n.versionId !== `${n.id}-v${n.version}`)
      throw new Error("NOTE_VERSION_MISMATCH");
    for (const ref of n.illustrationRefs)
      if (!r.illustrations.some((i) => i.id === ref))
        throw new Error("MISSING_ILLUSTRATION");
    for (const ref of n.comparisonRefs)
      if (
        !r.notes.some((x) => x.versionId === ref && x.versionId !== n.versionId)
      )
        throw new Error("MISSING_COMPARISON");
    for (const ref of n.references)
      if (!r.sources.some((s) => s.id === ref.sourceId))
        throw new Error("MISSING_SOURCE");
    if (
      ["LEXICAL_TONE", "CONTEXTUAL_TONE"].includes(n.category) &&
      !n.illustrationRefs.every(
        (ref) => r.illustrations.find((i) => i.id === ref)?.kind === "TONE",
      )
    )
      throw new Error("TONE_ILLUSTRATION_MISMATCH");
  }
  for (const i of r.illustrations) {
    if (!i.id.endsWith(`-v${i.version}`))
      throw new Error("ILLUSTRATION_VERSION_MISMATCH");
    for (const source of i.sourceIds)
      if (!r.sources.some((s) => s.id === source))
        throw new Error("MISSING_SOURCE");
    if (
      i.kind === "TRACT" &&
      (i.place === "NONE" || i.manner === "NONE" || i.contour !== "NONE")
    )
      throw new Error("INVALID_TRACT");
    if (i.kind === "TONE" && (i.contour === "NONE" || i.place !== "NONE"))
      throw new Error("INVALID_TONE_CONTOUR");
  }
  for (const [lesson, refs] of Object.entries(r.lessonBindings)) {
    unique(refs);
    for (const ref of refs) {
      const n = r.notes.find((n) => n.versionId === ref);
      if (!n) throw new Error("MISSING_PINNED_NOTE");
      if (
        lesson === "F02" &&
        !["LEXICAL_TONE", "CONTEXTUAL_TONE"].includes(n.category)
      )
        throw new Error("INVALID_TONE_BINDING");
    }
  }
  return r;
}
