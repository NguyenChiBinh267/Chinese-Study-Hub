import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import {
  loadDraftCatalog,
  contentTemplateIndex,
  findContentTemplate,
  currentDrafts,
} from "../src/modules/content/application/catalog";
import { publicProjection } from "../src/modules/content/domain/package";
import { createRuntimePool } from "../src/shared/db/transaction";
import { PostgresContentRepository } from "../src/modules/content/infrastructure/postgres-content";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
async function main() {
  if (!expansionEnabled()) throw Error("LOCAL_ONLY");
  const { packages } = loadDraftCatalog(),
    lessons = currentDrafts().filter((p) =>
      [2, 3, 4].includes(p.alignment.targetLevel ?? 0),
    );
  const samples: number[] = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    loadDraftCatalog();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const id = `${lessons[0].lesson.versionId}:recall:${lessons[0].concepts[0].id}`;
  let start = performance.now();
  for (let i = 0; i < 40; i++) findContentTemplate(id);
  const repeated = performance.now() - start;
  start = performance.now();
  const index = contentTemplateIndex();
  for (let i = 0; i < 40; i++) index.get(id);
  const scoped = performance.now() - start;
  const pointer = JSON.parse(
      fs.readFileSync(".local-postgres/hsk24/current.json", "utf8"),
    ),
    state = JSON.parse(fs.readFileSync(pointer.stateFile, "utf8"));
  const pool = createRuntimePool(state.runtimeUrl, 1),
    repo = new PostgresContentRepository(pool),
    owner = randomUUID();
  const latencies: number[] = [];
  const sampledVersions: string[] = [];
  let statements = 0;
  const queryCounts: number[] = [];
  pool.on("connect", (client) => {
    client.query = new Proxy(client.query, {
      apply(target, thisArg, args) {
        statements++;
        return Reflect.apply(target, thisArg, args);
      },
    });
  });
  try {
    for (const p of [
      lessons[0],
      lessons[Math.floor(lessons.length / 2)],
      lessons.at(-1)!,
    ]) {
      sampledVersions.push(p.lesson.versionId);
      start = performance.now();
      const before = statements;
      const view = await repo.view(owner, p.lesson.versionId);
      latencies.push(performance.now() - start);
      queryCounts.push(statements - before);
      if (JSON.stringify(view).includes('"privateKeys"'))
        throw Error("PRIVATE_KEY_LEAK");
    }
  } finally {
    await pool.end();
  }
  const report = {
    checkedAt: new Date().toISOString(),
    packagesIncludingHistory: packages.length,
    currentHsk2: lessons.filter((p) => p.alignment.targetLevel === 2).length,
    currentHsk3: lessons.filter((p) => p.alignment.targetLevel === 3).length,
    currentHsk4: lessons.filter((p) => p.alignment.targetLevel === 4).length,
    sampledVersions,
    catalogLoadMs: { p50: samples[5], p90: samples[9], samples },
    fortyCardLookupsMs: {
      repeatedStandalone: repeated,
      requestScoped: scoped,
      meaning:
        "Same full corpus and process; 40 standalone catalog validations versus one request-local validated index, not cross-machine benchmark.",
    },
    readOnlyDatabaseViewMs: latencies,
    databaseStatementsPerView: queryCounts,
    publicPackageBytes: {
      max: Math.max(
        ...lessons.map((p) =>
          Buffer.byteLength(JSON.stringify(publicProjection(p))),
        ),
      ),
    },
    corpusServerBytes: packages.reduce(
      (n, p) => n + Buffer.byteLength(JSON.stringify(p)),
      0,
    ),
    duplicateCurrentVersions:
      lessons.length - new Set(lessons.map((p) => p.lesson.versionId)).size,
    queryShape:
      "One version-pinned package/session per lesson view, nine SQL statements in this measurement. No migration or owner writes. Curriculum summaries read all registered manifests; Today also validates/reloads the full server corpus. Foundation-library four-package bound is a separate regression, not a corpus-independent planner claim.",
    limits:
      "Local host timings under concurrent SQL/browser checks; not a cloud benchmark or an upper latency SLA.",
  };
  fs.writeFileSync(
    process.argv[2] ?? "docs/hsk24/performance.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Benchmark failed");
  process.exitCode = 1;
});
