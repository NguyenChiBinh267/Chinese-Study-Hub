import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { fixtureDefinition, templateDefinition } from "../server/local-fixture";
import {
  projectMastery,
  MASTERY_ENGINE,
  type Evidence,
} from "../domain/mastery";
import {
  ALGORITHM,
  SCHEDULER_CONFIG,
  newCard,
} from "../../review/domain/fsrs-adapter";
import type {
  LearningSummary,
  DueCard,
} from "../../review/domain/local-review";

export async function databaseNow(c: PoolClient): Promise<Date> {
  return new Date(
    (await c.query("SELECT clock_timestamp() AS now")).rows[0].now,
  );
}
export async function recordLearning(
  c: PoolClient,
  uid: string,
  attemptId: string,
  item: string,
  correct: boolean,
  at: Date,
) {
  const def = fixtureDefinition(item);
  if (!def) throw new Error("No controlled fixture definition");
  await c.query(
    `INSERT INTO app_private.mastery_evidence(id,user_id,attempt_id,concept_id,skill,exercise_version_id,score,eligibility,assisted,occurred_at,engine_version)
    VALUES($1,$2,$3,$4,$5,$6,$7,'unreviewed_fixture',false,$8,$9)`,
    [
      randomUUID(),
      uid,
      attemptId,
      def.conceptId,
      def.skill,
      item,
      correct ? 1 : 0,
      at,
      MASTERY_ENGINE,
    ],
  );
  const history = (
    await c.query(
      `SELECT * FROM app_private.mastery_evidence WHERE user_id=$1 AND concept_id=$2 AND skill=$3 ORDER BY occurred_at,id`,
      [uid, def.conceptId, def.skill],
    )
  ).rows;
  const evidence: Evidence[] = history.map((e) => ({
    id: e.id,
    item: e.exercise_version_id,
    at: new Date(e.occurred_at).toISOString(),
    score: e.score,
    weight: 1,
    source: "unreviewed_fixture",
    assisted: e.assisted,
    answerSeen: false,
    repeatedInSession: false,
    durationVerified: false,
    delayedProbe: false,
  }));
  const projection = projectMastery(evidence, at);
  await c.query(
    `INSERT INTO app_private.skill_mastery(user_id,concept_id,skill,projection,engine_version,version) VALUES($1,$2,$3,$4,$5,1)
    ON CONFLICT(user_id,concept_id,skill) DO UPDATE SET projection=$4,engine_version=$5,version=skill_mastery.version+1,updated_at=now()`,
    [uid, def.conceptId, def.skill, projection, MASTERY_ENGINE],
  );
  const card = newCard(at);
  // Two explicitly defined, distinct concepts only. No arbitrary/generated
  // templates or backfill of historical answers. Always below new-card cap10.
  await c.query(
    `INSERT INTO app_private.cards(id,user_id,template_version_id,source_attempt_id,scheduler_card,algorithm,scheduler_config,due_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_id,template_version_id) DO NOTHING`,
    [
      randomUUID(),
      uid,
      def.templateVersionId,
      attemptId,
      card,
      ALGORITHM,
      SCHEDULER_CONFIG,
      card.due,
    ],
  );
}
export async function learningSummary(
  c: PoolClient,
  uid: string,
  definition = templateDefinition,
): Promise<LearningSummary> {
  const now = await databaseNow(c);
  const rows = (
    await c.query(
      `SELECT id,template_version_id,version,due_at,scheduler_card FROM app_private.cards WHERE user_id=$1 AND due_at<=$2 ORDER BY CASE WHEN (scheduler_card->>'state')::int=3 THEN 0 ELSE 1 END,due_at,id LIMIT 20`,
      [uid, now],
    )
  ).rows;
  const scoped =
    definition === templateDefinition
      ? null
      : (
          await c.query(
            "SELECT id,template_version_id,version,due_at,scheduler_card FROM app_private.cards WHERE user_id=$1 ORDER BY due_at,id",
            [uid],
          )
        ).rows.filter((r) => definition(r.template_version_id));
  const dueRows = scoped
    ? scoped.filter((r) => new Date(r.due_at) <= now)
    : rows;
  const due: DueCard[] = dueRows.slice(0, 20).map((r) => ({
    id: r.id,
    templateVersionId: r.template_version_id,
    version: r.version,
    prompt:
      definition(r.template_version_id)?.prompt ??
      "Định nghĩa thẻ không khả dụng",
    dueAt: new Date(r.due_at).toISOString(),
    state: r.scheduler_card.state,
    reps: r.scheduler_card.reps,
    lapses: r.scheduler_card.lapses,
  }));
  const counts = (
    await c.query(
      `SELECT count(*) FILTER(WHERE due_at<=$2)::int AS due,min(due_at) FILTER(WHERE due_at>$2) AS next FROM app_private.cards WHERE user_id=$1`,
      [uid, now],
    )
  ).rows[0];
  const reviews = (
    await c.query(
      "SELECT count(*)::int AS n FROM app_private.review_logs WHERE user_id=$1 AND ($2::uuid[] IS NULL OR card_id=ANY($2))",
      [uid, scoped ? scoped.map((r) => r.id) : null],
    )
  ).rows[0].n;
  const mastery = (
    await c.query(
      `SELECT concept_id AS "conceptId",skill,projection FROM app_private.skill_mastery WHERE user_id=$1 ORDER BY concept_id,skill`,
      [uid],
    )
  ).rows;
  return {
    due,
    dueCount: scoped ? dueRows.length : counts.due,
    nextDueAt: scoped
      ? scoped.find((r) => new Date(r.due_at) > now)
        ? new Date(
            scoped.find((r) => new Date(r.due_at) > now)!.due_at,
          ).toISOString()
        : null
      : counts.next
        ? new Date(counts.next).toISOString()
        : null,
    reviews,
    mastery,
  };
}
