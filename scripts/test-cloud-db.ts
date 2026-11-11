// Real cloud SQL checks; refuses any target except the explicitly pinned project.
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { Client, Pool } from "pg";
import {
  targetSchema,
  cloudUrl,
  verifiedPgOptions,
  hash,
} from "./cloud-gates-policy";
import { assertRuntime, ownerTransaction } from "../src/shared/db/transaction";
const dir = ".local-postgres/cloud-gates",
  read = (n: string) =>
    JSON.parse(fs.readFileSync(`${dir}/${n}`, "utf8").replace(/^\uFEFF/, ""));
async function main() {
  if (process.argv[2] !== "--verify")
    throw Error("EXPLICIT_VERIFY_ACTION_REQUIRED");
  const target = targetSchema.parse(read("project.json")),
    secret = read("runtime-connection.json"),
    adminSecret = read("connection.json"),
    ca = fs.readFileSync(`${dir}/supabase-ca.crt`, "utf8");
  if (secret.projectRef !== target.projectRef)
    throw Error("RUNTIME_TARGET_MISMATCH");
  cloudUrl(secret.runtimeUrl, target);
  cloudUrl(adminSecret.adminUrl, target, true);
  const config = verifiedPgOptions(secret.runtimeUrl, ca),
    admin = new Client({
      ...verifiedPgOptions(adminSecret.adminUrl, ca),
      connectionTimeoutMillis: 10000,
    });
  const sqlOnly = process.argv.includes("--sql-only");
  const accounts = sqlOnly
    ? {
        projectRef: target.projectRef,
        owner: { id: randomUUID() },
        nonowner: { id: randomUUID() },
      }
    : read("auth-test-accounts.json");
  if (accounts.projectRef !== target.projectRef)
    throw Error("AUTH_ACCOUNT_TARGET_MISMATCH");
  const a = accounts.owner.id as string,
    b = accounts.nonowner.id as string,
    key = randomUUID();
  assert.notEqual(a, b);
  let pool = new Pool({
    ...config,
    max: 1,
    connectionTimeoutMillis: 10000,
    statement_timeout: 5000,
  });
  const checks: string[] = [];
  async function run(name: string, f: () => Promise<void>) {
    await f();
    checks.push(name);
    console.log("PASS " + name);
  }
  await admin.connect();
  try {
    await run(
      "runtime-not-superuser-not-owner-no-bypass-no-memberships-19-force-rls",
      async () => {
        const c = await pool.connect();
        try {
          await assertRuntime(c);
          const stream = (
            c as unknown as {
              connection: {
                stream: { encrypted?: boolean; authorized?: boolean };
              };
            }
          ).connection.stream;
          assert.equal(stream.encrypted, true);
          assert.equal(stream.authorized, true);
        } finally {
          c.release();
        }
      },
    );
    await run("anonymous-database-context-fails-closed", async () => {
      const c = await pool.connect();
      try {
        assert.equal(
          (
            await c.query(
              "SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid AS uid",
            )
          ).rows[0].uid,
          null,
        );
        assert.equal(
          (await c.query("SELECT * FROM app_private.owner_profiles")).rowCount,
          0,
        );
      } finally {
        c.release();
      }
    });
    await run("owner-A-and-B-using-isolation", async () => {
      for (const id of [a, b])
        await ownerTransaction(pool, id, (c) =>
          c.query(
            "INSERT INTO app_private.owner_profiles(user_id,display_name) VALUES($1,'CLOUD_GATE_SYNTHETIC') ON CONFLICT(user_id) DO NOTHING",
            [id],
          ),
        );
      await ownerTransaction(pool, a, async (c) => {
        assert.equal(
          (
            await c.query(
              "SELECT user_id FROM app_private.owner_profiles WHERE user_id=$1",
              [a],
            )
          ).rowCount,
          1,
        );
        assert.equal(
          (
            await c.query(
              "SELECT user_id FROM app_private.owner_profiles WHERE user_id=$1",
              [b],
            )
          ).rowCount,
          0,
        );
      });
      await ownerTransaction(pool, b, async (c) => {
        assert.equal(
          (
            await c.query(
              "SELECT user_id FROM app_private.owner_profiles WHERE user_id=$1",
              [a],
            )
          ).rowCount,
          0,
        );
      });
    });
    await run("with-check-rejects-owner-spoof", async () => {
      await assert.rejects(
        ownerTransaction(pool, b, (c) =>
          c.query(
            "INSERT INTO app_private.owner_profiles(user_id) VALUES($1)",
            [randomUUID()],
          ),
        ),
        (e: unknown) => (e as { code?: string }).code === "42501",
      );
    });
    await run(
      "failed-A-transaction-B-reuse-and-anonymous-cleanup",
      async () => {
        await assert.rejects(
          ownerTransaction(pool, a, (c) => c.query("SELECT 1/0")),
          (e: unknown) => (e as { code?: string }).code === "22012",
        );
        await ownerTransaction(pool, b, async (c) => {
          assert.equal(
            (
              await c.query(
                "SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid AS uid",
              )
            ).rows[0].uid,
            b,
          );
        });
        assert.equal(
          (
            await pool.query(
              "SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid AS uid",
            )
          ).rows[0].uid,
          null,
        );
      },
    );
    await run(
      "idempotent-synthetic-transaction-and-owner-scoped-receipt",
      async () => {
        for (let i = 0; i < 2; i++)
          await ownerTransaction(pool, a, (c) =>
            c.query(
              "INSERT INTO app_private.api_idempotency(user_id,endpoint,key,payload_hash,response_json) VALUES($1,'cloud-gate-proof-v1',$2,$3,'{\"stored\":true}') ON CONFLICT DO NOTHING",
              [a, key, "0".repeat(64)],
            ),
          );
        await ownerTransaction(pool, a, async (c) => {
          assert.equal(
            (
              await c.query(
                "SELECT * FROM app_private.api_idempotency WHERE key=$1",
                [key],
              )
            ).rowCount,
            1,
          );
        });
        await ownerTransaction(pool, b, async (c) => {
          assert.equal(
            (
              await c.query(
                "SELECT * FROM app_private.api_idempotency WHERE key=$1",
                [key],
              )
            ).rowCount,
            0,
          );
        });
      },
    );
    await run(
      "append-only-evidence-and-proof-not-runtime-writable",
      async () => {
        for (const sql of [
          "UPDATE app_private.api_idempotency SET payload_hash=payload_hash",
          "DELETE FROM app_private.api_idempotency",
          "DELETE FROM app_meta.runtime_proof",
        ]) {
          await assert.rejects(
            ownerTransaction(pool, a, (c) => c.query(sql)),
            (e: unknown) => (e as { code?: string }).code === "42501",
          );
        }
      },
    );
    await run("unauthorized-api-roles-cannot-read-private-keys", async () => {
      for (const role of ["anon", "authenticated"]) {
        const c = await admin.query(
          "SELECT has_schema_privilege($1,'app_content','USAGE') AS schema,has_table_privilege($1,'app_content.exercise_versions','SELECT') AS keys",
          [role],
        );
        assert.equal(c.rows[0].schema, false);
        assert.equal(c.rows[0].keys, false);
      }
      assert.equal(
        (
          await pool.query(
            "SELECT has_table_privilege(current_user,'app_content.packages','INSERT') AS writable",
          )
        ).rows[0].writable,
        false,
      );
    });
    await run("two-client-concurrent-context-isolation", async () => {
      const two = new Pool({
        ...config,
        max: 2,
        connectionTimeoutMillis: 10000,
      });
      try {
        for (let i = 0; i < 4; i++)
          await Promise.all(
            [a, b].map((id) =>
              ownerTransaction(two, id, async (c) => {
                assert.equal(
                  (
                    await c.query(
                      "SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid AS uid,pg_sleep(0.01)",
                    )
                  ).rows[0].uid,
                  id,
                );
                assert.equal(
                  (
                    await c.query(
                      "SELECT user_id FROM app_private.owner_profiles WHERE user_id<>$1",
                      [id],
                    )
                  ).rowCount,
                  0,
                );
              }),
            ),
          );
      } finally {
        await two.end();
      }
    });
    await run("synthetic-record-survives-client-pool-restart", async () => {
      await pool.end();
      pool = new Pool({ ...config, max: 1, connectionTimeoutMillis: 10000 });
      await ownerTransaction(pool, a, async (c) => {
        assert.equal(
          (
            await c.query(
              "SELECT * FROM app_private.api_idempotency WHERE key=$1",
              [key],
            )
          ).rowCount,
          1,
        );
      });
    });
    await run("failed-schema-transaction-is-rolled-back", async () => {
      assert.equal(
        (
          await admin.query(
            "SELECT to_regclass('app_meta.csh_cloud_failure_probe') AS t",
          )
        ).rows[0].t,
        null,
      );
      await admin.query("BEGIN");
      try {
        await admin.query(
          "CREATE TABLE app_meta.csh_cloud_failure_probe(x integer CHECK(x>0))",
        );
        await assert.rejects(
          admin.query(
            "INSERT INTO app_meta.csh_cloud_failure_probe VALUES(-1)",
          ),
          (e: unknown) => (e as { code?: string }).code === "23514",
        );
      } finally {
        await admin.query("ROLLBACK");
      }
      assert.equal(
        (
          await admin.query(
            "SELECT to_regclass('app_meta.csh_cloud_failure_probe') AS t",
          )
        ).rows[0].t,
        null,
      );
    });
    await run(
      "managed-auth-unchanged-seven-immutable-migration-receipts-no-content-import",
      async () => {
        const migration = read("migration.json");
        assert.equal(
          hash(
            (
              await admin.query(
                "SELECT pg_get_functiondef('auth.uid()'::regprocedure) AS d",
              )
            ).rows[0].d,
          ),
          migration.authUidDefinitionSha256,
        );
        assert.equal(
          (await admin.query("SELECT * FROM public.csh_cloud_migrations"))
            .rowCount,
          7,
        );
        assert.equal(
          (
            await admin.query(
              "SELECT count(*)::int AS n FROM app_content.packages",
            )
          ).rows[0].n,
          0,
        );
      },
    );
  } finally {
    await pool.end();
    // Exact named synthetic cohort only; never import/export/reset native history.
    await admin.query(
      "DELETE FROM app_private.api_idempotency WHERE user_id=ANY($1::uuid[]) AND endpoint='cloud-gate-proof-v1' AND key=$2",
      [[a, b], key],
    );
    await admin.query(
      "DELETE FROM app_private.owner_profiles WHERE user_id=ANY($1::uuid[]) AND display_name='CLOUD_GATE_SYNTHETIC'",
      [[a, b]],
    );
    await admin.end();
    fs.writeFileSync(
      `${dir}/cloud-sql.json`,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          commit: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          projectRef: target.projectRef,
          environment: "supabase-cloud",
          passed: checks.length,
          expected: 12,
          checks,
          authHttpIncluded: false,
          identitySource: sqlOnly
            ? "SYNTHETIC_SQL_UUIDS_NOT_AUTH_USERS"
            : "SUPPORTED_PROVIDER_AUTH_USERS",
          productionGateStamped: false,
          personalDataImported: false,
          syntheticSqlCohortCleaned: true,
        },
        null,
        2,
      ) + "\n",
    );
  }
  assert.equal(checks.length, 12);
  console.log(
    "PASS 12 actual cloud SQL groups; Auth/HTTP and hosting gates remain separate.",
  );
}
void main().catch((e: unknown) => {
  console.error(
    (e as { code?: string })?.code ?? "CLOUD_SQL_VERIFICATION_FAILED",
  );
  process.exitCode = 1;
});
