// Verify the integration worktree without changing Git, policy or source files.
import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  }).trim();
const manifest = JSON.parse(
  fs.readFileSync("docs/integration/app-baseline-import-manifest.json", "utf8"),
);
const entries = (ref) =>
  git("ls-tree", "-r", "-z", ref)
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const [metadata, path] = line.split("\t");
      const [mode, type, blob] = metadata.split(" ");
      return { path, mode, type, blob };
    });
const main = entries(manifest.pinnedMain);
assert.deepEqual(main, manifest.mainFiles);
execFileSync("git", [
  "merge-base",
  "--is-ancestor",
  manifest.pinnedMain,
  "HEAD",
]);
const files = [
  ...new Set([
    ...main.map((x) => x.path),
    ...manifest.files.filter((x) => x.decision === "IMPORT").map((x) => x.path),
  ]),
];
const values = execFileSync("git", ["hash-object", "--stdin-paths"], {
  input: files.join("\n") + "\n",
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
})
  .trim()
  .split("\n");
assert.equal(values.length, files.length);
const hashes = new Map(files.map((file, i) => [file, values[i]]));
let protectedExact = 0;
for (const file of main) {
  if ([".gitignore", ".gitattributes"].includes(file.path)) {
    const original = execFileSync("git", ["show", `${manifest.pinnedMain}:${file.path}`], { encoding: "utf8" });
    const current = fs.readFileSync(file.path, "utf8").replace(/\r\n/g, "\n");
    assert.ok(
      current.startsWith(original),
      `MAIN_CONFIG_PREFIX_CHANGED:${file.path}`,
    );
  } else {
    assert.equal(
      hashes.get(file.path),
      file.blob,
      `MAIN_FILE_CHANGED:${file.path}`,
    );
    protectedExact++;
  }
}
const adjustments = new Set(manifest.integrationAdjustments.map((x) => x.path));
let importedExact = 0;
for (const file of manifest.files.filter((x) => x.decision === "IMPORT")) {
  if (!adjustments.has(file.path)) {
    assert.equal(
      hashes.get(file.path),
      file.blob,
      `SOURCE_IMPORT_CHANGED:${file.path}`,
    );
    importedExact++;
  }
}
const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
assert.ok(
  !tracked.some((file) =>
    /(^|\/)(?:node_modules|\.next|\.local-postgres|\.engineering-loop|graphify-out|test-results|playwright-report)(\/|$)/.test(
      file,
    ),
  ),
);
assert.ok(
  !tracked.some(
    (file) => /(^|\/)\.env(?:\.|$)/.test(file) && file !== ".env.example",
  ),
);
assert.ok(!tracked.includes("next-env.d.ts"));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
let directDependencies = 0;
for (const kind of ["dependencies", "devDependencies"]) {
  assert.deepEqual(pkg[kind], lock.packages[""][kind]);
  for (const name of Object.keys(pkg[kind])) {
    const installed = JSON.parse(
      fs.readFileSync(`node_modules/${name}/package.json`, "utf8"),
    );
    assert.equal(
      installed.version,
      lock.packages[`node_modules/${name}`].version,
      `INSTALLED_LOCK_MISMATCH:${name}`,
    );
    directDependencies++;
  }
}
console.log(
  JSON.stringify({
    head: git("rev-parse", "HEAD"),
    sourceCommit: manifest.sourceCommit,
    pinnedMain: manifest.pinnedMain,
    protectedMainFilesExact: protectedExact,
    mainConfigAppendOnly: 2,
    sourceFilesExact: importedExact,
    adjustedImportedFiles: manifest.files
      .filter((x) => x.decision === "IMPORT" && adjustments.has(x.path))
      .map((x) => x.path),
    directDependenciesMatchLock: directDependencies,
    generatedOrSecretFilesTracked: false,
    gitWrites: false,
  }),
);
