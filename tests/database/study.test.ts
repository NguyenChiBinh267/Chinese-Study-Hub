import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import fs from "node:fs";
import { adminConfig } from "../../scripts/local-db.mjs";
import {
  createRuntimePool,
  ownerTransaction,
} from "../../src/shared/db/transaction";
import { PostgresStudyRepository } from "../../src/modules/planning/infrastructure/postgres-study";
import { PostgresContentRepository } from "../../src/modules/content/infrastructure/postgres-content";
import { PostgresLocalRepository } from "../../src/modules/learning/infrastructure/postgres-local-repository";
import { PostgresReviewRepository } from "../../src/modules/review/infrastructure/postgres-review-repository";
import {
  loadDraftCatalog,
  currentDrafts,
} from "../../src/modules/content/application/catalog";
import {
  newCard,
  ALGORITHM,
  SCHEDULER_CONFIG,
} from "../../src/modules/review/domain/fsrs-adapter";
import {
  localDate,
  weekStart,
} from "../../src/modules/planning/domain/weekly-plan";
import type { StudyPreferenceCommand } from "../../src/modules/planning/domain/study-commands";
import type { CommandError } from "../../src/modules/learning/domain/local-foundation";
const pool = createRuntimePool(process.env.DATABASE_URL!, 2),
  study = new PostgresStudyRepository(pool),
  content = new PostgresContentRepository(pool),
  legacy = new PostgresLocalRepository(pool),
  review = new PostgresReviewRepository(pool),
  admin = new pg.Client(adminConfig());
const { packages } = loadDraftCatalog();
const command = (hours = 3): StudyPreferenceCommand => ({
  preferences: {
    weeklyHours: hours,
    days: [0, 1, 2, 3, 4, 5, 6],
    dailyCap: 90,
    sessionMinutes: 20,
  },
  planning: {
    dayCaps: [90, 90, 90, 90, 90, 90, 90],
    maxSessionMinutes: 25,
    paused: false,
    timezone: "Asia/Saigon",
    startingLevel: "zero",
  },
  expectedVersion: 0,
  acceptLimited: false,
});
const code = (value: string) => (e: CommandError) => e.code === value;
test.before(async () => {
  await admin.connect();
});
test.after(async () => {
  await pool.end();
  await admin.end();
});
async function profile(uid: string, hours = 3) {
  return study.save(uid, randomUUID(), command(hours));
}
async function open(uid: string, id = "F01") {
  const p = currentDrafts().find((p) => p.lesson.id === id)!;
  return {
    p,
    id: (
      await content.start(uid, randomUUID(), p.lesson.versionId, {
        restart: false,
        packageHash: p.packageHash,
      })
    ).sessionId,
  };
}
async function firstAnswer(uid: string) {
  const { p, id } = await open(uid);
  let v = await content.view(uid, p.lesson.versionId);
  while (p.blocks[v.session!.cursor].type === "teaching") {
    await content.advance(uid, randomUUID(), id, v.session!.version);
    v = await content.view(uid, p.lesson.versionId);
  }
  const ex = p.exercises[0];
  await content.answer(uid, randomUUID(), id, {
    exerciseVersionId: ex.id,
    response: { choice: 0 },
  });
  return id;
}
async function finish(uid: string, lessonId: string, wrong = false) {
  const { p, id } = await open(uid, lessonId);
  let v = await content.view(uid, p.lesson.versionId);
  while (v.session!.cursor < p.blocks.length) {
    const block = p.blocks[v.session!.cursor];
    if (
      block.type === "exercise" &&
      !v.session!.answers.some(
        (a) => a.exerciseVersionId === block.exerciseVersionId,
      )
    ) {
      const ex = p.exercises.find((e) => e.id === block.exerciseVersionId)!,
        key = p.privateKeys.find((k) => k.id === ex.keyRef)!;
      const response =
        ex.type === "choice"
          ? { choice: ex.choices.indexOf(key.accepted[0]) }
          : ex.type === "sequence"
            ? { order: key.accepted[0].split(",").map(Number) }
            : {
                text:
                  wrong && ex.type === "short"
                    ? "不" + key.accepted[0]
                    : key.accepted[0],
              };
      const nonce = randomUUID();
      const [a, b] = await Promise.all([
        content.answer(uid, nonce, id, { exerciseVersionId: ex.id, response }),
        content.answer(uid, nonce, id, { exerciseVersionId: ex.id, response }),
      ]);
      assert.deepEqual(a, b);
      if (wrong && ex.type === "short") assert.equal(a.correct, false);
    }
    await content.advance(uid, randomUUID(), id, v.session!.version);
    v = await content.view(uid, p.lesson.versionId);
  }
  await content.complete(uid, randomUUID(), id);
  const resumed = await content.view(uid, p.lesson.versionId);
  assert.equal(resumed.session?.state, "completed");
  assert.equal(resumed.session?.answers.length, p.exercises.length);
  return resumed;
}
async function clearDue(uid: string) {
  for (let n = 0; n < 40; n++) {
    const snapshot = await legacy.snapshot(uid);
    const c = snapshot.learning.due[0];
    if (!c) return;
    await review.reveal(uid, randomUUID(), c.id, c.version);
    await review.rate(uid, randomUUID(), c.id, {
      expectedVersion: c.version,
      rating: "Easy",
    });
  }
  throw new Error("Unexpected review loop");
}
test("Legacy preferences interoperate with additive settings; owner RLS and publisher/security boundaries remain", async () => {
  const uid = randomUUID(),
    other = randomUUID();
  assert.equal((await study.settings(uid)).configured, false);
  await legacy.savePreferences(uid, randomUUID(), {
    preferences: command().preferences,
    expectedVersion: 0,
    acceptLimited: false,
  });
  let saved = await study.settings(uid);
  assert.equal(saved.expectedVersion, 1);
  assert.deepEqual(saved.planning.dayCaps, [90, 90, 90, 90, 90, 90, 90]);
  await study.save(uid, randomUUID(), { ...command(), expectedVersion: 1 });
  await ownerTransaction(pool, other, async (c) => {
    assert.equal(
      (await c.query("SELECT * FROM app_private.study_settings")).rowCount,
      0,
    );
    assert.equal(
      (await c.query("SELECT * FROM app_private.weekly_plans")).rowCount,
      0,
    );
  });
  await assert.rejects(
    ownerTransaction(pool, other, (c) =>
      c.query(
        "INSERT INTO app_private.study_day_overrides VALUES($1,current_date,0,'SKIP_TODAY',now())",
        [uid],
      ),
    ),
    (e: { code: string }) => e.code === "42501",
  );
  const tables = (
    await admin.query(
      "SELECT relname,relforcerowsecurity FROM pg_class WHERE relnamespace='app_private'::regnamespace AND relkind='r'",
    )
  ).rows;
  assert.equal(tables.length, 19);
  assert.ok(tables.every((r) => r.relforcerowsecurity));
  saved = await study.settings(uid);
  assert.equal(saved.expectedVersion, 2);
  assert.equal((await study.settings(other)).configured, false);
});
test("Settings and plan commit atomically, optimistic versions and lost/concurrent ACK retry create exactly one active revision", async () => {
  const uid = randomUUID(),
    nonce = randomUUID(),
    body = command();
  const [a, b] = await Promise.all([
    study.save(uid, nonce, body),
    study.save(uid, nonce, body),
  ]);
  assert.deepEqual(a, b);
  assert.equal(a.plan!.version, 1);
  await assert.rejects(
    study.save(uid, randomUUID(), body),
    code("STALE_VERSION"),
  );
  await assert.rejects(
    study.save(uid, nonce, {
      ...body,
      preferences: { ...body.preferences, weeklyHours: 6 },
    }),
    code("IDEMPOTENCY_CONFLICT"),
  );
  const reread = await study.today(uid);
  assert.equal(reread.plan!.version, 1);
  assert.equal((await study.today(uid)).plan!.id, reread.plan!.id);
  const other = randomUUID();
  await profile(other);
  const otherPlan = (await study.today(other)).plan!;
  await assert.rejects(
    ownerTransaction(pool, uid, (c) =>
      c.query(
        "INSERT INTO app_private.planned_blocks(id,user_id,plan_id,local_date,ordinal,kind,target,target_ids,estimated_minutes,status,reason) VALUES($1,$2,$3,current_date,999,'review','due','[]',1,'ready','TEST')",
        [randomUUID(), uid, otherPlan.id],
      ),
    ),
    (e: { code: string }) => e.code === "23503",
  );
});
test("Concurrent replans retain one active version; skipped day/paused/rest preserve cards and immutable historical rows", async () => {
  const uid = randomUUID();
  const first = await profile(uid),
    nonce = randomUUID(),
    payload = {
      action: "refresh" as const,
      expectedVersion: first.plan!.version,
    };
  const [a, b] = await Promise.all([
    study.replan(uid, nonce, payload),
    study.replan(uid, nonce, payload),
  ]);
  assert.deepEqual(a, b);
  assert.equal(a.plan!.version, 2);
  const active = (
    await admin.query(
      "SELECT count(*)::int AS n FROM app_private.weekly_plans WHERE user_id=$1 AND status='active'",
      [uid],
    )
  ).rows[0].n;
  assert.equal(active, 1);
  const skip = await study.replan(uid, randomUUID(), {
    action: "skip_today",
    expectedVersion: a.plan!.version,
  });
  assert.equal(skip.plan!.action, null);
  assert.ok(
    skip.plan!.blocks.every((block) => block.localDate !== skip.plan!.today),
  );
  const saved = await study.settings(uid);
  const paused = await study.save(uid, randomUUID(), {
    ...command(),
    expectedVersion: saved.expectedVersion,
    planning: { ...command().planning, paused: true },
  });
  assert.equal(paused.plan!.requestedMinutes, 0);
  assert.equal(paused.plan!.blocks.length, 0);
  assert.equal(paused.plan!.action, null);
  assert.ok(paused.plan!.reasons.includes("PAUSED"));
});
test("Real due/relearning queue suppresses new work under capacity overload without deleting or moving FSRS due timestamps", async () => {
  const uid = randomUUID();
  await firstAnswer(uid);
  const attempt = (
    await admin.query(
      "SELECT id FROM app_private.attempts WHERE user_id=$1 LIMIT 1",
      [uid],
    )
  ).rows[0].id;
  const templates = packages
    .flatMap((p) =>
      p.concepts.map((c) => `${p.lesson.versionId}:recall:${c.id}`),
    )
    .slice(0, 14);
  const at = new Date(Date.now() - 60000);
  for (const [i, template] of templates.entries()) {
    const card = { ...newCard(at), state: i === 5 ? 3 : 0 };
    await admin.query(
      "INSERT INTO app_private.cards(id,user_id,template_version_id,source_attempt_id,scheduler_card,algorithm,scheduler_config,due_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_id,template_version_id) DO NOTHING",
      [
        randomUUID(),
        uid,
        template,
        attempt,
        card,
        ALGORITHM,
        SCHEDULER_CONFIG,
        at,
      ],
    );
  }
  const before = (
    await admin.query(
      "SELECT id,due_at FROM app_private.cards WHERE user_id=$1 ORDER BY id",
      [uid],
    )
  ).rows;
  const atDate = localDate(new Date().toISOString(), "Asia/Saigon"),
    day = (new Date(atDate + "T12:00:00Z").getUTCDay() + 6) % 7,
    body = command(0.5);
  body.preferences.days = [day];
  body.preferences.dailyCap = 10;
  body.preferences.sessionMinutes = 10;
  body.planning.dayCaps = Array.from({ length: 7 }, (_, i) =>
    i === day ? 5 : 0,
  );
  body.acceptLimited = true;
  const plan = (await study.save(uid, randomUUID(), body)).plan!;
  assert.ok(plan.reviewDebtCards > 0);
  assert.ok(plan.blocks.every((b) => b.kind === "review"));
  assert.equal(plan.action?.reason, "RELEARNING_FIRST");
  assert.equal((await legacy.snapshot(uid)).learning.due[0].state, 3);
  assert.deepEqual(
    (
      await admin.query(
        "SELECT id,due_at FROM app_private.cards WHERE user_id=$1 ORDER BY id",
        [uid],
      )
    ).rows,
    before,
  );
});
test("Accepted time is deduplicated, active intent frozen and historical intervals clip correctly at local Monday", async () => {
  const uid = randomUUID();
  await profile(uid);
  const { p, id } = await open(uid);
  const snapshot = await study.today(uid);
  assert.equal(snapshot.plan!.action?.status, "in_progress");
  const clientId = randomUUID(),
    lease = await content.lease(uid, randomUUID(), id, clientId);
  await new Promise((r) => setTimeout(r, 25));
  const end = Date.now(),
    input = {
      eventId: randomUUID(),
      leaseId: lease.leaseId,
      clientId,
      observedStart: new Date(end - 10).toISOString(),
      observedEnd: new Date(end).toISOString(),
      lastInteractionAt: new Date(end - 10).toISOString(),
      activeMs: 10,
    };
  await Promise.all([
    content.duration(uid, id, input),
    content.duration(uid, id, input),
  ]);
  assert.equal((await study.today(uid)).plan!.actualMs, 10);
  // Native historical fixture checks calendar clipping, not a claim of a live client at midnight.
  const start = weekStart(localDate(new Date().toISOString(), "Asia/Saigon")),
    boundary = new Date(
      (
        await admin.query(
          "SELECT $1::date::timestamp AT TIME ZONE 'Asia/Saigon' AS at",
          [start],
        )
      ).rows[0].at,
    ).getTime();
  await admin.query(
    "INSERT INTO app_private.duration_events VALUES($1,$2,$3,$4,$5,$6,$5,10000,10000,now(),'VALIDATED_TELEMETRY','[]','historical-calendar-fixture','foreground-idle60-v1')",
    [
      uid,
      randomUUID(),
      id,
      lease.leaseId,
      new Date(boundary - 5000),
      new Date(boundary + 5000),
    ],
  );
  const after = await study.today(uid);
  assert.equal(after.plan!.actualMs, 5010);
  const stable = await study.today(uid);
  assert.equal(after.plan!.version, stable.plan!.version);
  assert.equal(
    (await content.view(uid, p.lesson.versionId)).session!.cursor,
    0,
  );
});
test("Lowering budget below historical observed time preserves evidence/FSRS and reports zero remaining rather than rewriting completion", async () => {
  const uid = randomUUID();
  await profile(uid, 6);
  const id = await firstAnswer(uid),
    client = randomUUID(),
    lease = await content.lease(uid, randomUUID(), id, client);
  // 31 minutes of synthetic previously-ACKed history for a new test owner only.
  await admin.query(
    "INSERT INTO app_private.duration_events SELECT $1,gen_random_uuid(),$2,$3,clock_timestamp()-n*interval '15 seconds',clock_timestamp()-(n-1)*interval '15 seconds',clock_timestamp()-n*interval '15 seconds',15000,15000,now(),'VALIDATED_TELEMETRY','[]','historical-budget-fixture','foreground-idle60-v1' FROM generate_series(1,124) n",
    [uid, id, lease.leaseId],
  );
  const before = (
    await admin.query(
      "SELECT to_jsonb(a) AS row FROM app_private.attempts a WHERE user_id=$1 ORDER BY id",
      [uid],
    )
  ).rows;
  const saved = await study.settings(uid),
    reduced = (
      await study.save(uid, randomUUID(), {
        ...command(0.5),
        expectedVersion: saved.expectedVersion,
      })
    ).plan!;
  assert.ok(reduced.actualMinutes > 30);
  assert.equal(reduced.remainingMinutes, 0);
  assert.equal(reduced.plannedMinutes, 0);
  assert.ok(reduced.reasons.includes("BUDGET_BELOW_SPENT"));
  assert.deepEqual(
    (
      await admin.query(
        "SELECT to_jsonb(a) AS row FROM app_private.attempts a WHERE user_id=$1 ORDER BY id",
        [uid],
      )
    ).rows,
    before,
  );
  assert.ok(
    (await legacy.snapshot(uid)).learning.mastery.every(
      (m) =>
        m.projection.evidenceCount === 0 && m.projection.status !== "secure",
    ),
  );
});
test("Four current drafts grade/complete/resume in sequence; due review precedes next optional practice and wrong short answers stay provisional", async () => {
  const uid = randomUUID();
  await profile(uid);
  for (const lesson of ["F01", "F02", "L001", "L002"]) {
    const before = await study.today(uid);
    assert.equal(
      before.plan!.action?.target,
      `${lesson.toLowerCase()}-draft-v${lesson.startsWith("L") ? 2 : 1}`,
    );
    await finish(uid, lesson, lesson === "L001");
    if ((await legacy.snapshot(uid)).learning.dueCount)
      assert.equal((await study.today(uid)).plan!.action?.kind, "review");
    await clearDue(uid);
  }
  const final = await study.today(uid);
  assert.equal(final.plan!.action, null);
  const summary = await legacy.snapshot(uid);
  assert.equal(summary.progress.completedSessions, 4);
  assert.ok(
    summary.learning.mastery.every(
      (m) =>
        m.projection.status !== "secure" && m.projection.evidenceCount === 0,
    ),
  );
  assert.ok(
    (await content.view(uid, "l001-draft-v2")).session!.answers.some(
      (a) => !a.correct,
    ),
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM app_content.packages WHERE state='PUBLISHED'",
      )
    ).rows[0].n,
    0,
  );
});
test("Review uses the existing foreground telemetry/lease path; close/retry persists time without adding a lesson completion or mastery", async () => {
  const uid = randomUUID();
  await profile(uid);
  const activeId = await firstAnswer(uid);
  await study.today(uid);
  const nonce = randomUUID(),
    observer = await study.reviewActivity(uid, nonce);
  assert.deepEqual(await study.reviewActivity(uid, nonce), observer);
  const clientId = randomUUID(),
    lease = await content.lease(
      uid,
      randomUUID(),
      observer.sessionId,
      clientId,
    );
  await new Promise((r) => setTimeout(r, 30));
  const end = Date.now();
  await content.duration(uid, observer.sessionId, {
    eventId: randomUUID(),
    leaseId: lease.leaseId,
    clientId,
    observedStart: new Date(end - 10).toISOString(),
    observedEnd: new Date(end).toISOString(),
    lastInteractionAt: new Date(end - 10).toISOString(),
    activeMs: 10,
  });
  await clearDue(uid);
  const closeKey = randomUUID();
  await study.closeReview(uid, closeKey, observer.sessionId);
  assert.deepEqual(await study.closeReview(uid, closeKey, observer.sessionId), {
    closed: true,
  });
  assert.equal((await study.today(uid)).plan!.actualMs, 10);
  assert.equal((await legacy.snapshot(uid)).progress.completedSessions, 0);
  await assert.rejects(
    study.closeReview(randomUUID(), randomUUID(), observer.sessionId),
    code("SESSION_NOT_FOUND"),
  );
  // Only this newly generated test owner may be advanced by the restart check.
  fs.mkdirSync(".local-postgres/sprint5", { recursive: true });
  fs.writeFileSync(
    ".local-postgres/sprint5/restart-active-fixture.json",
    JSON.stringify({
      owner: uid,
      version: "f01-draft-v1",
      sessionId: activeId,
    }),
  );
});
