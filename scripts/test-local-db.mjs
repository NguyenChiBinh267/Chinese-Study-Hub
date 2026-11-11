import fs from "node:fs";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { adminConfig, localDirectory, migrationDigest } from "./local-db.mjs";
fs.mkdirSync(localDirectory, { recursive: true });
const xml = `${localDirectory}/db-tests.xml`;
// Run the actual security-proof suite first, including on a fresh migration.
// Node may sort input filenames, so argument ordering alone is not a gate.
const batches = [
  ["tests/database/foundation.test.ts"],
  [
    "tests/database/learning.test.ts",
    "tests/database/content.test.ts",
    "tests/database/study.test.ts",
    "tests/database/curriculum.test.ts",
  ],
];
let exitCode = 0;
const reports = [];
for (let i = 0; i < batches.length; i++) {
  const part = `${localDirectory}/db-tests-${i}.xml`;
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "--env-file=.env.local",
      "--test",
      "--test-concurrency=1",
      "--test-reporter=junit",
      `--test-reporter-destination=${part}`,
      ...batches[i],
    ],
    { windowsHide: true, stdio: "inherit", timeout: 120000 },
  );
  if (fs.existsSync(part))
    reports.push(
      fs
        .readFileSync(part, "utf8")
        .replace(/<\?xml[^>]*>/g, "")
        .replace(/<\/?testsuites[^>]*>/g, ""),
    );
  if (result.status !== 0) {
    exitCode = result.status ?? 1;
    break;
  }
}
fs.writeFileSync(xml, `<testsuites>${reports.join("\n")}</testsuites>`);
const result = { status: exitCode };
const report = fs.existsSync(xml) ? fs.readFileSync(xml, "utf8") : "";
const count = (report.match(/<testcase\b/g) ?? []).length;
const passed =
  result.status === 0 &&
  count >= 42 &&
  report.includes("</testsuites>") &&
  !/<(?:failure|error|skipped)\b/.test(report);
if (!passed) {
  const client = new pg.Client(adminConfig());
  try {
    await client.connect();
    await client.query("DELETE FROM app_meta.runtime_proof");
  } catch {
    /* Remain blocked if DB is unavailable. */
  } finally {
    await client.end();
  }
}
fs.writeFileSync(
  `${localDirectory}/integration-evidence.json`,
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      status: passed ? "PASS" : "BLOCKED",
      tests: count,
      exitCode: result.status,
      scope:
        "Native PostgreSQL local development only; not cloud T009 completion",
      migrationDigest: migrationDigest(),
      runtimeRole: "csh_runtime",
      poolMax: 1,
      gradingScope:
        "Legacy fixture and original unreviewed content drafts; no approved assessment",
      junit: ".local-postgres/db-tests.xml",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `${passed ? "PASS" : "BLOCKED"}: ${count} real local PostgreSQL checks. Evidence: .local-postgres/integration-evidence.json`,
);
process.exitCode = passed ? 0 : 1;
