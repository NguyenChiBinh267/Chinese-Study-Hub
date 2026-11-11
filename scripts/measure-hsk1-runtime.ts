// Native repository boundary measurements, not HTTP/GUI or a latency SLA.
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
import { createRuntimePool } from "../src/shared/db/transaction";
import { PostgresStudyRepository } from "../src/modules/planning/infrastructure/postgres-study";

async function main() {
  const prefix = process.argv[2];
  if (!/^hsk1-runtime-[a-z0-9-]+$/.test(prefix ?? ""))
    throw Error("BOUNDED_REPORT_REQUIRED");
  const base = ".local-postgres/hsk24/";
  const reportFile = `${base}${prefix}.json`;
  if (fs.existsSync(reportFile)) throw Error("REPORT_ALREADY_EXISTS");
  const pointer = JSON.parse(fs.readFileSync(`${base}current.json`, "utf8"));
  const state = JSON.parse(fs.readFileSync(pointer.stateFile, "utf8"));
  if (state.database !== "csh_hsk24_bf294b6506c1")
    throw Error("SELECTED_HSK1_BASELINE_REQUIRED");
  const ownerFile = `${base}hsk1-runtime-measurement-owner.json`;
  const owner = fs.existsSync(ownerFile)
    ? JSON.parse(fs.readFileSync(ownerFile, "utf8")).owner
    : randomUUID();
  const pool = createRuntimePool(state.runtimeUrl, 3),
    study = new PostgresStudyRepository(pool);
  let connects = 0;
  let counters = {
    sql: 0,
    sqlMs: 0,
    maxSqlMs: 0,
    fullDatabaseManifests: 0,
    sqlResultBytes: 0,
    transactions: [] as number[],
    fullSourcePackages: 0,
    fsOps: 0,
  };
  pool.on("connect", (client) => {
    connects++;
    let began = 0;
    client.query = new Proxy(client.query, {
      apply(target, self, args) {
        const started = performance.now(),
          text = String(args[0]);
        if (text === "BEGIN") began = started;
        return Reflect.apply(target, self, args).then(
          (result: { rows: Record<string, unknown>[] }) => {
            const ms = performance.now() - started;
            counters.sql++;
            counters.sqlMs += ms;
            counters.maxSqlMs = Math.max(counters.maxSqlMs, ms);
            counters.fullDatabaseManifests += result.rows.filter(
              (r) => r.manifest && typeof r.manifest === "object",
            ).length;
            counters.sqlResultBytes += Buffer.byteLength(
              JSON.stringify(result.rows),
            );
            if (["COMMIT", "ROLLBACK"].includes(text) && began) {
              counters.transactions.push(performance.now() - began);
              began = 0;
            }
            return result;
          },
        );
      },
    });
  });
  try {
    if (!fs.existsSync(ownerFile)) {
      await study.save(owner, randomUUID(), {
        preferences: {
          weeklyHours: 3,
          days: [0, 1, 2, 3, 4, 5, 6],
          dailyCap: 90,
          sessionMinutes: 20,
        },
        planning: {
          dayCaps: [90, 90, 90, 90, 90, 90, 90],
          maxSessionMinutes: 25,
          paused: false,
          timezone: "Asia/Saigon",
          startingLevel: "zero",
        },
        expectedVersion: 0,
        acceptLimited: false,
      });
      fs.writeFileSync(
        ownerFile,
        JSON.stringify({ database: state.database, owner }) + "\n",
      );
      console.log(
        "Measurement owner configured; rerun in a fresh process for cold measurement.",
      );
      return;
    }
    const connectionStarted = performance.now(),
      connection = await pool.connect();
    const firstConnectionMs = performance.now() - connectionStarted;
    connection.release();
    const originalRead = fs.readFileSync,
      originalDir = fs.readdirSync,
      originalStat = fs.statSync;
    fs.readFileSync = new Proxy(originalRead, {
      apply(target, self, args) {
        counters.fsOps++;
        if (/(F\d{2}|L\d{3,6})\.v\d+\.json$/.test(String(args[0])))
          counters.fullSourcePackages++;
        return Reflect.apply(target, self, args);
      },
    });
    fs.readdirSync = new Proxy(originalDir, {
      apply(target, self, args) {
        counters.fsOps++;
        return Reflect.apply(target, self, args);
      },
    });
    Reflect.set(
      fs,
      "statSync",
      new Proxy(originalStat, {
        apply(target, self, args) {
          counters.fsOps++;
          return Reflect.apply(target, self, args);
        },
      }),
    );
    const samples = [];
    try {
      for (let i = 0; i < 4; i++) {
        counters = {
          sql: 0,
          sqlMs: 0,
          maxSqlMs: 0,
          fullDatabaseManifests: 0,
          sqlResultBytes: 0,
          transactions: [],
          fullSourcePackages: 0,
          fsOps: 0,
        };
        const started = performance.now(),
          result = await study.today(owner);
        samples.push({
          phase:
            i === 0
              ? "FIRST_TODAY_IN_FRESH_NODE_PROCESS"
              : "WARM_SAME_PROCESS_POOL",
          wallMs: performance.now() - started,
          ...counters,
          responseBytes: Buffer.byteLength(JSON.stringify(result)),
          pool: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          },
        });
      }
    } finally {
      fs.readFileSync = originalRead;
      fs.readdirSync = originalDir;
      Reflect.set(fs, "statSync", originalStat);
    }
    await pool.end();
    fs.writeFileSync(
      reportFile,
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          database: state.database,
          node: process.version,
          platform: process.platform,
          nativeRepositoryBoundary: true,
          freshProcess: true,
          explicitCatalogCache: false,
          firstConnectionMs,
          physicalConnections: connects,
          poolAfterEnd: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          },
          samples,
          methodology:
            "Source package reads count readFileSync(package filename); full DB manifests count result.rows.manifest objects. These are IO-boundary body counts, not every allocation inside Zod. SQL timing is client wall time including decoding. First connection measured before first Today; all4requests share one bounded pool. No HTTP/GUI or cloud latency claim, no automatic retries. Old learner rows are not modified; dedicated synthetic owner only.",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        report: reportFile,
        physicalConnections: connects,
        samples: samples.map((s) => ({
          phase: s.phase,
          ms: s.wallMs,
          files: s.fullSourcePackages,
          dbManifests: s.fullDatabaseManifests,
          sql: s.sql,
        })),
      }),
    );
  } finally {
    if (!pool.ending) await pool.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "MEASUREMENT_FAILED");
  process.exitCode = 1;
});
