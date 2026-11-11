import { validateAssetHashes } from "./validate-content-assets";
// Explicit local migration credential, never imported by application routes.
import pg from "pg";
import { adminConfig } from "./local-db.mjs";
import { loadDraftCatalog } from "../src/modules/content/application/catalog";
import { transition } from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
export async function seedContent(database = "csh_local") {
  if (expansionEnabled() && !/^csh_hsk24_[a-f0-9]{12}$/.test(database))
    throw Error("ISOLATED_CURRICULUM_DATABASE_REQUIRED");
  const { packages, evidence } = loadDraftCatalog();
  const assetIssues = packages.flatMap((p) => validateAssetHashes(p));
  if (assetIssues.length) throw new Error(JSON.stringify(assetIssues));
  const c = new pg.Client(adminConfig(database));
  await c.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(82417004)");
    for (const p of packages) {
      if (p.state === "REVIEW_PENDING")
        transition(
          transition({ ...p, state: "DRAFT" }, "VALIDATED", {
            catalog: packages,
            evidence,
          }),
          "REVIEW_PENDING",
        );
      const old = (
        await c.query(
          "SELECT package_hash FROM app_content.packages WHERE version_id=$1",
          [p.lesson.versionId],
        )
      ).rows[0];
      if (old) {
        if (old.package_hash !== p.packageHash)
          throw new Error("IMMUTABLE_VERSION_CONFLICT");
        continue;
      }
      await c.query(
        "INSERT INTO app_content.packages(version_id,lesson_id,release_id,package_hash,manifest,state) VALUES($1,$2,$3,$4,$5,$6)",
        [
          p.lesson.versionId,
          p.lesson.id,
          p.release.id,
          p.packageHash,
          p,
          p.state,
        ],
      );
      for (const ex of p.exercises) {
        const k = p.privateKeys.find((k) => k.id === ex.keyRef)!;
        await c.query(
          "INSERT INTO app_content.exercise_versions VALUES($1,$2,$3,$4,$5)",
          [
            ex.id,
            p.lesson.versionId,
            k.id,
            k.normalizerVersion,
            k.gradingVersion,
          ],
        );
      }
    }
    await c.query("COMMIT");
    console.log(
      "Immutable LOCAL DEVELOPMENT package versions registered; not published.",
    );
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/seed-content.ts")) {
  const database = process.argv[2] ?? "csh_local";
  if (
    !/^(csh_local|csh_phase4_restore_[a-f0-9]+|csh_sprint5_restore_[a-f0-9]+|csh_sprint6_restore_[a-f0-9]+)$/.test(
      database,
    )
  )
    throw new Error("Only project local/disposable database names allowed");
  seedContent(database).catch((e) => {
    console.error(
      e instanceof Error ? e.message : "Content registration failed",
    );
    process.exitCode = 1;
  });
}
