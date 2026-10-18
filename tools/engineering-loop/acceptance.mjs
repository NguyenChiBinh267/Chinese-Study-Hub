import fs from 'node:fs';
import path from 'node:path';
import { hash, requireThat, allowedPath } from './core.mjs';
import { git, command, codexEnvironment } from './io.mjs';
import { plain, PROTECTED } from './plan.mjs';
import { blob } from './git-ssot.mjs';

export const SECRET_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-(?:proj-)?[A-Za-z0-9_-]{25,}|gh[pousr]_[A-Za-z0-9]{20,}|ya29\.[A-Za-z0-9_-]{20,}/;
const json = bytes => { try { return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')); } catch { throw new Error('Invalid JSON; content not logged'); } };
function fileBytes(repo, file, policy) {
  // Read-only acceptance inputs never expand developer or diff write scope.
  requireThat(allowedPath(file, policy.allowedFiles) || allowedPath(file, policy.acceptanceReadOnlyFiles ?? []), 'Acceptance file outside task policy');
  const absolute = path.resolve(repo, file), root = fs.realpathSync(repo).toLowerCase() + path.sep;
  requireThat(fs.existsSync(absolute) && fs.statSync(absolute).isFile() && !fs.lstatSync(absolute).isSymbolicLink() && fs.realpathSync(absolute).toLowerCase().startsWith(root), 'Missing/non-file/escaping acceptance path');
  return fs.readFileSync(absolute);
}
export function schemaValid(value, schema) {
  const supported = ['$schema', 'title', 'description', 'type', 'required', 'properties', 'additionalProperties', 'items', 'enum', 'const', 'minItems', 'minLength', 'pattern', 'minimum', 'maximum'];
  requireThat(schema && Object.keys(schema).every(k => supported.includes(k)), 'Unsupported JSON schema keyword; contract must be extended/reviewed');
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) return false;
  if (schema.enum && !schema.enum.some(x => JSON.stringify(x) === JSON.stringify(value))) return false;
  if (schema.type) {
    const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    if (schema.type === 'integer' ? !Number.isInteger(value) : type !== schema.type) return false;
  }
  if (schema.type === 'object') {
    if ((schema.required ?? []).some(k => !(k in value))) return false;
    if (schema.additionalProperties === false && Object.keys(value).some(k => !(k in (schema.properties ?? {})))) return false;
    for (const [key, spec] of Object.entries(schema.properties ?? {})) if (key in value && !schemaValid(value[key], spec)) return false;
  }
  if (Array.isArray(value)) { if (schema.minItems !== undefined && value.length < schema.minItems) return false; if (schema.items && !value.every(x => schemaValid(x, schema.items))) return false; }
  if (typeof value === 'string') { if (schema.minLength !== undefined && value.length < schema.minLength) return false; if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) return false; }
  if (typeof value === 'number' && (schema.minimum !== undefined && value < schema.minimum || schema.maximum !== undefined && value > schema.maximum)) return false;
  return true;
}
function ownerProof(context, scope) {
  const proof = context.source?.ownerEvidence?.(context.state?.sourceCommit, context.state?.taskId);
  requireThat(proof && proof.taskId === context.state.taskId && proof.verified === true && proof.verifiedBy === 'owner' && proof.scopes?.includes(scope), 'Missing pinned owner evidence; model/developer claims do not qualify');
  requireThat(Date.parse(proof.checkedAt) <= Date.now() && Date.parse(proof.expiresAt) > Date.now() && proof.artifactSha256?.match(/^[a-f0-9]{64}$/) && proof.evidenceUrls?.length, 'Owner evidence expired/incomplete');
  return proof;
}
export function acceptanceChecks(repo, policy, context = {}) {
  requireThat(policy.acceptanceChecks?.length, 'Missing owner-defined deterministic acceptance checks');
  return policy.acceptanceChecks.map(check => {
    const result = { name: check.name ?? `${check.kind}: ${check.file ?? 'task'}`, kind: check.kind, passed: false };
    try {
      const bytes = check.file ? fileBytes(repo, check.file, policy) : null;
      if (bytes) Object.assign(result, { file: check.file, actualHash: hash(bytes), byteCount: bytes.length });
      if (check.kind === 'exact-bytes') { const expected = Buffer.from(check.expectedBase64, 'base64'); result.passed = bytes.equals(expected); result.expectedHash = hash(expected); }
      else if (check.kind === 'required-file') result.passed = bytes.length > 0;
      else if (check.kind === 'json-schema') result.passed = schemaValid(json(bytes), check.schema);
      else if (check.kind === 'required-headings') {
        const headings = bytes.toString('utf8').split(/\r?\n/).filter(x => /^#{1,6}\s/.test(x)).map(x => plain(x).toLowerCase());
        result.passed = check.headings.every(x => headings.includes(x.toLowerCase()));
      } else if (check.kind === 'required-text') result.passed = check.text.every(x => bytes.toString('utf8').toLowerCase().includes(x.toLowerCase()));
      else if (check.kind === 'section-contract') {
        const lines = bytes.toString('utf8').split(/\r?\n/);
        result.passed = check.sections.every(section => {
          const start = lines.findIndex(x => /^#{1,6}\s/.test(x) && plain(x).toLowerCase() === section.toLowerCase());
          if (start < 0) return false; let end = start + 1; while (end < lines.length && !/^#{1,6}\s/.test(lines[end])) end++;
          const text = lines.slice(start + 1, end).join('\n').toLowerCase(); return check.required.every(word => text.includes(word.toLowerCase()));
        });
      } else if (check.kind === 'file-scope') {
        const state = context.state; requireThat(state?.baseSha && state.commitSha, 'Missing exact Git diff context');
        const files = git(repo, 'diff', '--name-only', '--no-renames', state.baseSha, state.commitSha, '--').split(/\r?\n/).filter(Boolean);
        result.passed = files.length > 0 && files.every(f => f === state.handoffFile || allowedPath(f, policy.allowedFiles) && !allowedPath(f, PROTECTED));
      } else if (check.kind === 'whitespace') { requireThat(context.state, 'Missing Git context'); git(repo, 'diff', '--check', context.state.baseSha, context.state.commitSha); result.passed = true; }
      else if (check.kind === 'no-secrets') result.passed = !SECRET_PATTERN.test(bytes.toString('utf8'));
      else if (check.kind === 'no-paid-config') {
        const text = bytes.toString('utf8');
        result.passed = !/(?:billingEnabled|paidFallback|requiresPayment|trialDependency|temporaryCredits)"?\s*[:=]\s*true|(?:serviceFee|monthlyFee|oneTimeFee)"?\s*[:=]\s*[1-9]/i.test(text) && !SECRET_PATTERN.test(text);
      } else if (check.kind === 'task-safety') {
        const state = context.state; requireThat(state?.baseSha && state.commitSha, 'Missing task safety Git context');
        const files = git(repo, 'diff', '--name-only', '--no-renames', state.baseSha, state.commitSha).split(/\r?\n/).filter(Boolean).filter(x => x !== state.handoffFile);
        result.passed = files.length > 0 && files.every(file => {
          requireThat(allowedPath(file, policy.allowedFiles) && !allowedPath(file.toLowerCase(), PROTECTED.map(x => x.toLowerCase())), 'Protected task safety path');
          const data = blob(repo, state.commitSha, file).toString('utf8'); if (file.endsWith('.json')) json(Buffer.from(data));
          return !SECRET_PATTERN.test(data) && !/(?:billing[_-]?enabled|paid[_-]?fallback|requires[_-]?payment|trial[_-]?dependency|temporary[_-]?credits)"?\s*[:=]\s*true|(?:service[_-]?fee|monthly[_-]?fee|one[_-]?time[_-]?fee)"?\s*[:=]\s*[1-9]/i.test(data);
        });
      } else if (check.kind === 'dependencies') {
        const proof = context.source?.snapshot(context.state.sourceCommit), task = proof?.tasks.find(x => x.id === context.state.taskId);
        result.passed = !!task && task.dependencies.every(id => proof.tasks.find(x => x.id === id)?.status === 'done');
      } else if (check.kind === 'source-provenance') {
        const records = json(bytes).sources; requireThat(Array.isArray(records) && records.length > 0, 'Missing source records');
        const proof = records.some(r => r.verification === 'verified') ? ownerProof(context, 'source-readback') : null;
        result.passed = records.every(r => /^https:\/\//.test(r.url) && Number.isFinite(Date.parse(r.observedAt)) && Date.parse(r.observedAt) <= Date.now() &&
          ['verified', 'unverified', 'blocked'].includes(r.verification) && typeof r.evidence === 'string' && r.evidence.length >= 20 &&
          (r.verification !== 'verified' || /^[a-f0-9]{64}$/.test(r.sha256) && proof.evidenceUrls.includes(r.url) && proof.sourceRecords?.some(p => p.url === r.url && p.sha256 === r.sha256)));
      } else if (check.kind === 'practice-label') {
        const value = json(bytes); result.passed = value.practiceLabel === 'internal-practice' || value.practiceLabel === 'verified-official-format' &&
          ownerProof(context, 'exam-blueprint').officialFormatApproved === true && value.gaps.length === 0 && value.sources.every(r => r.verification === 'verified');
      } else if (check.kind === 'rights-gate') {
        const value = json(bytes), records = value.sources ?? value.services;
        requireThat(Array.isArray(records), 'Missing rights/evidence records');
        result.passed = records.every(r => ['allowed', 'restricted', 'unknown'].includes(r.rightsStatus) &&
          (r.published !== true || r.rightsStatus === 'allowed' && ownerProof(context, 'content-rights').verified));
      } else if (check.kind === 'owner-evidence') { const proof = ownerProof(context, check.scope); result.passed =
        (check.scope !== 'account-zero-cost' || proof.billingDisabled === true && proof.oneTimeFees === 0 && proof.recurringFees === 0 && proof.noTrialCredits === true && proof.accountTier && proof.quotas) &&
        (!check.file || proof.artifactSha256 === hash(bytes)); }
      else if (check.kind === 'targeted-command') {
        const registered = policy.checks?.find(x => x.id === check.commandId);
        requireThat(registered && registered.executable && Array.isArray(registered.args), 'Command not in owner allowlist');
        command(registered.executable, registered.args, repo, { timeout: 120000, env: codexEnvironment() }); result.passed = true;
      } else throw new Error('Unsupported acceptance kind; BLOCKED until reviewed');
    } catch (error) { result.reason = error.message; }
    result.passed = result.passed === true || Boolean(result.passed);
    return result;
  });
}
