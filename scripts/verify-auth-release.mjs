// Real application integration only: no model/Engineering Loop/controller work.
import fs from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  setupTechnicalDatabase,
  resetTechnicalRows,
} from "./auth-technical-db.mjs";
const dir = ".local-postgres/sprint11";
fs.mkdirSync(dir, { recursive: true });
const git = (args) =>
  execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
const head = git(["rev-parse", "HEAD"]),
  dirty = git(["status", "--porcelain=v1"]);
if (process.argv.includes("--require-clean") && dirty)
  throw Error(
    "Commit final source and preserve a clean tree before exact-commit verification",
  );
const tracked = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8", windowsHide: true },
)
  .split("\0")
  .filter(Boolean);
const source = [...new Set(tracked)]
  .filter(
    (p) =>
      /^(src\/|tests\/|scripts\/|supabase\/|package|playwright|next.config|eslint.config|tsconfig)/.test(
        p,
      ) && fs.existsSync(p),
  )
  .sort()
  .map((p) => ({
    path: p,
    sha256: createHash("sha256").update(fs.readFileSync(p)).digest("hex"),
  }));
const report = {
  startedAt: new Date().toISOString(),
  commit: head,
  cleanAtStart: !dirty,
  source,
  provider: "real-local-GoTrue",
  cloudVerified: false,
  completed: false,
  steps: [],
};
const file = dir + "/exact-source-auth.json";
function save() {
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
}
function run(name, args, env = {}) {
  return new Promise((resolve, reject) => {
    const out = fs.openSync(dir + "/" + name + ".log", "w");
    const child = spawn(process.execPath, args, {
      windowsHide: true,
      env: {
        ...process.env,
        CSH_AUTH_TECHNICAL_FIXTURE: "",
        CSH_AUTH_TEST_DATABASE: "sprint11",
        ...env,
      },
      stdio: ["ignore", out, out],
    });
    child.on("error", reject);
    child.on("close", (code) => {
      fs.closeSync(out);
      report.steps.push({ name, exitCode: code });
      save();
      if (code === 0) resolve();
      else reject(Error(name + " failed; inspect private evidence"));
    });
  });
}
try {
  save();
  await run("provider-tests", ["scripts/test-auth-provider.mjs"]);
  fs.copyFileSync(
    ".local-postgres/sprint10/provider-tests.json",
    dir + "/provider-tests.json",
  );
  await setupTechnicalDatabase();
  await run("isolated-database", [
    "node_modules/tsx/dist/cli.mjs",
    "--test",
    "--test-concurrency=1",
    "--test-reporter=junit",
    "--test-reporter-destination=" + dir + "/isolated-database.xml",
    "tests/database/auth-technical.test.ts",
  ]);
  await resetTechnicalRows();
  await run(
    "auth-browser",
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config",
      "playwright.sprint10.config.ts",
      "--reporter=list,junit",
    ],
    { PLAYWRIGHT_JUNIT_OUTPUT_FILE: dir + "/auth-browser.xml" },
  );
  await run(
    "journey-browser",
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config",
      "playwright.sprint11.config.ts",
      "--reporter=list,junit",
    ],
    { PLAYWRIGHT_JUNIT_OUTPUT_FILE: dir + "/journey-browser.xml" },
  );
  const changedSource = source.some(
    ({ path, sha256 }) =>
      !fs.existsSync(path) ||
      createHash("sha256").update(fs.readFileSync(path)).digest("hex") !==
        sha256,
  );
  if (git(["rev-parse", "HEAD"]) !== head || changedSource)
    throw Error(
      "Source changed during authentication verification; results are not final-source proof",
    );
  report.cleanAtEnd = !git(["status", "--porcelain=v1"]);
  if (process.argv.includes("--require-clean") && !report.cleanAtEnd)
    throw Error("Working tree changed during exact-commit verification");
  report.sourceUnchanged = true;
  report.completed = true;
  report.finishedAt = new Date().toISOString();
  save();
  console.log(
    "PASS real provider, isolated RLS, owner-security browser tests and synthetic authenticated learning journey; commit " +
      head +
      ". No cloud or content approval.",
  );
} catch (e) {
  save();
  console.error(e.message);
  process.exitCode = 1;
}
