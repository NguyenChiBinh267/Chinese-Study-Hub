// Copy the actual application's small transaction dependency graph into this
// isolated proof root. The explicit public course-outline dependency is allowed;
// lesson bodies, other content files and private configuration stay excluded.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import ts from "typescript";
const project = path.dirname(fileURLToPath(import.meta.url)),
  root = path.resolve(project, "../.."),
  dest = path.join(project, ".generated-shared");
const config = ts.readConfigFile(
  path.join(root, "tsconfig.json"),
  ts.sys.readFile,
).config;
const options = ts.convertCompilerOptionsFromJson(
  config.compilerOptions,
  root,
).options;
options.baseUrl = root;
const visited = new Set(),
  files = [];
const outline = path.join(root, "content/curriculum/catalog.v1.json");
function copy(name) {
  const source = path.resolve(name);
  if (visited.has(source)) return;
  visited.add(source);
  const publicOutline = source === outline;
  if (
    !publicOutline &&
    (!source.startsWith(path.join(root, "src") + path.sep) ||
      !source.endsWith(".ts"))
  )
    throw Error("SHARED_SOURCE_ESCAPE");
  const bytes = fs.readFileSync(source),
    rel = path.relative(root, source),
    out = path.resolve(dest, rel);
  if (!out.startsWith(dest + path.sep)) throw Error("SHARED_TARGET_ESCAPE");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, bytes);
  files.push({
    path: rel.replaceAll("\\", "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  if (publicOutline) return;
  for (const i of ts.preProcessFile(bytes.toString()).importedFiles) {
    if (!i.fileName.startsWith(".") && !i.fileName.startsWith("@/")) continue;
    const r = ts.resolveModuleName(
      i.fileName,
      source,
      options,
      ts.sys,
    ).resolvedModule;
    if (!r) throw Error("UNRESOLVED_SHARED_IMPORT");
    copy(r.resolvedFileName);
  }
}
copy(path.join(root, "src/shared/db/transaction.ts"));
copy(path.join(root, "src/shared/db/tls.ts"));
fs.writeFileSync(
  path.join(dest, "manifest.json"),
  JSON.stringify({ files }, null, 2) + "\n",
);
console.log(
  `Copied ${files.length} runtime dependency files with exact hashes; only the explicit public outline, no lesson bodies or private configuration.`,
);
