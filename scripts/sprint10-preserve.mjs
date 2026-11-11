// Private native-PostgreSQL backup and row preservation. No voice or row data logged.
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { adminConfig, localDirectory } from "./local-db.mjs";
const dir = path.join(localDirectory, "sprint10");
fs.mkdirSync(dir, { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function snapshot(c) {
  const out = {};
  for (const { schemaname: s, tablename: t } of (
    await c.query(
      "SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN('app_private','app_content') ORDER BY schemaname,tablename",
    )
  ).rows) {
    if (!/^[a-z_]+$/.test(t)) throw Error("Unexpected identifier");
    out[s + "." + t] = (
      await c.query(`SELECT to_jsonb(t)::text AS row FROM ${s}.${t} t`)
    ).rows
      .map((r) => hash(r.row))
      .sort();
  }
  return out;
}
function run(name, args, database = "csh_local") {
  const cfg = adminConfig(database);
  const result = spawnSync(
    path.join(
      process.env.CSH_PG_BIN ?? "C:/Program Files/PostgreSQL/18/bin",
      name + ".exe",
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
    throw Error(
      "Private backup/restore failed; no credentials or rows printed",
    );
}
const dump = path.join(dir, "pre-auth-backup.dump"),
  baseline = path.join(dir, "pre-auth-rows.json"),
  action = process.argv[2];
const client = new pg.Client(adminConfig());
await client.connect();
try {
  if (action === "backup") {
    if (fs.existsSync(dump) || fs.existsSync(baseline))
      throw Error("Preserve existing backup");
    const before = await snapshot(client);
    if (Object.keys(before).length !== 26)
      throw Error("Expected pre-Sprint10 footprint");
    run("pg_dump", ["-Fc", "-f", dump]);
    fs.writeFileSync(baseline, JSON.stringify(before));
    fs.writeFileSync(
      path.join(dir, "backup-meta.json"),
      JSON.stringify(
        {
          source: "6115ce4",
          at: new Date().toISOString(),
          bytes: fs.statSync(dump).size,
          sha256: hash(fs.readFileSync(dump)),
          tables: 26,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS private backup: 26-table pre-auth snapshot saved, no row data printed.",
    );
  } else if (action === "verify") {
    const before = JSON.parse(fs.readFileSync(baseline)),
      after = await snapshot(client);
    for (const [table, rows] of Object.entries(before)) {
      const now = new Set(after[table]);
      if (rows.some((r) => !now.has(r))) throw Error("Original row changed");
      if (
        table.startsWith("app_content.") &&
        JSON.stringify(rows) !== JSON.stringify(after[table])
      )
        throw Error("Content changed");
    }
    if (Object.keys(after).length !== 27)
      throw Error("Expected only one additive profile table");
    console.log(
      "PASS all original rows retained across 26 tables; 8 content/catalog tables identical; one profile table added.",
    );
  } else if (action === "restore-test") {
    const name = "csh_sprint10_restore_" + randomUUID().replaceAll("-", "");
    if (!/^csh_sprint10_restore_[a-f0-9]{32}$/.test(name))
      throw Error("Unsafe disposable database");
    const cluster = new pg.Client(adminConfig("postgres"));
    await cluster.connect();
    try {
      await cluster.query(`CREATE DATABASE ${name}`);
      await cluster.query(
        `GRANT CREATE ON DATABASE ${name} TO csh_schema_owner`,
      );
      run("pg_restore", ["--exit-on-error", dump], name);
      const c = new pg.Client(adminConfig(name));
      await c.connect();
      try {
        if (
          JSON.stringify(await snapshot(c)) !==
          fs.readFileSync(baseline, "utf8")
        )
          throw Error("Restore differs");
      } finally {
        await c.end();
      }
      console.log(
        "PASS backup restored into a disposable database; original 26 table fingerprints match.",
      );
    } finally {
      await cluster.query(`DROP DATABASE ${name} WITH (FORCE)`);
      await cluster.end();
    }
  } else throw Error("Use backup | verify | restore-test");
} finally {
  await client.end();
}
