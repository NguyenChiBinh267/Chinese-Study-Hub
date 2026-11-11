// Read-only evidence for the already selected local database, including every old row.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { adminConfig } from "./local-db.mjs";
const mode = process.argv[2];
if (!["before", "after"].includes(mode))
  throw Error("EXPECTED_BEFORE_OR_AFTER");
const pointer = JSON.parse(
  fs.readFileSync(".local-postgres/hsk24/current.json", "utf8"),
);
const state = JSON.parse(fs.readFileSync(pointer.stateFile, "utf8"));
const url = new URL(state.runtimeUrl);
if (
  !/^csh_hsk24_[a-f0-9]{12}$/.test(state.database) ||
  url.hostname !== "127.0.0.1" ||
  url.port !== "5447" ||
  url.pathname !== "/" + state.database ||
  url.username !== "csh_runtime"
)
  throw Error("SELECTED_ISOLATED_DATABASE_REQUIRED");
const run = process.argv[3] ?? "hsk4-production";
if (!/^[a-z][a-z0-9-]*$/.test(run)) throw Error("INVALID_EVIDENCE_RUN");
const filename = `.local-postgres/hsk24/${run}-before.json`;
if (mode === "before" && fs.existsSync(filename))
  throw Error("BASELINE_ALREADY_EXISTS");
const old =
  mode === "after" ? JSON.parse(fs.readFileSync(filename, "utf8")) : null;
if (old && old.database !== state.database)
  throw Error("SELECTED_DATABASE_CHANGED");
const c = new Client(adminConfig(state.database));
await c.connect();
try {
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const tables = {};
  for (const [name, sql, key] of [
    [
      "packages",
      "SELECT version_id,package_hash FROM app_content.packages ORDER BY version_id",
      "version_id",
    ],
    ["attempts", "SELECT * FROM app_private.attempts ORDER BY id", "id"],
    ["sessions", "SELECT * FROM app_private.lesson_sessions ORDER BY id", "id"],
    ["cards", "SELECT * FROM app_private.cards ORDER BY id", "id"],
  ]) {
    const rows = (await c.query(sql)).rows;
    tables[name] = Object.fromEntries(
      rows.map((row) => [
        row[key],
        createHash("sha256").update(JSON.stringify(row)).digest("hex"),
      ]),
    );
    if (old)
      for (const [id, hash] of Object.entries(old.tables[name]))
        if (tables[name][id] !== hash)
          throw Error("OLD_ROW_CHANGED:" + name + ":" + id);
  }
  await c.query("COMMIT");
  const result = {
    checkedAt: new Date().toISOString(),
    database: state.database,
    readOnly: true,
    tables,
  };
  fs.writeFileSync(
    mode === "before"
      ? filename
      : `.local-postgres/hsk24/${run}-after.json`,
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      database: state.database,
      mode,
      currentRows: Object.fromEntries(
        Object.entries(tables).map(([k, v]) => [k, Object.keys(v).length]),
      ),
      preservedOldRows: old
        ? Object.fromEntries(
            Object.entries(old.tables).map(([k, v]) => [
              k,
              Object.keys(v).length,
            ]),
          )
        : null,
    }),
  );
} finally {
  await c.end();
}
