// Local-only immutable wording repairs; concept identities and old files stay pinned.
import fs from "node:fs";
import {
  contentHash,
  loadDraftCatalog,
} from "../src/modules/content/application/catalog";
import {
  validatePackage,
  type ContentPackage,
} from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const input = process.argv[2];
if (!input?.startsWith(".local-postgres/hsk24/") || !input.endsWith(".json"))
  throw Error("BOUNDED_REPAIR_FILE");
const repairs = JSON.parse(fs.readFileSync(input, "utf8")) as {
  id: string;
  replacements: [string, string][];
  support?: string;
}[];
const dir = "content/hsk24",
  read = (f: string) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json");
const { packages, evidence } = loadDraftCatalog();
const outputs: ContentPackage[] = [];
for (const repair of repairs) {
  if (!/^L4\d{2,5}$/.test(repair.id)) throw Error("HSK4_ONLY");
  const row = catalog.lessons.find((l: { key: string }) => l.key === repair.id);
  const original = packages.find(
    (p) => p.lesson.versionId === row?.currentVersion,
  );
  if (!original) throw Error("UNKNOWN_CURRENT");
  const p = structuredClone(original);
  const replace = (v: unknown): unknown =>
    typeof v === "string"
      ? repair.replacements.reduce((s, [a, b]) => s.replaceAll(a, b), v)
      : Array.isArray(v)
        ? v.map(replace)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.entries(v).map(([k, x]) => [k, replace(x)]),
            )
          : v;
  p.blocks = replace(p.blocks) as ContentPackage["blocks"];
  p.exercises = replace(p.exercises) as ContentPackage["exercises"];
  p.privateKeys = replace(p.privateKeys) as ContentPackage["privateKeys"];
  if (
    JSON.stringify(p.concepts) !== JSON.stringify(original.concepts) ||
    JSON.stringify(p.alignment) !== JSON.stringify(original.alignment)
  )
    throw Error("IDENTITY_OR_REFERENCE_MUTATION");
  const version = original.lesson.version + 1,
    prefix = repair.id.toLowerCase();
  p.lesson.version = version;
  p.lesson.versionId = `${prefix}-draft-v${version}`;
  if (repair.support) {
    const guide = p.blocks[0];
    if (guide.type !== "teaching") throw Error("GUIDE");
    guide.text += " " + repair.support;
  }
  for (const [i, e] of p.exercises.entries()) {
    const oldId = e.id,
      k = p.privateKeys.find((k) => k.id === e.keyRef)!;
    e.id = `${prefix}-v${version}-e${i}`;
    e.keyRef = `${prefix}-v${version}-k${i}`;
    k.id = e.keyRef;
    k.exerciseVersionId = e.id;
    for (const b of p.blocks)
      if (b.type === "exercise" && b.exerciseVersionId === oldId)
        b.exerciseVersionId = e.id;
  }
  p.packageHash = contentHash(p);
  outputs.push(p);
}
for (const p of outputs) {
  const file = `${p.lesson.id}.v${p.lesson.version}.json`;
  if (
    fs.existsSync(`${dir}/${file}`) ||
    validatePackage(p, [...packages, ...outputs], evidence).length
  )
    throw Error("INVALID_OR_EXISTING_REPAIR");
}
for (const p of outputs) {
  const file = `${p.lesson.id}.v${p.lesson.version}.json`;
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(p, null, 2) + "\n");
  manifest.packages.push({
    file,
    versionId: p.lesson.versionId,
    sha256: p.packageHash,
  });
  catalog.lessons.find(
    (l: { key: string }) => l.key === p.lesson.id,
  ).currentVersion = p.lesson.versionId;
}
for (const [file, value] of [
  ["manifest.json", manifest],
  ["catalog.json", catalog],
] as const)
  fs.writeFileSync(`${dir}/${file}`, JSON.stringify(value, null, 2) + "\n");
console.log(
  JSON.stringify({
    immutableRepairs: outputs.map((p) => p.lesson.versionId),
    originalsRetained: true,
  }),
);
