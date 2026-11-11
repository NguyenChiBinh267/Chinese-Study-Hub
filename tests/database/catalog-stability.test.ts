import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRuntimePool } from "../../src/shared/db/transaction";
import { PostgresCurriculumRepository } from "../../src/modules/curriculum/infrastructure/postgres-curriculum";
import { failure } from "../../src/modules/learning/server/local-service";

const pointer = JSON.parse(
  fs.readFileSync(".local-postgres/hsk24/current.json", "utf8"),
);
const state = JSON.parse(fs.readFileSync(pointer.stateFile, "utf8"));
assert.equal(state.database, "csh_hsk24_bf294b6506c1");
const pool = createRuntimePool(state.runtimeUrl, 1);
test.after(() => pool.end());

test("Native catalog first/warm requests preserve HSK1 draft scope without granting mastery", async () => {
  const uid = randomUUID();
  const repo = new PostgresCurriculumRepository(pool);
  const observations = [];
  for (const phase of [
    "FIRST_NATIVE_SNAPSHOT",
    "WARM_NATIVE_SNAPSHOT",
    "WARM_NATIVE_SNAPSHOT",
  ]) {
    const started = performance.now();
    const data = await repo.snapshot(uid);
    observations.push({ phase, ms: performance.now() - started });
    const hsk1 = data.courses.find((c) => c.code === "HSK1")!;
    assert.equal(hsk1.totalLessons, 129);
    assert.equal(hsk1.publishedAvailable, 0);
    assert.equal(hsk1.independentEvidence, 0);
    assert.notEqual(hsk1.activityState, "COMPLETED");
  }
  console.log(
    JSON.stringify({
      scope:
        "Native repository only; module load/Next compilation/HTTP excluded. No SLA or historical root-cause claim.",
      observations,
    }),
  );
});

test("A real PostgreSQL connection failure remains HTTP503; no retry or fabricated empty catalog", async () => {
  const absent = `csh_hsk24_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  assert.equal(
    (await pool.query("SELECT 1 FROM pg_database WHERE datname=$1", [absent]))
      .rowCount,
    0,
  );
  const url = new URL(state.runtimeUrl);
  url.pathname = `/${absent}`;
  const badPool = createRuntimePool(url.toString(), 1);
  let caught: unknown;
  try {
    await new PostgresCurriculumRepository(badPool).snapshot(randomUUID());
    assert.fail("Absent database must not return a catalog");
  } catch (e) {
    caught = e;
  } finally {
    await badPool.end();
  }
  assert.equal((caught as { code: string }).code, "3D000");
  const response = failure(caught);
  assert.equal(response.status, 503);
  const body = await response.text();
  assert.equal(JSON.parse(body).error.code, "LOCAL_DB_UNAVAILABLE");
  assert.ok(!body.includes(absent));
  assert.ok(!body.includes(url.password));
});
