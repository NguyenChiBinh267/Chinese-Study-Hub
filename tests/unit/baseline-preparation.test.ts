import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

test("Fresh local preparation copies the current transaction graph and only its explicit public outline", () => {
  execFileSync(
    process.execPath,
    ["benchmarks/cloud-proof/prepare-shared.mjs"],
    { stdio: "pipe" },
  );
  const manifest = JSON.parse(
    fs.readFileSync(
      "benchmarks/cloud-proof/.generated-shared/manifest.json",
      "utf8",
    ),
  ) as { files: Array<{ path: string; sha256: string }> };
  assert.ok(
    manifest.files.some((f) => f.path === "src/shared/db/transaction.ts"),
  );
  assert.ok(
    manifest.files.some((f) => f.path === "content/curriculum/catalog.v1.json"),
  );
  for (const file of manifest.files) {
    assert.ok(
      file.path.startsWith("src/") ||
        file.path === "content/curriculum/catalog.v1.json",
    );
    assert.doesNotMatch(
      file.path,
      /(?:\.env|hsk24|private-preview|credentials)/,
    );
    for (const prefix of ["", "benchmarks/cloud-proof/.generated-shared/"])
      assert.equal(
        createHash("sha256")
          .update(fs.readFileSync(prefix + file.path))
          .digest("hex"),
        file.sha256,
      );
  }
});
