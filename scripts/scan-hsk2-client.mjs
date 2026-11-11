import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const root = process.argv[2] ?? ".next/hsk2-check/static",
  files = [];
const reportPath =
  process.argv[3] ??
  `.local-postgres/hsk24/${root.includes("hsk3-check") ? "hsk23-" : ""}${root.includes("/dev/") ? "dev-" : ""}client-isolation.json`;
if (
  !/^\.local-postgres\/hsk24\/[a-z0-9-]*client-isolation\.json$/.test(
    reportPath,
  )
)
  throw Error("EXPECTED_LOCAL_CLIENT_REPORT_PATH");
if (!/^\.next\/hsk[23]-check\/(?:dev\/)?static$/.test(root))
  throw Error("EXPECTED_ISOLATED_CURRICULUM_BUILD_PATH");
function visit(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) visit(file);
    else if (/\.(js|map)$/.test(file)) files.push(file);
  }
}
visit(root);
if (!files.length) throw Error("CLIENT_BUILD_MISSING");
const manifest = JSON.parse(
  fs.readFileSync("content/hsk24/manifest.json", "utf8"),
);
const corpus = manifest.packages.map((m) =>
  JSON.parse(fs.readFileSync(`content/hsk24/${m.file}`, "utf8")),
);
const markers = [
  ...new Set(corpus.flatMap((p) => p.privateKeys.map((k) => k.id))),
];
const hits = files.filter((f) => {
  const text = fs.readFileSync(f, "utf8");
  return markers.some((marker) => text.includes(marker));
});
if (hits.length) throw Error("PRIVATE_KEY_ID_IN_CLIENT");
const result = {
  passed: true,
  scope: root.includes("/dev/")
    ? "Local opt-in development client artifacts"
    : "Production default with local expansion disabled",
  files: files.length,
  bytes: files.reduce((n, f) => n + fs.statSync(f).size, 0),
  privateKeyIdsChecked: markers.length,
  markerHits: 0,
  artifactDigest: createHash("sha256")
    .update(
      files
        .sort()
        .map(
          (f) =>
            `${f}:${createHash("sha256").update(fs.readFileSync(f)).digest("hex")}`,
        )
        .join("\n"),
    )
    .digest("hex"),
  limits:
    "Bounded marker scan plus per-package public projection tests; not a formal leak proof. Server-provided draft feedback after submission remains expected.",
};
fs.writeFileSync(reportPath, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
