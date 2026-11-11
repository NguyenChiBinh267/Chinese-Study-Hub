import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createRuntimePool } from "../../src/shared/db/transaction";
import { PostgresContentRepository } from "../../src/modules/content/infrastructure/postgres-content";
import { PostgresCurriculumRepository } from "../../src/modules/curriculum/infrastructure/postgres-curriculum";
import { currentDrafts } from "../../src/modules/content/application/catalog";
import { performance } from "node:perf_hooks";
const pointer = JSON.parse(
  fs.readFileSync(".local-postgres/hsk24/current.json", "utf8"),
);
const state = JSON.parse(fs.readFileSync(pointer.stateFile, "utf8"));
const packageQuery =
  "SELECT manifest,package_hash FROM app_content.packages WHERE version_id=$1";
test("Expanded foundation library has four public packages and bounded SQL while same-owner course metadata remains available", async () => {
  const expectedHsk4 = currentDrafts().filter(
    (p) => p.alignment.targetLevel === 4,
  );
  const startedAt = performance.now();
  const pool = createRuntimePool(state.runtimeUrl, 3),
    versions: string[] = [];
  pool.on("connect", (client) => {
    client.query = new Proxy(client.query, {
      apply(target, self, args) {
        if (args[0] === packageQuery) versions.push(args[1][0]);
        return Reflect.apply(target, self, args);
      },
    });
  });
  try {
    const owner = randomUUID();
    const [entries, courses] = await Promise.all([
      new PostgresContentRepository(pool).library(owner),
      new PostgresCurriculumRepository(pool).snapshot(owner),
    ]);
    assert.deepEqual(entries.map((e) => e.lesson.lesson.id).sort(), [
      "F01",
      "F02",
      "L001",
      "L002",
    ]);
    assert.equal(versions.length, 4);
    assert.equal(new Set(versions).size, 4);
    assert.equal(
      courses.courses.find((c) => c.code === "HSK4")!.totalLessons,
      expectedHsk4.length,
    );
    assert.deepEqual(
      courses.lessons
        .filter((l) => l.courseCode === "HSK4")
        .map((l) => l.key)
        .sort(),
      expectedHsk4.map((p) => p.lesson.id).sort(),
    );
    const body = JSON.stringify(entries),
      bytes = Buffer.byteLength(body);
    // The structural four-lookup bound detects the original O(all lessons) defect.
    // Timings and payload are observations, with no invented latency/byte SLA.
    for (const key of ["privateKeys", "keyRef", "accepted", "feedback"])
      assert.ok(!body.includes(`"${key}"`));
    fs.writeFileSync(
      process.env.CSH_HSK4_LIBRARY_REPORT ??
        ".local-postgres/hsk24/hsk4-continuous-library-bounds.json",
      JSON.stringify(
        {
          database: state.database,
          checkedAt: new Date().toISOString(),
          readOnly: true,
          returnedLessonIds: entries.map((e) => e.lesson.lesson.id),
          packageLookups: versions.length,
          payloadBytes: bytes,
          concurrentSameOwnerCurriculumSucceeded: true,
          HSK4Activities: expectedHsk4.length,
          allExpectedHsk4LessonIdsVisible: true,
          combinedConcurrentWallMs: performance.now() - startedAt,
          limits:
            "Course metadata remains complete via the validated metadata index; no course package bodies are fetched. This test bounds the4foundation body lookups; Today candidate bounds are tested separately.",
          noTimeoutPolicyChange: true,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await pool.end();
  }
});
test("Request-local catalog reuse still denies altered database hashes and revoked draft permissions", async () => {
  const pool = createRuntimePool(state.runtimeUrl, 1);
  let corruption: "hash" | "permission" = "hash";
  pool.on("connect", (client) => {
    client.query = new Proxy(client.query, {
      apply(target, self, args) {
        const pending = Reflect.apply(target, self, args);
        if (typeof args[0] !== "string") return pending;
        if (
          (corruption === "hash" && args[0] === packageQuery) ||
          (corruption === "permission" &&
            args[0].includes("SELECT l.local_draft_allowed"))
        )
          return pending.then(
            (result: {
              rows: { package_hash?: string; local_draft_allowed?: boolean }[];
            }) => {
              // Alter only the returned in-memory row; no UPDATE or learner write.
              if (corruption === "hash")
                result.rows[0].package_hash = "0".repeat(64);
              else result.rows[0].local_draft_allowed = false;
              return result;
            },
          );
        return pending;
      },
    });
  });
  try {
    const repo = new PostgresContentRepository(pool),
      owner = randomUUID();
    await assert.rejects(repo.library(owner), { code: "CONTENT_STALE" });
    corruption = "permission";
    await assert.rejects(repo.library(owner), { code: "COURSE_NOT_AVAILABLE" });
  } finally {
    await pool.end();
  }
});
test("Explicit custom access retains its own scope and package verifier", async () => {
  const pool = createRuntimePool(state.runtimeUrl, 1),
    p = currentDrafts().find((p) => p.lesson.id === "L436")!;
  const checked: string[] = [];
  try {
    const repo = new PostgresContentRepository(pool, {
      current: () => [p],
      packageFor: async (_client, version) => {
        checked.push(version);
        return p;
      },
      canStart: () => false,
      reviewStatus: "TECHNICAL_ONLY",
    });
    const entries = await repo.library(randomUUID());
    assert.deepEqual(
      entries.map((e) => e.lesson.lesson.id),
      ["L436"],
    );
    assert.deepEqual(checked, [p.lesson.versionId]);
  } finally {
    await pool.end();
  }
});
