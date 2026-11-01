// Sprint7 retention proof. Only the project DB and generated disposable restore
// names are accessed. Raw row hashes/backup stay ignored; never print row data.
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { adminConfig, localDirectory } from "./local-db.mjs";
const dir = path.join(localDirectory, "sprint7");
fs.mkdirSync(dir, { recursive: true });
const hash = (value) => createHash("sha256").update(value).digest("hex");
async function snapshot(c) {
  const tables = (
    await c.query(
      "SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN('app_private','app_content') ORDER BY schemaname,tablename",
    )
  ).rows;
  const result = {};
  for (const { schemaname: schema, tablename: table } of tables) {
    if (!/^[a-z_]+$/.test(table)) throw new Error("Unexpected table");
    result[`${schema}.${table}`] = (
      await c.query(`SELECT to_jsonb(t)::text AS row FROM ${schema}.${table} t`)
    ).rows
      .map((r) => hash(r.row))
      .sort();
  }
  if (
    tables.filter((t) => t.schemaname === "app_private").length !== 18 ||
    tables.filter((t) => t.schemaname === "app_content").length !== 8
  )
    throw new Error("Schema footprint changed unexpectedly");
  return result;
}
function run(binary, args, database = "csh_local") {
  const cfg = adminConfig(database);
  const result = spawnSync(
    path.join(
      process.env.CSH_PG_BIN ?? "C:/Program Files/PostgreSQL/18/bin",
      `${binary}.exe`,
    ),
    [
      "-h",
      cfg.host,
      "-p",
      String(cfg.port),
      "-U",
      cfg.user,
      "-d",
      database,
      ...args,
    ],
    {
      windowsHide: true,
      env: { ...process.env, PGPASSWORD: cfg.password },
      stdio: "pipe",
      timeout: 60000,
    },
  );
  if (result.status !== 0)
    throw new Error(
      "Private backup/restore operation failed; credentials and rows not logged",
    );
}
const c = new pg.Client(adminConfig());
await c.connect();
try {
  const action = process.argv[2];
  const baseline = path.join(dir, "baseline-rows.json"),
    restart = path.join(dir, "restart-rows.json"),
    backup = path.join(dir, "sprint6-backup.dump");
  if (action === "backup") {
    if (fs.existsSync(baseline) || fs.existsSync(backup))
      throw new Error("Do not overwrite the existing Sprint7 baseline");
    run("pg_dump", ["--format=custom", "--file", backup]);
    fs.writeFileSync(baseline, JSON.stringify(await snapshot(c)));
    fs.writeFileSync(
      path.join(dir, "backup-meta.json"),
      JSON.stringify(
        {
          source: "bb10cb4c7048d3079d7048dff211354908ffe111",
          at: new Date().toISOString(),
          bytes: fs.statSync(backup).size,
          sha256: hash(fs.readFileSync(backup)),
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS: private Sprint6 backup and complete 18 owner + 8 content table fingerprints captured.",
    );
  } else if (action === "verify") {
    const before = JSON.parse(fs.readFileSync(baseline, "utf8")),
      after = await snapshot(c);
    for (const [table, old] of Object.entries(before)) {
      const now = new Set(after[table]);
      if (old.some((row) => !now.has(row)))
        throw new Error("Original rows changed");
      if (
        table.startsWith("app_content.") &&
        JSON.stringify(old) !== JSON.stringify(after[table])
      )
        throw new Error("Immutable content/catalog changed");
    }
    console.log(
      "PASS: every original learner row retained; all eight content/catalog tables identical.",
    );
  } else if (action === "capture-restart") {
    fs.writeFileSync(restart, JSON.stringify(await snapshot(c)));
    console.log(
      "Captured current 18+8 tables before restart; no browser writes may run until verification.",
    );
  } else if (action === "verify-restart") {
    if (fs.readFileSync(restart, "utf8") !== JSON.stringify(await snapshot(c)))
      throw new Error("Restart changed rows");
    console.log(
      "PASS: PostgreSQL restart preserves all current 18+8 tables exactly.",
    );
  } else if (action === "restore-test") {
    const name = `csh_sprint7_restore_${randomUUID().replaceAll("-", "")}`;
    if (!/^csh_sprint7_restore_[a-f0-9]{32}$/.test(name))
      throw new Error("Unsafe restore target");
    const cluster = new pg.Client(adminConfig("postgres"));
    await cluster.connect();
    try {
      await cluster.query(`CREATE DATABASE ${name}`);
      run("pg_restore", ["--no-owner", "--exit-on-error", backup], name);
      const restored = new pg.Client(adminConfig(name));
      await restored.connect();
      try {
        if (
          JSON.stringify(await snapshot(restored)) !==
          fs.readFileSync(baseline, "utf8")
        )
          throw new Error("Restored rows differ");
      } finally {
        await restored.end();
      }
      console.log(
        "PASS: private backup restored into disposable DB; all 26 table fingerprints match.",
      );
    } finally {
      await cluster.query(`DROP DATABASE ${name} WITH (FORCE)`);
      await cluster.end();
    }
  } else
    throw new Error(
      "Use backup | verify | capture-restart | verify-restart | restore-test",
    );
} finally {
  await c.end();
}
