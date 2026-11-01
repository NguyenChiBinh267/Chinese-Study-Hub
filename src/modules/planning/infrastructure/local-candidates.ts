import type { PoolClient } from "pg";
import { isDeepStrictEqual } from "node:util";
import {
  loadLocalPlanningIndex,
  type LocalPlanningIndex,
} from "@/modules/content/application/local-planning-index";
import type { PlanBlock, PlanLesson, PlanSession } from "../domain/weekly-plan";

// allocateWeek schedules at most one non-review activity per local date. Seven
// usable candidates suffice for its seven-day horizon, after frozen exclusions.
export const PLANNING_CANDIDATE_LIMIT = 7;
export const PLANNING_METADATA_PAGE = 16;
type Active = {
  id: string;
  package_id: string;
  started_at: Date;
  cursor: number;
};
type Row = {
  version_id: string;
  package_hash: string;
  state: string;
  manifest_state: string;
  lesson: unknown;
  manifest_hash: string;
  review_status: string;
  publication_status: string;
  human_review: unknown;
  release_id: string;
  key: string;
  current_version: string;
  local_draft_allowed: boolean;
  unit_state: string;
  course_state: string;
  lesson_uid: string;
  unit_uid: string;
  course_uid: string;
  lesson_order: number;
  unit_order: number;
  course_order: number;
  course_code: string;
  course_title: string;
  unit_title: string;
  unit_slug: string;
  release_ref: string | null;
  syllabus_id: string | null;
};
const selectMetadata = `SELECT p.version_id,p.package_hash,p.state,p.manifest->>'state' AS manifest_state,
 p.manifest->'lesson' AS lesson,p.manifest->>'packageHash' AS manifest_hash,
 p.manifest->>'reviewStatus' AS review_status,p.manifest->>'publicationStatus' AS publication_status,
 p.manifest->'humanReview' AS human_review,p.manifest->'release'->>'id' AS release_id,
 l.stable_key AS key,l.current_version,l.local_draft_allowed,u.availability AS unit_state,c.availability AS course_state,
 l.id AS lesson_uid,u.id AS unit_uid,c.id AS course_uid,l.ordinal AS lesson_order,u.ordinal AS unit_order,c.ordinal AS course_order,
 c.code AS course_code,c.title AS course_title,u.title AS unit_title,u.slug AS unit_slug,c.release_ref,c.syllabus_id
 FROM app_content.packages p JOIN app_content.lesson_versions v ON v.package_id=p.version_id
 JOIN app_content.lessons l ON l.id=v.lesson_id JOIN app_content.units u ON u.id=l.unit_id
 JOIN app_content.courses c ON c.id=u.course_id`;

function validateRow(row: Row, index: LocalPlanningIndex) {
  const p = index.records[row.version_id]?.metadata,
    position = index.placements[row.key];
  if (
    !p ||
    !position ||
    row.package_hash !== p.packageHash ||
    row.manifest_hash !== p.packageHash ||
    !isDeepStrictEqual(row.lesson, p.lesson) ||
    row.release_id !== p.release.id ||
    row.state !== p.state ||
    row.manifest_state !== p.state ||
    !["DRAFT", "VALIDATED", "REVIEW_PENDING"].includes(row.state) ||
    row.review_status !== "DRAFT_UNREVIEWED" ||
    row.publication_status !== "BLOCKED" ||
    row.human_review !== null
  )
    throw Error("PLANNER_PACKAGE_METADATA_DRIFT");
  const actual = {
    lessonUid: row.lesson_uid,
    unitUid: row.unit_uid,
    courseUid: row.course_uid,
    lessonOrder: row.lesson_order,
    unitOrder: row.unit_order,
    courseOrder: row.course_order,
    courseCode: row.course_code,
    courseTitle: row.course_title,
    unitTitle: row.unit_title,
    unitSlug: row.unit_slug,
    releaseRef: row.release_ref,
    syllabusId: row.syllabus_id,
  };
  const { planOrder, ...expectedPosition } = position;
  if (
    !isDeepStrictEqual(actual, expectedPosition) ||
    index.currentByKey[row.key] !== row.current_version
  )
    throw Error("PLANNER_CURRICULUM_METADATA_DRIFT");
  return {
    id: p.lesson.id,
    versionId: row.version_id,
    minutes: p.lesson.estimatedMinutes,
    order: planOrder,
    prerequisites: p.lesson.prerequisites,
    completed: false,
    verifiedEligible: false,
    practiceAllowed:
      row.local_draft_allowed &&
      row.unit_state !== "NOT_RELEASED" &&
      row.course_state !== "NOT_RELEASED",
    courseCode: row.course_code,
    courseTitle: row.course_title,
    unitTitle: row.unit_title,
    unitSlug: row.unit_slug,
    checkpointMinutes: 5,
  } satisfies PlanLesson;
}

export async function localPlanningCandidatesWithin(
  c: PoolClient,
  completed: Set<string>,
  active: Active[],
  frozen: PlanBlock[],
  today: string,
) {
  const index = loadLocalPlanningIndex(),
    lessons = new Map<string, PlanLesson>(),
    sessions: PlanSession[] = [];
  const selectedKeys = new Set(index.roots);
  for (const version of completed)
    for (const key of index.unlockedBy[version] ?? []) selectedKeys.add(key);
  const eligibleKeys = [...selectedKeys].filter((key) => {
    const p = index.records[index.currentByKey[key]]?.metadata;
    return (
      p &&
      !completed.has(p.lesson.versionId) &&
      p.lesson.prerequisites.every((v) => completed.has(v))
    );
  });
  // Owner-owned active sessions are already ordered in SQL. Fetch only enough
  // permitted metadata pages, skipping a frozen continuation already today.
  for (const s of active)
    if (!index.records[s.package_id])
      throw Error("PLANNER_ACTIVE_VERSION_UNREGISTERED");
  const pendingActive = active.filter(
    (s) => !frozen.some((b) => b.sessionId === s.id && b.localDate === today),
  );
  for (
    let offset = 0;
    offset < pendingActive.length && sessions.length < PLANNING_CANDIDATE_LIMIT;
    offset += PLANNING_METADATA_PAGE
  ) {
    const page = pendingActive.slice(offset, offset + PLANNING_METADATA_PAGE);
    const rows = (
      await c.query(`${selectMetadata} WHERE p.version_id=ANY($1::text[])`, [
        page.map((s) => s.package_id),
      ])
    ).rows as Row[];
    for (const s of page) {
      const row = rows.find((r) => r.version_id === s.package_id);
      if (!row) throw Error("PLANNER_ACTIVE_VERSION_MISSING");
      const lesson = validateRow(row, index);
      if (!lesson.practiceAllowed) continue;
      lessons.set(lesson.versionId, {
        ...lesson,
        completed: completed.has(lesson.versionId),
      });
      const p = index.records[s.package_id].metadata;
      sessions.push({
        id: s.id,
        versionId: s.package_id,
        startedAt: new Date(s.started_at).toISOString(),
        remainingMinutes: Math.max(
          5,
          Math.ceil(
            (p.lesson.estimatedMinutes * (p.blockCount - s.cursor)) /
              p.blockCount,
          ),
        ),
      });
      if (sessions.length === PLANNING_CANDIDATE_LIMIT) break;
    }
  }
  const activeVersions = new Set(active.map((s) => s.package_id));
  // SQL orders by the same ordinal expression as allocateWeek, never by a
  // fixed-width lesson ID. Permissions remain live database values.
  let nextCount = 0;
  for (
    let offset = 0;
    nextCount < PLANNING_CANDIDATE_LIMIT;
    offset += PLANNING_METADATA_PAGE
  ) {
    const rows = (
      await c.query(
        `${selectMetadata} WHERE p.version_id IN (
 SELECT q.current_version FROM app_content.lessons q JOIN app_content.units qu ON qu.id=q.unit_id
 JOIN app_content.courses qc ON qc.id=qu.course_id WHERE q.stable_key=ANY($1::text[])
 ORDER BY qc.ordinal,qu.ordinal,q.ordinal,q.current_version LIMIT $2 OFFSET $3
 ) ORDER BY c.ordinal,u.ordinal,l.ordinal,p.version_id`,
        [eligibleKeys, PLANNING_METADATA_PAGE, offset],
      )
    ).rows as Row[];
    for (const row of rows) {
      const lesson = validateRow(row, index);
      if (activeVersions.has(lesson.versionId) || !lesson.practiceAllowed)
        continue;
      lessons.set(lesson.versionId, lesson);
      nextCount++;
      if (nextCount === PLANNING_CANDIDATE_LIMIT) break;
    }
    if (rows.length < PLANNING_METADATA_PAGE) break;
  }
  // Frozen facts survive permission changes. Decoration is metadata only and
  // does not turn a frozen block into new eligibility or read its content body.
  const decorated = frozen.map((b) => {
    const p = index.records[b.target]?.metadata,
      position = p && index.placements[p.lesson.id];
    return position
      ? {
          ...b,
          courseCode: position.courseCode,
          courseTitle: position.courseTitle,
          unitTitle: position.unitTitle,
          unitSlug: position.unitSlug,
        }
      : b;
  });
  return {
    lessons: [...lessons.values()],
    sessions,
    frozen: decorated,
    completedVersions: [...completed],
  };
}
