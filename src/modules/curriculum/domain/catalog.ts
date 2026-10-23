import { z } from "zod";
import type { ContentPackage } from "@/modules/content/domain/package";
import {
  foundationPrerequisite,
  type Mastery,
} from "@/modules/learning/domain/mastery";
const uuid = z.uuid();
const availability = z.enum(["NOT_RELEASED", "PRACTICE_ONLY", "AVAILABLE"]);
export const catalogSchema = z.strictObject({
  schemaVersion: z.literal(1),
  releaseId: z.string().min(1),
  courses: z
    .array(
      z.strictObject({
        id: uuid,
        code: z.enum(["FOUNDATION", "HSK1", "HSK2", "HSK3", "HSK4"]),
        title: z.string().min(1),
        description: z.string().min(1),
        order: z.int().min(0),
        syllabusId: z.literal("hsk-exam-2025-11").nullable(),
        releaseRef: z.string().nullable(),
        availability,
        coverageVerified: z.boolean(),
      }),
    )
    .length(5),
  units: z.array(
    z.strictObject({
      id: uuid,
      slug: z.string().regex(/^[a-z][a-z-]*$/),
      courseId: uuid,
      order: z.int().min(0),
      title: z.string().min(1),
      objective: z.string().min(1),
      prerequisites: z.array(uuid),
      availability,
    }),
  ),
  lessons: z.array(
    z.strictObject({
      id: uuid,
      key: z.string().regex(/^[A-Z][A-Z0-9]+$/),
      unitId: uuid,
      order: z.int().min(0),
      currentVersion: z.string().min(1),
      localDraftAllowed: z.boolean(),
      requirements: z.array(
        z.strictObject({
          conceptId: z.string().min(1),
          skill: z.enum(["recognition", "reading", "pinyin"]),
          rule: z.enum(["foundation", "secure"]),
        }),
      ),
    }),
  ),
});
export type Curriculum = z.infer<typeof catalogSchema>;
export type Requirement = Curriculum["lessons"][number]["requirements"][number];
function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length)
    throw new Error(`DUPLICATE_${label}`);
}
function dag(edges: Map<string, string[]>) {
  const visiting = new Set<string>(),
    done = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error("CYCLIC_PREREQUISITE");
    if (done.has(id)) return;
    if (!edges.has(id)) throw new Error("MISSING_PREREQUISITE");
    visiting.add(id);
    for (const dep of edges.get(id)!) visit(dep);
    visiting.delete(id);
    done.add(id);
  };
  for (const id of edges.keys()) visit(id);
}
export function validateCurriculum(
  raw: unknown,
  packages: ContentPackage[],
): Curriculum {
  const c = catalogSchema.parse(raw);
  unique(
    c.courses.map((x) => x.id),
    "COURSE",
  );
  unique(
    c.courses.map((x) => x.code),
    "LEVEL",
  );
  unique(
    c.courses.map((x) => String(x.order)),
    "COURSE_ORDER",
  );
  unique(
    c.units.map((x) => x.id),
    "UNIT",
  );
  unique(
    c.units.map((x) => `${x.courseId}:${x.slug}`),
    "UNIT_SLUG",
  );
  unique(
    c.units.map((x) => `${x.courseId}:${x.order}`),
    "UNIT_ORDER",
  );
  unique(
    c.lessons.map((x) => x.id),
    "LESSON",
  );
  unique(
    c.lessons.map((x) => x.key),
    "LESSON_KEY",
  );
  unique(
    c.lessons.map((x) => `${x.unitId}:${x.order}`),
    "LESSON_ORDER",
  );
  const ordered = [...c.courses].sort((a, b) => a.order - b.order);
  if (
    ordered.map((x) => x.code).join(",") !== "FOUNDATION,HSK1,HSK2,HSK3,HSK4" ||
    ordered[0].syllabusId !== null ||
    ordered[0].coverageVerified
  )
    throw new Error("INVALID_LEVEL_SCOPE");
  for (const course of c.courses) {
    if (
      course.code !== "FOUNDATION" &&
      course.syllabusId !== "hsk-exam-2025-11"
    )
      throw new Error("SYLLABUS_DRIFT");
  }
  for (const u of c.units) {
    if (!c.courses.some((x) => x.id === u.courseId))
      throw new Error("MISSING_COURSE");
    unique(u.prerequisites, "UNIT_PREREQUISITE");
  }
  dag(new Map(c.units.map((u) => [u.id, u.prerequisites])));
  const versionEdges = new Map(
    packages.map((p) => [p.lesson.versionId, p.lesson.prerequisites]),
  );
  dag(versionEdges);
  for (const l of c.lessons) {
    const u = c.units.find((u) => u.id === l.unitId),
      p = packages.find((p) => p.lesson.versionId === l.currentVersion);
    if (!u || !p || p.lesson.id !== l.key)
      throw new Error("MISSING_OR_MISMATCHED_LESSON_VERSION");
    const course = c.courses.find((x) => x.id === u.courseId)!;
    if (
      course.releaseRef !== p.release.id ||
      (course.code === "FOUNDATION") !==
        (p.lesson.classification === "FOUNDATION_INTERNAL")
    )
      throw new Error("INVALID_COURSE_BINDING");
    if (
      p.lesson.classification === "HSK_ALIGNED_DRAFT" &&
      (p.alignment.syllabusId !== course.syllabusId ||
        p.alignment.targetLevel !== Number(course.code.slice(3)))
    )
      throw new Error("SYLLABUS_DRIFT");
    unique(
      l.requirements.map((r) => `${r.conceptId}:${r.skill}`),
      "REQUIREMENT",
    );
    for (const r of l.requirements)
      if (
        !packages.some((p) =>
          p.concepts.some(
            (x) => x.id === r.conceptId && x.skills.includes(r.skill),
          ),
        )
      )
        throw new Error("MISSING_CONCEPT_SKILL");
  }
  return c;
}
export type MasteryRow = {
  conceptId: string;
  skill: string;
  projection: Mastery;
};
export function prerequisiteStatus(
  requirements: Requirement[],
  mastery: MasteryRow[],
  labels: Record<string, string> = {},
) {
  return requirements.map((r) => {
    const m = mastery.find(
      (m) => m.conceptId === r.conceptId && m.skill === r.skill,
    )?.projection;
    const satisfied =
      !!m &&
      m.evidenceCount > 0 &&
      (r.rule === "foundation"
        ? foundationPrerequisite(m)
        : m.status === "secure" && !m.stale);
    return {
      ...r,
      satisfied,
      evidenceCount: m?.evidenceCount ?? 0,
      reason: satisfied
        ? "Đủ bằng chứng hợp lệ."
        : `Thiếu bằng chứng độc lập về ${{ recognition: "nhận diện", reading: "đọc", pinyin: "pinyin" }[r.skill]} cho ${labels[r.conceptId] ?? r.conceptId}; cần ${r.rule === "foundation" ? "nền tảng đã kiểm chứng" : "mastery secure còn hiệu lực"}.`,
    };
  });
}
export type AvailabilityState =
  | "NOT_RELEASED"
  | "AVAILABLE"
  | "PRACTICE_ONLY"
  | "PREREQUISITE_BLOCKED";
export function lessonAccess(
  p: ContentPackage,
  requirements: ReturnType<typeof prerequisiteStatus>,
  localDraftAllowed: boolean,
  development: boolean,
  parentsReleased = true,
) {
  const prerequisitesSatisfied = requirements.every((r) => r.satisfied);
  const published =
    p.state === "PUBLISHED" &&
    p.publicationStatus === "APPROVED" &&
    p.reviewStatus === "HUMAN_REVIEWED" &&
    p.humanReview !== null &&
    p.rights.licenseDecision === "PERMITTED" &&
    !!p.rights.publicationReceipt;
  // Source alignment, human review, publication, prerequisites and practice are independent.
  const availability: AvailabilityState = !parentsReleased
    ? "NOT_RELEASED"
    : published
      ? prerequisitesSatisfied
        ? "AVAILABLE"
        : "PREREQUISITE_BLOCKED"
      : development &&
          localDraftAllowed &&
          ["DRAFT", "VALIDATED", "REVIEW_PENDING"].includes(p.state) &&
          p.reviewStatus === "DRAFT_UNREVIEWED"
        ? "PRACTICE_ONLY"
        : "NOT_RELEASED";
  return {
    availability,
    published,
    prerequisitesSatisfied,
    verifiedEligible: parentsReleased && published && prerequisitesSatisfied,
    mayPractice:
      availability === "PRACTICE_ONLY" || availability === "AVAILABLE",
  };
}
