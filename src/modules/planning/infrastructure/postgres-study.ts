import type { StudySnapshot, SavedStudySettings } from "../domain/study-types";
import {
  curriculumWithin,
  type PublishedScope,
} from "@/modules/curriculum/infrastructure/postgres-curriculum";
import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { ownerTransaction } from "@/shared/db/transaction";
import { CommandError } from "@/modules/learning/domain/local-foundation";
import {
  once,
  savePreferencesWithin,
} from "@/modules/learning/infrastructure/postgres-local-repository";
import { databaseNow } from "@/modules/learning/infrastructure/postgres-learning";
import { loadDraftCatalog } from "@/modules/content/application/catalog";
import { defaultPreferences } from "../domain/preview-plan";
import {
  allocateWeek,
  PLANNER_VERSION,
  localDate,
  weekStart,
  addDays,
  type StudySettings,
  type PlanBlock,
  type WeeklyInput,
} from "../domain/weekly-plan";
import type {
  StudyPreferenceCommand,
  ReplanCommand,
} from "../domain/study-commands";
const OBSERVER = "local-review-activity-v1";
type FormConfig = Pick<StudyPreferenceCommand, "preferences" | "planning">;
async function configuration(c: PoolClient, uid: string) {
  const pref = (
    await c.query(
      "SELECT * FROM app_private.time_preferences WHERE user_id=$1",
      [uid],
    )
  ).rows[0];
  const extra = (
    await c.query("SELECT * FROM app_private.study_settings WHERE user_id=$1", [
      uid,
    ])
  ).rows[0];
  const preferences = pref
    ? {
        weeklyHours: pref.weekly_minutes / 60,
        days: pref.available_days as number[],
        dailyCap: pref.daily_cap as number,
        sessionMinutes: pref.session_minutes as number,
      }
    : { ...defaultPreferences, days: [...defaultPreferences.days] };
  const dayCaps =
    extra && extra.preferences_version === pref?.version
      ? (extra.day_caps as number[])
      : Array.from({ length: 7 }, (_, i) =>
          preferences.days.includes(i) ? preferences.dailyCap : 0,
        );
  return {
    configured: !!pref,
    expectedVersion: pref?.version ?? 0,
    preferences,
    planning: {
      dayCaps,
      maxSessionMinutes: extra?.max_session_minutes ?? 25,
      paused: extra?.paused ?? false,
      timezone: extra?.timezone ?? "Asia/Saigon",
      startingLevel: (extra?.starting_level ?? "zero") as "zero" | "some",
    },
  };
}
function domainSettings(config: FormConfig, version: number): StudySettings {
  return {
    weeklyMinutes: Math.round(config.preferences.weeklyHours * 60),
    days: config.preferences.days,
    preferredMinutes: config.preferences.sessionMinutes,
    ...config.planning,
    version,
  };
}
function blockRow(row: Record<string, unknown>): PlanBlock {
  return {
    id: String(row.id),
    localDate: String(row.local_date),
    ordinal: Number(row.ordinal),
    kind: row.kind as PlanBlock["kind"],
    target: String(row.target),
    targetIds: row.target_ids as string[],
    estimatedMinutes: Number(row.estimated_minutes),
    status: row.status as PlanBlock["status"],
    reason: String(row.reason),
    ...(row.session_id ? { sessionId: String(row.session_id) } : {}),
  };
}
async function inputSnapshot(
  c: PoolClient,
  uid: string,
  config: FormConfig,
  version: number,
  scope?: PublishedScope,
): Promise<WeeklyInput> {
  const now = await databaseNow(c),
    asOf = now.toISOString(),
    s = domainSettings(config, version),
    today = localDate(asOf, s.timezone),
    start = weekStart(today),
    end = addDays(start, 6);
  let cards = (
    await c.query(
      "SELECT id,due_at,scheduler_card,template_version_id FROM app_private.cards WHERE user_id=$1 AND due_at<=$2::timestamptz+interval '7 days' ORDER BY due_at,id",
      [uid, asOf],
    )
  ).rows;
  let sessions = (
    await c.query(
      "SELECT s.*,cs.cursor,cs.package_id FROM app_private.lesson_sessions s JOIN app_private.content_session_state cs ON cs.user_id=s.user_id AND cs.session_id=s.id WHERE s.user_id=$1 AND s.state='active' ORDER BY s.started_at,s.id",
      [uid],
    )
  ).rows;
  const progress = (
    await c.query(
      "SELECT lesson_version_id FROM app_private.lesson_progress WHERE user_id=$1 AND completed_sessions>0",
      [uid],
    )
  ).rows;
  const completed = new Set(progress.map((p) => p.lesson_version_id));
  const curriculum = await curriculumWithin(c, uid, scope);
  const all = scope?.all ?? loadDraftCatalog().packages,
    latest = curriculum.lessons.map(
      (l) => all.find((p) => p.lesson.versionId === l.currentVersion)!,
    );
  if (scope) {
    cards = cards.filter((c) =>
      all.some((p) =>
        p.concepts.some(
          (x) =>
            c.template_version_id === `${p.lesson.versionId}:recall:${x.id}`,
        ),
      ),
    );
    sessions = sessions.filter(
      (s) =>
        all.some((p) => p.lesson.versionId === s.package_id) &&
        curriculum.lessons.some(
          (l) =>
            l.key ===
            all.find((p) => p.lesson.versionId === s.package_id)?.lesson.id,
        ),
    );
  }
  const needed = [
    ...latest,
    ...all.filter(
      (p) =>
        !latest.includes(p) &&
        sessions.some((s) => s.package_id === p.lesson.versionId),
    ),
  ];
  const unique = [
    ...new Map(needed.map((p) => [p.lesson.versionId, p])).values(),
  ];
  const observed = (
    await c.query(
      `WITH pieces AS (
 SELECT e.*,dates.day FROM app_private.duration_events e CROSS JOIN LATERAL
 (SELECT (observed_start AT TIME ZONE $2)::date AS day UNION SELECT (observed_end AT TIME ZONE $2)::date) dates
 WHERE user_id=$1 AND classification='VALIDATED_TELEMETRY' AND (observed_start AT TIME ZONE $2)::date BETWEEN $3::date-1 AND $4::date
 ) SELECT day::text AS date,coalesce(sum(CASE WHEN observed_end>observed_start THEN accepted_ms * greatest(0,extract(epoch FROM least(observed_end,(day+1)::timestamp AT TIME ZONE $2)-greatest(observed_start,day::timestamp AT TIME ZONE $2))) / extract(epoch FROM observed_end-observed_start) ELSE accepted_ms END),0) AS ms
 FROM pieces WHERE day BETWEEN $3::date AND $4::date GROUP BY day ORDER BY day`,
      [uid, s.timezone, start, end],
    )
  ).rows;
  const frozenRows = (
    await c.query(
      "SELECT b.*,b.local_date::text FROM app_private.planned_blocks b WHERE b.user_id=$1 AND b.local_date BETWEEN $2::date AND $3::date AND b.status IN('in_progress','completed') ORDER BY b.local_date,b.ordinal,b.id",
      [uid, start, end],
    )
  ).rows;
  const observedSessions = (
    await c.query(
      "SELECT b.id,coalesce(sum(e.accepted_ms),0) AS ms FROM app_private.planned_blocks b LEFT JOIN app_private.duration_events e ON e.user_id=b.user_id AND e.session_id=b.session_id AND e.observed_start>=b.created_at WHERE b.user_id=$1 AND b.status='in_progress' GROUP BY b.id",
      [uid],
    )
  ).rows;
  const overrides = (
    await c.query(
      "SELECT local_date::text,cap_minutes FROM app_private.study_day_overrides WHERE user_id=$1 AND local_date BETWEEN $2::date AND $3::date",
      [uid, start, end],
    )
  ).rows;
  // Response dwell is a planning estimate only, never credited as actual study time.
  const median = (
    await c.query(
      "SELECT percentile_cont(0.5) WITHIN GROUP(ORDER BY extract(epoch FROM occurred_at-revealed_at)) AS seconds FROM app_private.review_logs WHERE user_id=$1 AND occurred_at>=$2::timestamptz-interval '14 days' AND extract(epoch FROM occurred_at-revealed_at) BETWEEN 1 AND 120 HAVING count(*)>=6",
      [uid, asOf],
    )
  ).rows[0]?.seconds;
  return {
    asOf,
    settings: s,
    cards: cards.map((r) => ({
      id: r.id,
      dueAt: new Date(r.due_at).toISOString(),
      state: r.scheduler_card.state,
      concept: r.template_version_id,
    })),
    lessons: unique.map((p) => {
      const l = curriculum.lessons.find((l) => l.key === p.lesson.id)!,
        unit = curriculum.units.find((u) => u.id === l.unitId)!,
        course = curriculum.courses.find((x) => x.code === l.courseCode)!;
      return {
        id: p.lesson.id,
        versionId: p.lesson.versionId,
        minutes: p.lesson.estimatedMinutes,
        order: course.order * 1000 + unit.order * 100 + l.order,
        prerequisites: p.lesson.prerequisites,
        completed: completed.has(p.lesson.versionId),
        verifiedEligible: l.access.verifiedEligible,
        practiceAllowed: l.access.mayPractice,
        courseCode: course.code,
        courseTitle: course.title,
        unitTitle: unit.title,
        unitSlug: unit.slug,
        checkpointMinutes: 5,
      };
    }),
    sessions: sessions.map((r) => {
      const p = all.find((p) => p.lesson.versionId === r.package_id)!;
      return {
        id: r.id,
        versionId: r.package_id,
        startedAt: new Date(r.started_at).toISOString(),
        remainingMinutes: Math.max(
          5,
          Math.ceil(
            (p.lesson.estimatedMinutes * (p.blocks.length - r.cursor)) /
              p.blocks.length,
          ),
        ),
      };
    }),
    observedByDate: Object.fromEntries(
      observed.map((r) => [r.date, Number(r.ms)]),
    ),
    observedBySession: Object.fromEntries(
      observedSessions.map((r) => [r.id, Number(r.ms)]),
    ),
    overrides: Object.fromEntries(
      overrides.map((r) => [r.local_date, r.cap_minutes]),
    ),
    frozen: frozenRows
      .map(blockRow)
      .filter(
        (b) =>
          !scope ||
          (b.kind !== "review"
            ? all.some((p) => p.lesson.versionId === b.target)
            : b.targetIds.every((id) => cards.some((c) => c.id === id))),
      )
      .map((b) => {
        const l = curriculum.lessons.find(
          (l) =>
            l.key ===
            all.find((p) => p.lesson.versionId === b.target)?.lesson.id,
        );
        return l
          ? {
              ...b,
              courseCode: l.courseCode,
              courseTitle: l.courseTitle,
              unitTitle: l.unitTitle,
              unitSlug: l.unitSlug,
            }
          : b;
      }),
    ...(median ? { reviewSecondsPerCard: Number(median) } : {}),
  };
}
function fingerprint(input: WeeklyInput) {
  const value = {
    plannerVersion: PLANNER_VERSION,
    ...input,
    asOf: localDate(input.asOf, input.settings.timezone),
    cards: input.cards.map((c) => ({ ...c, dueNow: c.dueAt <= input.asOf })),
  };
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
async function planWithin(
  c: PoolClient,
  uid: string,
  reason: string,
  force = false,
  scope?: PublishedScope,
): Promise<StudySnapshot> {
  const config = await configuration(c, uid);
  if (!config.configured)
    return { configured: false, settings: config, plan: null };
  await c.query(
    "UPDATE app_private.planned_blocks b SET status='completed' FROM app_private.lesson_sessions s WHERE b.user_id=$1 AND s.user_id=b.user_id AND s.id=b.session_id AND s.state='completed' AND b.status='in_progress'",
    [uid],
  );
  const input = await inputSnapshot(
      c,
      uid,
      config,
      config.expectedVersion,
      scope,
    ),
    draft = allocateWeek(input),
    hash = fingerprint(input);
  const old = (
    await c.query(
      "SELECT * FROM app_private.weekly_plans WHERE user_id=$1 AND week_start=$2::date AND status='active' FOR UPDATE",
      [uid, draft.weekStart],
    )
  ).rows[0];
  if (old?.snapshot_hash === hash && !force)
    return {
      configured: true,
      settings: config,
      plan: {
        ...old.document,
        id: old.id,
        version: old.version,
        reason: old.reason,
      },
    };
  const version = Number(
      (
        await c.query(
          "SELECT coalesce(max(version),0)+1 AS v FROM app_private.weekly_plans WHERE user_id=$1 AND week_start=$2::date",
          [uid, draft.weekStart],
        )
      ).rows[0].v,
    ),
    id = randomUUID();
  await c.query(
    "UPDATE app_private.weekly_plans SET status='superseded' WHERE user_id=$1 AND week_start=$2::date AND status='active'",
    [uid, draft.weekStart],
  );
  await c.query(
    "UPDATE app_private.planned_blocks SET status='superseded' WHERE user_id=$1 AND local_date BETWEEN $2::date AND $3::date AND status IN('ready','tentative')",
    [uid, draft.weekStart, addDays(draft.weekStart, 6)],
  );
  const ids = new Map(draft.blocks.map((b) => [b.id, randomUUID()]));
  const document = {
    ...draft,
    blocks: draft.blocks.map((b) => ({ ...b, id: ids.get(b.id)! })),
    action: draft.action
      ? { ...draft.action, id: ids.get(draft.action.id) ?? draft.action.id }
      : null,
  };
  await c.query(
    "INSERT INTO app_private.weekly_plans VALUES($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10,$11)",
    [
      id,
      uid,
      draft.weekStart,
      draft.timezone,
      config.expectedVersion,
      version,
      hash,
      draft.plannerVersion,
      reason,
      document,
      draft.asOf,
    ],
  );
  for (const b of document.blocks)
    await c.query(
      "INSERT INTO app_private.planned_blocks(id,user_id,plan_id,local_date,ordinal,kind,target,target_ids,estimated_minutes,status,reason,session_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [
        b.id,
        uid,
        id,
        b.localDate,
        b.ordinal,
        b.kind,
        b.target,
        JSON.stringify(b.targetIds),
        b.estimatedMinutes,
        b.status,
        b.reason,
        b.sessionId ?? null,
      ],
    );
  return {
    configured: true,
    settings: config,
    plan: { ...document, id, version, reason },
  };
}
export class PostgresStudyRepository {
  constructor(
    private pool: Pool,
    private scope?: PublishedScope,
  ) {}
  settings(uid: string): Promise<SavedStudySettings> {
    return ownerTransaction(this.pool, uid, (c) => configuration(c, uid));
  }
  preview(uid: string, config: FormConfig) {
    return ownerTransaction(this.pool, uid, async (c) =>
      allocateWeek(await inputSnapshot(c, uid, config, 0, this.scope)),
    );
  }
  today(uid: string): Promise<StudySnapshot> {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        planWithin(c, uid, "OPEN_OR_COMMITTED_DATA_CHANGED", false, this.scope),
      true,
    );
  }
  save(uid: string, key: string, command: StudyPreferenceCommand) {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        once(c, uid, "study/preferences", key, command, async () => {
          const saved = await savePreferencesWithin(c, uid, command);
          const p = command.planning;
          await c.query(
            "INSERT INTO app_private.study_settings VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id) DO UPDATE SET preferences_version=$2,day_caps=$3,max_session_minutes=$4,paused=$5,timezone=$6,starting_level=$7",
            [
              uid,
              saved.version,
              p.dayCaps,
              p.maxSessionMinutes,
              p.paused,
              p.timezone,
              p.startingLevel,
            ],
          );
          return {
            saved,
            ...(await planWithin(
              c,
              uid,
              "PREFERENCES_CHANGED",
              true,
              this.scope,
            )),
          };
        }),
      true,
    );
  }
  replan(uid: string, key: string, command: ReplanCommand) {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        once(c, uid, "study/replan", key, command, async () => {
          const config = await configuration(c, uid),
            at = await databaseNow(c),
            date = localDate(at.toISOString(), config.planning.timezone),
            start = weekStart(date);
          const old = (
            await c.query(
              "SELECT version FROM app_private.weekly_plans WHERE user_id=$1 AND week_start=$2::date AND status='active'",
              [uid, start],
            )
          ).rows[0];
          if ((old?.version ?? 0) !== command.expectedVersion)
            throw new CommandError(
              409,
              "STALE_PLAN",
              "Lịch đã đổi. Đọc lại trước khi điều chỉnh.",
            );
          if (command.action !== "refresh") {
            await c.query(
              "INSERT INTO app_private.study_day_overrides VALUES($1,$2,$3,$4,now()) ON CONFLICT(user_id,local_date) DO UPDATE SET cap_minutes=$3,reason=$4,updated_at=now()",
              [
                uid,
                date,
                command.action === "skip_today" ? 0 : 10,
                command.action === "skip_today" ? "SKIP_TODAY" : "TEN_MINUTES",
              ],
            );
            if (command.action === "skip_today")
              await c.query(
                "UPDATE app_private.planned_blocks SET status='skipped' WHERE user_id=$1 AND local_date=$2::date AND status IN('ready','tentative')",
                [uid, date],
              );
          }
          return planWithin(
            c,
            uid,
            command.action.toUpperCase(),
            true,
            this.scope,
          );
        }),
      true,
    );
  }
  reviewActivity(uid: string, key: string) {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        once(c, uid, "study/review-activity", key, {}, async () => {
          const old = (
            await c.query(
              "SELECT id FROM app_private.lesson_sessions WHERE user_id=$1 AND lesson_version_id=$2 AND state='active'",
              [uid, OBSERVER],
            )
          ).rows[0];
          const id = old?.id ?? randomUUID();
          if (!old)
            await c.query(
              "INSERT INTO app_private.lesson_sessions(id,user_id,lesson_version_id) VALUES($1,$2,$3)",
              [id, uid, OBSERVER],
            );
          await bindBlock(c, uid, id, "due", "review");
          return { sessionId: id };
        }),
      true,
    );
  }
  closeReview(uid: string, key: string, id: string) {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        once(c, uid, `study/review-activity/${id}/close`, key, {}, async () => {
          const row = (
            await c.query(
              "SELECT * FROM app_private.lesson_sessions WHERE user_id=$1 AND id=$2 AND lesson_version_id=$3 FOR UPDATE",
              [uid, id, OBSERVER],
            )
          ).rows[0];
          if (!row)
            throw new CommandError(
              404,
              "SESSION_NOT_FOUND",
              "Không có phiên ôn của bạn.",
            );
          if (row.state === "active")
            await c.query(
              "UPDATE app_private.lesson_sessions SET state='completed',completed_at=clock_timestamp() WHERE user_id=$1 AND id=$2",
              [uid, id],
            );
          return { closed: true };
        }),
      true,
    );
  }
}
export async function bindBlock(
  c: PoolClient,
  uid: string,
  session: string,
  target: string,
  kind = "draft_lesson",
) {
  const block = (
    await c.query(
      "SELECT b.id FROM app_private.planned_blocks b JOIN app_private.weekly_plans p ON p.user_id=b.user_id AND p.id=b.plan_id WHERE b.user_id=$1 AND p.status='active' AND b.local_date=(clock_timestamp() AT TIME ZONE p.timezone_snapshot)::date AND b.target=$2 AND b.kind IN($3,'resume') AND b.status IN('ready','tentative') ORDER BY b.ordinal,b.id LIMIT 1 FOR UPDATE OF b",
      [uid, target, kind],
    )
  ).rows[0];
  if (block)
    await c.query(
      "UPDATE app_private.planned_blocks SET status='in_progress',session_id=$3 WHERE user_id=$1 AND id=$2",
      [uid, block.id, session],
    );
}
