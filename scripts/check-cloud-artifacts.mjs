// Scan built client/server artifacts against actual ignored credentials without printing them.
import fs from "node:fs";
import path from "node:path";
const root = process.cwd(),
  privateDir = path.join(root, ".local-postgres/cloud-gates"),
  arg = process.argv[2] ?? "benchmarks/cloud-proof/.next",
  build = path.resolve(arg);
if (
  !build.startsWith(root + path.sep) ||
  !fs.existsSync(path.join(build, "BUILD_ID"))
)
  throw Error("BUILT_WORKSPACE_ARTIFACT_REQUIRED");
const read = (n) =>
    JSON.parse(
      fs.readFileSync(path.join(privateDir, n), "utf8").replace(/^\uFEFF/, ""),
    ),
  secrets = [];
for (const n of ["connection.json", "runtime-connection.json"]) {
  if (!fs.existsSync(path.join(privateDir, n))) continue;
  for (const value of Object.values(read(n))) {
    if (typeof value !== "string" || !value.startsWith("postgres")) continue;
    secrets.push(value, decodeURIComponent(new URL(value).password));
  }
}
for (const n of ["auth-test-accounts.json", "expiry-session.json"]) {
  if (!fs.existsSync(path.join(privateDir, n))) continue;
  const visit = (o) => {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === "object") visit(v);
      else if (typeof v === "string" && /password|token/i.test(k))
        secrets.push(v);
    }
  };
  visit(read(n));
}
if (fs.existsSync(path.join(privateDir, "api-keys.json")))
  for (const k of read("api-keys.json")) if (k.api_key) secrets.push(k.api_key);
const needles = [...new Set(secrets.filter((s) => s.length >= 16))];
let clientFiles = 0,
  serverFiles = 0;
const findings = [];
function walk(dir, kind) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) walk(file, kind);
    else if (/\.(?:js|json|html|rsc|map|txt)$/.test(e.name)) {
      if (kind === "client") clientFiles++;
      else serverFiles++;
      const text = fs.readFileSync(file, "utf8");
      if (needles.some((secret) => text.includes(secret)))
        findings.push({
          file: path.relative(build, file),
          reason: "ACTUAL_CREDENTIAL_BYTES",
        });
      if (e.name.endsWith(".nft.json")) {
        const trace = JSON.parse(text);
        if (
          trace.files?.some((f) =>
            /(?:content[/\\](?:staging|releases)|review-packets|microphone-pilot|api-keys\.json|connection\.json)/.test(
              f,
            ),
          )
        )
          findings.push({
            file: path.relative(build, file),
            reason: "PRIVATE_RESOURCE_IN_SERVER_TRACE",
          });
      }
    }
  }
}
walk(path.join(build, "static"), "client");
walk(path.join(build, "server"), "server");
const report = {
  at: new Date().toISOString(),
  build: path.relative(root, build).replaceAll("\\", "/"),
  clientFiles,
  serverFiles,
  actualSensitiveValuesChecked: needles.length,
  findings,
  safe: findings.length === 0,
  secretBytesPrinted: false,
};
fs.writeFileSync(
  path.join(privateDir, "artifact-scan.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    clientFiles,
    serverFiles,
    safe: report.safe,
    findings: findings.length,
  }),
);
if (!report.safe) process.exitCode = 1;
