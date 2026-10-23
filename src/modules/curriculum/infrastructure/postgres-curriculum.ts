import type { Pool, PoolClient } from "pg";
import type { CurriculumSnapshot, CourseView } from "../domain/snapshot";
import { ownerTransaction } from "@/shared/db/transaction";
import { loadDraftCatalog } from "@/modules/content/application/catalog";
import { contentHash } from "@/modules/content/application/catalog";
import {
  packageSchema,
  type ContentPackage,
} from "@/modules/content/domain/package";
export type PublishedScope = {
  privateOwnerPreview?: boolean;
  id: string;
  current: ContentPackage[];
  all: ContentPackage[];
};
import {
  validateCurriculum,
  prerequisiteStatus,
  lessonAccess,
  type MasteryRow,
} from "../domain/catalog";
export async function curriculumWithin(
  c: PoolClient,
  uid: string,
  scope?: PublishedScope,
): Promise<CurriculumSnapshot> {
  const courses = (
    await c.query(
      `SELECT id,code,title,description,ordinal AS "order",syllabus_id AS "syllabusId",release_ref AS "releaseRef",availability,coverage_verified AS "coverageVerified" FROM app_content.courses ORDER BY ordinal,id`,
    )
  ).rows;
  const unitRows = (
    await c.query(
      `SELECT id,course_id AS "courseId",slug,ordinal AS "order",title,objective,availability FROM app_content.units ORDER BY ordinal,id`,
    )
  ).rows;
  const deps = (
    await c.query(
      "SELECT unit_id,required_unit_id FROM app_content.unit_prerequisites ORDER BY unit_id,required_unit_id",
    )
  ).rows;
  let lessonRows = (
    await c.query(
      `SELECT id,unit_id AS "unitId",stable_key AS key,ordinal AS "order",current_version AS "currentVersion",local_draft_allowed AS "localDraftAllowed" FROM app_content.lessons ORDER BY ordinal,id`,
    )
  ).rows;
  const reqs = (
    await c.query(
      `SELECT lesson_id,concept_id AS "conceptId",skill,rule FROM app_content.lesson_skill_prerequisites ORDER BY lesson_id,concept_id,skill`,
    )
  ).rows;
  const bindings = (
    await c.query(
      "SELECT package_id,lesson_id,version FROM app_content.lesson_versions ORDER BY package_id",
    )
  ).rows;
  const registered = (
    await c.query(
      "SELECT p.manifest,p.package_hash FROM app_content.packages p JOIN app_content.lesson_versions v ON v.package_id=p.version_id ORDER BY p.version_id",
    )
  ).rows;
  const expected = scope?.all ?? loadDraftCatalog().packages;
  if (scope)
    lessonRows = lessonRows
      .filter((l) => scope.current.some((p) => p.lesson.id === l.key))
      .map((l) => ({
        ...l,
        currentVersion: scope.current.find((p) => p.lesson.id === l.key)!.lesson
          .versionId,
        localDraftAllowed: false,
      }));
  const packages = registered
    .filter(
      (r) =>
        !scope ||
        expected.some(
          (p) => p.lesson.versionId === r.manifest.lesson.versionId,
        ),
    )
    .map((r) => {
      const p = packageSchema.parse(r.manifest);
      if (
        contentHash(p) !== r.package_hash ||
        !expected.some(
          (e) =>
            e.lesson.versionId === p.lesson.versionId &&
            e.packageHash === p.packageHash,
        )
      )
        throw new Error("CURRICULUM_PACKAGE_DRIFT");
      return p;
    });
  const catalog = validateCurriculum(
    {
      schemaVersion: 1,
      releaseId: "local-curriculum-v1",
      courses: scope
        ? courses.map((c) => ({
            ...c,
            releaseRef: scope.privateOwnerPreview ? c.releaseRef : scope.id,
            availability: lessonRows.some((l) =>
              unitRows.some((u) => u.id === l.unitId && u.courseId === c.id),
            )
              ? "AVAILABLE"
              : "NOT_RELEASED",
          }))
        : courses,
      units: unitRows.map((u) => ({
        ...u,
        ...(scope
          ? {
              availability: lessonRows.some((l) => l.unitId === u.id)
                ? "AVAILABLE"
                : "NOT_RELEASED",
            }
          : {}),
        prerequisites: deps
          .filter((d) => d.unit_id === u.id)
          .map((d) => d.required_unit_id),
      })),
      lessons: lessonRows.map((l) => ({
        ...l,
        requirements: reqs
          .filter((r) => r.lesson_id === l.id)
          .map(({ conceptId, skill, rule }) => ({ conceptId, skill, rule })),
      })),
    },
    packages,
  );
  for (const b of bindings) {
    if (scope && !packages.some((p) => p.lesson.versionId === b.package_id))
      continue;
    const p = packages.find((p) => p.lesson.versionId === b.package_id),
      l = catalog.lessons.find((l) => l.id === b.lesson_id);
    if (
      !p ||
      (!l && !scope) ||
      (l && p.lesson.id !== l.key) ||
      p.lesson.version !== b.version
    )
      throw new Error("VERSION_BINDING_DRIFT");
  }
  const sessions = (
    await c.query(
      "SELECT s.id,s.lesson_version_id,s.state FROM app_private.lesson_sessions s WHERE user_id=$1 ORDER BY started_at DESC,id DESC",
      [uid],
    )
  ).rows;
  const attempts = (
    await c.query(
      "SELECT DISTINCT package_id FROM app_private.content_attempt_bindings WHERE user_id=$1",
      [uid],
    )
  ).rows;
  const progress = (
    await c.query(
      "SELECT lesson_version_id,completed_sessions FROM app_private.lesson_progress WHERE user_id=$1",
      [uid],
    )
  ).rows;
  const mastery = (
    await c.query(
      `SELECT concept_id AS "conceptId",skill,projection FROM app_private.skill_mastery WHERE user_id=$1 ORDER BY concept_id,skill`,
      [uid],
    )
  ).rows as MasteryRow[];
  const cards = (
    await c.query(
      "SELECT template_version_id FROM app_private.cards WHERE user_id=$1 AND due_at<=clock_timestamp() ORDER BY due_at,id",
      [uid],
    )
  ).rows;
  const lessons = catalog.lessons.map((l) => {
    const p = packages.find((p) => p.lesson.versionId === l.currentVersion)!,
      unit = catalog.units.find((u) => u.id === l.unitId)!,
      course = catalog.courses.find((x) => x.id === unit.courseId)!;
    const prerequisites = prerequisiteStatus(
        l.requirements,
        mastery,
        Object.fromEntries(
          packages.flatMap((p) =>
            p.concepts.map((c) => [c.id, `${c.hanzi} · ${c.dictionaryPinyin}`]),
          ),
        ),
      ),
      canonicalAccess = lessonAccess(
        p,
        prerequisites,
        l.localDraftAllowed,
        !scope,
        course.availability !== "NOT_RELEASED" &&
          unit.availability !== "NOT_RELEASED",
      );
    // Proposed private practice exception: explicit selections only. This never
    // satisfies prerequisites or changes canonical eligibility/publication.
    const access = scope?.privateOwnerPreview
      ? {
          ...canonicalAccess,
          availability: "PRACTICE_ONLY" as const,
          mayPractice: true,
          published: false,
          verifiedEligible: false,
        }
      : canonicalAccess;
    const versions = bindings
      .filter(
        (b) =>
          b.lesson_id === l.id &&
          (!scope?.privateOwnerPreview ||
            scope.all.some((p) => p.lesson.versionId === b.package_id)),
      )
      .map((b) => b.package_id as string);
    const active = sessions.find(
      (s) => s.lesson_version_id === l.currentVersion && s.state === "active",
    );
    const completed = progress.some(
        (r) =>
          r.lesson_version_id === l.currentVersion && r.completed_sessions > 0,
      ),
      practiced = attempts.some((r) => r.package_id === l.currentVersion),
      started = sessions.some((s) => s.lesson_version_id === l.currentVersion);
    const historicalVersions = versions.filter(
      (v) =>
        v !== l.currentVersion &&
        sessions.some((s) => s.lesson_version_id === v),
    );
    const evidence = mastery
      .filter((m) => p.concepts.some((c) => c.id === m.conceptId))
      .reduce((n, m) => n + m.projection.evidenceCount, 0);
    return {
      ...l,
      courseCode: course.code,
      courseTitle: course.title,
      unitTitle: unit.title,
      unitSlug: unit.slug,
      title: p.lesson.title,
      objectives: p.lesson.objectives,
      estimatedMinutes: p.lesson.estimatedMinutes,
      packageHash: p.packageHash,
      reviewStatus: p.reviewStatus,
      publicationStatus: p.publicationStatus,
      alignment: p.alignment.alignmentStatus,
      contentPrerequisites: p.lesson.prerequisites,
      exerciseCount: p.exercises.length,
      prerequisites,
      access,
      started,
      practiced,
      completed,
      activityState: active
        ? ("IN_PROGRESS" as const)
        : completed
          ? ("COMPLETED" as const)
          : started
            ? ("IN_PROGRESS" as const)
            : ("NOT_STARTED" as const),
      sessionId: active?.id ?? null,
      independentEvidence: evidence,
      historicalVersions,
      dueCards: cards.filter((c) =>
        versions.some((v) => c.template_version_id.startsWith(`${v}:recall:`)),
      ).length,
    };
  });
  return {
    releaseId: catalog.releaseId,
    asOf: new Date().toISOString(),
    units: catalog.units,
    lessons,
    courses: catalog.courses.map((course) => {
      const ls = lessons.filter((l) => l.courseCode === course.code),
        units = catalog.units.filter((u) => u.courseId === course.id);
      const total = ls.length,
        practiced = ls.filter((l) => l.practiced).length,
        completed = ls.filter((l) => l.completed).length;
      const available = ls.filter((l) => l.access.verifiedEligible).length,
        practiceOnly = ls.filter(
          (l) => l.access.availability === "PRACTICE_ONLY",
        ).length;
      const activityState: CourseView["activityState"] =
        total &&
        course.coverageVerified &&
        completed === total &&
        available === total
          ? "COMPLETED"
          : ls.some((l) => l.started)
            ? "IN_PROGRESS"
            : "NOT_STARTED";
      const availability: CourseView["availability"] = available
        ? "AVAILABLE"
        : practiceOnly
          ? "PRACTICE_ONLY"
          : ls.some((l) => l.access.availability === "PREREQUISITE_BLOCKED")
            ? "PREREQUISITE_BLOCKED"
            : "NOT_RELEASED";
      return {
        ...course,
        availability,
        activityState,
        unitCount: units.length,
        totalLessons: total,
        publishedAvailable: available,
        practiceOnly,
        practiced,
        completed,
        pending: ls.filter((l) => !l.access.published).length,
        independentEvidence: ls.reduce((n, l) => n + l.independentEvidence, 0),
        dueCards: ls.reduce((n, l) => n + l.dueCards, 0),
        currentPracticeScopeComplete: total > 0 && completed === total,
      };
    }),
  };
}
export class PostgresCurriculumRepository {
  constructor(private pool: Pool) {}
  snapshot(uid: string) {
    return ownerTransaction(this.pool, uid, (c) => curriculumWithin(c, uid));
  }
}
