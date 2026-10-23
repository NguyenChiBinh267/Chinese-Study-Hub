import "server-only";
import { Pool } from "pg";
import { verifiedDatabaseOptions } from "@/shared/db/tls";
import { authConfiguration } from "./config";
import {
  assertLearningGate,
  createRuntimePool,
  ownerTransaction,
} from "@/shared/db/transaction";
import { PostgresStudyRepository } from "@/modules/planning/infrastructure/postgres-study";
import {
  once,
  savePreferencesWithin,
} from "@/modules/learning/infrastructure/postgres-local-repository";
import { allocateWeek } from "@/modules/planning/domain/weekly-plan";
import type { StudyPreferenceCommand } from "@/modules/planning/domain/study-commands";
import type { SavedStudySettings } from "@/modules/planning/domain/study-types";
import type { ProfileCommand, OwnerProfile } from "../domain/profile";

let pool: Pool | undefined;
export function authenticatedPool() {
  const cfg = authConfiguration();
  if (!pool) {
    pool =
      process.env.NODE_ENV === "development" &&
      new URL(cfg.databaseUrl).pathname === "/csh_local"
        ? createRuntimePool(cfg.databaseUrl, 2)
        : new Pool({
            ...(["127.0.0.1", "localhost", "[::1]"].includes(
              new URL(cfg.databaseUrl).hostname,
            )
              ? { connectionString: cfg.databaseUrl }
              : verifiedDatabaseOptions(
                  cfg.databaseUrl,
                  process.env.CSH_DATABASE_CA_PEM ?? "",
                )),
            max: 2,
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 5000,
            statement_timeout: 5000,
            application_name: "csh-owner-runtime",
          });
    pool.on("error", () => {});
  }
  return pool;
}
export async function assertProductionDatabase() {
  const client = await authenticatedPool().connect();
  try {
    await assertLearningGate(client);
    const proof = (
      await client.query(
        "SELECT evidence FROM app_meta.runtime_proof WHERE singleton",
      )
    ).rows[0]?.evidence;
    if (
      proof?.kind !== "supabase-free-runtime-proof-v1" ||
      proof?.environment !== "production"
    )
      throw new Error("PRODUCTION_T009_PROOF_REQUIRED");
  } finally {
    client.release();
  }
}
export function ownerSettings(uid: string) {
  return new PostgresStudyRepository(authenticatedPool()).settings(uid);
}
export function ownerProfile(uid: string): Promise<OwnerProfile> {
  return ownerTransaction(authenticatedPool(), uid, async (c) => {
    const row = (
      await c.query(
        "SELECT display_name,text_size,timezone,updated_at FROM app_private.owner_profiles WHERE user_id=$1",
        [uid],
      )
    ).rows[0];
    const schedule = (
      await c.query(
        "SELECT timezone FROM app_private.study_settings WHERE user_id=$1",
        [uid],
      )
    ).rows[0];
    return {
      userId: uid,
      displayName: row?.display_name ?? "Người học",
      textSize: row?.text_size ?? "normal",
      timezone: row?.timezone ?? "Asia/Saigon",
      scheduleTimezone: schedule?.timezone ?? null,
      updatedAt: row ? new Date(row.updated_at).toISOString() : null,
    };
  });
}
export function saveOwnerProfile(uid: string, value: ProfileCommand) {
  return ownerTransaction(authenticatedPool(), uid, async (c) => {
    await c.query(
      "INSERT INTO app_private.owner_profiles(user_id,display_name,text_size,timezone) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET display_name=$2,text_size=$3,timezone=$4,updated_at=now()",
      [uid, value.displayName, value.textSize, value.timezone],
    );
    return { saved: true };
  });
}
// Empty published catalog is intentional. DRAFT sessions/cards are never planned
// through this adapter. Reuses the existing pure allocation algorithm.
export function releasePreview(
  config: Pick<SavedStudySettings, "preferences" | "planning">,
  now = new Date().toISOString(),
) {
  return allocateWeek({
    asOf: now,
    settings: {
      weeklyMinutes: Math.round(config.preferences.weeklyHours * 60),
      days: config.preferences.days,
      preferredMinutes: config.preferences.sessionMinutes,
      ...config.planning,
      version: 1,
    },
    lessons: [],
    cards: [],
    sessions: [],
    observedByDate: {},
    overrides: {},
    frozen: [],
  });
}
export function saveOwnerSettings(
  uid: string,
  key: string,
  command: StudyPreferenceCommand,
) {
  return ownerTransaction(
    authenticatedPool(),
    uid,
    (c) =>
      once(c, uid, "owner/study/preferences", key, command, async () => {
        const saved = await savePreferencesWithin(c, uid, command),
          p = command.planning;
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
          publication: "NO_APPROVED_CONTENT",
          preview: releasePreview(command),
        };
      }),
    true,
  );
}
export function ownerProgress(uid: string) {
  return ownerTransaction(authenticatedPool(), uid, async (c) => {
    const row = (
      await c.query(
        "SELECT (SELECT count(*)::int FROM app_private.attempts WHERE user_id=$1) AS attempts,(SELECT count(*)::int FROM app_private.attempts WHERE user_id=$1 AND correct) AS correct,(SELECT coalesce(sum(completed_sessions),0)::int FROM app_private.lesson_progress WHERE user_id=$1) AS completed,(SELECT updated_at FROM app_private.time_preferences WHERE user_id=$1) AS preferences_updated_at,(SELECT count(*)::int FROM app_private.review_logs WHERE user_id=$1) AS reviews,(SELECT count(*)::int FROM app_private.cards WHERE user_id=$1) AS stored_cards",
        [uid],
      )
    ).rows[0];
    return {
      attempts: row.attempts as number,
      correct: row.correct as number,
      completedSessions: row.completed as number,
      preferencesUpdatedAt: row.preferences_updated_at
        ? new Date(row.preferences_updated_at).toISOString()
        : null,
      reviews: row.reviews as number,
      storedCards: row.stored_cards as number,
      approvedContentAvailable: false,
      assessmentValidated: false,
    };
  });
}
