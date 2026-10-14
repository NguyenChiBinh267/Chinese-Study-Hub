import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateAuthorization, preflight, recoveryDecision, chooseTask, newLedger, summarize } from './autonomous.mjs';
import { makeMultiGitFixture } from './fixtures.mjs';
import { GitSource, blob } from './git-ssot.mjs';
import { git, validateFreeQuota } from './io.mjs';
import { STATUS } from './plan.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cfg = { repository: 'NguyenChiBinh267/Chinese-Study-Hub', liveEnabled: false, autoMerge: false, ssotAllowStatusWrites: false, authorizedTasks: [] };
const grant = () => ({ schemaVersion: 1, ownerApproved: true, grantId: 'synthetic-owner-grant', repository: cfg.repository, release: 'fixture', tasks: ['D001', 'D002', 'D003', 'D004', 'D005'],
  autoMerge: true, statusWrites: true, maxServiceCost: 0, allowPaidCredits: false, allowNewServices: false, maxTasks: 5, maxModelCalls: 12, maxRunSeconds: 1000, maxRetries: 3, maxQuotaWaitSeconds: 60, expiresAt: new Date(Date.now() + 600000).toISOString() });
test('No absent/expired/paid/mismatched grant can activate autonomous authority', () => {
  assert.throws(() => validateAuthorization(null, cfg), /authorization/);
  for (const patch of [{ ownerApproved: false }, { autoMerge: false }, { statusWrites: false }, { maxServiceCost: 1 }, { allowPaidCredits: true }, { allowNewServices: true }, { tasks: ['T004'] }, { expiresAt: '2000-01-01' }, { maxRetries: 4 }])
    assert.throws(() => validateAuthorization({ ...grant(), ...patch }, cfg, true));
  assert.throws(() => validateAuthorization(grant(), { ...cfg, liveEnabled: true }, true), /real authority/);
  const real = { ...grant(), release: 'M0', tasks: ['T004'], bootstrapReviewedSha: 'a'.repeat(40) };
  assert.throws(() => validateAuthorization(real, cfg), /match/);
  assert.ok(validateAuthorization(real, { ...cfg, liveEnabled: true, autoMerge: true, ssotAllowStatusWrites: true, authorizedTasks: ['T004'] }));
});
test('Grant binding changes when scope, expiry or budgets change across restart', () => {
  const g = grant(), h = validateAuthorization(g, cfg, true), l = newLedger(h, g);
  const restored = JSON.parse(JSON.stringify(l)); assert.equal(restored.grantHash, h);
  assert.notEqual(validateAuthorization({ ...g, maxTasks: 4 }, cfg, true), restored.grantHash);
  assert.notEqual(validateAuthorization({ ...g, tasks: ['D001'] }, cfg, true), restored.grantHash);
});
test('Real pinned multi-task Git source has dependencies and human gate, never mutates backlog', () => {
  const initial = fs.readFileSync(path.join(root, STATUS));
  const f = makeMultiGitFixture(path.join(root, '.engineering-loop', 'multi-tests'));
  const src = new GitSource({ root: f.controller, synthetic: true, expectedRemote: f.remote }); const snap = src.loadRemote();
  assert.deepEqual(snap.tasks.map(t => t.id), ['D001', 'D002', 'D003', 'D004', 'D005']);
  assert.deepEqual(snap.tasks.find(t => t.id === 'D002').dependencies, ['D001']);
  assert.deepEqual(snap.tasks.find(t => t.id === 'D005').dependencies, ['D003']);
  assert.equal(preflight(snap.tasks.find(t => t.id === 'D003'), f.policies.D003, src, snap.commit), 'Missing/invalid pinned human-only evidence');
  assert.equal(preflight(snap.tasks[0], f.policies.D001, src, snap.commit), null);
  assert.equal(JSON.parse(blob(f.controller, snap.commit, STATUS)).tasks.D001.status, 'pending');
  assert.deepEqual(fs.readFileSync(path.join(root, STATUS)), initial);
});
test('Blocked task is attempt evidence only; dependent task stays blocked while independent task is picked', () => {
  const snap = { activeIds: ['D001', 'D002', 'D003', 'D004', 'D005'], tasks: [
    { id: 'D001', status: 'done', dependencies: [] }, { id: 'D002', status: 'done', dependencies: ['D001'] },
    { id: 'D003', status: 'pending', dependencies: [] }, { id: 'D004', status: 'pending', dependencies: [] }, { id: 'D005', status: 'pending', dependencies: ['D003'] } ] };
  const l = newLedger('h', grant()); l.outcomes = [{ taskId: 'D003', phase: 'BLOCKED' }];
  assert.equal(chooseTask(snap, grant(), JSON.parse(JSON.stringify(l))).id, 'D004');
  l.outcomes.push({ taskId: 'D004', phase: 'DONE' }); snap.tasks[3].status = 'done';
  assert.equal(chooseTask(snap, grant(), l), undefined);
  assert.deepEqual(summarize(l, snap, 'No eligible task').dependencyBlocked, ['D005']);
  assert.equal(snap.tasks[2].status, 'pending');
});
test('Missing contract and invalid human attestation cannot be replaced by developer evidence', () => {
  const t = { id: 'T004' }, p = { allowedFiles: ['a.txt'], checks: [], acceptanceChecks: [{ kind: 'owner-evidence', scope: 'ux-walkthrough' }] };
  assert.equal(preflight(t, null, {}, 'x'), 'Missing acceptance contract');
  assert.match(preflight(t, p, { ownerEvidence: () => ({ taskId: 'T004', verified: true, verifiedBy: 'developer', scopes: ['ux-walkthrough'] }) }, 'x'), /human-only/);
});
test('Only typed safe transport checkpoints retry, at most three times, with persisted intent', () => {
  const g = grant(), l = newLedger('h', g), s = { runId: 'r', phase: 'BLOCKED', blockedFrom: 'SSOT_WAIT', blockerCode: 'TRANSIENT_TRANSPORT', mergeSha: 'a'.repeat(40), statusPendingSha: 'b'.repeat(40) };
  for (let i = 0; i < 3; i++) { l.retries.r = i; assert.equal(recoveryDecision(JSON.parse(JSON.stringify(s)), g, JSON.parse(JSON.stringify(l))).kind, 'retry'); }
  l.retries.r = 3; assert.equal(recoveryDecision(s, g, l).kind, 'global');
  l.retries.r = 0; assert.equal(recoveryDecision({ ...s, blockedFrom: 'DEVELOPING' }, g, l).kind, 'global');
  assert.equal(recoveryDecision({ ...s, writerPid: process.pid }, g, l).kind, 'global');
  assert.equal(s.statusPendingSha, 'b'.repeat(40));
});
test('Quota reset checkpoint retains stable phase and has bounded wait with no credit fallback', () => {
  const at = Date.now(), g = grant(), l = newLedger('h', g);
  const result = { rateLimits: { credits: { hasCredits: false, unlimited: false, balance: '0' }, primary: { usedPercent: 100, resetsAt: Math.ceil((at + 10000) / 1000) } } };
  let e; try { validateFreeQuota(result); } catch (error) { e = error; }
  assert.equal(e.code, 'QUOTA_EXHAUSTED'); assert.ok(e.retryAt > at);
  const s = { phase: 'BLOCKED', runId: 'r', blockedFrom: 'DEVELOP_READY', blockerCode: e.code, retryAt: e.retryAt };
  assert.equal(recoveryDecision(s, g, l, at).kind, 'retry');
  assert.equal(recoveryDecision({ ...s, retryAt: at + 120000 }, g, l, at).kind, 'global');
  assert.equal(recoveryDecision({ ...s, retryAt: null }, g, l, at).kind, 'global');
  assert.throws(() => validateFreeQuota({ rateLimits: { ...result.rateLimits, credits: { hasCredits: true, unlimited: false, balance: '1' } } }), /Paid/);
});
test('Task-local block can advance only before merge; source/stale/malformed/unsafe failures stop globally', () => {
  const g = grant(), l = newLedger('h', g), s = { phase: 'BLOCKED', blockedFrom: 'REVIEW_WAIT', runId: 'r', blockerCode: 'TASK_LOCAL', blocker: 'Human evidence missing' };
  assert.equal(recoveryDecision(s, g, l).kind, 'task');
  assert.equal(recoveryDecision({ ...s, mergePendingSha: 'x' }, g, l).kind, 'global');
  for (const code of ['INTEGRITY_OR_UNKNOWN', 'REVIEW_FAILURE', 'SOURCE_DRIFT', 'MALFORMED_REVIEW']) assert.equal(recoveryDecision({ ...s, blockerCode: code }, g, l).kind, 'global');
});
