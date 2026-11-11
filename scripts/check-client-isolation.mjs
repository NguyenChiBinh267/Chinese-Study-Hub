// Examines the built browser artifact without logging secret values or voice.
import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
const secrets = new Set();
if (fs.existsSync(".env.local")) {
  const env = parseEnv(fs.readFileSync(".env.local", "utf8"));
  for (const [key, value] of Object.entries(env)) {
    if (/SECRET|PASSWORD|KEY/.test(key) && value.length >= 20)
      secrets.add(value);
    if (key === "DATABASE_URL") {
      secrets.add(value);
      const password = new URL(value).password;
      if (password.length >= 20) secrets.add(password);
    }
  }
}
for (const file of [
  ".local-postgres/credentials.json",
  ".local-postgres/sprint10/auth-local/credentials.json",
]) {
  if (!fs.existsSync(file)) continue;
  const visit = (object) => {
    for (const [key, value] of Object.entries(object)) {
      if (typeof value === "object" && value) visit(value);
      else if (
        typeof value === "string" &&
        value.length >= 20 &&
        /admin|runtime|cookie|password|secret|key/i.test(key)
      )
        secrets.add(value);
    }
  };
  visit(JSON.parse(fs.readFileSync(file)));
}
const files = [];
function collect(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) collect(file);
    else if (/\.(js|map|html|json)$/.test(file)) files.push(file);
  }
}
collect(
  process.env.CSH_ISOLATED_PREVIEW_BUILD === "1"
    ? ".next/private-preview/static"
    : ".next/static",
);
if (!files.length) throw Error("No browser build artifact");
const forbidden = [
  "privateKeys",
  "keyRef",
  "CSH_PRIVATE_OWNER_PREVIEW",
  "answerKey",
  "acceptedNormalized",
  "CSH_LOCAL_SESSION_SECRET",
  "CSH_AUTH_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "csh_runtime",
];
const failures = [];
for (const file of files) {
  const bytes = fs.readFileSync(file, "utf8");
  if (
    forbidden.some((word) => bytes.includes(word)) ||
    [...secrets].some((secret) => bytes.includes(secret))
  )
    failures.push(file);
}
const result = {
  kind: "REAL_BROWSER_ARTIFACT_SCAN",
  at: new Date().toISOString(),
  files: files.length,
  privateValuesChecked: secrets.size,
  privateValuesPrinted: false,
  forbiddenServerFieldMarkers: forbidden,
  failures,
};
fs.writeFileSync(
  ".local-postgres/sprint10/client-isolation.json",
  JSON.stringify(result, null, 2),
);
if (failures.length)
  throw Error(
    "Browser artifact isolation failed; see filenames in private report",
  );
console.log(
  `PASS ${files.length} browser artifacts: no checked private value, grading-key marker or server credential marker found. This is a bounded scan, not a formal proof.`,
);
