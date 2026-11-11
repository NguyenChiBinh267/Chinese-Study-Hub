import test from "node:test";
import assert from "node:assert/strict";
import {
  loadPrivatePackages,
  loadPrivateOwnerPreview,
  privatePreviewAllowed,
} from "../../src/modules/content/application/private-preview";
import {
  gradeContent,
  publicProjection,
  transition,
} from "../../src/modules/content/domain/package";
import { lessonAccess } from "../../src/modules/curriculum/domain/catalog";
const { all } = loadPrivatePackages();
import { expectedKeys } from "../fixtures/private-preview";
test("Explicit four DRAFT versions, independent semantic keys and unchanged canonical publication gate", () => {
  for (const p of all) {
    assert.equal(p.state, "DRAFT");
    assert.equal(p.humanReview, null);
    assert.equal(p.rights.licenseDecision, "ORIGINAL_REVIEW_PENDING");
    assert.equal(lessonAccess(p, [], true, false).mayPractice, false);
    assert.throws(() => transition(p, "PUBLISHED"));
    assert.doesNotMatch(
      JSON.stringify(publicProjection(p)),
      /"(privateKeys|accepted|keyRef)"/,
    );
    for (const [i, e] of p.exercises.entries()) {
      const answer = expectedKeys[p.lesson.id][i];
      assert.deepEqual(p.privateKeys.find((k) => k.id === e.keyRef)!.accepted, [
        answer,
      ]);
      const response =
        e.type === "choice"
          ? { choice: e.choices.indexOf(answer) }
          : e.type === "sequence"
            ? { order: answer.split(",").map(Number) }
            : { text: answer };
      assert.equal(gradeContent(p, e.id, response).correct, true);
    }
  }
  assert.deepEqual(
    all
      .filter((p) => p.lesson.id.startsWith("L"))
      .flatMap((p) =>
        p.alignment.grammarReferences
          .filter((r) => r.status === "UNVERIFIED")
          .map((r) => r.id),
      )
      .sort(),
    ["g-jiao-pattern", "g-like-pattern"],
  );
});
test("Preview flag cannot activate online/production, other adapters or unselected DBs", () => {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "development",
    CSH_APP_MODE: "PRODUCTION_AUTHENTICATED",
    CSH_PRIVATE_OWNER_PREVIEW: "local-v1",
    CSH_APP_ORIGIN: "http://127.0.0.1:3025",
    CSH_AUTH_URL: "http://127.0.0.1:54390",
    DATABASE_URL:
      "postgresql://csh_runtime:dummy@127.0.0.1:5447/csh_private_verify_012345abcdef",
  };
  assert.equal(privatePreviewAllowed(env, "development"), true);
  for (const change of [
    { NODE_ENV: "production" },
    { CSH_APP_ORIGIN: "https://study.example.com" },
    { CSH_AUTH_URL: "https://provider.example.com" },
    {
      DATABASE_URL: env.DATABASE_URL!.replace("127.0.0.1", "cloud.example.com"),
    },
    { CSH_CONTENT_RELEASE: "release" },
    { CSH_AUTH_TECHNICAL_FIXTURE: "fixture" },
    { CSH_PRIVATE_OWNER_PREVIEW: "true" },
    {
      DATABASE_URL: env.DATABASE_URL!.replace(
        "csh_private_verify_012345abcdef",
        "csh_local",
      ),
    },
  ] as NodeJS.ProcessEnv[]) {
    assert.equal(
      privatePreviewAllowed({ ...env, ...change }, "development"),
      false,
    );
    assert.throws(() =>
      loadPrivateOwnerPreview({ ...env, ...change }, "development"),
    );
  }
  assert.equal(privatePreviewAllowed(env, "production"), false);
  assert.equal(
    loadPrivateOwnerPreview({ NODE_ENV: "production" }, "production"),
    null,
  );
});
