// Explicit, bounded source export; full local Git history and private packages
// are never copied. Run from the original workspace, not the export checkout.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = process.cwd(),
  dest = path.resolve(".local-postgres/t053/application");
const git = (args, cwd = root) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
if (
  root !== "D:\\Chinese-Study-Hub" ||
  git(["branch", "--show-current"], dest) !== "feat/t053-private-owner"
)
  throw Error("PINNED_EXPORT_WORKTREE_REQUIRED");
const source = git(["rev-parse", "HEAD"]),
  files = [];
function copy(rel) {
  const p = path.join(root, rel),
    s = fs.statSync(p);
  if (s.isDirectory()) {
    for (const e of fs.readdirSync(p)) copy(path.join(rel, e));
    return;
  }
  fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true });
  fs.copyFileSync(p, path.join(dest, rel));
  files.push({
    path: rel.replaceAll("\\", "/"),
    sha256: createHash("sha256").update(fs.readFileSync(p)).digest("hex"),
  });
}
for (const rel of [
  "src",
  "supabase/migrations",
  "content/curriculum",
  "content/pronunciation",
  "content/private-preview/selection.json",
  "content/releases/trusted.json",
  "content/staging/slice/source-pin.json",
  "content/staging/slice/source-evidence.json",
  "next.config.ts",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  ".gitignore",
])
  copy(rel);
fs.appendFileSync(path.join(dest, ".gitignore"), "\n.vercel/\n");
fs.writeFileSync(
  path.join(dest, ".vercelignore"),
  ".git\n.next\nnode_modules\n.local-postgres\n.engineering-loop\ndocs\nscripts\ntests\nbenchmarks\nAGENTS.md\n",
);
const pkg = JSON.parse(
  fs.readFileSync(path.join(dest, "package.json"), "utf8"),
);
pkg.scripts = {
  dev: "next dev --hostname 127.0.0.1",
  build: "next build",
  start: "next start",
  lint: "eslint src next.config.ts",
  typecheck: "tsc --noEmit",
};
pkg.engines = { node: "24.x" };
fs.writeFileSync(
  path.join(dest, "package.json"),
  JSON.stringify(pkg, null, 2) + "\n",
);
const lock = JSON.parse(
  fs.readFileSync(path.join(dest, "package-lock.json"), "utf8"),
);
lock.packages[""].engines = pkg.engines;
fs.writeFileSync(
  path.join(dest, "package-lock.json"),
  JSON.stringify(lock, null, 2) + "\n",
);
fs.writeFileSync(
  path.join(dest, "vercel.json"),
  JSON.stringify(
    {
      framework: "nextjs",
      regions: ["sin1"],
      git: { deploymentEnabled: false },
      headers: [
        {
          source: "/(.*)",
          headers: [
            { key: "X-Robots-Tag", value: "noindex, nofollow" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "same-origin" },
          ],
        },
      ],
    },
    null,
    2,
  ) + "\n",
);
fs.mkdirSync(path.join(dest, "docs/t053"), { recursive: true });
fs.writeFileSync(
  path.join(dest, "docs/t053/source-export.json"),
  JSON.stringify(
    {
      sourceLocalCommit: source,
      base: git(["rev-parse", "origin/main"]),
      policy: "PRIVATE_OWNER_PREVIEW",
      packages:
        "Four hash-allowlisted originals supplied only via sensitive production server environment. No package files exported.",
      files,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Exported ${files.length} application/configuration files; no private packages or local history.`,
);
