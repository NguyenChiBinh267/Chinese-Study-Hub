// Product acceptance only. Fresh isolated token databases preserve all previous history.
import fs from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
const dir = ".local-postgres/sprint12";
fs.mkdirSync(dir, { recursive: true });
const git = (args) =>
    execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim(),
  head = git(["rev-parse", "HEAD"]),
  clean = () => !git(["status", "--porcelain=v1"]),
  requireClean = process.argv.includes("--require-clean");
if (requireClean && !clean())
  throw Error("Commit final source and preserve a clean tree first");
const source = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter((p) =>
        /^(\.gitattributes$|src\/|tests\/|scripts\/|supabase\/|content\/|package|playwright|next.config|eslint.config|tsconfig)/.test(
          p,
        ),
      ),
  ),
]
  .sort()
  .map((path) => ({
    path,
    sha256: createHash("sha256").update(fs.readFileSync(path)).digest("hex"),
  }));
const report = {
  startedAt: new Date().toISOString(),
  commit: head,
  cleanAtStart: clean(),
  source,
  completed: false,
  sourceUnchanged: false,
  cloudVerified: false,
  historyReset: false,
  steps: [],
};
const file = dir + "/exact-commit-auth.json",
  save = () => fs.writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
function run(name, args, env = {}) {
  return new Promise((resolve, reject) => {
    const fd = fs.openSync(dir + "/" + name + ".log", "w"),
      child = spawn(process.execPath, args, {
        windowsHide: true,
        env: {
          ...process.env,
          CSH_CONTENT_TEST_ROOT: "",
          CSH_CONTENT_RELEASE: "",
          CSH_AUTH_TECHNICAL_FIXTURE: "",
          ...env,
        },
        stdio: ["ignore", fd, fd],
      });
    child.on("error", reject);
    child.on("close", (code) => {
      fs.closeSync(fd);
      report.steps.push({ name, exitCode: code });
      save();
      if (code === 0) resolve();
      else reject(Error(name + " failed; inspect private evidence"));
    });
  });
}
async function authScope(label) {
  const stateDir = dir + "/" + label + "-" + randomBytes(3).toString("hex"),
    env = {
      CSH_AUTH_FIXTURE_STATE_DIR: stateDir,
      CSH_AUTH_TEST_DATABASE: "sprint12",
      CSH_PRESERVE_TEST_HISTORY: "1",
    };
  await run(
    label + "-setup",
    [
      "--input-type=module",
      "-e",
      "await (await import('./scripts/auth-technical-db.mjs')).setupTechnicalDatabase()",
    ],
    env,
  );
  await run(
    label + "-sql",
    [
      "node_modules/tsx/dist/cli.mjs",
      "--test",
      "--test-reporter=junit",
      "--test-reporter-destination=" + dir + "/" + label + "-sql.xml",
      "tests/database/auth-technical.test.ts",
    ],
    env,
  );
  return env;
}
try {
  save();
  await run("provider-tests", ["scripts/test-auth-provider.mjs"]);
  fs.copyFileSync(
    ".local-postgres/sprint10/provider-tests.json",
    dir + "/provider-tests.json",
  );
  const authEnv = await authScope("auth");
  await run(
    "auth-browser",
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config",
      "playwright.sprint10.config.ts",
      "--reporter=list,junit",
    ],
    { ...authEnv, PLAYWRIGHT_JUNIT_OUTPUT_FILE: dir + "/auth-browser.xml" },
  );
  for (const project of ["desktop", "mobile"]) {
    const env = await authScope("token-" + project);
    await run(
      "token-" + project + "-browser",
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        "--config",
        "playwright.sprint11.config.ts",
        "--project",
        project,
        "--reporter=list,junit",
      ],
      {
        ...env,
        PLAYWRIGHT_JUNIT_OUTPUT_FILE:
          dir + "/token-" + project + "-browser.xml",
      },
    );
  }
  await run("release-setup", [
    "node_modules/tsx/dist/cli.mjs",
    "scripts/release-test-db.ts",
  ]);
  await run("release-sql", [
    "node_modules/tsx/dist/cli.mjs",
    "--test",
    "--test-reporter=junit",
    "--test-reporter-destination=" + dir + "/release-sql.xml",
    "tests/database/content-release.test.ts",
  ]);
  await run(
    "release-browser",
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config",
      "playwright.sprint12.config.ts",
      "--reporter=list,junit",
    ],
    { PLAYWRIGHT_JUNIT_OUTPUT_FILE: dir + "/release-browser.xml" },
  );
  if (
    git(["rev-parse", "HEAD"]) !== head ||
    source.some(
      (s) =>
        !fs.existsSync(s.path) ||
        createHash("sha256").update(fs.readFileSync(s.path)).digest("hex") !==
          s.sha256,
    )
  )
    throw Error("Source changed during acceptance");
  report.cleanAtEnd = clean();
  if (requireClean && !report.cleanAtEnd)
    throw Error("Working tree changed during acceptance");
  report.sourceUnchanged = true;
  report.completed = true;
  report.finishedAt = new Date().toISOString();
  save();
  console.log(
    "PASS real GoTrue, Auth security, token regressions without truncation, publication journey and SQL on " +
      head +
      "; no cloud or real content approval.",
  );
} catch (e) {
  save();
  console.error(e.message);
  process.exitCode = 1;
}
