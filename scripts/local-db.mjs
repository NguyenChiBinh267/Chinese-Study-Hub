import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const localDirectory = path.join(root, ".local-postgres");
const data = path.join(localDirectory, "data"),
  credentials = path.join(localDirectory, "credentials.json");
export const migrationFile = path.join(
  root,
  "supabase/migrations/202610170001_local_foundation.sql",
);
const digestFile = (file) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"))
    .digest("hex");
export const migrationFiles = () =>
  fs
    .readdirSync(path.join(root, "supabase/migrations"))
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
export const migrationDigest = () =>
  crypto
    .createHash("sha256")
    .update(
      migrationFiles()
        .map(
          (f) =>
            `${f}:${digestFile(path.join(root, "supabase/migrations", f))}`,
        )
        .join("\n"),
    )
    .digest("hex");
export function adminConfig(database = "csh_local") {
  const secret = JSON.parse(fs.readFileSync(credentials, "utf8"));
  return {
    host: "127.0.0.1",
    port: 5447,
    user: "csh_migrator",
    password: secret.admin,
    database,
  };
}
export async function migrate(database = "csh_local", down = false) {
  const client = new pg.Client(adminConfig(database));
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(82417001)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS public.csh_migrations(version text PRIMARY KEY, digest text NOT NULL)",
    );
    const files = migrationFiles();
    await client.query("BEGIN");
    for (const file of down ? [...files].reverse() : files) {
      const version = file.split("_")[0],
        digest = digestFile(path.join(root, "supabase/migrations", file));
      const old = await client.query(
        "SELECT digest FROM public.csh_migrations WHERE version=$1",
        [version],
      );
      if (old.rowCount && old.rows[0].digest !== digest)
        throw new Error("Applied migration checksum drift");
      if (down ? !old.rowCount : old.rowCount) continue;
      await client.query(
        fs.readFileSync(
          path.join(
            root,
            down ? "supabase/rollbacks" : "supabase/migrations",
            file,
          ),
          "utf8",
        ),
      );
      await client.query("RESET ROLE");
      if (down)
        await client.query(
          "DELETE FROM public.csh_migrations WHERE version=$1",
          [version],
        );
      else
        await client.query("INSERT INTO public.csh_migrations VALUES($1,$2)", [
          version,
          digest,
        ]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}
function binary(name) {
  const directory =
    process.env.CSH_PG_BIN ?? "C:/Program Files/PostgreSQL/18/bin";
  const file = path.join(
    directory,
    process.platform === "win32" ? `${name}.exe` : name,
  );
  if (!fs.existsSync(file))
    throw new Error(
      "PostgreSQL binary missing; set CSH_PG_BIN to your installed OSS PostgreSQL bin directory",
    );
  return file;
}
function run(name, args) {
  const r = spawnSync(binary(name), args, {
    cwd: root,
    windowsHide: true,
    // A detached Windows postmaster must not inherit a captured stdout pipe;
    // otherwise pg_ctl can exit while its caller waits on that pipe forever.
    stdio: "ignore",
    timeout: 60000,
  });
  if (r.status !== 0)
    throw new Error(
      `${name} failed (${r.status ?? r.error?.code}); inspect private .local-postgres logs`,
    );
}
async function main(action) {
  fs.mkdirSync(localDirectory, { recursive: true });
  if (action === "init") {
    if (!fs.existsSync(credentials)) {
      if (fs.existsSync(data) || fs.existsSync(path.join(root, ".env.local")))
        throw new Error(
          "Existing data/config needs reconciliation; nothing overwritten",
        );
      fs.writeFileSync(
        credentials,
        JSON.stringify({
          admin: crypto.randomBytes(32).toString("hex"),
          runtime: crypto.randomBytes(32).toString("hex"),
          cookie: crypto.randomBytes(32).toString("hex"),
        }),
        { mode: 0o600 },
      );
    }
    const s = JSON.parse(fs.readFileSync(credentials, "utf8"));
    if (!fs.existsSync(path.join(data, "PG_VERSION"))) {
      const passwordFile = path.join(localDirectory, "init-password");
      fs.writeFileSync(passwordFile, s.admin, { mode: 0o600 });
      try {
        run("initdb", [
          "-D",
          data,
          "-U",
          "csh_migrator",
          "--pwfile",
          passwordFile,
          "--auth-host=scram-sha-256",
          "--auth-local=scram-sha-256",
          "--encoding=UTF8",
          "--locale=C",
        ]);
      } finally {
        fs.unlinkSync(passwordFile);
      }
    }
    await main("start");
    const c = new pg.Client(adminConfig("postgres"));
    await c.connect();
    try {
      if (
        !(
          await c.query(
            "SELECT 1 FROM pg_roles WHERE rolname='csh_schema_owner'",
          )
        ).rowCount
      )
        await c.query(
          "CREATE ROLE csh_schema_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS",
        );
      if (
        !(await c.query("SELECT 1 FROM pg_roles WHERE rolname='csh_runtime'"))
          .rowCount
      ) {
        if (!/^[a-f0-9]{64}$/.test(s.runtime))
          throw new Error("Invalid generated runtime credential");
        await c.query(
          `CREATE ROLE csh_runtime LOGIN PASSWORD '${s.runtime}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
        );
      }
      if (
        !(await c.query("SELECT 1 FROM pg_database WHERE datname='csh_local'"))
          .rowCount
      )
        await c.query("CREATE DATABASE csh_local");
    } finally {
      await c.end();
    }
    const d = new pg.Client(adminConfig());
    await d.connect();
    try {
      await d.query("REVOKE ALL ON DATABASE csh_local FROM PUBLIC");
      await d.query("GRANT CONNECT ON DATABASE csh_local TO csh_runtime");
      await d.query("GRANT CREATE ON DATABASE csh_local TO csh_schema_owner");
    } finally {
      await d.end();
    }
    const envFile = path.join(root, ".env.local");
    const lines = `CSH_LOCAL_DATABASE=1\nCSH_APP_ORIGIN=http://127.0.0.1:3000\nCSH_LOCAL_OWNER_ID=10000000-0000-4000-8000-000000000001\nCSH_LOCAL_SESSION_SECRET=${s.cookie}\nDATABASE_URL=postgresql://csh_runtime:${s.runtime}@127.0.0.1:5447/csh_local\n`;
    if (!fs.existsSync(envFile))
      fs.writeFileSync(envFile, lines, { mode: 0o600 });
    // Windows chmod does not set ACLs. Restrict only our generated secret paths.
    if (process.platform === "win32") {
      const account = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
      for (const target of [localDirectory, envFile]) {
        const directory = target === localDirectory;
        const r = spawnSync(
          "icacls.exe",
          [
            target,
            "/inheritance:r",
            "/grant:r",
            `${account}:${directory ? "(OI)(CI)" : ""}F`,
            `SYSTEM:${directory ? "(OI)(CI)" : ""}F`,
          ],
          { windowsHide: true, stdio: "ignore" },
        );
        if (r.status !== 0) throw new Error("Cannot restrict local secret ACL");
      }
    }
    await migrate();
    console.log(
      "Local PostgreSQL initialized and migrated. Run npm run test:db before learning writes.",
    );
  } else if (action === "start") {
    if (!fs.existsSync(path.join(data, "PG_VERSION")))
      throw new Error("Initialize this project cluster first");
    const status = spawnSync(binary("pg_ctl"), ["-D", data, "status"], {
      windowsHide: true,
      stdio: "ignore",
    });
    if (status.status !== 0)
      run("pg_ctl", [
        "-D",
        data,
        "-l",
        path.join(localDirectory, "postgres.log"),
        "-o",
        "-h 127.0.0.1 -p 5447",
        "-w",
        "start",
      ]);
    console.log("Project PostgreSQL listening on 127.0.0.1:5447.");
  } else if (action === "stop") {
    run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
    console.log("Project PostgreSQL stopped.");
  } else if (action === "migrate") {
    await migrate();
    console.log("Migrations verified.");
  } else if (
    action === "rollback" &&
    process.argv.includes("--confirm-local-data-loss")
  ) {
    await migrate("csh_local", true);
    console.log("Local schema rolled back; acknowledged data removed.");
  } else
    throw new Error(
      "Use init | start | stop | migrate | rollback --confirm-local-data-loss",
    );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main(process.argv[2]).catch((e) => {
    console.error(
      e instanceof Error &&
        /missing|reconciliation|checksum|Initialize|Use |ACL|failed/.test(
          e.message,
        )
        ? e.message
        : "Local database operation failed; no credentials logged.",
    );
    process.exitCode = 1;
  });
