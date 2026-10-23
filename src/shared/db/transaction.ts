import { Pool, type PoolClient } from "pg";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CommandError, uuid } from "@/modules/learning/domain/local-foundation";

export function migrationDigest() {
  return createHash("sha256")
    .update(
      fs
        .readdirSync(path.join(process.cwd(), "supabase/migrations"))
        .filter((f) => /^\d+_.*\.sql$/.test(f))
        .sort()
        .map(
          (f) =>
            `${f}:${createHash("sha256")
              .update(
                fs
                  .readFileSync(
                    path.join(process.cwd(), "supabase/migrations", f),
                    "utf8",
                  )
                  .replace(/\r\n/g, "\n"),
              )
              .digest("hex")}`,
        )
        .join("\n"),
    )
    .digest("hex");
}
export function createRuntimePool(connectionString: string, max = 3) {
  const url = new URL(connectionString);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username !== "csh_runtime" ||
    url.pathname !== "/csh_local"
  )
    throw new CommandError(
      503,
      "LOCAL_DB_CONFIG",
      "Chỉ cho phép PostgreSQL local với runtime role riêng.",
    );
  const pool = new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
    application_name: "csh-local-runtime",
  });
  // pg evicts failed idle clients; do not crash the app or log credentials when
  // the dedicated local server restarts. In-flight requests still fail visibly.
  pool.on("error", () => {});
  return pool;
}
export async function assertRuntime(client: PoolClient) {
  const role = (
    await client.query(`SELECT r.oid, r.rolname, r.rolsuper, r.rolbypassrls, r.rolcreaterole, r.rolcreatedb,
    (SELECT count(*)::int FROM pg_auth_members WHERE member=r.oid) AS memberships,
    (SELECT oid FROM pg_database WHERE datname=current_database()) AS database_oid
    FROM pg_roles r WHERE rolname=current_user`)
  ).rows[0];
  const tables = (
    await client.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app_private' AND c.relkind='r'`)
  ).rows;
  if (
    !role ||
    role.rolname !== "csh_runtime" ||
    role.rolsuper ||
    role.rolbypassrls ||
    role.rolcreaterole ||
    role.rolcreatedb ||
    role.memberships !== 0 ||
    tables.length !== 19 ||
    tables.some(
      (t) =>
        !t.relrowsecurity ||
        !t.relforcerowsecurity ||
        t.owner === "csh_runtime",
    )
  )
    throw new CommandError(
      503,
      "RLS_GATE",
      "Runtime role hoặc FORCE RLS chưa đạt kiểm tra an toàn.",
    );
  return role as { oid: number; database_oid: number };
}
export async function assertLearningGate(client: PoolClient) {
  const role = await assertRuntime(client);
  const result = await client.query(
    `SELECT 1 FROM app_meta.runtime_proof WHERE singleton AND migration_digest=$1 AND database_oid=$2 AND runtime_oid=$3`,
    [migrationDigest(), role.database_oid, role.oid],
  );
  if (result.rowCount !== 1)
    throw new CommandError(
      503,
      "RLS_PROOF_REQUIRED",
      "Chưa có runtime proof local hợp lệ. Chạy npm run test:db trước khi ghi kết quả.",
    );
}
export async function ownerTransaction<T>(
  pool: Pool,
  userId: string,
  work: (client: PoolClient) => Promise<T>,
  learningWrite = false,
): Promise<T> {
  uuid.parse(userId);
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    await assertRuntime(client);
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
      userId,
    ]);
    // One transaction/client. Serialize commands for the same owner, including
    // idempotency receipt, evidence and projection updates.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      userId,
    ]);
    if (learningWrite) await assertLearningGate(client);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      broken = true;
    }
    throw e;
  } finally {
    client.release(broken);
  }
}
