// Negative proof for the explicit LOCAL content-pointer advance. Never learner writes.
import fs from "node:fs";
import assert from "node:assert/strict";
import { Client } from "pg";
import { adminConfig } from "./local-db.mjs";
import { seedContent } from "./seed-content";
import { seedCurriculum, assertLocalDraftAdvance } from "./seed-curriculum";
import { loadDraftCatalog } from "../src/modules/content/application/catalog";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
async function main() {
  const pointer = JSON.parse(
      fs.readFileSync(".local-postgres/hsk24/current.json", "utf8"),
    ),
    state = JSON.parse(fs.readFileSync(pointer.stateFile, "utf8"));
  if (!/^csh_hsk24_[a-f0-9]{12}$/.test(state.database))
    throw Error("ISOLATED_DATABASE_REQUIRED");
  const { packages } = loadDraftCatalog(),
    from = packages.find((p) => p.lesson.versionId === "l416-draft-v2")!,
    to = packages.find((p) => p.lesson.versionId === "l416-draft-v3")!;
  assertLocalDraftAdvance("L416", from, to);
  assert.throws(
    () => assertLocalDraftAdvance("L416", to, from),
    /UNSAFE_LOCAL/,
  );
  const changed = structuredClone(to);
  changed.concepts[0].meaning += " changed";
  assert.throws(
    () => assertLocalDraftAdvance("L416", from, changed),
    /UNSAFE_LOCAL/,
  );
  assert.throws(
    () => assertLocalDraftAdvance("L316", from, to),
    /UNSAFE_LOCAL/,
  );
  await assert.rejects(
    seedCurriculum("csh_local", { advanceLocalDraftVersions: true }),
    /ISOLATED_DRAFT_ADVANCE_REQUIRED/,
  );
  const oldFlag = process.env.CSH_LOCAL_DATABASE;
  process.env.CSH_LOCAL_DATABASE = "0";
  try {
    await assert.rejects(
      seedCurriculum(state.database, { advanceLocalDraftVersions: true }),
      /ISOLATED_DRAFT_ADVANCE_REQUIRED/,
    );
  } finally {
    process.env.CSH_LOCAL_DATABASE = oldFlag;
  }
  await seedContent(state.database);
  const c = new Client(adminConfig(state.database));
  await c.connect();
  const snapshot = async () => ({
    lessons: (await c.query("SELECT * FROM app_content.lessons ORDER BY id"))
      .rows,
    versions: (
      await c.query(
        "SELECT * FROM app_content.lesson_versions ORDER BY package_id",
      )
    ).rows,
  });
  const path = "content/hsk24/catalog.json",
    bytes = fs.readFileSync(path),
    doc = JSON.parse(bytes.toString());
  try {
    const before = await snapshot();
    assert.equal(
      before.lessons.find((x) => x.stable_key === "L416").current_version,
      "l416-draft-v2",
    );
    // Force a later immutable metadata conflict after the earlier pointer update.
    const review = doc.lessons.find((x: { key: string }) => x.key === "L482");
    review.order += 10;
    fs.writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
    try {
      await assert.rejects(
        seedCurriculum(state.database, { advanceLocalDraftVersions: true }),
        /CURRICULUM_IMMUTABLE_CONFLICT/,
      );
    } finally {
      fs.writeFileSync(path, bytes);
    }
    assert.deepEqual(await snapshot(), before);
    fs.writeFileSync(
      ".local-postgres/hsk24/hsk4-advance-negative.json",
      JSON.stringify(
        {
          database: state.database,
          checkedAt: new Date().toISOString(),
          passed: true,
          cases: 6,
          unsafeDowngradeDenied: true,
          changedSensesDenied: true,
          foreignLessonDenied: true,
          nonlocalDatabaseDeniedBeforeConnection: true,
          disabledExpansionDeniedBeforeConnection: true,
          lateMetadataConflictRolledBackAllLessonPointersAndVersionBindings: true,
          learnerWrites: false,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "PASS:6 local advance guards/rollback assertions; no learner writes.",
    );
  } finally {
    if (!fs.readFileSync(path).equals(bytes)) fs.writeFileSync(path, bytes);
    await c.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Verification failed");
  process.exitCode = 1;
});
