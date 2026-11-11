// Reconnect check and one checkpoint advance for an isolated DB-test owner.
// Never advances the real development owner's session. Private IDs stay ignored.
import fs from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import { adminConfig, localDirectory } from "./local-db.mjs";
import { createRuntimePool } from "../src/shared/db/transaction";
import { PostgresContentRepository } from "../src/modules/content/infrastructure/postgres-content";
import { PostgresStudyRepository } from "../src/modules/planning/infrastructure/postgres-study";
const versions = [
  "f01-draft-v1",
  "f02-draft-v1",
  "l001-draft-v2",
  "l002-draft-v2",
];
const file = path.join(localDirectory, "sprint5/restart-views.json");
async function main() {
  const pool = createRuntimePool(process.env.DATABASE_URL!, 1);
  const content = new PostgresContentRepository(pool),
    study = new PostgresStudyRepository(pool);
  const hash = (value: unknown) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex");
  async function projection(owner: string) {
    const views = [];
    for (const version of versions) {
      const view = await content.view(owner, version);
      if (view.session?.state !== "completed" || !view.session.answers.length)
        throw new Error("Missing completion/answers");
      views.push(view);
    }
    return {
      views,
      settings: await study.settings(owner),
      summary: await content.summary(owner),
    };
  }
  try {
    if (process.argv[2] === "capture") {
      const c = new pg.Client(adminConfig());
      await c.connect();
      try {
        const row = (
          await c.query(
            "SELECT user_id FROM app_private.lesson_progress WHERE lesson_version_id=ANY($1) AND completed_sessions>0 GROUP BY user_id HAVING count(DISTINCT lesson_version_id)=4 LIMIT 1",
            [versions],
          )
        ).rows[0];
        if (!row) throw new Error("Four lesson completions required");
        const active = JSON.parse(
          fs.readFileSync(
            path.join(localDirectory, "sprint5/restart-active-fixture.json"),
            "utf8",
          ),
        );
        const activeView = await content.view(active.owner, active.version);
        if (
          !activeView.session ||
          activeView.session?.id !== active.sessionId ||
          activeView.session.state !== "active" ||
          !activeView.session.answers.length
        )
          throw new Error("Isolated active fixture required");
        fs.writeFileSync(
          file,
          JSON.stringify({
            owner: row.user_id,
            hash: hash(await projection(row.user_id)),
            active: { ...active, hash: hash(activeView) },
          }),
        );
        console.log(
          "Captured four completed draft repository views, saved settings and progress before restart.",
        );
      } finally {
        await c.end();
      }
    } else if (process.argv[2] === "verify") {
      const entry = JSON.parse(fs.readFileSync(file, "utf8"));
      if (hash(await projection(entry.owner)) !== entry.hash)
        throw new Error("Projection changed");
      const before = await content.view(
        entry.active.owner,
        entry.active.version,
      );
      if (hash(before) !== entry.active.hash || !before.session)
        throw new Error("Active checkpoint changed");
      const key = randomUUID();
      const first = await content.advance(
        entry.active.owner,
        key,
        entry.active.sessionId,
        before.session.version,
      );
      const replay = await content.advance(
        entry.active.owner,
        key,
        entry.active.sessionId,
        before.session.version,
      );
      const after = await content.view(
        entry.active.owner,
        entry.active.version,
      );
      assert.deepEqual(first, replay);
      if (after.session?.cursor !== before.session.cursor + 1)
        throw new Error("Checkpoint advance/replay failed");
      console.log(
        "PASS: after real PostgreSQL restart, all four completed views/settings/progress match; an isolated unfinished checkpoint resumes and duplicate advance is idempotent.",
      );
    } else throw new Error("Use capture | verify");
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Sprint5 restart repository verification failed; no private rows logged.",
  );
  process.exitCode = 1;
});
