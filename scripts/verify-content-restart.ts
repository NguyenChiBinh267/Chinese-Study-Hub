// Read-only application repository check around a real project PostgreSQL restart.
// Owner IDs and projection hashes stay in ignored local evidence, never stdout.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";
import { adminConfig, localDirectory } from "./local-db.mjs";
import { createRuntimePool } from "../src/shared/db/transaction";
import { PostgresContentRepository } from "../src/modules/content/infrastructure/postgres-content";
const file = path.join(localDirectory, "phase4/restart-views.json");
async function main() {
  const pool = createRuntimePool(process.env.DATABASE_URL!, 1);
  const repo = new PostgresContentRepository(pool);
  const action = process.argv[2];
  const hash = (value: unknown) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex");
  try {
    if (action === "capture") {
      const c = new pg.Client(adminConfig());
      await c.connect();
      try {
        const rows = (
          await c.query(
            `SELECT DISTINCT ON (lesson_version_id) user_id,lesson_version_id FROM app_private.lesson_sessions WHERE state='completed' AND lesson_version_id IN ('f01-draft-v1','f02-draft-v1') ORDER BY lesson_version_id,started_at DESC,id DESC`,
          )
        ).rows;
        if (rows.length !== 2) throw new Error("F01_F02_COMPLETIONS_REQUIRED");
        const views = [];
        for (const row of rows) {
          const view = await repo.view(row.user_id, row.lesson_version_id);
          if (
            view.session?.state !== "completed" ||
            !view.session.answers.length
          )
            throw new Error("COMPLETION_OR_ANSWERS_MISSING");
          views.push({
            owner: row.user_id,
            version: row.lesson_version_id,
            digest: hash(view),
          });
        }
        fs.writeFileSync(file, JSON.stringify(views));
        console.log(
          "Saved private F01/F02 application-read fingerprints before restart.",
        );
      } finally {
        await c.end();
      }
    } else if (action === "verify") {
      const views = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const entry of views) {
        const view = await repo.view(entry.owner, entry.version);
        if (hash(view) !== entry.digest)
          throw new Error("RESTART_APPLICATION_VIEW_CHANGED");
      }
      console.log(
        "F01/F02 application repository reconnected after PostgreSQL restart: saved completion, answers/feedback and cursor match exactly.",
      );
    } else throw new Error("Use capture | verify");
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Restart application-read verification failed; inspect local DB/config and completed F01/F02 test sessions.",
  );
  process.exitCode = 1;
});
