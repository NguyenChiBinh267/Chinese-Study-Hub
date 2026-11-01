import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { currentDrafts } from "../../src/modules/content/application/catalog";
import { PostgresContentRepository } from "../../src/modules/content/infrastructure/postgres-content";
import { createRuntimePool } from "../../src/shared/db/transaction";
const pointer = JSON.parse(
  fs.readFileSync(".local-postgres/hsk24/current.json", "utf8"),
);
const state = JSON.parse(fs.readFileSync(pointer.stateFile, "utf8"));
const pool = createRuntimePool(state.runtimeUrl, 1),
  repo = new PostgresContentRepository(pool);
test.after(() => pool.end());
test("All current HSK2 manifests reject a wrong hash and resume the exact saved session", async () => {
  const lessons = currentDrafts().filter((p) =>
    [2, 3, 4].includes(p.alignment.targetLevel ?? 0),
  );
  assert.ok(lessons.length >= 91);
  for (const p of lessons) {
    const owner = randomUUID();
    await assert.rejects(
      repo.start(owner, randomUUID(), p.lesson.versionId, {
        restart: false,
        packageHash: "0".repeat(64),
      }),
    );
    const first = await repo.start(owner, randomUUID(), p.lesson.versionId, {
      restart: false,
      packageHash: p.packageHash,
    });
    const view = await repo.view(owner, p.lesson.versionId);
    assert.equal(view.lesson.packageHash, p.packageHash);
    assert.equal(view.session!.id, first.sessionId);
    await repo.advance(
      owner,
      randomUUID(),
      first.sessionId,
      view.session!.version,
    );
    const resumed = await repo.start(owner, randomUUID(), p.lesson.versionId, {
      restart: false,
      packageHash: p.packageHash,
    });
    assert.equal(resumed.sessionId, first.sessionId);
    const saved = await repo.view(owner, p.lesson.versionId);
    assert.equal(saved.session!.cursor, 1, p.lesson.id);
  }
});
