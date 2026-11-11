// A reviewable, source-only export. No Git ref or remote is changed.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createHash } from "node:crypto";
const root = process.cwd(),
  source = "benchmarks/cloud-proof",
  dest = path.resolve(".local-postgres/cloud-gates/proof-export");
const files = [];
function put(name, bytes) {
  const target = path.resolve(dest, name);
  if (!target.startsWith(dest + path.sep)) throw Error("EXPORT_ESCAPE");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  files.push({
    path: name,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      e.name.startsWith(".") ||
      e.name === "node_modules" ||
      e.name === "next-env.d.ts"
    )
      continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.(tsx?|json)$/.test(e.name)) {
      let bytes = fs.readFileSync(f);
      let rel = path.relative(source, f).replaceAll("\\", "/");
      if (rel === "lib/runtime.ts")
        bytes = Buffer.from(
          bytes
            .toString()
            .replace(
              '"../.generated-shared/src/shared/db/transaction"',
              '"../src/shared/db/transaction"',
            ),
        );
      if (rel === "lib/config.ts")
        bytes = Buffer.from(
          bytes
            .toString()
            .replace(
              '"../.generated-shared/src/shared/db/tls"',
              '"../src/shared/db/tls"',
            ),
        );
      if (rel === "tsconfig.json") {
        const j = JSON.parse(bytes.toString());
        j.compilerOptions.paths = { "@/*": ["./src/*"] };
        bytes = Buffer.from(JSON.stringify(j, null, 2) + "\n");
      }
      if (rel === "package.json") {
        const j = JSON.parse(bytes.toString());
        delete j.scripts.prebuild;
        delete j.scripts.predev;
        j.scripts["test:security"] =
          "tsx --test tests/unit/cloud-gates.test.ts";
        j.scripts["test:cloud:sql"] = "tsx scripts/test-cloud-db.ts --verify";
        j.scripts["test:host:browser"] =
          "playwright test --config playwright.host.config.ts";
        j.devDependencies.tsx = "4.23.15";
        bytes = Buffer.from(JSON.stringify(j, null, 2) + "\n");
      }
      if (rel === "next.config.ts")
        bytes = Buffer.from(
          'import type {NextConfig} from "next";\nconst config:NextConfig={poweredByHeader:false,devIndicators:false,turbopack:{root:process.cwd()},outputFileTracingRoot:process.cwd()};\nexport default config;\n',
        );
      put(rel, bytes);
    }
  }
}
walk(source);
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile).config;
const options = ts.convertCompilerOptionsFromJson(
  config.compilerOptions,
  root,
).options;
const visited = new Set();
function closure(name) {
  const abs = path.resolve(name);
  if (visited.has(abs)) return;
  visited.add(abs);
  if (
    !abs.startsWith(path.join(root, "src") + path.sep) ||
    !abs.endsWith(".ts")
  )
    throw Error("UNEXPECTED_SHARED_SOURCE");
  const text = fs.readFileSync(abs, "utf8");
  put(path.relative(root, abs).replaceAll("\\", "/"), Buffer.from(text));
  for (const i of ts.preProcessFile(text).importedFiles) {
    if (!i.fileName.startsWith(".") && !i.fileName.startsWith("@/")) continue;
    const resolved = ts.resolveModuleName(
      i.fileName,
      abs,
      options,
      ts.sys,
    ).resolvedModule;
    if (!resolved) throw Error("UNRESOLVED_SHARED_IMPORT");
    closure(resolved.resolvedFileName);
  }
}
closure("src/shared/db/transaction.ts");
closure("src/shared/db/tls.ts");
for (const name of [
  "cloud-gates-policy.ts",
  "cloud-gates-db.ts",
  "test-cloud-db.ts",
  "cloud-auth-bootstrap.mjs",
  "test-cloud-auth.mjs",
  "configure-cloud-cli.ps1",
  "benchmark-cloud-proof.mjs",
  "check-cloud-artifacts.mjs",
  "check-cloud-push.mjs",
  "configure-cloud-credential.ps1",
])
  put("scripts/" + name, fs.readFileSync("scripts/" + name));
put(
  "tests/unit/cloud-gates.test.ts",
  Buffer.from(
    fs
      .readFileSync("tests/unit/cloud-gates.test.ts", "utf8")
      .replace(
        '"../../benchmarks/cloud-proof/lib/config"',
        '"../../lib/config"',
      ),
  ),
);
put(
  "tests/fixtures/supabase-prod-ca-2021.crt",
  fs.readFileSync("tests/fixtures/supabase-prod-ca-2021.crt"),
);
put(
  ".gitattributes",
  Buffer.from("tests/fixtures/supabase-prod-ca-2021.crt -text\n"),
);
for (const n of fs
  .readdirSync("supabase/migrations")
  .filter((n) => n.endsWith(".sql")))
  put("supabase/migrations/" + n, fs.readFileSync("supabase/migrations/" + n));
put(
  ".gitignore",
  Buffer.from(
    "node_modules/\n.next/\n.env*\n!.env.example\n.vercel/\n.local-postgres/\nnext-env.d.ts\n*.tsbuildinfo\n",
  ),
);
put(
  "README.md",
  Buffer.from(
    "# Temporary cloud gate proof\n\nSynthetic transactions only. No learning content, answer keys, reviewer packets or local history. Auth-protected routes use remotely verified owner identity and the existing application transaction/RLS helper. Deploy only after actual Free eligibility and cloud security checks; remove the temporary deployment after bounded measurements. No T053 release.\n\nRun `npm ci`, `npm run test:security`, and `npm run build`. Server-only configuration: CSH_PROOF_MODE=cloud-benchmark-v1, CSH_PROJECT_REF, CSH_POOLER_HOST, CSH_AUTH_URL, CSH_AUTH_PUBLISHABLE_KEY, OWNER_USER_ID, DATABASE_URL (custom runtime role, sslmode=verify-full), CSH_DATABASE_CA_PEM (pinned provider certificate), CSH_PROOF_COMMIT (exact tested source), and CSH_APP_ORIGIN (canonical HTTPS proof origin). Never provide admin or service-role credentials to the app.\n\nThe manual `node scripts/benchmark-cloud-proof.mjs --measure` requires matching ignored cloud-gate account/config/benchmark-target files from the authorized bootstrap; it performs only five fresh-client and twenty warm measurements. `npm run test:host:browser` uses the same ignored target/account files and requires an installed Playwright Chromium. Never publish these credential files. Cleanup removes the exact synthetic nonowner and proof cohort; a later authorized rerun must recreate that user through the supported bootstrap, recreate a disposable Hobby project, and configure server environment values through CLI stdin. No security-protection bypass or real learning deployment is authorized. See docs/cloud-gates/verification-report.md and hosting-results.json for measured results and billing limitations.\n",
  ),
);
put(
  "docs/cloud-gates/progress.md",
  fs.readFileSync("docs/cloud-gates/progress.md"),
);
put(
  "docs/cloud-gates/t009-matrix.md",
  fs.readFileSync("docs/cloud-gates/t009-matrix.md"),
);
put(
  "supabase/cloud-gates.config.toml.example",
  fs.readFileSync("supabase/cloud-gates.config.toml.example"),
);
put(
  "docs/cloud-gates/verification-report.md",
  fs.readFileSync("docs/cloud-gates/verification-report.md"),
);
put(
  "docs/cloud-gates/evidence.json",
  fs.readFileSync("docs/cloud-gates/evidence.json"),
);
put("playwright.host.config.ts", fs.readFileSync("playwright.host.config.ts"));
put(
  "tests/host-browser/proof.spec.ts",
  fs.readFileSync("tests/host-browser/proof.spec.ts"),
);
put(
  "scripts/cleanup-cloud-cohort.ts",
  fs.readFileSync("scripts/cleanup-cloud-cohort.ts"),
);
put(
  "docs/cloud-gates/hosting-results.json",
  fs.readFileSync("docs/cloud-gates/hosting-results.json"),
);
for (const f of files) {
  const text = fs.readFileSync(path.join(dest, f.path), "utf8");
  if (
    /"privateKeys"\s*:\s*\[|f01-private-v2|l001-private-v4|sbp_[A-Za-z0-9]{25,}|sb_secret_[A-Za-z0-9_-]{20,}/.test(
      text,
    )
  )
    throw Error("PRIVATE_DATA_IN_EXPORT");
}
fs.writeFileSync(
  ".local-postgres/cloud-gates/proof-export-manifest.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
      privateContentIncluded: false,
      gitRefChanged: false,
      pushed: false,
      requiresOwnerBaseChangeApproval: false,
      ownerApprovedCleanBranchFromMain: true,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Prepared " +
    files.length +
    " source-only files; no content/credentials; no Git ref or remote changed.",
);
