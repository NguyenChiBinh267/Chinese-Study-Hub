// Exact-source local acceptance. No existing database is reset or dropped.
import fs from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import pg from "pg";
import { adminConfig } from "./local-db.mjs";
const dir = ".local-postgres/private-preview";
fs.mkdirSync(dir, { recursive: true });
const git = (args) =>
  execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
const source = () =>
  Object.fromEntries(
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean)
      .sort()
      .map((p) => [
        p,
        createHash("sha256").update(fs.readFileSync(p)).digest("hex"),
      ]),
  );
const clean = () => !git(["status", "--porcelain=v1"]);
if (process.argv.includes("--require-clean") && !clean())
  throw Error("Commit final source first");
async function nativeFootprint() {
  const c = new pg.Client(adminConfig());
  await c.connect();
  try {
    await c.query("BEGIN READ ONLY");
    const tables = (
        await c.query(
          "SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('app_private','app_content') ORDER BY schemaname,tablename",
        )
      ).rows,
      result = {};
    for (const { schemaname, tablename } of tables) {
      if (!/^[a-z_]+$/.test(schemaname + tablename))
        throw Error("Unexpected table name");
      const rows = (
        await c.query(
          `SELECT row_to_json(t)::text AS doc FROM ${schemaname}.${tablename} t`,
        )
      ).rows
        .map((r) => r.doc)
        .sort();
      result[schemaname + "." + tablename] = {
        rows: rows.length,
        sha256: createHash("sha256").update(rows.join("\n")).digest("hex"),
      };
    }
    await c.query("COMMIT");
    return result;
  } finally {
    await c.end();
  }
}
const report = {
  startedAt: new Date().toISOString(),
  commit: git(["rev-parse", "HEAD"]),
  cleanAtStart: clean(),
  source: source(),
  completed: false,
  steps: [],
  cloudVerified: false,
  historyReset: false,
  nativeBefore: await nativeFootprint(),
};
const save = () =>
  fs.writeFileSync(
    dir + "/exact-commit.json",
    JSON.stringify(report, null, 2) + "\n",
  );
async function run(name, args) {
  const file = dir + "/" + name + ".log",
    fd = fs.openSync(file, "w");
  const code = await new Promise((resolve, reject) => {
    const c = spawn(process.execPath, args, {
      windowsHide: true,
      env: {
        ...process.env,
        CSH_PRIVATE_OWNER_PREVIEW: "",
        CSH_CONTENT_RELEASE: "",
        CSH_CONTENT_TEST_ROOT: "",
        CSH_AUTH_TECHNICAL_FIXTURE: "",
      },
      stdio: ["ignore", fd, fd],
    });
    c.on("error", reject);
    c.on("close", resolve);
  });
  fs.closeSync(fd);
  report.steps.push({ name, exitCode: code, log: file });
  save();
  if (code !== 0) throw Error(name + " failed; inspect private log");
}
try {
  save();
  await run("setup", [
    "node_modules/tsx/dist/cli.mjs",
    "scripts/private-preview-db.ts",
    "--fresh",
  ]);
  await run("unit", [
    "node_modules/tsx/dist/cli.mjs",
    "--test",
    ...fs
      .readdirSync("tests/unit")
      .filter((f) => f.endsWith(".test.ts"))
      .map((f) => "tests/unit/" + f),
  ]);
  await run("database", [
    "node_modules/tsx/dist/cli.mjs",
    "--test",
    "tests/database/private-preview.test.ts",
  ]);
  await run("browser", [
    "node_modules/@playwright/test/cli.js",
    "test",
    "--config",
    "playwright.private.config.ts",
  ]);
  report.nativeAfter = await nativeFootprint();
  report.nativeUnchanged =
    JSON.stringify(report.nativeBefore) === JSON.stringify(report.nativeAfter);
  report.sourceUnchanged =
    JSON.stringify(report.source) === JSON.stringify(source());
  report.cleanAtEnd = clean();
  if (
    !report.nativeUnchanged ||
    !report.sourceUnchanged ||
    report.commit !== git(["rev-parse", "HEAD"])
  )
    throw Error("History/source drift; reconcile before delivery");
  report.completed = true;
  report.finishedAt = new Date().toISOString();
  save();
  console.log(
    "PASS exact-source owner-only private preview; native data unchanged; online activation remains blocked.",
  );
} catch (e) {
  report.error = e.message;
  save();
  throw e;
}
