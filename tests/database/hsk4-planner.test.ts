import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createRuntimePool } from "../../src/shared/db/transaction";
import { PostgresStudyRepository } from "../../src/modules/planning/infrastructure/postgres-study";
import { loadDraftCatalog } from "../../src/modules/content/application/catalog";
import { PostgresContentRepository } from "../../src/modules/content/infrastructure/postgres-content";
import { loadLocalPlanningIndex } from "../../src/modules/content/application/local-planning-index";
import { localPlanningCandidatesWithin } from "../../src/modules/planning/infrastructure/local-candidates";
import { ownerTransaction } from "../../src/shared/db/transaction";

const pointer = JSON.parse(
  fs.readFileSync(".local-postgres/hsk24/current.json", "utf8"),
);
const state = JSON.parse(fs.readFileSync(pointer.stateFile, "utf8"));
const config = {
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
    startingLevel: "zero" as const,
  },
};

test("Opening one pinned lesson loads one full source/DB body and returns no private key fields", async () => {
  const pool = createRuntimePool(state.runtimeUrl, 1),
    read = fs.readFileSync;
  let files = 0,
    bodies = 0;
  fs.readFileSync = new Proxy(read, {
    apply(fn, self, args) {
      if (/(?:F\d{2}|L\d{3,6})\.v\d+\.json$/.test(String(args[0]))) files++;
      return Reflect.apply(fn, self, args);
    },
  });
  pool.on("connect", (client) => {
    client.query = new Proxy(client.query, {
      apply(fn, self, args) {
        return Reflect.apply(fn, self, args).then(
          (r: { rows: { manifest?: unknown }[] }) => {
            bodies += r.rows.filter((x) => x.manifest).length;
            return r;
          },
        );
      },
    });
  });
  try {
    const view = await new PostgresContentRepository(pool).view(
      randomUUID(),
      "l492-draft-v1",
    );
    assert.equal(files, 1);
    assert.equal(bodies, 1);
    const publicJson = JSON.stringify(view);
    for (const key of ['"privateKeys"', '"keyRef"', '"accepted"'])
      assert.ok(!publicJson.includes(key));
  } finally {
    fs.readFileSync = read;
    await pool.end();
  }
});

test("Candidate pagination reaches permitted lessons beyond a rejected metadata page and materializes at most seven candidates", async () => {
  const index = loadLocalPlanningIndex(),
    current = Object.values(index.currentByKey);
  const withheld = new Set<string>();
  for (const v of current) {
    const deps = index.records[v].metadata.lesson.prerequisites;
    if (
      !deps.some((d) => withheld.has(d)) &&
      ![...withheld].some((other) =>
        index.records[other].metadata.lesson.prerequisites.includes(v),
      )
    )
      withheld.add(v);
  }
  const completed = new Set(
    Object.keys(index.records).filter((v) => !withheld.has(v)),
  );
  const eligible = current.filter(
    (v) =>
      !completed.has(v) &&
      index.records[v].metadata.lesson.prerequisites.every((dep) =>
        completed.has(dep),
      ),
  );
  assert.ok(eligible.length >= 23);
  const pool = createRuntimePool(state.runtimeUrl, 1),
    pages: number[] = [],
    fullBodies: number[] = [];
  pool.on("connect", (client) => {
    client.query = new Proxy(client.query, {
      apply(target, self, args) {
        const pending = Reflect.apply(target, self, args);
        if (
          typeof args[0] === "string" &&
          args[0].includes("WHERE p.version_id IN (")
        )
          return pending.then(
            (result: {
              rows: { local_draft_allowed: boolean; manifest?: unknown }[];
            }) => {
              pages.push(result.rows.length);
              fullBodies.push(result.rows.filter((r) => r.manifest).length);
              if (args[1][2] === 0)
                for (const row of result.rows) row.local_draft_allowed = false;
              return result;
            },
          );
        return pending;
      },
    });
  });
  try {
    const selected = await ownerTransaction(pool, randomUUID(), (c) =>
      localPlanningCandidatesWithin(c, completed, [], [], "2026-10-29"),
    );
    assert.equal(selected.lessons.length, 7);
    assert.ok(pages.length >= 2);
    assert.ok(pages.every((n) => n <= 16));
    assert.equal(
      fullBodies.reduce((a, b) => a + b, 0),
      0,
    );
    assert.ok(
      selected.lessons.every((l) => l.practiceAllowed && !l.verifiedEligible),
    );
  } finally {
    await pool.end();
  }
});

test("Changed derived-index bytes and changed pinned catalog input fail closed on the next planner request", async () => {
  const pool = createRuntimePool(state.runtimeUrl, 1),
    repo = new PostgresStudyRepository(pool),
    read = fs.readFileSync;
  let target = "planning-index.v1.json";
  fs.readFileSync = new Proxy(read, {
    apply(fn, self, args) {
      const bytes = Reflect.apply(fn, self, args);
      return String(args[0]).endsWith(target) ? String(bytes) + " " : bytes;
    },
  });
  try {
    await assert.rejects(
      repo.preview(randomUUID(), config),
      /PLANNING_INDEX_DRIFT/,
    );
    target = "catalog.json";
    await assert.rejects(
      repo.preview(randomUUID(), config),
      /PLANNING_SOURCE_DRIFT/,
    );
  } finally {
    fs.readFileSync = read;
    await pool.end();
  }
});

test("A large-corpus planner preview reads zero full packages and keeps new lesson blocks tentative", async () => {
  const pool = createRuntimePool(state.runtimeUrl, 1);
  const originalRead = fs.readFileSync;
  const reads = new Map<string, number>();
  fs.readFileSync = new Proxy(originalRead, {
    apply(target, self, args) {
      const filename = String(args[0]).replaceAll("\\", "/");
      if (
        /content\/(hsk24|staging\/slice)\/(F\d{2}|L\d{3,6})\.v\d+\.json$/.test(
          filename,
        )
      )
        reads.set(filename, (reads.get(filename) ?? 0) + 1);
      return Reflect.apply(target, self, args);
    },
  });
  const started = performance.now();
  try {
    const plan = await new PostgresStudyRepository(pool).preview(
      randomUUID(),
      config,
    );
    const result = {
      checkedAt: new Date().toISOString(),
      database: state.database,
      packageFiles: reads.size,
      packageReads: [...reads.values()].reduce((a, b) => a + b, 0),
      maxReadsPerFile: Math.max(0, ...reads.values()),
      wallMs: performance.now() - started,
      blocks: plan.blocks.length,
      verifiedBlocks: plan.blocks.filter((b) => b.reason === "ELIGIBLE_LESSON")
        .length,
      limit:
        "Counts observe full source package reads only. Validated metadata index/input pins are read freshly; no full package body is needed for Today candidates. No latency SLA.",
    };
    fs.writeFileSync(
      process.env.CSH_HSK4_PLANNER_REPORT ??
        ".local-postgres/hsk24/hsk4-today-planner.json",
      JSON.stringify(result, null, 2) + "\n",
    );
    assert.ok(Object.keys(loadLocalPlanningIndex().records).length > 300);
    assert.equal(reads.size, 0);
    assert.equal(result.maxReadsPerFile, 0);
    assert.equal(result.verifiedBlocks, 0);
    assert.ok(plan.blocks.some((b) => b.kind === "draft_lesson"));
  } finally {
    fs.readFileSync = originalRead;
    await pool.end();
  }
});

test("Planner rejects changed database hash and changed metadata without loading a private body", async () => {
  const pool = createRuntimePool(state.runtimeUrl, 1);
  let alteration: "hash" | "body" = "hash";
  pool.on("connect", (client) => {
    client.query = new Proxy(client.query, {
      apply(target, self, args) {
        const result = Reflect.apply(target, self, args);
        if (
          typeof args[0] === "string" &&
          args[0].startsWith("SELECT p.version_id,p.package_hash,p.state")
        )
          return result.then(
            (value: {
              rows: { lesson: { title: string }; package_hash: string }[];
            }) => {
              const row = value.rows[0];
              // In-memory corruption only: no manifest/learner UPDATE.
              if (alteration === "body") {
                row.lesson.title += " altered";
              } else row.package_hash = "0".repeat(64);
              return value;
            },
          );
        return result;
      },
    });
  });
  try {
    const repo = new PostgresStudyRepository(pool),
      uid = randomUUID();
    await assert.rejects(
      repo.preview(uid, config),
      /PLANNER_PACKAGE_METADATA_DRIFT/,
    );
    alteration = "body";
    await assert.rejects(
      repo.preview(uid, config),
      /PLANNER_PACKAGE_METADATA_DRIFT/,
    );
  } finally {
    await pool.end();
  }
});

test("Planner re-reads draft practice permissions instead of retaining a previous request's eligibility", async () => {
  const pool = createRuntimePool(state.runtimeUrl, 1);
  let revoked = false;
  pool.on("connect", (client) => {
    client.query = new Proxy(client.query, {
      apply(target, self, args) {
        const result = Reflect.apply(target, self, args);
        if (
          revoked &&
          typeof args[0] === "string" &&
          args[0].startsWith("SELECT p.version_id,p.package_hash,p.state")
        )
          return result.then(
            (value: { rows: { local_draft_allowed: boolean }[] }) => {
              for (const row of value.rows) row.local_draft_allowed = false;
              return value;
            },
          );
        return result;
      },
    });
  });
  try {
    const repo = new PostgresStudyRepository(pool),
      uid = randomUUID();
    assert.ok((await repo.preview(uid, config)).blocks.length > 0);
    revoked = true;
    assert.deepEqual((await repo.preview(uid, config)).blocks, []);
  } finally {
    await pool.end();
  }
});

test("Sharing the validated result retains explicit private preview scope without including the local expansion", async () => {
  const pool = createRuntimePool(state.runtimeUrl, 1);
  const all = loadDraftCatalog().packages.filter((p) =>
    ["F01", "F02", "L001", "L002"].includes(p.lesson.id),
  );
  const current = all.filter(
    (p) =>
      !all.some(
        (other) =>
          other.lesson.id === p.lesson.id &&
          other.lesson.version > p.lesson.version,
      ),
  );
  try {
    const repo = new PostgresStudyRepository(pool, {
      id: "test-private-scope",
      privateOwnerPreview: true,
      all,
      current,
    });
    const plan = await repo.preview(randomUUID(), config);
    assert.ok(plan.blocks.length > 0);
    for (const block of plan.blocks) {
      assert.ok(current.some((p) => p.lesson.versionId === block.target));
      assert.equal(block.reason, "OPTIONAL_DRAFT_NOT_UNLOCKED");
      assert.equal(block.status, "tentative");
    }
  } finally {
    await pool.end();
  }
});

test("Unselected body bytes are not read by Today; opening the selected package still rejects source corruption", async () => {
  const pool = createRuntimePool(state.runtimeUrl, 1),
    repo = new PostgresStudyRepository(pool);
  const originalRead = fs.readFileSync;
  let corrupt = false,
    intercepted = 0;
  fs.readFileSync = new Proxy(originalRead, {
    apply(target, self, args) {
      const result = Reflect.apply(target, self, args);
      if (
        corrupt &&
        String(args[0])
          .replaceAll("\\", "/")
          .endsWith("content/hsk24/L492.v1.json")
      ) {
        const p = JSON.parse(String(result));
        p.lesson.title += " changed without a new immutable version";
        intercepted++;
        return JSON.stringify(p);
      }
      return result;
    },
  });
  try {
    const uid = randomUUID();
    await repo.preview(uid, config);
    corrupt = true;
    await repo.preview(uid, config);
    assert.equal(intercepted, 0);
    await assert.rejects(
      new PostgresContentRepository(pool).view(uid, "l492-draft-v1"),
      /EXPANSION_MANIFEST_DRIFT/,
    );
    assert.equal(intercepted, 1);
  } finally {
    fs.readFileSync = originalRead;
    await pool.end();
  }
});
