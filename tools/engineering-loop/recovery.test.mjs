import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { autonomousRun, newLedger, validateAuthorization } from './autonomous.mjs';
import { GitSource } from './git-ssot.mjs';
import { readJson, writeJson } from './io.mjs';
import { reconcile } from './loop.mjs';

const cfg = { repository: 'fixture', authorizedTasks: [], liveEnabled: false, autoMerge: false, ssotAllowStatusWrites: false };
function setup() {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'b001-recovery-'));
  const grant = { schemaVersion: 1, ownerApproved: true, grantId: 'recovery-test-grant', repository: 'fixture', release: 'fixture', tasks: ['D001'],
    autoMerge: true, statusWrites: true, maxServiceCost: 0, allowPaidCredits: false, allowNewServices: false,
    maxTasks: 1, maxModelCalls: 1, maxRunSeconds: 60, maxRetries: 1, maxQuotaWaitSeconds: 60, expiresAt: new Date(Date.now() + 60000).toISOString() };
  const fixture = { grant, controller: data, remote: path.join(data, 'remote') };
  writeJson(path.join(data, 'control.json'), { stop: false, pause: false });
  return { root: data, tool: data, data, cfg, fixture, sourceFactory: () => Object.create(GitSource.prototype) };
}
const empty = { tasks: [], activeIds: [], kind: 'synthetic-git', commit: 'a'.repeat(40) };
const transport = () => Object.assign(new Error('temporary outage'), { code: 'TRANSIENT_TRANSPORT' });

test('Driver persists transport retry and recovers without stopping the grant on first failure', async t => {
  const args = setup(); let calls = 0;
  t.mock.method(GitSource.prototype, 'loadRemote', () => {
    if (++calls === 1) throw transport();
    const ledger = readJson(path.join(args.data, 'multi-ledger.json'));
    assert.equal(ledger.phase, 'RUNNING'); assert.equal(ledger.remoteRetries, 1);
    assert.ok(Date.now() >= ledger.remoteWait.at);
    return empty;
  });
  const report = await autonomousRun(args);
  assert.equal(calls, 2); assert.equal(report.stopReason, 'No eligible task');
});

test('Driver resume honors persisted backoff and exhausted transport budget', async t => {
  const args = setup(), g = args.fixture.grant;
  const ledger = newLedger(validateAuthorization(g, cfg, true), g);
  Object.assign(ledger, { fixture: args.fixture, remoteRetries: 1, remoteWait: { at: Date.now() + 100 } });
  writeJson(path.join(args.data, 'multi-ledger.json'), ledger);
  let calls = 0;
  t.mock.method(GitSource.prototype, 'loadRemote', () => {
    calls++; assert.ok(Date.now() >= ledger.remoteWait.at); throw transport();
  });
  const report = await autonomousRun({ ...args, resume: true });
  assert.equal(calls, 1); assert.match(report.stopReason, /transport retry limit/);
  assert.equal(report.remoteRetries, 1);
});

test('Driver honors controller backoff before remote read and rejects untyped errors', async t => {
  const args = setup(), g = args.fixture.grant;
  const ledger = newLedger(validateAuthorization(g, cfg, true), g);
  Object.assign(ledger, { fixture: args.fixture, wait: { runId: 'r', at: Date.now() + 100 } });
  writeJson(path.join(args.data, 'multi-ledger.json'), ledger);
  let calls = 0;
  t.mock.method(GitSource.prototype, 'loadRemote', () => {
    calls++; assert.ok(Date.now() >= ledger.wait.at); throw new Error('source integrity failure');
  });
  const report = await autonomousRun({ ...args, resume: true });
  assert.equal(calls, 1); assert.match(report.stopReason, /source integrity failure/);
  assert.equal(report.remoteRetries, undefined);
});

test('Reconciliation permits exact pre-push head only during recoverable publication', async () => {
  const old = 'a'.repeat(40), next = 'b'.repeat(40);
  // Persist/reload the checkpoint as after a push failed before remote acceptance.
  const state = JSON.parse(JSON.stringify({ mode: 'dry-local', phase: 'PUBLISHING', cycleId: 'cycle', pr: 1,
    branch: 'task', sourceRevision: 'source', commitSha: next, previouslyPublishedSha: old }));
  const config = { repository: 'fixture', baseBranch: 'main', reviewerBackend: 'local-codex' };
  let remote = old;
  const gh = { repo: async () => ({ head: { sha: remote, ref: 'task', repo: { full_name: 'fixture' } }, base: { ref: 'main' }, state: 'open', merged: false }) };
  const check = s => reconcile(s, config, gh, { revision: 'source' });
  await check(state);
  remote = next; await check(state); // Push accepted but acknowledgement lost.
  remote = 'c'.repeat(40); await assert.rejects(check(state), /head differs/);
  remote = old;
  for (const patch of [{ phase: 'REVIEW_WAIT' }, { cycleId: null }, { previouslyPublishedSha: null }])
    await assert.rejects(check({ ...state, ...patch }), /head differs/);
});
