import { buildLocalPlanningIndex } from "./build-hsk24-planning-index";
// Additive import into the selected isolated sandbox; no resets or pointer rewrites.
import fs from "node:fs";
import assert from "node:assert/strict";
import { Client } from "pg";
import { adminConfig } from "./local-db.mjs";
import { seedContent } from "./seed-content";
import { seedCurriculum } from "./seed-curriculum";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
async function main() {
  if (!expansionEnabled()) throw Error("LOCAL_EXPANSION_REQUIRED");
  const pointer = JSON.parse(
    fs.readFileSync(".local-postgres/hsk24/current.json", "utf8"),
  );
  const state = JSON.parse(fs.readFileSync(pointer.stateFile, "utf8")),
    u = new URL(state.runtimeUrl);
  if (
    !/^csh_hsk24_[a-f0-9]{12}$/.test(state.database) ||
    u.hostname !== "127.0.0.1" ||
    u.port !== "5447" ||
    u.pathname !== "/" + state.database ||
    u.username !== "csh_runtime"
  )
    throw Error("ISOLATED_DATABASE_REQUIRED");
  const c = new Client(adminConfig(state.database));
  await c.connect();
  const snapshot = async () => ({
    packages: (
      await c.query(
        "SELECT version_id,package_hash FROM app_content.packages ORDER BY version_id",
      )
    ).rows,
    attempts: (await c.query("SELECT * FROM app_private.attempts ORDER BY id"))
      .rows,
    sessions: (
      await c.query("SELECT * FROM app_private.lesson_sessions ORDER BY id")
    ).rows,
    cards: (await c.query("SELECT * FROM app_private.cards ORDER BY id")).rows,
  });
  try {
    const before = await snapshot();
    await seedContent(state.database);
    const versionAdvances = await seedCurriculum(state.database, {
      advanceLocalDraftVersions: true,
    });
    const planningIndex = buildLocalPlanningIndex();
    const after = await snapshot();
    for (const old of before.packages)
      assert.deepEqual(
        after.packages.find((x) => x.version_id === old.version_id),
        old,
      );
    assert.deepEqual(after.attempts, before.attempts);
    assert.deepEqual(after.sessions, before.sessions);
    assert.deepEqual(after.cards, before.cards);
    const report = {
      database: state.database,
      checkedAt: new Date().toISOString(),
      existingPackagesPreserved: before.packages.length,
      packagesAfter: after.packages.length,
      existingAttemptsPreserved: before.attempts.length,
      existingSessionsPreserved: before.sessions.length,
      existingCardsPreserved: before.cards.length,
      versionAdvances,
      planningIndex,
    };
    fs.writeFileSync(
      ".local-postgres/hsk24/import-" + Date.now() + ".json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await c.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Import failed");
  process.exitCode = 1;
});
