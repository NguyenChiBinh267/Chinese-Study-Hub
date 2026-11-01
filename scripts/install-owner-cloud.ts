// Administrative installation for the explicitly authorized T053 only. Never
// imported by application code. No local personal records are read or uploaded.
import fs from "node:fs";
import { gzipSync } from "node:zlib";
import { Client, Pool } from "pg";
import { loadPrivatePackages } from "../src/modules/content/application/private-preview";
import { contentHash } from "../src/modules/content/application/catalog";
import { packageSchema } from "../src/modules/content/domain/package";
import { assertRuntime, migrationDigest } from "../src/shared/db/transaction";
import {
  targetSchema,
  cloudUrl,
  verifiedPgOptions,
  hash,
} from "./cloud-gates-policy";
import raw from "../content/curriculum/catalog.v1.json";
const d = ".local-postgres/cloud-gates",
  out = ".local-postgres/t053";
const read = (name: string) =>
  JSON.parse(fs.readFileSync(`${d}/${name}`, "utf8").replace(/^\uFEFF/, ""));
async function main() {
  if (process.argv[2] !== "--install-authorized-private")
    throw Error("EXPLICIT_INSTALL_REQUIRED");
  const target = targetSchema.parse(read("project.json"));
  if (target.projectRef !== "yartjbdapoyqcxfagsrj")
    throw Error("PINNED_PROJECT_REQUIRED");
  const backup = read("backup-recovery.json"),
    sql = read("cloud-sql.json");
  if (
    !backup.rowsAndDigestsMatch ||
    backup.projectRef !== target.projectRef ||
    Date.now() - Date.parse(backup.at) > 3600000 ||
    sql.passed !== 12 ||
    sql.projectRef !== target.projectRef ||
    Date.now() - Date.parse(sql.at) > 3600000
  )
    throw Error("FRESH_BACKUP_AND_SQL_EVIDENCE_REQUIRED");
  const { all } = loadPrivatePackages(),
    ca = fs.readFileSync(`${d}/supabase-ca.crt`, "utf8"),
    adminUrl = read("connection.json").adminUrl,
    runtimeUrl = read("runtime-connection.json").runtimeUrl;
  cloudUrl(adminUrl, target, true);
  cloudUrl(runtimeUrl, target);
  const admin = new Client(verifiedPgOptions(adminUrl, ca)),
    pool = new Pool({ ...verifiedPgOptions(runtimeUrl, ca), max: 1 });
  await admin.connect();
  try {
    const c = await pool.connect();
    let role;
    try {
      role = await assertRuntime(c);
    } finally {
      c.release();
    }
    await admin.query("BEGIN");
    await admin.query("SELECT pg_advisory_xact_lock(82417053)");
    async function insert(
      table: string,
      columns: string[],
      values: unknown[],
      keys: string[],
    ) {
      const where = keys
        .map((k) => `${k}=$${columns.indexOf(k) + 1}`)
        .join(" AND ");
      const old = (
        await admin.query(
          `SELECT ${columns.join(",")} FROM app_content.${table} WHERE ${where}`,
          values.slice(0, Math.max(...keys.map((k) => columns.indexOf(k))) + 1),
        )
      ).rows[0];
      if (old) {
        const canon = (x: unknown) =>
          JSON.stringify(x, (_k, v) =>
            v && typeof v === "object" && !Array.isArray(v)
              ? Object.fromEntries(
                  Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
                )
              : v,
          );
        if (canon(columns.map((k) => old[k])) !== canon(values))
          throw Error("IMMUTABLE_CONTENT_CONFLICT");
        return;
      }
      await admin.query(
        `INSERT INTO app_content.${table}(${columns.join(",")}) VALUES(${values.map((_, i) => `$${i + 1}`).join(",")})`,
        values,
      );
    }
    for (const p of all) {
      const old = (
        await admin.query(
          "SELECT manifest,package_hash,state FROM app_content.packages WHERE version_id=$1",
          [p.lesson.versionId],
        )
      ).rows[0];
      if (
        old &&
        (old.state !== "DRAFT" ||
          old.package_hash !== p.packageHash ||
          contentHash(packageSchema.parse(old.manifest)) !== p.packageHash)
      )
        throw Error("IMMUTABLE_PACKAGE_CONFLICT");
      await admin.query(
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
    }
    for (const c of raw.courses)
      await insert(
        "courses",
        [
          "id",
          "code",
          "title",
          "description",
          "ordinal",
          "syllabus_id",
          "release_ref",
          "availability",
          "coverage_verified",
        ],
        [
          c.id,
          c.code,
          c.title,
          c.description,
          c.order,
          c.syllabusId,
          c.releaseRef,
          c.availability,
          c.coverageVerified,
        ],
        ["id"],
      );
    for (const u of raw.units)
      await insert(
        "units",
        [
          "id",
          "course_id",
          "slug",
          "ordinal",
          "title",
          "objective",
          "availability",
        ],
        [
          u.id,
          u.courseId,
          u.slug,
          u.order,
          u.title,
          u.objective,
          u.availability,
        ],
        ["id"],
      );
    for (const l of raw.lessons) {
      const p = all.find((p) => p.lesson.id === l.key)!;
      await insert(
        "lessons",
        [
          "id",
          "unit_id",
          "stable_key",
          "ordinal",
          "current_version",
          "local_draft_allowed",
        ],
        [l.id, l.unitId, l.key, l.order, p.lesson.versionId, false],
        ["id"],
      );
      await insert(
        "lesson_versions",
        ["package_id", "lesson_id", "version"],
        [p.lesson.versionId, l.id, p.lesson.version],
        ["package_id"],
      );
      for (const r of l.requirements)
        await insert(
          "lesson_skill_prerequisites",
          ["lesson_id", "concept_id", "skill", "rule"],
          [l.id, r.conceptId, r.skill, r.rule],
          ["lesson_id", "concept_id", "skill"],
        );
      for (const e of p.exercises) {
        const k = p.privateKeys.find((k) => k.id === e.keyRef)!;
        await insert(
          "exercise_versions",
          [
            "id",
            "package_id",
            "key_version",
            "normalizer_version",
            "grading_version",
          ],
          [
            e.id,
            p.lesson.versionId,
            k.id,
            k.normalizerVersion,
            k.gradingVersion,
          ],
          ["id"],
        );
      }
    }
    for (const u of raw.units)
      for (const p of u.prerequisites)
        await insert(
          "unit_prerequisites",
          ["unit_id", "required_unit_id"],
          [u.id, p],
          ["unit_id", "required_unit_id"],
        );
    await admin.query(
      "INSERT INTO app_meta.runtime_proof VALUES(true,$1,$2,$3,$4) ON CONFLICT(singleton) DO UPDATE SET migration_digest=$1,database_oid=$2,runtime_oid=$3,evidence=$4",
      [
        migrationDigest(),
        role.database_oid,
        role.oid,
        {
          kind: "supabase-free-runtime-proof-v1",
          environment: "production",
          projectRef: target.projectRef,
          sqlEvidenceSha256: hash(fs.readFileSync(`${d}/cloud-sql.json`)),
          scope: "T053_PRIVATE_OWNER_PREVIEW_NOT_PUBLICATION",
          at: new Date().toISOString(),
        },
      ],
    );
    await admin.query("COMMIT");
    const bundle = gzipSync(JSON.stringify(all)).toString("base64");
    if (bundle.length > 32768) throw Error("SERVER_ENV_BUNDLE_TOO_LARGE");
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(`${out}/private-package-bundle.txt`, bundle, {
      mode: 0o600,
    });
    fs.copyFileSync(
      `${d}/backup-recovery.json`,
      `${out}/predeployment-backup.json`,
    );
    fs.writeFileSync(
      `${out}/installation.json`,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          projectRef: target.projectRef,
          packages: all.map((p) => ({
            versionId: p.lesson.versionId,
            sha256: p.packageHash,
            state: p.state,
          })),
          migrationDigest: migrationDigest(),
          serverBundleBytes: bundle.length,
          personalHistoryImported: false,
          publication: false,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS additive four-package private installation; immutable bindings, production runtime proof and protected server bundle. No personal history uploaded.",
    );
  } catch (e) {
    await admin.query("ROLLBACK");
    throw e;
  } finally {
    await admin.end();
    await pool.end();
  }
}
main().catch((e) => {
  console.error(
    /^[A-Z0-9_]+$/.test(e.message)
      ? e.message
      : (e.code ?? "PRIVATE_INSTALL_FAILED"),
  );
  process.exitCode = 1;
});
