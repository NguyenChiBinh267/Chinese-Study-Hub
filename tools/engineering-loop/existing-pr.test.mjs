import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { git } from './io.mjs';
import { newExecution } from './core.mjs';
import { validateExistingTarget, validateExistingIdentity, existingCandidate, adoptExisting, prepareExistingReview } from './existing-pr.mjs';
const repository = 'owner/repo', base = 'a'.repeat(40), head = 'b'.repeat(40);
const target = { taskId: 'T004', repository, pr: 6, branch: 'feat/t004', baseSha: base, headSha: head };
const prFor = t => ({ number: t.pr, title: 'T004: existing UX candidate', state: 'open', draft: true, merged: false,
  head: { ref: t.branch, sha: t.headSha, repo: { full_name: t.repository } }, base: { ref: 'main', sha: t.baseSha, repo: { full_name: t.repository } } });
const cfg = { repository, existingPullRequests: { T004: target }, liveEnabled: true, authorizedTasks: ['T004'], sourceBackend: 'git', reviewerBackend: 'local-codex' };

test('Existing PR discovery is read-only, pins one candidate and blocks duplicate or unmapped task hints', async () => {
  const gh = { repo: async (url, method = 'GET') => { assert.equal(method, 'GET'); assert.match(url, /state=open/); return [prFor(target)]; } };
  assert.deepEqual(await existingCandidate(gh, cfg, 'T004', base), target);
  await assert.rejects(existingCandidate(gh, { ...cfg, existingPullRequests: {} }, 'T004', base), /requires pinned mapping/);
  await assert.rejects(existingCandidate({ repo: async () => [prFor(target), { ...prFor(target), number: 99 }] }, cfg, 'T004', base), /Multiple/);
  assert.equal(await existingCandidate({ repo: async () => [] }, { ...cfg, existingPullRequests: {} }, 'T004', base), null);
  await assert.rejects(existingCandidate({ repo: async () => [] }, cfg, 'T004', base), /missing/);
});
test('Existing PR requires exact task/repository/branch/base/HEAD and open draft, never accepts cached PASS', () => {
  for (const changed of [{ taskId: 'T005' }, { repository: 'fork/repo' }, { branch: '../main' }, { baseSha: head }, { headSha: 'short' }]) assert.throws(() => validateExistingTarget({ ...target, ...changed }, 'T004', repository, base), /pinned/);
  for (const changed of [{ state: 'closed' }, { merged: true }, { draft: false }, { number: 5 }, { head: { ...prFor(target).head, sha: base } }, { base: { ...prFor(target).base, sha: head } }, { head: { ...prFor(target).head, repo: { full_name: 'fork/repo' } } }]) assert.throws(() => validateExistingIdentity({ ...prFor(target), ...changed }, target), /drift/);
});
test('Adoption with live disabled fails before remote, filesystem, developer or review work', async () => {
  await assert.rejects(adoptExisting({ state: { mode: 'live', phase: 'QUEUED', evidence: [] }, cfg: { ...cfg, liveEnabled: false }, task: { id: 'T004' },
    gh: { repo: () => assert.fail('No network') }, source: { verifyTask: () => assert.fail('No source work') } }), /authorized/);
});
test('Mock takeover preserves existing bytes and PR identity, bypasses generation and enters independent review without verdict', async () => {
  const data = path.resolve('.engineering-loop', 'adoption-tests', randomUUID()), root = path.join(data, 'root'), remote = path.join(data, 'remote.git');
  fs.mkdirSync(root, { recursive: true }); git(root, 'init', '-b', 'main'); git(root, 'config', 'core.autocrlf', 'false');
  fs.writeFileSync(path.join(root, 'AGENTS.md'), 'Synthetic adoption fixture, no models or external writes.\n');
  git(root, 'add', '.'); git(root, 'commit', '-m', 'base'); const baseSha = git(root, 'rev-parse', 'HEAD');
  git(root, 'init', '--bare', remote); git(root, 'remote', 'add', 'origin', remote); git(root, 'push', 'origin', 'main');
  git(root, 'checkout', '-b', 'feat/t004'); fs.writeFileSync(path.join(root, 'ux.md'), 'existing owner UX bytes\n');
  git(root, 'add', 'ux.md'); git(root, 'commit', '-m', 'existing candidate'); const headSha = git(root, 'rev-parse', 'HEAD'); git(root, 'push', 'origin', 'feat/t004');
  const pinned = { ...target, baseSha, headSha }, task = { id: 'T004', spec: ['UX fixture'], dependencies: [] };
  const state = { ...newExecution(task, { revision: `git:${baseSha}` }), sourceCommit: baseSha };
  const phases = [], writes = [], gh = { repo: async (url, method = 'GET') => { assert.equal(url, '/pulls/6'); if (method !== 'GET') writes.push(method); return { ...prFor(pinned), review: { verdict: 'PASS' } }; } };
  let sourceReads = 0; const source = { verifyTask: async () => { sourceReads++; return { revision: `git:${baseSha}`, readbackVerified: true }; } };
  const policy = { allowedFiles: ['ux.md'], checks: [], acceptanceChecks: [{ kind: 'exact-bytes', file: 'ux.md', expectedBase64: Buffer.from('existing owner UX bytes\n').toString('base64') }] };
  await adoptExisting({ root, data, state, cfg, task, policy, source, gh, target: pinned, save: s => phases.push(s.phase) });
  assert.equal(state.phase, 'SOURCE_WAIT'); assert.equal(state.pr, 6); assert.equal(state.commitSha, headSha); assert.equal(state.evidence.length, 0);
  await prepareExistingReview({ state, task, policy, source, gh, save: s => phases.push(s.phase) });
  assert.deepEqual(phases, ['HANDOFF_CREATING', 'SOURCE_WAIT', 'REVIEW_WAIT']); assert.equal(sourceReads, 2);
  assert.equal(state.review, undefined); assert.equal(state.developerReport, undefined); assert.equal(state.repairs, 0); assert.deepEqual(writes, []);
  assert.equal(state.evidence[0].checks[0].passed, true); assert.equal(git(state.worktree, 'rev-parse', 'HEAD'), headSha);
  assert.equal(fs.readFileSync(path.join(state.worktree, 'ux.md'), 'utf8'), 'existing owner UX bytes\n'); assert.equal(git(remote, 'rev-parse', 'refs/heads/feat/t004'), headSha);
  const drift = { ...state, phase: 'SOURCE_WAIT', adoptedPullRequest: { ...pinned, headSha: baseSha } };
  await assert.rejects(prepareExistingReview({ state: drift, task, policy, source, gh, save: () => assert.fail('No release on drift') }), /drift/);
});
