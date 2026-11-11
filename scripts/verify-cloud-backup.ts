// Application-schema recovery exercise only. No managed Auth data or local history.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { adminConfig } from "./local-db.mjs";
import {
  targetSchema,
  cloudUrl,
  verifiedPgOptions,
  hash,
} from "./cloud-gates-policy";
const d = ".local-postgres/cloud-gates",
  read = (n: string) =>
    JSON.parse(fs.readFileSync(`${d}/${n}`, "utf8").replace(/^\uFEFF/, ""));
async function main() {
  if (process.argv[2] !== "--verify")
    throw Error("EXPLICIT_RECOVERY_EXERCISE_REQUIRED");
  const target = targetSchema.parse(read("project.json")),
    url = read("connection.json").adminUrl;
  const u = cloudUrl(url, target, true),
    ca = fs.readFileSync(`${d}/supabase-ca.crt`, "utf8");
  const cloud = new Client(verifiedPgOptions(url, ca)),
    local = new Client(adminConfig("postgres"));
  const name =
      "csh_cloud_restore_" + randomUUID().replaceAll("-", "").slice(0, 12),
    cohort = randomUUID(),
    key = randomUUID();
  const bin = "C:/Program Files/PostgreSQL/18/bin",
    dump = path.resolve(d, "application-backup.dump");
  let created = false;
  function run(exe: string, args: string[], env: NodeJS.ProcessEnv) {
    const r = spawnSync(path.join(bin, exe + ".exe"), args, {
      env,
      windowsHide: true,
      encoding: "utf8",
      timeout: 60000,
    });
    fs.writeFileSync(`${d}/${exe}-recovery.log`, r.stderr ?? "");
    if (r.status !== 0)
      throw Error("RECOVERY_TOOL_FAILED_" + exe.toUpperCase());
  }
  async function fingerprint(c: Client) {
    await c.query("SET TIME ZONE 'UTC'");
    const rows = (
      await c.query(
        "SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('app_private','app_content','app_meta') ORDER BY schemaname,tablename",
      )
    ).rows;
    const out = [];
    for (const t of rows) {
      const r = await c.query(
        `SELECT count(*)::int AS count,md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text),'')) AS digest FROM ${t.schemaname}.${t.tablename} t`,
      );
      out.push({ ...t, ...r.rows[0] });
    }
    return out;
  }
  await cloud.connect();
  await local.connect();
  try {
    await cloud.query(
      "INSERT INTO app_private.api_idempotency VALUES($1,'cloud-backup-synthetic-v1',$2,$3,'{\"synthetic\":true}',now())",
      [cohort, key, "0".repeat(64)],
    );
    const before = await fingerprint(cloud),
      auth = (
        await cloud.query(
          "SELECT pg_get_functiondef('auth.uid()'::regprocedure) AS d",
        )
      ).rows[0].d;
    run(
      "pg_dump",
      [
        "-h",
        u.hostname,
        "-p",
        u.port,
        "-U",
        decodeURIComponent(u.username),
        "-d",
        "postgres",
        "-Fc",
        "--no-owner",
        "--schema=app_private",
        "--schema=app_content",
        "--schema=app_meta",
        "-f",
        dump,
      ],
      {
        ...process.env,
        PGPASSWORD: decodeURIComponent(u.password),
        PGSSLMODE: "verify-full",
        PGSSLROOTCERT: path.resolve(d, "supabase-ca.crt"),
      },
    );
    await local.query(`CREATE DATABASE ${name}`);
    created = true;
    const restored = new Client(adminConfig(name));
    await restored.connect();
    try {
      await restored.query("CREATE SCHEMA auth");
      await restored.query(auth);
      await restored.query(
        "GRANT USAGE ON SCHEMA auth TO csh_schema_owner,csh_runtime; GRANT EXECUTE ON FUNCTION auth.uid() TO csh_schema_owner,csh_runtime; GRANT CREATE ON DATABASE " +
          name +
          " TO csh_schema_owner",
      );
    } finally {
      await restored.end();
    }
    const cfg = adminConfig(name);
    run(
      "pg_restore",
      [
        "-h",
        cfg.host,
        "-p",
        String(cfg.port),
        "-U",
        cfg.user,
        "-d",
        name,
        "--no-owner",
        "--role=csh_schema_owner",
        "--exit-on-error",
        dump,
      ],
      { ...process.env, PGPASSWORD: cfg.password, PGSSLMODE: "disable" },
    );
    const check = new Client(adminConfig(name));
    await check.connect();
    let after;
    try {
      after = await fingerprint(check);
    } finally {
      await check.end();
    }
    fs.writeFileSync(
      `${d}/backup-fingerprints.json`,
      JSON.stringify({ before, after }, null, 2),
    );
    if (JSON.stringify(before) !== JSON.stringify(after))
      throw Error("RESTORED_APPLICATION_BYTES_DIFFER");
    fs.writeFileSync(
      `${d}/backup-recovery.json`,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          projectRef: target.projectRef,
          kind: "APPLICATION_SCHEMA_CLOUD_TO_DISPOSABLE_LOCAL_RECOVERY",
          tlsVerified: true,
          archiveSha256: hash(fs.readFileSync(dump)),
          tables: before.length,
          rowsAndDigestsMatch: true,
          syntheticReceiptRoundTrip: true,
          managedAuthRowsExported: false,
          localHistoryUploaded: false,
          fullProjectDisasterRecoveryProven: false,
          isolatedDatabaseRemoved: true,
        },
        null,
        2,
      ),
    );
    console.log(
      `PASS cloud application backup / isolated restore: ${before.length} tables, exact row digests, one synthetic receipt. Managed Auth data excluded.`,
    );
  } finally {
    await cloud
      .query(
        "DELETE FROM app_private.api_idempotency WHERE user_id=$1 AND endpoint='cloud-backup-synthetic-v1'",
        [cohort],
      )
      .catch(() => {});
    if (created) await local.query(`DROP DATABASE ${name}`);
    await cloud.end();
    await local.end();
  }
}
main().catch((e: unknown) => {
  console.error(
    (e as { code?: string }).code ??
      (e instanceof Error && /^[A-Z_]+$/.test(e.message)
        ? e.message
        : "CLOUD_BACKUP_RECOVERY_FAILED"),
  );
  process.exitCode = 1;
});
