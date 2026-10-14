import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateBootstrapIdentity, validateBootstrapMergeGrant } from './bootstrap.mjs';
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
