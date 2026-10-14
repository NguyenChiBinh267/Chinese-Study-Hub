import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateBootstrapIdentity, validateBootstrapMergeGrant, bootstrapSnapshot, controllerCheckHandoff } from './bootstrap.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git } from './io.mjs';
const sha = 'a'.repeat(40), base = 'b'.repeat(40), repo = 'NguyenChiBinh267/Chinese-Study-Hub';
const pr = () => ({ number: 3, state: 'open', merged: false, draft: true, head: { sha, ref: 'loop/local-codex-reviewer', repo: { full_name: repo } }, base: { sha: base, ref: 'main', repo: { full_name: repo } } });
const state = () => ({ commitSha: sha, baseSha: base, sourceRevision: `git-bootstrap:${base}:${sha}`, runId: 'run', nonce: 'nonce',
  review: { verdict: 'PASS', commitSha: sha, sourceRevision: `git-bootstrap:${base}:${sha}`, runId: 'run', nonce: 'nonce', findings: [] },
  reviewerReceipt: { role: 'reviewer', sandbox: 'read-only', newSession: true, threadId: 'fresh-independent-thread', processId: 123, costProof: { chatgptOnly: true, hasCredits: false, balance: '0' } }, checks: [{ passed: true, commitSha: sha }] });
const grant = () => ({ ownerApproved: true, pr: 3, repository: repo, merge: true, commitSha: sha, baseSha: base, expiresAt: new Date(Date.now() + 60000).toISOString() });
test('Bootstrap identity pins draft PR3 repository/base/branch/HEAD', () => {
  validateBootstrapIdentity(pr(), base, sha);
  for (const patch of [{ number: 2 }, { state: 'closed' }, { merged: true }, { draft: false }, { head: { ...pr().head, ref: 'main' } }, { base: { ...pr().base, ref: 'other' } }]) assert.throws(() => validateBootstrapIdentity({ ...pr(), ...patch }, base, sha));
  assert.throws(() => validateBootstrapIdentity(pr(), sha, sha), /drift/);
  assert.throws(() => validateBootstrapIdentity(pr(), base, base), /drift/);
});
test('Initial merge authorization must be explicit, exact-SHA and unexpired', () => {
  assert.throws(() => validateBootstrapMergeGrant(null, state()), /authorization/);
  for (const patch of [{ ownerApproved: false }, { merge: false }, { pr: 2 }, { commitSha: base }, { baseSha: sha }, { expiresAt: '2000-01-01' }]) assert.throws(() => validateBootstrapMergeGrant({ ...grant(), ...patch }, state()));
  validateBootstrapMergeGrant(grant(), state());
});
test('Bootstrap merge cannot accept stale/self verdict, findings, missing deterministic or sandbox evidence', () => {
  for (const patch of [{ review: { ...state().review, verdict: 'REWORK' } }, { review: { ...state().review, commitSha: base } }, { review: { ...state().review, nonce: 'stale' } },
    { review: { ...state().review, findings: [{ severity: 'P1' }] } }, { reviewerReceipt: { sandbox: 'workspace-write', newSession: true } }, { checks: [] }, { checks: [{ passed: false }] }])
    assert.throws(() => validateBootstrapMergeGrant(grant(), { ...state(), ...patch }), /independent/);
});
test('Bootstrap snapshot detaches exact bytes even when clone already has the PR branch name', () => {
  const parent = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.engineering-loop/bootstrap-tests', String(Date.now()));
  const original = path.join(parent, 'original'), copy = path.join(parent, 'copy'); fs.mkdirSync(original, { recursive: true });
  git(original, 'init', '-b', 'loop/local-codex-reviewer'); git(original, 'config', 'core.autocrlf', 'false');
  git(original, 'config', 'user.name', 'Bootstrap fixture'); git(original, 'config', 'user.email', 'fixture@example.invalid');
  fs.writeFileSync(path.join(original, 'fixture.txt'), 'EXACT\n'); git(original, 'add', '.'); git(original, 'commit', '-m', 'bootstrap snapshot fixture');
  const head = git(original, 'rev-parse', 'HEAD'); bootstrapSnapshot(original, copy, head, original);
  assert.equal(git(copy, 'rev-parse', 'HEAD'), head); assert.equal(git(copy, 'branch', '--show-current'), '');
  assert.equal(git(copy, 'status', '--porcelain'), ''); assert.equal(fs.readFileSync(path.join(copy, 'fixture.txt'), 'utf8'), 'EXACT\n');
});
test('Bootstrap testing-denial handoff preserves BLOCKED and never replaces human evidence or reviewer verdict', () => {
  const report = { result: 'BLOCKED', blocker: 'Sandbox EPERM prevents child-process regression checks', tests: [{ passed: false }] };
  assert.equal(controllerCheckHandoff(report), true); assert.equal(report.result, 'BLOCKED');
  for (const blocker of ['Missing publication rights', 'No account consent', 'Model quota exhausted', 'Unknown implementation failure']) assert.equal(controllerCheckHandoff({ ...report, blocker }), false);
  assert.equal(controllerCheckHandoff({ ...report, tests: [{ passed: true }] }), false);
});
