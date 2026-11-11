// Read-only evidence for retained isolated sandboxes; never prints private rows.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { adminConfig } from "./local-db.mjs";
const [output, ...databases] = process.argv.slice(2);
if (
  !/^\.local-postgres\/hsk24\/history-(?:before|after)\.json$/.test(
    output ?? "",
  ) ||
  !databases.length ||
  databases.some((d) => !/^csh_hsk24_[a-f0-9]{12}$/.test(d))
)
  throw Error("ISOLATED_READ_ONLY_ARGUMENTS_REQUIRED");
async function main() {
  const results = [];
  for (const database of databases) {
    const c = new Client(adminConfig(database));
    await c.connect();
    try {
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const tables: Record<string, { rows: number; sha256: string }> = {};
      for (const [name, sql] of Object.entries({
        packages:
          "SELECT version_id,package_hash FROM app_content.packages ORDER BY version_id",
        attempts: "SELECT * FROM app_private.attempts ORDER BY id",
        sessions: "SELECT * FROM app_private.lesson_sessions ORDER BY id",
        cards: "SELECT * FROM app_private.cards ORDER BY id",
      })) {
        const rows = (await c.query(sql)).rows;
        tables[name] = {
          rows: rows.length,
          sha256: createHash("sha256")
            .update(JSON.stringify(rows))
            .digest("hex"),
        };
      }
      await c.query("COMMIT");
      results.push({ database, tables });
    } finally {
      await c.end();
    }
  }
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        readOnly: true,
        scope:
          "Full retained package-hash/attempt/session/card row serialization; no backup/restore claim",
        databases: results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Read-only history digests recorded for ${results.length} retained isolated databases.`,
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "History read failed");
  process.exitCode = 1;
});
