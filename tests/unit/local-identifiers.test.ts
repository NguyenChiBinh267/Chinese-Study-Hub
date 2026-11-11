import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { z } from "zod";
import { packageSchema } from "../../src/modules/content/domain/package";
import { localCurriculumUuid } from "../../src/modules/curriculum/domain/local-identifiers";
import { studyHref } from "../../src/modules/planning/ui/study-panel";
import { assertLocalDraftAdvance } from "../../scripts/seed-curriculum";

test("Legacy local lesson UUIDs remain identical; larger HSK4 identifiers are distinct valid UUIDs", () => {
  for (let n = 101; n <= 496; n++)
    assert.equal(
      localCurriculumUuid(n),
      `62000000-0000-4000-8000-000000000${n}`,
    );
  const ids = [4001, 4024, 49001, 499999].map(localCurriculumUuid);
  assert.equal(new Set(ids).size, 4);
  ids.forEach((id) => z.uuid().parse(id));
  for (const n of [-1, 1.5, 1000000, NaN])
    assert.throws(() => localCurriculumUuid(n));
});
test("Extended IDs, version/prerequisite strings and Today links remain exact without numeric/lexical renaming", () => {
  const original = JSON.parse(
    fs.readFileSync("content/hsk24/L492.v1.json", "utf8"),
  );
  for (const id of ["L4001", "L4024", "L49001", "L499999"]) {
    const p = structuredClone(original);
    p.lesson.id = id;
    p.lesson.versionId = id.toLowerCase() + "-draft-v1";
    p.lesson.prerequisites = ["l492-draft-v1", "l4001-draft-v1"];
    packageSchema.parse(p);
    assert.equal(
      studyHref({
        id: "test",
        localDate: "2026-10-29",
        ordinal: 1,
        kind: "resume",
        target: p.lesson.versionId,
        targetIds: [p.lesson.versionId],
        estimatedMinutes: 10,
        status: "ready",
        reason: "RESUME_SAVED_CHECKPOINT",
      }),
      `/learn/draft/${id}?version=${p.lesson.versionId}`,
    );
  }
  for (const id of ["L40", "L4000000", "L-4001", "L4001/../x"]) {
    const p = structuredClone(original);
    p.lesson.id = id;
    assert.equal(packageSchema.safeParse(p).success, false);
  }
});

test("Local draft version advancement supports extended HSK4 IDs and still rejects unsafe changes", () => {
  const original = packageSchema.parse(
    JSON.parse(fs.readFileSync("content/hsk24/L492.v1.json", "utf8")),
  );
  for (const id of ["L492", "L4008", "L49001", "L499999"]) {
    const from = structuredClone(original);
    from.lesson.id = id;
    from.lesson.versionId = `${id.toLowerCase()}-draft-v1`;
    const to = structuredClone(from);
    to.lesson.version = 2;
    to.lesson.versionId = `${id.toLowerCase()}-draft-v2`;
    assert.doesNotThrow(() => assertLocalDraftAdvance(id, from, to));
    assert.throws(() => assertLocalDraftAdvance(id, to, from), /UNSAFE_LOCAL/);
    const changed = structuredClone(to);
    changed.concepts[0].meaning += " changed sense";
    assert.throws(
      () => assertLocalDraftAdvance(id, from, changed),
      /UNSAFE_LOCAL/,
    );
    assert.throws(
      () => assertLocalDraftAdvance("L3001", from, to),
      /UNSAFE_LOCAL/,
    );
    const publication = structuredClone(to);
    publication.publicationStatus = "APPROVED";
    assert.throws(
      () => assertLocalDraftAdvance(id, from, publication),
      /UNSAFE_LOCAL/,
    );
  }
});
