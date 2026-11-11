// Additive local-only installation; never updates old manifests/current pointers.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { adminConfig, migrate } from "./local-db.mjs";
import { seedContent } from "./seed-content";
import { seedCurriculum } from "./seed-curriculum";
import { loadPrivatePackages } from "../src/modules/content/application/private-preview";
import { contentHash } from "../src/modules/content/application/catalog";
import { packageSchema } from "../src/modules/content/domain/package";
import {
  assertRuntime,
  ownerTransaction,
  migrationDigest,
} from "../src/shared/db/transaction";
const dir = ".local-postgres/private-preview";
export function privateState() {
  const s = JSON.parse(fs.readFileSync(dir + "/database.json", "utf8"));
  const u = new URL(s.runtimeUrl);
  if (
    !/^csh_private_verify_[a-f0-9]{12}$/.test(s.database) ||
    u.hostname !== "127.0.0.1" ||
    u.port !== "5447" ||
    u.username !== "csh_runtime" ||
    u.pathname !== "/" + s.database
  )
    throw Error("ISOLATED_PRIVATE_DATABASE_REQUIRED");
  return s as { database: string; runtimeUrl: string; ownerId: string };
}
export async function setupPrivatePreview(
  fresh = process.argv.includes("--fresh"),
) {
  fs.mkdirSync(dir, { recursive: true });
  const auth = JSON.parse(
    fs.readFileSync(
      ".local-postgres/sprint10/auth-local/credentials.json",
      "utf8",
    ),
  );
  let s;
  if (fs.existsSync(dir + "/database.json") && !fresh) s = privateState();
  else {
    if (fs.existsSync(dir + "/database.json"))
      fs.copyFileSync(
        dir + "/database.json",
        dir + "/preserved-" + randomBytes(6).toString("hex") + ".json",
      );
    const database = "csh_private_verify_" + randomBytes(6).toString("hex"),
      secret = JSON.parse(
        fs.readFileSync(".local-postgres/credentials.json", "utf8"),
      );
    const c = new Client(adminConfig("postgres"));
    await c.connect();
    try {
      await c.query(`CREATE DATABASE ${database}`);
      await c.query(`REVOKE ALL ON DATABASE ${database} FROM PUBLIC`);
      await c.query(`GRANT CONNECT ON DATABASE ${database} TO csh_runtime`);
      await c.query(`GRANT CREATE ON DATABASE ${database} TO csh_schema_owner`);
    } finally {
      await c.end();
    }
    s = {
      database,
      ownerId: auth.owner.id,
      runtimeUrl: `postgresql://csh_runtime:${encodeURIComponent(secret.runtime)}@127.0.0.1:5447/${database}`,
    };
    fs.writeFileSync(dir + "/database.json", JSON.stringify(s, null, 2), {
      mode: 0o600,
    });
  }
  if (s.ownerId !== auth.owner.id)
    throw Error("PRESERVE_IDENTITY_BOUND_DATABASE");
  await migrate(s.database);
  await seedContent(s.database);
  await seedCurriculum(s.database);
  const c = new Client(adminConfig(s.database));
  await c.connect();
  try {
    await c.query("BEGIN");
    for (const p of loadPrivatePackages().all) {
      const old = (
        await c.query(
          "SELECT manifest,state,package_hash FROM app_content.packages WHERE version_id=$1",
          [p.lesson.versionId],
        )
      ).rows[0];
      if (
        old &&
        (old.package_hash !== p.packageHash ||
          old.state !== "DRAFT" ||
          contentHash(packageSchema.parse(old.manifest)) !== p.packageHash)
      )
        throw Error("IMMUTABLE_PACKAGE_CONFLICT");
      await c.query(
        "INSERT INTO app_content.packages VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(version_id) DO NOTHING",
        [
          p.lesson.versionId,
          p.lesson.id,
          p.release.id,
          p.packageHash,
          p,
          p.state,
        ],
      );
      const l = (
        await c.query(
          "SELECT id FROM app_content.lessons WHERE stable_key=$1",
          [p.lesson.id],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO app_content.lesson_versions VALUES($1,$2,$3) ON CONFLICT(package_id) DO NOTHING",
        [p.lesson.versionId, l.id, p.lesson.version],
      );
      const binding = (
        await c.query(
          "SELECT lesson_id,version FROM app_content.lesson_versions WHERE package_id=$1",
          [p.lesson.versionId],
        )
      ).rows[0];
      if (binding.lesson_id !== l.id || binding.version !== p.lesson.version)
        throw Error("IMMUTABLE_BINDING_CONFLICT");
      for (const e of p.exercises) {
        const k = p.privateKeys.find((k) => k.id === e.keyRef)!;
        await c.query(
          "INSERT INTO app_content.exercise_versions VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING",
          [
            e.id,
            p.lesson.versionId,
            k.id,
            k.normalizerVersion,
            k.gradingVersion,
          ],
        );
        const binding = (
          await c.query(
            "SELECT package_id,key_version,normalizer_version,grading_version FROM app_content.exercise_versions WHERE id=$1",
            [e.id],
          )
        ).rows[0];
        if (
          binding.package_id !== p.lesson.versionId ||
          binding.key_version !== k.id ||
          binding.normalizer_version !== k.normalizerVersion ||
          binding.grading_version !== k.gradingVersion
        )
          throw Error("IMMUTABLE_KEY_BINDING_CONFLICT");
      }
    }
    await c.query("COMMIT");
    const pool = new Pool({ connectionString: s.runtimeUrl, max: 1 }),
      a = randomUUID(),
      b = randomUUID();
    try {
      const runtime = await pool.connect();
      let role;
      try {
        role = await assertRuntime(runtime);
        let denied = false;
        try {
          await runtime.query(
            "UPDATE app_content.packages SET state='PUBLISHED'",
          );
        } catch (e) {
          if ((e as { code?: string }).code !== "42501") throw e;
          denied = true;
        }
        if (!denied) throw Error("RUNTIME_CAN_PUBLISH");
      } finally {
        runtime.release();
      }
      await ownerTransaction(pool, a, (cl) =>
        cl.query(
          "INSERT INTO app_private.owner_profiles(user_id,display_name) VALUES($1,'isolation probe')",
          [a],
        ),
      );
      await ownerTransaction(pool, b, async (cl) => {
        if (
          (
            await cl.query(
              "SELECT 1 FROM app_private.owner_profiles WHERE user_id=$1",
              [a],
            )
          ).rowCount
        )
          throw Error("RLS_READ_LEAK");
      });
      let denied = false;
      try {
        await ownerTransaction(pool, b, (cl) =>
          cl.query(
            "INSERT INTO app_private.owner_profiles(user_id) VALUES($1)",
            [randomUUID()],
          ),
        );
      } catch (e) {
        if ((e as { code?: string }).code !== "42501") throw e;
        denied = true;
      }
      if (!denied) throw Error("RLS_WRITE_LEAK");
      const check = await pool.connect();
      try {
        if (
          (
            await check.query(
              "SELECT count(*)::int AS n FROM app_private.owner_profiles",
            )
          ).rows[0].n !== 0
        )
          throw Error("POOLED_IDENTITY_LEAK");
      } finally {
        check.release();
      }
      await c.query(
        "INSERT INTO app_meta.runtime_proof VALUES(true,$1,$2,$3,$4) ON CONFLICT(singleton) DO UPDATE SET migration_digest=$1,database_oid=$2,runtime_oid=$3,evidence=$4",
        [
          migrationDigest(),
          role.database_oid,
          role.oid,
          {
            kind: "local-private-preview-v1",
            checks: [
              "actual-role",
              "19-FORCE-RLS",
              "runtime-cannot-publish",
              "A-B-USING-WITH-CHECK",
              "pooled-identity",
            ],
          },
        ],
      );
    } finally {
      await pool.end();
    }
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
  console.log(
    "PASS local private DRAFT packages installed additively; actual runtime/RLS isolation checked; no publication or cloud authorization.",
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  void setupPrivatePreview().catch((e) => {
    console.error(e instanceof Error ? e.message : "Private setup failed");
    process.exitCode = 1;
  });
