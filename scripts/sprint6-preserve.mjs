// Private backup and historical-row preservation evidence. Never logs credentials or row contents.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import { adminConfig, localDirectory, migrate } from "./local-db.mjs";
const dir = path.join(localDirectory, "sprint6");
fs.mkdirSync(dir, { recursive: true });
const bin = process.env.CSH_PG_BIN ?? "C:/Program Files/PostgreSQL/18/bin";
function run(name, args, database = "csh_local") {
  const cfg = adminConfig(database);
  const r = spawnSync(
    path.join(bin, `${name}.exe`),
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
  if (r.status !== 0)
    throw new Error(`${name} failed; private backup operation incomplete`);
}
const hash = (s) => createHash("sha256").update(s).digest("hex");
async function rows(c) {
  const tables = (
    await c.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='app_private' ORDER BY tablename",
    )
  ).rows;
  const result = {};
  for (const { tablename: t } of tables) {
    if (!/^[a-z_]+$/.test(t)) throw new Error("Unexpected table");
    result[t] = (
      await c.query(`SELECT to_jsonb(t)::text AS row FROM app_private.${t} t`)
    ).rows
      .map((r) => hash(r.row))
      .sort();
  }
  return result;
}
const action = process.argv[2];
const c = new pg.Client(adminConfig());
await c.connect();
try {
  if (action === "backup") {
    const file = path.join(dir, "sprint5-backup.dump");
    if (fs.existsSync(file))
      throw new Error("Backup exists; refusing overwrite");
    run("pg_dump", ["-Fc", "-f", file]);
    fs.writeFileSync(
      path.join(dir, "historical-rows.json"),
      JSON.stringify(await rows(c)),
    );
    fs.writeFileSync(
      path.join(dir, "backup-meta.json"),
      JSON.stringify(
        {
          source: "1d5abb3d227944a1fcbebf68b1a8f9115a518f8e",
          at: new Date().toISOString(),
          bytes: fs.statSync(file).size,
          sha256: hash(fs.readFileSync(file)),
        },
        null,
        2,
      ),
    );
    console.log(
      "Private Sprint5 backup and historical row fingerprints saved.",
    );
  } else if (action === "capture-restart" || action === "verify-restart") {
    const snapshot = { ownerTables: await rows(c), content: {} };
    for (const table of [
      "packages",
      "exercise_versions",
      "courses",
      "units",
      "lessons",
      "lesson_versions",
      "unit_prerequisites",
      "lesson_skill_prerequisites",
    ]) {
      snapshot.content[table] = (
        await c.query(
          `SELECT to_jsonb(t)::text AS row FROM app_content.${table} t`,
        )
      ).rows
        .map((r) => hash(r.row))
        .sort();
    }
    const file = path.join(dir, "restart-rows.json");
    if (action === "capture-restart") {
      fs.writeFileSync(file, JSON.stringify(snapshot));
      console.log(
        "Private pre-restart fingerprints captured: current owner tables and eight content tables.",
      );
    } else {
      if (fs.readFileSync(file, "utf8") !== JSON.stringify(snapshot))
        throw new Error("RESTART_ROW_MISMATCH");
      console.log(
        "PostgreSQL restart: all current owner tables and eight content tables match exactly, including attempts, cursor, FSRS cards/logs and duration.",
      );
    }
  } else if (action === "verify") {
    const before = JSON.parse(
        fs.readFileSync(path.join(dir, "historical-rows.json"), "utf8"),
      ),
      after = await rows(c);
    const missing = [];
    for (const [t, hashes] of Object.entries(before)) {
      const now = new Set(after[t]);
      if (hashes.some((h) => !now.has(h))) missing.push(t);
    }
    if (missing.length)
      throw new Error(`Historical rows changed: ${missing.join(",")}`);
    console.log(
      `Historical rows unchanged in ${Object.keys(before).length} original owner tables.`,
    );
  } else if (action === "restore-test" || action === "upgrade-test") {
    const name = `csh_sprint6_restore_${randomUUID().replaceAll("-", "")}`;
    const cluster = new pg.Client(adminConfig("postgres"));
    await cluster.connect();
    try {
      await cluster.query(`CREATE DATABASE ${name}`);
      run(
        "pg_restore",
        ["--exit-on-error", path.join(dir, "sprint5-backup.dump")],
        name,
      );
      const restored = new pg.Client(adminConfig(name));
      await restored.connect();
      try {
        const expected = JSON.parse(
          fs.readFileSync(path.join(dir, "historical-rows.json"), "utf8"),
        );
        const actual = await rows(restored);
        if (JSON.stringify(expected) !== JSON.stringify(actual))
          throw new Error("Restore row mismatch");
        if (action === "upgrade-test") {
          await cluster.query(
            `GRANT CREATE ON DATABASE ${name} TO csh_schema_owner`,
          );
          await migrate(name);
          const seeded = spawnSync(
            process.execPath,
            ["node_modules/tsx/dist/cli.mjs", "scripts/seed-content.ts", name],
            { windowsHide: true, stdio: "pipe", timeout: 30000 },
          );
          if (seeded.status !== 0) throw new Error("Upgrade seed failed");
          const catalog = spawnSync(
            process.execPath,
            [
              "node_modules/tsx/dist/cli.mjs",
              "scripts/seed-curriculum.ts",
              name,
            ],
            { windowsHide: true, stdio: "pipe", timeout: 30000 },
          );
          if (catalog.status !== 0)
            throw new Error("Upgrade curriculum seed failed");
          if (
            (
              await restored.query(
                "SELECT count(*)::int AS n FROM app_content.courses",
              )
            ).rows[0].n !== 5
          )
            throw new Error("Five courses required after upgrade");
          const upgraded = await rows(restored);
          for (const [t, hashes] of Object.entries(expected)) {
            const all = new Set(upgraded[t]);
            if (hashes.some((h) => !all.has(h)))
              throw new Error("Upgrade changed historical rows");
          }
          const count = (
            await restored.query(
              "SELECT count(*)::int AS n FROM app_content.packages",
            )
          ).rows[0].n;
          if (count !== 6) throw new Error("Upgrade content count mismatch");
        }
      } finally {
        await restored.end();
      }
      console.log(
        action === "upgrade-test"
          ? "Sprint5 backup restored and upgraded to Sprint6 in disposable DB; historical rows unchanged, six immutable package versions registered."
          : "Backup restored into disposable DB; all historical row fingerprints match.",
      );
    } finally {
      await cluster.query(`DROP DATABASE ${name} WITH (FORCE)`);
      await cluster.end();
    }
  } else
    throw new Error(
      "Use backup | verify | restore-test | upgrade-test | capture-restart | verify-restart",
    );
} finally {
  await c.end();
}
