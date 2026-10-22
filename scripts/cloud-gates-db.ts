// Administrative CLI only. No imports from this file in the web application.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import {
  cloudUrl,
  targetSchema,
  hash,
  managedFoundation,
  managedPolicyCompilation,
  verifiedPgOptions,
} from "./cloud-gates-policy";

const dir = ".local-postgres/cloud-gates";
const read = (name: string) =>
  JSON.parse(
    fs.readFileSync(path.join(dir, name), "utf8").replace(/^\uFEFF/, ""),
  );
const quote = (v: string) => "'" + v.replaceAll("'", "''") + "'";
async function main() {
  if (process.argv[2] !== "migrate")
    throw Error("EXPLICIT_MIGRATE_ACTION_REQUIRED");
  const target = targetSchema.parse(read("project.json"));
  const adminUrl = read("connection.json").adminUrl as string;
  cloudUrl(adminUrl, target, true);
  const c = new Client({
    ...verifiedPgOptions(
      adminUrl,
      fs.readFileSync(path.join(dir, "supabase-ca.crt"), "utf8"),
    ),
    connectionTimeoutMillis: 10000,
    statement_timeout: 20000,
  });
  await c.connect();
  try {
    const socket = (
      c as unknown as {
        connection: { stream: { encrypted?: boolean; authorized?: boolean } };
      }
    ).connection.stream;
    if (!socket.encrypted || !socket.authorized)
      throw Error("VERIFIED_TLS_REQUIRED");
    const identity = (
      await c.query("SELECT current_database() AS db, current_user AS role")
    ).rows[0];
    if (identity.db !== "postgres" || identity.role !== "postgres")
      throw Error("MANAGED_ADMIN_BASELINE_REQUIRED");
    const authBefore = (
      await c.query(
        "SELECT pg_get_functiondef('auth.uid()'::regprocedure) AS definition",
      )
    ).rows[0].definition;
    const existing = (
      await c.query(
        "SELECT nspname FROM pg_namespace WHERE nspname IN ('app_private','app_content','app_meta')",
      )
    ).rows;
    const tracked = (
      await c.query(
        "SELECT to_regclass('public.csh_cloud_migrations') AS tracked",
      )
    ).rows[0].tracked;
    if (existing.length && !tracked)
      throw Error("UNRECOGNIZED_EXISTING_APPLICATION_SCHEMA");
    console.log("Cloud baseline and managed auth verified.");
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(82417001)");
    let secret = fs.existsSync(path.join(dir, "runtime.json"))
      ? read("runtime.json")
      : null;
    if (secret && secret.projectRef !== target.projectRef)
      throw Error("RUNTIME_SECRET_TARGET_MISMATCH");
    for (const role of ["csh_schema_owner", "csh_runtime"]) {
      console.log(`Checking restricted role: ${role}`);
      const old = (
        await c.query(
          "SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolcanlogin FROM pg_roles WHERE rolname=$1",
          [role],
        )
      ).rows[0];
      if (old) {
        if (role === "csh_runtime" && !secret)
          throw Error("EXISTING_RUNTIME_CREDENTIAL_REQUIRED");
        if (
          old.rolsuper ||
          old.rolbypassrls ||
          old.rolcreaterole ||
          old.rolcreatedb ||
          old.rolcanlogin !== (role === "csh_runtime") ||
          !tracked
        )
          throw Error("UNRECOGNIZED_EXISTING_ROLE");
      } else if (role === "csh_schema_owner") {
        await c.query(
          "CREATE ROLE csh_schema_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS",
        );
      } else {
        if (!secret) {
          secret = {
            projectRef: target.projectRef,
            password: randomBytes(32).toString("base64url"),
          };
          // Keep the same credential when a failed migration transaction retries.
          fs.writeFileSync(
            path.join(dir, "runtime.json"),
            JSON.stringify(secret),
            { flag: "wx", mode: 0o600 },
          );
        }
        await c.query(
          `CREATE ROLE csh_runtime LOGIN PASSWORD ${quote(secret.password)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
        );
      }
    }
    console.log("Applying schema-owner and managed-auth grants.");
    await c.query("GRANT csh_schema_owner TO postgres");
    await c.query("GRANT CREATE ON DATABASE postgres TO csh_schema_owner");
    await c.query("GRANT CONNECT ON DATABASE postgres TO csh_runtime");
    await c.query("REVOKE ALL ON SCHEMA public FROM PUBLIC");
    if (
      !(
        await c.query(
          "SELECT has_function_privilege('csh_runtime','auth.uid()','EXECUTE') AS allowed",
        )
      ).rows[0].allowed
    )
      throw Error("MANAGED_UID_EXECUTION_NOT_AVAILABLE");
    await c.query(
      "CREATE TABLE IF NOT EXISTS public.csh_cloud_migrations(version text PRIMARY KEY,source_sha256 text NOT NULL,executed_sha256 text NOT NULL,adaptation text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    await c.query(
      "REVOKE ALL ON public.csh_cloud_migrations FROM PUBLIC,anon,authenticated,csh_runtime",
    );
    const applied = [];
    for (const file of fs
      .readdirSync("supabase/migrations")
      .filter((n) => /^\d+_.*\.sql$/.test(n))
      .sort()) {
      const source = fs
        .readFileSync(path.join("supabase/migrations", file), "utf8")
        .replace(/\r\n/g, "\n");
      const sql = managedPolicyCompilation(
        file === "202610170001_local_foundation.sql"
          ? managedFoundation(source)
          : source,
      );
      const version = file.split("_")[0],
        sourceHash = hash(source),
        executedHash = hash(sql);
      console.log(`Checking migration: ${file}`);
      const old = (
        await c.query(
          "SELECT source_sha256,executed_sha256 FROM public.csh_cloud_migrations WHERE version=$1",
          [version],
        )
      ).rows[0];
      if (old) {
        if (
          old.source_sha256 !== sourceHash ||
          old.executed_sha256 !== executedHash
        )
          throw Error("MIGRATION_CHECKSUM_DRIFT");
        continue;
      }
      await c.query(sql);
      await c.query("RESET ROLE");
      await c.query(
        "INSERT INTO public.csh_cloud_migrations(version,source_sha256,executed_sha256,adaptation) VALUES($1,$2,$3,$4)",
        [
          version,
          sourceHash,
          executedHash,
          sql === source ? "none" : "managed-auth-policy-compilation-v1",
        ],
      );
      applied.push(file);
    }
    const authAfter = (
      await c.query(
        "SELECT pg_get_functiondef('auth.uid()'::regprocedure) AS definition",
      )
    ).rows[0].definition;
    if (authBefore !== authAfter)
      throw Error("MANAGED_AUTH_DEFINITION_CHANGED");
    await c.query("COMMIT");
    const runtimeUrl = new URL(adminUrl);
    runtimeUrl.username = `csh_runtime.${target.projectRef}`;
    runtimeUrl.password = secret.password;
    runtimeUrl.port = "6543";
    cloudUrl(runtimeUrl.href, target);
    fs.writeFileSync(
      path.join(dir, "runtime-connection.json"),
      JSON.stringify({
        projectRef: target.projectRef,
        runtimeUrl: runtimeUrl.href,
      }),
      { mode: 0o600 },
    );
    fs.writeFileSync(
      path.join(dir, "migration.json"),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          projectRef: target.projectRef,
          applied,
          managedAuthUnchanged: true,
          authUidDefinitionSha256: hash(authAfter),
          tlsVerified: true,
          personalDataImported: false,
          contentPackagesImported: 0,
        },
        null,
        2,
      ),
    );
    console.log(
      `PASS managed cloud migration: ${applied.length} applied; managed Auth retained; no local history/content imported.`,
    );
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}
void main().catch((e: unknown) => {
  const code =
    e instanceof Error && /^[A-Z0-9_]+$/.test(e.message)
      ? e.message
      : ((e as { code?: string })?.code ?? "CLOUD_MIGRATION_FAILED");
  console.error(code);
  if (code === "42501" && e instanceof Error)
    console.error(e.message.replace(/password[^\n]*/gi, "[redacted]"));
  process.exitCode = 1;
});
