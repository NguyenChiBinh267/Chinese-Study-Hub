import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { ownerTransaction } from "@/shared/db/transaction";
import {
  CommandError,
  type AnswerCommand,
  type LocalAnswer,
  type LocalLearningRepository,
  type LocalSnapshot,
  type PreferenceCommand,
  type SavedPreferences,
} from "../domain/local-foundation";
import {
  fixture,
  gradeFixture,
  fixtureDefinition,
} from "../server/local-fixture";
import { recordLearning, learningSummary } from "./postgres-learning";

export async function once<T>(
  client: PoolClient,
  userId: string,
  endpoint: string,
  key: string,
  payload: unknown,
  work: () => Promise<T>,
): Promise<T> {
  const digest = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  const old = await client.query(
    "SELECT payload_hash,response_json FROM app_private.api_idempotency WHERE user_id=$1 AND endpoint=$2 AND key=$3",
    [userId, endpoint, key],
  );
  if (old.rowCount) {
    if (old.rows[0].payload_hash !== digest)
      throw new CommandError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "Khóa gửi đã được dùng cho dữ liệu khác.",
      );
    return old.rows[0].response_json as T;
  }
  const result = await work();
  await client.query(
    "INSERT INTO app_private.api_idempotency(user_id,endpoint,key,payload_hash,response_json) VALUES($1,$2,$3,$4,$5)",
    [userId, endpoint, key, digest, JSON.stringify(result)],
  );
  return result;
}
function settings(row: Record<string, unknown>): SavedPreferences {
  return {
    preferences: {
      weeklyHours: Number(row.weekly_minutes) / 60,
      days: row.available_days as number[],
      dailyCap: Number(row.daily_cap),
      sessionMinutes: Number(row.session_minutes),
    },
    version: Number(row.version),
    updatedAt: new Date(row.updated_at as Date).toISOString(),
  };
}
async function sessionFor(client: PoolClient, uid: string, id: string) {
  const row = (
    await client.query(
      "SELECT * FROM app_private.lesson_sessions WHERE user_id=$1 AND id=$2 FOR UPDATE",
      [uid, id],
    )
  ).rows[0];
  if (!row || row.lesson_version_id !== fixture.id)
    throw new CommandError(
      404,
      "SESSION_NOT_FOUND",
      "Không tìm thấy phiên học của bạn.",
    );
  return row;
}
async function event(
  client: PoolClient,
  uid: string,
  session: string,
  kind: string,
  payload: unknown,
) {
  await client.query(
    `INSERT INTO app_private.learning_events(id,user_id,session_id,owner_seq,kind,payload,engine_version)
    SELECT $1,$2,$3,coalesce(max(owner_seq),0)+1,$4,$5,'local-fixture-v1' FROM app_private.learning_events WHERE user_id=$2`,
    [randomUUID(), uid, session, kind, JSON.stringify(payload)],
  );
}
export async function savePreferencesWithin(
  c: PoolClient,
  uid: string,
  command: PreferenceCommand,
): Promise<SavedPreferences> {
  const p = command.preferences;
  const old = (
    await c.query(
      "SELECT version FROM app_private.time_preferences WHERE user_id=$1 FOR UPDATE",
      [uid],
    )
  ).rows[0];
  if ((old?.version ?? 0) !== command.expectedVersion)
    throw new CommandError(
      409,
      "STALE_VERSION",
      "Lịch đã thay đổi. Tải lại dữ liệu trước khi chỉnh sửa.",
    );
  const result = await c.query(
    `INSERT INTO app_private.time_preferences(user_id,weekly_minutes,available_days,daily_cap,session_minutes)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET weekly_minutes=$2,available_days=$3,daily_cap=$4,session_minutes=$5,
        version=time_preferences.version+1,updated_at=now() RETURNING *`,
    [
      uid,
      Math.round(p.weeklyHours * 60),
      [...p.days].sort(),
      p.dailyCap,
      p.sessionMinutes,
    ],
  );
  return settings(result.rows[0]);
}
export class PostgresLocalRepository implements LocalLearningRepository {
  constructor(
    private pool: Pool,
    private definition?: Parameters<typeof learningSummary>[2],
    private versions?: string[],
  ) {}
  snapshot(uid: string): Promise<LocalSnapshot> {
    return ownerTransaction(this.pool, uid, async (c) => {
      const pref = (
        await c.query(
          "SELECT * FROM app_private.time_preferences WHERE user_id=$1",
          [uid],
        )
      ).rows[0];
      const session = (
        await c.query(
          "SELECT * FROM app_private.lesson_sessions WHERE user_id=$1 AND lesson_version_id=$2 ORDER BY started_at DESC,id DESC LIMIT 1",
          [uid, fixture.id],
        )
      ).rows[0];
      const answers = session
        ? ((
            await c.query(
              `SELECT exercise_version_id AS "exerciseVersionId",response,correct,occurred_at AS "occurredAt" FROM app_private.attempts WHERE user_id=$1 AND session_id=$2 ORDER BY occurred_at,id`,
              [uid, session.id],
            )
          ).rows.map((a) => ({
            ...a,
            feedback: fixtureDefinition(a.exerciseVersionId)?.feedback,
            occurredAt: new Date(a.occurredAt).toISOString(),
          })) as LocalAnswer[])
        : [];
      const counts = (
        await c.query(
          `SELECT count(*)::int AS attempts,count(*) FILTER (WHERE correct)::int AS correct FROM app_private.attempts a WHERE user_id=$1 AND ($2::text[] IS NULL OR EXISTS(SELECT 1 FROM app_private.lesson_sessions s WHERE s.user_id=a.user_id AND s.id=a.session_id AND s.lesson_version_id=ANY($2)))`,
          [uid, this.versions ?? null],
        )
      ).rows[0];
      const completed = (
        await c.query(
          "SELECT coalesce(sum(completed_sessions),0)::int AS count FROM app_private.lesson_progress WHERE user_id=$1 AND ($2::text[] IS NULL OR lesson_version_id=ANY($2))",
          [uid, this.versions ?? null],
        )
      ).rows[0];
      return {
        learning: await learningSummary(c, uid, this.definition),
        settings: pref ? settings(pref) : null,
        session: session
          ? {
              id: session.id,
              lessonVersionId: session.lesson_version_id,
              state: session.state,
              answers,
            }
          : null,
        progress: {
          attempts: counts.attempts,
          correct: counts.correct,
          completedSessions: completed.count,
        },
        source: "postgresql-local",
      };
    });
  }
  savePreferences(
    uid: string,
    key: string,
    command: PreferenceCommand,
  ): Promise<SavedPreferences> {
    return ownerTransaction(this.pool, uid, (c) =>
      once(c, uid, "preferences", key, command, async () => {
        return savePreferencesWithin(c, uid, command);
      }),
    );
  }
  start(uid: string, key: string, restart: boolean) {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        once(c, uid, "sessions", key, { restart }, async () => {
          const active = (
            await c.query(
              "SELECT id FROM app_private.lesson_sessions WHERE user_id=$1 AND lesson_version_id=$2 AND state='active'",
              [uid, fixture.id],
            )
          ).rows[0];
          if (active) return { sessionId: active.id as string };
          const previous = (
            await c.query(
              "SELECT id FROM app_private.lesson_sessions WHERE user_id=$1 AND lesson_version_id=$2 ORDER BY started_at DESC,id DESC LIMIT 1",
              [uid, fixture.id],
            )
          ).rows[0];
          if (previous && !restart) return { sessionId: previous.id as string };
          const id = randomUUID();
          await c.query(
            "INSERT INTO app_private.lesson_sessions(id,user_id,lesson_version_id) VALUES($1,$2,$3)",
            [id, uid, fixture.id],
          );
          return { sessionId: id };
        }),
      true,
    );
  }
  answer(
    uid: string,
    key: string,
    id: string,
    command: AnswerCommand,
  ): Promise<LocalAnswer> {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        once(c, uid, `sessions/${id}/answers`, key, command, async () => {
          const session = await sessionFor(c, uid, id);
          if (session.state !== "active")
            throw new CommandError(
              409,
              "SESSION_COMPLETED",
              "Phiên đã hoàn tất.",
            );
          const correct = gradeFixture(
            command.exerciseVersionId,
            command.response.choice,
          );
          if (correct === null)
            throw new CommandError(
              422,
              "UNKNOWN_EXERCISE",
              "Câu trả lời không thuộc fixture version này.",
            );
          const prior = await c.query(
            "SELECT 1 FROM app_private.attempts WHERE user_id=$1 AND session_id=$2 AND exercise_version_id=$3",
            [uid, id, command.exerciseVersionId],
          );
          if (prior.rowCount)
            throw new CommandError(
              409,
              "ANSWER_EXISTS",
              "Câu trả lời đã được lưu; tải lại để xem kết quả.",
            );
          const attemptId = randomUUID();
          const result = await c.query(
            `INSERT INTO app_private.attempts(id,user_id,session_id,exercise_version_id,response,correct,score_source)
        VALUES($1,$2,$3,$4,$5,$6,'local-fixture-v1') RETURNING occurred_at`,
            [
              attemptId,
              uid,
              id,
              command.exerciseVersionId,
              command.response,
              correct,
            ],
          );
          await event(c, uid, id, "fixture_answer", {
            exerciseVersionId: command.exerciseVersionId,
            response: command.response,
            correct,
          });
          await recordLearning(
            c,
            uid,
            attemptId,
            command.exerciseVersionId,
            correct,
            new Date(result.rows[0].occurred_at),
          );
          return {
            ...command,
            feedback: fixtureDefinition(command.exerciseVersionId)?.feedback,
            correct,
            occurredAt: new Date(result.rows[0].occurred_at).toISOString(),
          };
        }),
      true,
    );
  }
  complete(uid: string, key: string, id: string): Promise<{ completed: true }> {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        once(c, uid, `sessions/${id}/complete`, key, {}, async () => {
          const session = await sessionFor(c, uid, id);
          if (session.state === "completed")
            return { completed: true as const };
          const count = (
            await c.query(
              "SELECT count(*)::int AS n FROM app_private.attempts WHERE user_id=$1 AND session_id=$2",
              [uid, id],
            )
          ).rows[0].n;
          if (count !== fixture.exercises.length)
            throw new CommandError(
              409,
              "INCOMPLETE_SESSION",
              "Trả lời đủ các câu trước khi hoàn tất.",
            );
          await c.query(
            "UPDATE app_private.lesson_sessions SET state='completed',completed_at=now() WHERE user_id=$1 AND id=$2",
            [uid, id],
          );
          await c.query(
            `INSERT INTO app_private.lesson_progress(user_id,lesson_version_id,completed_sessions,last_session_id) VALUES($1,$2,1,$3)
        ON CONFLICT(user_id,lesson_version_id) DO UPDATE SET completed_sessions=lesson_progress.completed_sessions+1,last_session_id=$3`,
            [uid, fixture.id, id],
          );
          await event(c, uid, id, "fixture_complete", {
            fixtureVersion: fixture.id,
          });
          return { completed: true as const };
        }),
      true,
    );
  }
}
