// Check every outgoing blob, not just HEAD. Never prints matching secret bytes.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const git = (a) =>
  execFileSync("git", a, { encoding: "utf8", maxBuffer: 20_000_000 });
const base = git(["rev-parse", "origin/main"]).trim();
const head = git(["rev-parse", "HEAD"]).trim();
const paths = git(["rev-list", "--objects", `${base}..${head}`])
  .trim()
  .split("\n");
const findings = [];
let checked = 0;
for (const line of paths) {
  const at = line.indexOf(" ");
  if (at < 0) continue;
  const oid = line.slice(0, at),
    path = line.slice(at + 1);
  if (git(["cat-file", "-t", oid]).trim() !== "blob") continue;
  const text = git(["cat-file", "blob", oid]);
  if (text.includes("\u0000")) {
    findings.push({
      oid,
      path,
      reason: "BINARY_OUTGOING_BLOB_REQUIRES_REVIEW",
    });
    continue;
  }
  checked++;
  if (
    /^(?:\.local-postgres|\.engineering-loop|\.env(?:\.|$))/.test(path) &&
    path !== ".env.example"
  )
    findings.push({ oid, path, reason: "PRIVATE_RUNTIME_PATH" });
  if (
    /(?:sbp_[A-Za-z0-9]{25,}|sb_secret_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(
      text,
    )
  )
    findings.push({ oid, path, reason: "POSSIBLE_CREDENTIAL_REQUIRES_REVIEW" });
  if (path.endsWith(".json")) {
    try {
      const value = JSON.parse(text);
      if (Array.isArray(value.privateKeys) && value.privateKeys.length)
        findings.push({
          oid,
          path,
          reason: "SERVER_PRIVATE_DRAFT_ANSWER_KEYS_IN_PUBLIC_HISTORY",
        });
    } catch {
      /* Not a JSON object. */
    }
  }
  if (/review-packets\/.*\.(?:html|json)$/.test(path))
    findings.push({ oid, path, reason: "PRIVATE_REVIEW_PACKET" });
}
const report = {
  at: new Date().toISOString(),
  base,
  head,
  repository: "NguyenChiBinh267/Chinese-Study-Hub",
  visibility: "public",
  outgoingCommits: Number(
    git(["rev-list", "--count", `${base}..${head}`]).trim(),
  ),
  checkedTextBlobs: checked,
  safeToPush: findings.length === 0,
  findings,
  note: "Deleting a sensitive file at HEAD does not remove it from outgoing parent commits. No push or history rewrite performed.",
};
fs.mkdirSync(".local-postgres/cloud-gates", { recursive: true });
fs.writeFileSync(
  ".local-postgres/cloud-gates/push-scan.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    outgoingCommits: report.outgoingCommits,
    checkedTextBlobs: checked,
    safeToPush: report.safeToPush,
    findings: findings.length,
  }),
);
if (!report.safeToPush) process.exitCode = 1;
