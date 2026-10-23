import { bindBlock } from "@/modules/planning/infrastructure/postgres-study";
import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { ownerTransaction } from "@/shared/db/transaction";
import { CommandError } from "@/modules/learning/domain/local-foundation";
import { once } from "@/modules/learning/infrastructure/postgres-local-repository";
import { databaseNow } from "@/modules/learning/infrastructure/postgres-learning";
import {
  projectMastery,
  MASTERY_ENGINE,
  type Evidence,
} from "@/modules/learning/domain/mastery";
import {
  newCard,
  ALGORITHM,
  SCHEDULER_CONFIG,
} from "@/modules/review/domain/fsrs-adapter";
import {
  loadDraftCatalog,
  currentDrafts,
  contentHash,
} from "../application/catalog";
import {
  packageSchema,
  publicProjection,
  gradeContent,
  type ContentPackage,
} from "../domain/package";
import type { DraftAnswer, DraftView } from "../domain/commands";
import {
  classifyDuration,
  type DurationInput,
} from "@/modules/learning/domain/duration";
function problem(status: number, code: string, message: string): never {
  throw new CommandError(status, code, message);
}
async function packageFor(c: PoolClient, version: string) {
  const row = (
    await c.query(
      "SELECT manifest,package_hash FROM app_content.packages WHERE version_id=$1",
      [version],
    )
  ).rows[0];
  if (!row) problem(404, "PACKAGE_NOT_FOUND", "Chưa có package local này.");
  const p = packageSchema.parse(row.manifest);
  const current = loadDraftCatalog().packages.find(
    (x) => x.lesson.versionId === version,
  );
  if (
    !current ||
    current.packageHash !== row.package_hash ||
    contentHash(p) !== row.package_hash
  )
    problem(
      409,
      "CONTENT_STALE",
      "Package/hash đã thay đổi. Không dùng đáp án mới cho phiên cũ.",
    );
  if (
    !["DRAFT", "VALIDATED", "REVIEW_PENDING"].includes(p.state) ||
    p.reviewStatus !== "DRAFT_UNREVIEWED"
  )
    problem(
      409,
      "CONTENT_STATE",
      "Luồng này chỉ dành cho draft development chưa duyệt.",
    );
  const permission = (
    await c.query(
      `SELECT l.local_draft_allowed,u.availability AS unit_state,c.availability AS course_state
    FROM app_content.lesson_versions v JOIN app_content.lessons l ON l.id=v.lesson_id
    JOIN app_content.units u ON u.id=l.unit_id JOIN app_content.courses c ON c.id=u.course_id
    WHERE v.package_id=$1 AND l.stable_key=$2`,
      [version, p.lesson.id],
    )
  ).rows[0];
  if (
    !permission?.local_draft_allowed ||
    permission.unit_state === "NOT_RELEASED" ||
    permission.course_state === "NOT_RELEASED"
  )
    problem(
      403,
      "COURSE_NOT_AVAILABLE",
      "Khóa/unit chưa cho phép luyện draft local. Lịch sử vẫn được giữ.",
    );
  return p;
}
export type ContentAccess = {
  current: () => ContentPackage[];
  packageFor: (c: PoolClient, version: string) => Promise<ContentPackage>;
  canStart: (version: string) => boolean;
  reviewStatus: "DRAFT_UNREVIEWED" | "HUMAN_REVIEWED" | "TECHNICAL_ONLY";
  summaryVersions?: () => string[];
  preserveMasteryProjection?: boolean;
  authorizeStart?: (
    c: PoolClient,
    uid: string,
    version: string,
  ) => Promise<void>;
};
const draftAccess: ContentAccess = {
  current: currentDrafts,
  packageFor,
  canStart: () => true,
  reviewStatus: "DRAFT_UNREVIEWED",
};
async function contentSession(
  c: PoolClient,
  uid: string,
  id: string,
  access: ContentAccess,
) {
  const row = (
    await c.query(
      `SELECT s.state,s.lesson_version_id,cs.* FROM app_private.lesson_sessions s JOIN app_private.content_session_state cs ON cs.user_id=s.user_id AND cs.session_id=s.id WHERE s.user_id=$1 AND s.id=$2 FOR UPDATE OF s,cs`,
      [uid, id],
    )
  ).rows[0];
  if (!row)
    problem(404, "SESSION_NOT_FOUND", "Không tìm thấy phiên học của bạn.");
  const p = await access.packageFor(c, row.package_id);
  if (
    row.lesson_version_id !== p.lesson.versionId ||
    row.package_hash !== p.packageHash
  )
    problem(409, "CONTENT_STALE", "Phiên không khớp package bất biến.");
  return { row, p };
}
async function activitySession(
  c: PoolClient,
  uid: string,
  id: string,
  access: ContentAccess,
) {
  const row = (
    await c.query(
      "SELECT * FROM app_private.lesson_sessions WHERE user_id=$1 AND id=$2 FOR UPDATE",
      [uid, id],
    )
  ).rows[0];
  if (row?.lesson_version_id === "local-review-activity-v1") return { row };
  return contentSession(c, uid, id, access);
}
async function recordEvent(
  c: PoolClient,
  uid: string,
  id: string,
  kind: string,
  payload: unknown,
) {
  await c.query(
    `INSERT INTO app_private.learning_events(id,user_id,session_id,owner_seq,kind,payload,engine_version) SELECT $1,$2,$3,coalesce(max(owner_seq),0)+1,$4,$5,'local-content-v1' FROM app_private.learning_events WHERE user_id=$2`,
    [randomUUID(), uid, id, kind, payload],
  );
}
export class PostgresContentRepository {
  constructor(
    private pool: Pool,
    private access: ContentAccess = draftAccess,
  ) {}
  library(uid: string) {
    return ownerTransaction(this.pool, uid, async (c) => {
      const packages = this.access.current();
      const entries = [];
      for (const draft of packages) {
        const p = await this.access.packageFor(c, draft.lesson.versionId);
        const progress = (
          await c.query(
            `SELECT id,state FROM app_private.lesson_sessions WHERE user_id=$1 AND lesson_version_id=$2 ORDER BY started_at DESC,id DESC LIMIT 1`,
            [uid, p.lesson.versionId],
          )
        ).rows[0];
        entries.push({
          lesson: publicProjection(p),
          sessionState: progress?.state ?? null,
        });
      }
      return entries;
    });
  }
  view(uid: string, version: string): Promise<DraftView> {
    return ownerTransaction(this.pool, uid, async (c) => {
      const p = await this.access.packageFor(c, version);
      const row = (
        await c.query(
          `SELECT s.id,s.state,cs.cursor,cs.version FROM app_private.lesson_sessions s JOIN app_private.content_session_state cs ON cs.user_id=s.user_id AND cs.session_id=s.id WHERE s.user_id=$1 AND s.lesson_version_id=$2 ORDER BY s.started_at DESC,s.id DESC LIMIT 1`,
          [uid, version],
        )
      ).rows[0];
      const answers = row
        ? (
            await c.query(
              `SELECT exercise_version_id,response,correct FROM app_private.attempts WHERE user_id=$1 AND session_id=$2 ORDER BY occurred_at,id`,
              [uid, row.id],
            )
          ).rows.map((a) => ({
            exerciseVersionId: a.exercise_version_id,
            response: a.response,
            correct: a.correct,
            feedback:
              p.privateKeys.find(
                (k) => k.exerciseVersionId === a.exercise_version_id,
              )?.feedback ?? "Phản hồi phiên bản không khả dụng.",
          }))
        : [];
      return {
        lesson: publicProjection(p),
        session: row
          ? {
              id: row.id,
              state: row.state,
              cursor: row.cursor,
              version: row.version,
              answers,
            }
          : null,
      };
    });
  }
  start(
    uid: string,
    key: string,
    version: string,
    command: { restart: boolean; packageHash: string },
  ) {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        once(c, uid, `content/${version}/start`, key, command, async () => {
          const p = await this.access.packageFor(c, version);
          if (!this.access.canStart(version))
            problem(
              403,
              "RELEASE_NOT_CURRENT",
              "Phiên bản không thuộc bản phát hành hiện tại.",
            );
          await this.access.authorizeStart?.(c, uid, version);
          if (command.packageHash !== p.packageHash)
            problem(409, "CONTENT_STALE", "Đọc lại package trước khi bắt đầu.");
          const old = (
            await c.query(
              `SELECT id,state FROM app_private.lesson_sessions WHERE user_id=$1 AND lesson_version_id=$2 ORDER BY started_at DESC,id DESC LIMIT 1`,
              [uid, version],
            )
          ).rows[0];
          if (old && (old.state === "active" || !command.restart)) {
            if (old.state === "active")
              await bindBlock(c, uid, old.id, version);
            return { sessionId: old.id as string };
          }
          const id = randomUUID();
          await c.query(
            "INSERT INTO app_private.lesson_sessions(id,user_id,lesson_version_id) VALUES($1,$2,$3)",
            [id, uid, version],
          );
          await c.query(
            "INSERT INTO app_private.content_session_state(user_id,session_id,package_id,package_hash) VALUES($1,$2,$3,$4)",
            [uid, id, version, p.packageHash],
          );
          await bindBlock(c, uid, id, version);
          return { sessionId: id };
        }),
      true,
    );
  }
  advance(uid: string, key: string, id: string, expectedVersion: number) {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        once(
          c,
          uid,
          `content/${id}/advance`,
          key,
          { expectedVersion },
          async () => {
            const { row, p } = await contentSession(c, uid, id, this.access);
            if (
              row.state !== "active" ||
              row.version !== expectedVersion ||
              row.cursor >= p.blocks.length
            )
              problem(409, "STALE_STEP", "Bước đã thay đổi. Tải lại phiên.");
            const block = p.blocks[row.cursor];
            if (
              block.type === "exercise" &&
              !(
                await c.query(
                  "SELECT 1 FROM app_private.attempts WHERE user_id=$1 AND session_id=$2 AND exercise_version_id=$3",
                  [uid, id, block.exerciseVersionId],
                )
              ).rowCount
            )
              problem(
                409,
                "ANSWER_REQUIRED",
                "Gửi câu trả lời trước khi đi tiếp.",
              );
            await c.query(
              "UPDATE app_private.content_session_state SET cursor=cursor+1,version=version+1 WHERE user_id=$1 AND session_id=$2",
              [uid, id],
            );
            return { cursor: row.cursor + 1 };
          },
        ),
      true,
    );
  }
  answer(uid: string, key: string, id: string, command: DraftAnswer) {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        once(c, uid, `content/${id}/answers`, key, command, async () => {
          const { row, p } = await contentSession(c, uid, id, this.access);
          const block = p.blocks[row.cursor];
          if (
            row.state !== "active" ||
            block?.type !== "exercise" ||
            block.exerciseVersionId !== command.exerciseVersionId
          )
            problem(
              409,
              "WRONG_STEP",
              "Câu hỏi không thuộc bước hiện tại của phiên.",
            );
          if (
            (
              await c.query(
                "SELECT 1 FROM app_private.attempts WHERE user_id=$1 AND session_id=$2 AND exercise_version_id=$3",
                [uid, id, command.exerciseVersionId],
              )
            ).rowCount
          )
            problem(
              409,
              "ANSWER_EXISTS",
              "Câu này đã lưu; đọc lại để xem phản hồi.",
            );
          let result;
          try {
            result = gradeContent(
              p,
              command.exerciseVersionId,
              command.response,
            );
          } catch {
            problem(422, "INVALID_ANSWER", "Dữ liệu không khớp loại bài tập.");
          }
          const ex = p.exercises.find(
              (e) => e.id === command.exerciseVersionId,
            )!,
            at = await databaseNow(c),
            attempt = randomUUID();
          await c.query(
            `INSERT INTO app_private.attempts(id,user_id,session_id,exercise_version_id,response,correct,score_source,occurred_at) VALUES($1,$2,$3,$4,$5,$6,'local-content-v1',$7)`,
            [attempt, uid, id, ex.id, command.response, result.correct, at],
          );
          const duration = (
            await c.query(
              `SELECT coalesce(sum(accepted_ms),0)::int AS ms,count(*) FILTER(WHERE classification='SUSPICIOUS_INVALID')::int AS invalid FROM app_private.duration_events WHERE user_id=$1 AND session_id=$2`,
              [uid, id],
            )
          ).rows[0];
          const classification =
            duration.ms > 0
              ? "VALIDATED_TELEMETRY"
              : duration.invalid > 0
                ? "SUSPICIOUS_INVALID"
                : "MISSING_INSUFFICIENT";
          await c.query(
            `INSERT INTO app_private.content_attempt_bindings VALUES($1,$2,$3,$4,$5,$6,$7,$8,$10,$9)`,
            [
              uid,
              attempt,
              p.lesson.versionId,
              p.packageHash,
              ex.id,
              result.keyVersion,
              result.normalizerVersion,
              result.gradingVersion,
              classification,
              this.access.reviewStatus,
            ],
          );
          await c.query(
            `INSERT INTO app_private.mastery_evidence(id,user_id,attempt_id,concept_id,skill,exercise_version_id,score,eligibility,assisted,occurred_at,engine_version) VALUES($1,$2,$3,$4,$5,$6,$7,$10,false,$8,$9)`,
            [
              randomUUID(),
              uid,
              attempt,
              ex.conceptId,
              ex.skill,
              ex.id,
              result.correct ? 1 : 0,
              at,
              MASTERY_ENGINE,
              this.access.reviewStatus === "HUMAN_REVIEWED"
                ? "reviewed_practice"
                : "unreviewed_fixture",
            ],
          );
          if (!this.access.preserveMasteryProjection) {
            const history = (
              await c.query(
                "SELECT * FROM app_private.mastery_evidence WHERE user_id=$1 AND concept_id=$2 AND skill=$3 ORDER BY occurred_at,id",
                [uid, ex.conceptId, ex.skill],
              )
            ).rows;
            const evidence: Evidence[] = history.map((e) => ({
              id: e.id,
              item: e.exercise_version_id,
              at: new Date(e.occurred_at).toISOString(),
              score: e.score,
              weight: 1,
              source:
                e.eligibility === "reviewed_practice"
                  ? "verified_key"
                  : "unreviewed_fixture",
              assisted: e.assisted,
              answerSeen: true,
              repeatedInSession: false,
              durationVerified: false,
              delayedProbe: false,
            }));
            const projection = projectMastery(evidence, at);
            await c.query(
              `INSERT INTO app_private.skill_mastery(user_id,concept_id,skill,projection,engine_version,version) VALUES($1,$2,$3,$4,$5,1) ON CONFLICT(user_id,concept_id,skill) DO UPDATE SET projection=$4,engine_version=$5,version=skill_mastery.version+1,updated_at=now()`,
              [uid, ex.conceptId, ex.skill, projection, MASTERY_ENGINE],
            );
          }
          // At most one card per concept in this bounded release (three F01 + six F02).
          const template = `${p.lesson.versionId}:recall:${ex.conceptId}`,
            card = newCard(at);
          await c.query(
            `INSERT INTO app_private.cards(id,user_id,template_version_id,source_attempt_id,scheduler_card,algorithm,scheduler_config,due_at) SELECT $1,$2,$3,$4,$5,$6,$7,$8 WHERE (SELECT count(*) FROM app_private.cards WHERE user_id=$2 AND created_at>=date_trunc('day',$8::timestamptz))<10 ON CONFLICT(user_id,template_version_id) DO NOTHING`,
            [
              randomUUID(),
              uid,
              template,
              attempt,
              card,
              ALGORITHM,
              SCHEDULER_CONFIG,
              card.due,
            ],
          );
          await recordEvent(c, uid, id, "content_answer", {
            exerciseVersionId: ex.id,
            packageHash: p.packageHash,
            correct: result.correct,
          });
          return {
            correct: result.correct,
            feedback: result.feedback,
            exerciseVersionId: ex.id,
            durationClassification: classification,
            independentEvidence: false,
          };
        }),
      true,
    );
  }
  complete(uid: string, key: string, id: string) {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        once(c, uid, `content/${id}/complete`, key, {}, async () => {
          const { row, p } = await contentSession(c, uid, id, this.access);
          if (row.state === "completed") return { completed: true };
          const count = (
            await c.query(
              "SELECT count(*)::int AS n FROM app_private.attempts WHERE user_id=$1 AND session_id=$2",
              [uid, id],
            )
          ).rows[0].n;
          if (row.cursor !== p.blocks.length || count !== p.exercises.length)
            problem(
              409,
              "INCOMPLETE_SESSION",
              "Đọc và trả lời đủ các bước trước khi hoàn tất luyện tập.",
            );
          await c.query(
            "UPDATE app_private.lesson_sessions SET state='completed',completed_at=clock_timestamp() WHERE user_id=$1 AND id=$2",
            [uid, id],
          );
          await c.query(
            "UPDATE app_private.planned_blocks SET status='completed' WHERE user_id=$1 AND session_id=$2 AND status='in_progress'",
            [uid, id],
          );
          await c.query(
            `INSERT INTO app_private.lesson_progress(user_id,lesson_version_id,completed_sessions,last_session_id) VALUES($1,$2,1,$3) ON CONFLICT(user_id,lesson_version_id) DO UPDATE SET completed_sessions=lesson_progress.completed_sessions+1,last_session_id=$3`,
            [uid, p.lesson.versionId, id],
          );
          await recordEvent(c, uid, id, "content_complete", {
            packageHash: p.packageHash,
            practiceOnly: true,
          });
          return { completed: true };
        }),
      true,
    );
  }
  lease(uid: string, key: string, id: string, clientId: string) {
    return ownerTransaction(
      this.pool,
      uid,
      (c) =>
        once(c, uid, `content/${id}/lease`, key, { clientId }, async () => {
          const { row } = await activitySession(c, uid, id, this.access);
          if (row.state !== "active")
            problem(409, "SESSION_COMPLETED", "Phiên đã kết thúc.");
          const at = await databaseNow(c),
            leaseId = randomUUID();
          await c.query(
            `INSERT INTO app_private.activity_leases VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id) DO UPDATE SET session_id=$2,client_id=$3,lease_id=$4,issued_at=$5,expires_at=$6`,
            [uid, id, clientId, leaseId, at, new Date(at.getTime() + 120000)],
          );
          return { leaseId, issuedAt: at.toISOString() };
        }),
      true,
    );
  }
  duration(uid: string, id: string, input: DurationInput) {
    return ownerTransaction(
      this.pool,
      uid,
      async (c) => {
        const hash = createHash("sha256")
          .update(JSON.stringify(input))
          .digest("hex");
        const old = (
          await c.query(
            "SELECT * FROM app_private.duration_events WHERE user_id=$1 AND event_id=$2",
            [uid, input.eventId],
          )
        ).rows[0];
        if (old) {
          if (old.payload_hash !== hash || old.session_id !== id)
            problem(
              409,
              "IDEMPOTENCY_CONFLICT",
              "Event ID đã dùng cho interval khác.",
            );
          return {
            classification: old.classification,
            acceptedMs: old.accepted_ms,
            reasons: old.reasons,
            duplicate: true,
          };
        }
        const { row } = await activitySession(c, uid, id, this.access);
        if (row.state !== "active")
          problem(409, "SESSION_COMPLETED", "Phiên đã kết thúc.");
        const lease = (
          await c.query(
            "SELECT * FROM app_private.activity_leases WHERE user_id=$1 AND session_id=$2 FOR UPDATE",
            [uid, id],
          )
        ).rows[0];
        if (
          !lease ||
          lease.lease_id !== input.leaseId ||
          lease.client_id !== input.clientId
        )
          problem(
            409,
            "LEASE_LOST",
            "Tab khác đang giữ lượt đo; bấm tiếp tục đo ở tab này.",
          );
        if (Date.parse(input.observedEnd) < Date.parse(input.observedStart))
          problem(422, "INTERVAL_ORDER", "Thứ tự thời gian không hợp lệ.");
        const at = await databaseNow(c);
        const overlaps = Boolean(
          (
            await c.query(
              `SELECT 1 FROM app_private.duration_events WHERE user_id=$1 AND classification='VALIDATED_TELEMETRY' AND observed_start<$3 AND observed_end>$2 LIMIT 1`,
              [uid, input.observedStart, input.observedEnd],
            )
          ).rowCount,
        );
        const result = classifyDuration(
          input,
          at,
          {
            leaseId: lease.lease_id,
            clientId: lease.client_id,
            issuedAt: new Date(lease.issued_at),
            expiresAt: new Date(lease.expires_at),
          },
          overlaps,
        );
        await c.query(
          `INSERT INTO app_private.duration_events VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            uid,
            input.eventId,
            id,
            input.leaseId,
            input.observedStart,
            input.observedEnd,
            input.lastInteractionAt,
            input.activeMs,
            result.acceptedMs,
            at,
            result.classification,
            JSON.stringify(result.reasons),
            hash,
            result.ruleVersion,
          ],
        );
        await c.query(
          "UPDATE app_private.activity_leases SET expires_at=$2 WHERE user_id=$1",
          [uid, new Date(at.getTime() + 120000)],
        );
        return { ...result, duplicate: false };
      },
      true,
    );
  }
  summary(uid: string) {
    return ownerTransaction(this.pool, uid, async (c) => {
      const versions = this.access.summaryVersions?.() ?? null;
      const durations = (
        await c.query(
          `SELECT coalesce(sum(accepted_ms),0)::bigint AS ms,count(*) FILTER(WHERE classification='SUSPICIOUS_INVALID')::int AS invalid FROM app_private.duration_events d WHERE user_id=$1 AND ($2::text[] IS NULL OR EXISTS(SELECT 1 FROM app_private.lesson_sessions s WHERE s.user_id=d.user_id AND s.id=d.session_id AND s.lesson_version_id=ANY($2)))`,
          [uid, versions],
        )
      ).rows[0];
      const lessons = (
        await c.query(
          `SELECT p.lesson_id AS "lessonId",s.lesson_version_id AS "versionId",count(*) FILTER(WHERE s.state='completed')::int AS completed FROM app_private.lesson_sessions s JOIN app_content.packages p ON p.version_id=s.lesson_version_id WHERE s.user_id=$1 AND ($2::text[] IS NULL OR s.lesson_version_id=ANY($2)) GROUP BY p.lesson_id,s.lesson_version_id ORDER BY p.lesson_id`,
          [uid, versions],
        )
      ).rows;
      return {
        observedActiveMs: Number(durations.ms),
        invalidIntervals: durations.invalid,
        lessons,
        listening: "NOT_ASSESSED",
        pronunciation: "NOT_ASSESSED",
        independentEvidence: 0,
      };
    });
  }
}
