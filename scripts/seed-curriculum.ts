import pg from "pg";
import { adminConfig } from "./local-db.mjs";
import { loadCurriculum } from "../src/modules/curriculum/application/catalog";
import { loadDraftCatalog } from "../src/modules/content/application/catalog";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
import type { ContentPackage } from "../src/modules/content/domain/package";
export function assertLocalDraftAdvance(
  key: string,
  from: ContentPackage | undefined,
  to: ContentPackage | undefined,
) {
  if (
    !from ||
    !to ||
    !(
      (/^L4\d{2,5}$/.test(key) &&
        from?.alignment.targetLevel === 4 &&
        to?.alignment.targetLevel === 4) ||
      (/^L1\d{2,5}$/.test(key) &&
        from?.alignment.targetLevel === 1 &&
        to?.alignment.targetLevel === 1) ||
      (/^F0[3-5]$/.test(key) &&
        from?.lesson.classification === "FOUNDATION_INTERNAL" &&
        to?.lesson.classification === "FOUNDATION_INTERNAL" &&
        from?.alignment.targetLevel === null &&
        to?.alignment.targetLevel === null)
    ) ||
    from.lesson.id !== key ||
    to.lesson.id !== key ||
    to.lesson.version <= from.lesson.version ||
    JSON.stringify(from.concepts) !== JSON.stringify(to.concepts) ||
    to.state !== "DRAFT" ||
    from.state !== "DRAFT" ||
    to.publicationStatus !== "BLOCKED" ||
    from.publicationStatus !== "BLOCKED" ||
    to.humanReview !== null ||
    from.humanReview !== null
  )
    throw Error("UNSAFE_LOCAL_DRAFT_ADVANCE");
}
export async function seedCurriculum(
  database = "csh_local",
  options: { advanceLocalDraftVersions?: boolean } = {},
) {
  if (
    options.advanceLocalDraftVersions &&
    (!expansionEnabled() || !/^csh_hsk24_[a-f0-9]{12}$/.test(database))
  )
    throw Error("ISOLATED_DRAFT_ADVANCE_REQUIRED");
  if (expansionEnabled() && !/^csh_hsk24_[a-f0-9]{12}$/.test(database))
    throw Error("ISOLATED_CURRICULUM_DATABASE_REQUIRED");
  const data = loadCurriculum(),
    { packages } = loadDraftCatalog(),
    c = new pg.Client(adminConfig(database));
  const versionAdvances: { lesson: string; from: string; to: string }[] = [];
  await c.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(82417006)");
    // Immutable associations: do not silently repoint an existing current version.
    async function insert(
      sql: string,
      args: unknown[],
      read: string,
      expected: unknown,
    ) {
      await c.query(sql, args);
      const actual = (await c.query(read, [args[0]])).rows[0]?.doc;
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        // JSONB key order differs from JS; compare canonical JSON below.
        const canonical = (v: unknown): string =>
          JSON.stringify(v, (_k, x) =>
            x && typeof x === "object" && !Array.isArray(x)
              ? Object.fromEntries(
                  Object.entries(x).sort(([a], [b]) => a.localeCompare(b)),
                )
              : x,
          );
        if (canonical(actual) !== canonical(expected))
          throw new Error("CURRICULUM_IMMUTABLE_CONFLICT");
      }
    }
    for (const x of data.courses)
      await insert(
        "INSERT INTO app_content.courses VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING",
        [
          x.id,
          x.code,
          x.title,
          x.description,
          x.order,
          x.syllabusId,
          x.releaseRef,
          x.availability,
          x.coverageVerified,
        ],
        "SELECT jsonb_build_object('id',id,'code',code,'title',title,'description',description,'order',ordinal,'syllabusId',syllabus_id,'releaseRef',release_ref,'availability',availability,'coverageVerified',coverage_verified) AS doc FROM app_content.courses WHERE id=$1",
        x,
      );
    for (const x of data.units) {
      const { prerequisites, ...body } = x;
      void prerequisites;
      await insert(
        "INSERT INTO app_content.units VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING",
        [
          x.id,
          x.courseId,
          x.slug,
          x.order,
          x.title,
          x.objective,
          x.availability,
        ],
        "SELECT jsonb_build_object('id',id,'courseId',course_id,'slug',slug,'order',ordinal,'title',title,'objective',objective,'availability',availability) AS doc FROM app_content.units WHERE id=$1",
        body,
      );
    }
    for (const x of data.lessons) {
      if (options.advanceLocalDraftVersions) {
        const existing = (
          await c.query(
            "SELECT current_version FROM app_content.lessons WHERE id=$1 FOR UPDATE",
            [x.id],
          )
        ).rows[0];
        if (existing && existing.current_version !== x.currentVersion) {
          const from = packages.find(
              (p) => p.lesson.versionId === existing.current_version,
            ),
            to = packages.find((p) => p.lesson.versionId === x.currentVersion);
          // Explicit local HSK4 pointer advance only. Old immutable associations and
          // session/card/attempt rows remain pinned; downgrade and changed senses fail.
          assertLocalDraftAdvance(x.key, from, to);
          await c.query(
            "UPDATE app_content.lessons SET current_version=$1 WHERE id=$2 AND current_version=$3",
            [x.currentVersion, x.id, existing.current_version],
          );
          versionAdvances.push({
            lesson: x.key,
            from: existing.current_version,
            to: x.currentVersion,
          });
        }
      }
      await insert(
        "INSERT INTO app_content.lessons VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING",
        [x.id, x.unitId, x.key, x.order, x.currentVersion, x.localDraftAllowed],
        "SELECT jsonb_build_object('id',id,'unitId',unit_id,'key',stable_key,'order',ordinal,'currentVersion',current_version,'localDraftAllowed',local_draft_allowed) AS doc FROM app_content.lessons WHERE id=$1",
        {
          id: x.id,
          unitId: x.unitId,
          key: x.key,
          order: x.order,
          currentVersion: x.currentVersion,
          localDraftAllowed: x.localDraftAllowed,
        },
      );
    }
    for (const p of packages) {
      const l = data.lessons.find((l) => l.key === p.lesson.id);
      if (!l) throw new Error("UNASSOCIATED_VERSION");
      await insert(
        "INSERT INTO app_content.lesson_versions VALUES($1,$2,$3) ON CONFLICT(package_id) DO NOTHING",
        [p.lesson.versionId, l.id, p.lesson.version],
        "SELECT jsonb_build_object('package',package_id,'lesson',lesson_id,'version',version) AS doc FROM app_content.lesson_versions WHERE package_id=$1",
        {
          package: p.lesson.versionId,
          lesson: l.id,
          version: p.lesson.version,
        },
      );
    }
    for (const u of data.units)
      for (const p of u.prerequisites)
        await c.query(
          "INSERT INTO app_content.unit_prerequisites VALUES($1,$2) ON CONFLICT DO NOTHING",
          [u.id, p],
        );
    for (const l of data.lessons)
      for (const r of l.requirements)
        await c.query(
          "INSERT INTO app_content.lesson_skill_prerequisites VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [l.id, r.conceptId, r.skill, r.rule],
        );
    const actualDeps = (
      await c.query(
        "SELECT unit_id,required_unit_id FROM app_content.unit_prerequisites",
      )
    ).rows
      .map((r) => `${r.unit_id}:${r.required_unit_id}`)
      .sort();
    const expectedDeps = data.units
      .flatMap((u) => u.prerequisites.map((p) => `${u.id}:${p}`))
      .sort();
    const actualReqs = (
      await c.query(
        "SELECT lesson_id,concept_id,skill,rule FROM app_content.lesson_skill_prerequisites",
      )
    ).rows
      .map((r) => `${r.lesson_id}:${r.concept_id}:${r.skill}:${r.rule}`)
      .sort();
    const expectedReqs = data.lessons
      .flatMap((l) =>
        l.requirements.map(
          (r) => `${l.id}:${r.conceptId}:${r.skill}:${r.rule}`,
        ),
      )
      .sort();
    if (
      JSON.stringify(actualDeps) !== JSON.stringify(expectedDeps) ||
      JSON.stringify(actualReqs) !== JSON.stringify(expectedReqs)
    )
      throw new Error("CURRICULUM_PREREQUISITE_DRIFT");
    for (const [table, count] of [
      ["courses", data.courses.length],
      ["units", data.units.length],
      ["lessons", data.lessons.length],
      ["lesson_versions", packages.length],
    ] as const)
      if (
        (await c.query(`SELECT count(*)::int AS n FROM app_content.${table}`))
          .rows[0].n !== count
      )
        throw new Error("CURRICULUM_SCOPE_DRIFT");
    await c.query("COMMIT");
    console.log(
      `Curriculum registered: ${data.courses.length} courses, ${data.units.length} units, ${data.lessons.length} lessons, ${packages.length} immutable version bindings. Nothing published.`,
    );
    return versionAdvances;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/seed-curriculum.ts")) {
  const database = process.argv[2] ?? "csh_local";
  if (!/^(csh_local|csh_sprint6_restore_[a-f0-9]+)$/.test(database))
    throw new Error("Only project/disposable databases allowed");
  seedCurriculum(database).catch(() => {
    console.error("Curriculum registration failed; no private data logged.");
    process.exitCode = 1;
  });
}
