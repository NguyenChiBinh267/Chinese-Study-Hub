import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { validateAuthorization, preflight, recoveryDecision, chooseTask, newLedger, summarize, autonomousRun, bindRunDeadline, checkpointRetry } from './autonomous.mjs';
import { makeMultiGitFixture } from './fixtures.mjs';
import { GitSource, blob } from './git-ssot.mjs';
import { git, validateFreeQuota, GitHub, remainingTime, deadlineTimer, command, writeJson, readJson } from './io.mjs';
import { STATUS } from './plan.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
fs.mkdirSync(path.join(root, '.engineering-loop'), { recursive: true });
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

test('Grant A budgets survive A -> B -> A, changed terms, and process reload', async () => {
  const data = fs.mkdtempSync(path.join(root, '.engineering-loop', 'grant-replay-'));
  const a = { ...grant(), grantId: 'persistent-owner-grant-A' }, b = { ...a, grantId: 'persistent-owner-grant-B' };
  const exhausted = { ...newLedger(validateAuthorization(a, cfg, true), a), phase: 'STOPPED', modelCalls: a.maxModelCalls,
    outcomes: [{ taskId: 'D001', runId: 'old-run' }], retries: { 'old-run': 3 } };
  // Migrate the pre-fix single ledger without losing already-consumed A authority.
  writeJson(path.join(data, 'multi-ledger.json'), exhausted);
  writeJson(path.join(data, 'control.json'), { stop: true });
  const args = g => ({ root, tool: 'must-not-dispatch', data, cfg,
    fixture: { grant: g, controller: root, remote: 'synthetic', policies: {} },
    sourceFactory: () => ({ loadRemote: () => assert.fail('Must stop before task dispatch') }) });
  const reportB = await autonomousRun(args(b));
  assert.equal(reportB.grantId, b.grantId);
  const { autonomousRun: reloaded } = await import(`./autonomous.mjs?replay=${Date.now()}`);
  for (const g of [a, { ...a, maxModelCalls: a.maxModelCalls + 1 }]) {
    await assert.rejects(reloaded(args(g)), /grant.*reus|grant.*consum|reset budgets/i);
    assert.deepEqual(readJson(path.join(data, 'multi-ledger.json')), reportB, 'Denied replay must preserve latest ledger');
  }
  const { hash } = await import('./core.mjs');
  const savedA = readJson(path.join(data, 'grant-ledgers', 'synthetic', `${hash(a.grantId)}.json`));
  assert.equal(savedA.modelCalls, a.maxModelCalls);
  assert.deepEqual(savedA.retries, exhausted.retries);
  assert.deepEqual(savedA.outcomes, exhausted.outcomes);
  assert.equal(savedA.startedAt, exhausted.startedAt);
  const child = command(process.execPath, ['--input-type=module', '-e', `
    import { autonomousRun } from ${JSON.stringify(new URL('./autonomous.mjs', import.meta.url).href)};
    const args = JSON.parse(process.argv[1]);
    try { await autonomousRun(args); process.exitCode = 1; }
    catch (error) { if (!/Consumed grant/.test(error.message)) throw error; console.log('replay-denied'); }
  `, JSON.stringify(args(a))], root);
  assert.equal(child, 'replay-denied', 'A fresh process must also reject consumed A');
});

test('Resume uses durable per-identity counters; failed starts also consume grant identity', async () => {
  const data = fs.mkdtempSync(path.join(root, '.engineering-loop', 'grant-resume-'));
  const g = grant(), l = newLedger(validateAuthorization(g, cfg, true), g);
  const fixture = { grant: g, controller: root, remote: 'synthetic' };
  Object.assign(l, { fixture, modelCalls: 7, transitions: 9, retries: { r: 2 } });
  const { hash } = await import('./core.mjs');
  const canonical = path.join(data, 'grant-ledgers', 'synthetic', `${hash(g.grantId)}.json`);
  writeJson(canonical, l);
  writeJson(path.join(data, 'multi-ledger.json'), { ...l, modelCalls: 0, transitions: 0, retries: {} });
  writeJson(path.join(data, 'control.json'), { stop: true });
  const args = { root, tool: 'must-not-dispatch', data, cfg, fixture,
    sourceFactory: () => ({}) };
  const resumed = await autonomousRun({ ...args, resume: true });
  assert.equal(resumed.stopReason, 'Operator stop/pause');
  assert.equal(resumed.cycleId, l.cycleId);
  assert.equal(resumed.modelCalls, 7); assert.equal(resumed.transitions, 9);
  assert.equal(resumed.startedAt, l.startedAt); assert.deepEqual(resumed.retries, l.retries);
  assert.deepEqual(readJson(canonical), resumed);
  const failed = { ...g, grantId: 'failed-start-owner-grant' };
  const failure = await autonomousRun({ ...args, fixture: { ...args.fixture, grant: failed }, sourceFactory: () => { throw new Error('Source unavailable'); } });
  assert.match(failure.stopReason, /Source unavailable/);
  await assert.rejects(autonomousRun({ ...args, fixture: { ...args.fixture, grant: failed } }), /Consumed grant/);
});

test('Final grant ledger is durable before driver lock release', async () => {
  const data = fs.mkdtempSync(path.join(root, '.engineering-loop', 'grant-lock-'));
  const g = grant();
  const { hash } = await import('./core.mjs');
  writeJson(path.join(data, 'control.json'), { stop: true });
  let released = false;
  await autonomousRun({ root, tool: 'must-not-dispatch', data, cfg, fixture: { grant: g, controller: root, remote: 'synthetic' },
    sourceFactory: () => ({}), driverRelease: () => {
      assert.equal(readJson(path.join(data, 'grant-ledgers', 'synthetic', `${hash(g.grantId)}.json`)).phase, 'STOPPED');
      assert.equal(readJson(path.join(data, 'multi-ledger.json')).phase, 'STOPPED');
      released = true;
    } });
  assert.equal(released, true);
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
test('GitHub GET network/temporary server failures retry within a fixed bound without logging credentials', async () => {
  let calls = 0; const delays = [];
  const gh = new GitHub(root, cfg.repository, { wait: async ms => delays.push(ms), transport: async () => {
    calls++; if (calls === 1) throw new TypeError('fetch failed'); if (calls === 2) return { ok: false, status: 503 }; return { ok: true, status: 200, json: async () => ({ sha: 'verified' }) };
  } }); gh.token = 'synthetic-placeholder';
  assert.deepEqual(await gh.repo('/pulls/3'), { sha: 'verified' }); assert.equal(calls, 3); assert.deepEqual(delays, [1000, 2000]);
  calls = 0; gh.transport = async () => { calls++; throw new TypeError('contains sensitive raw payload'); };
  await assert.rejects(gh.repo('/pulls/3'), e => e.code === 'TRANSIENT_TRANSPORT' && !e.message.includes('sensitive')); assert.equal(calls, 3);
});
test('GitHub writes and permission failures are never blindly retried', async () => {
  let calls = 0; const gh = new GitHub(root, cfg.repository, { wait: async () => assert.fail('Must not retry'), transport: async () => { calls++; throw new TypeError('fetch failed'); } }); gh.token = 'synthetic-placeholder';
  await assert.rejects(gh.repo('/pulls', 'POST', { title: 'synthetic' }), /transport/); assert.equal(calls, 1);
  calls = 0; gh.transport = async () => { calls++; return { ok: false, status: 403 }; }; await assert.rejects(gh.repo('/pulls/3'), /403/); assert.equal(calls, 1);
});

test('Elapsed quota reset retries immediately but remains bounded and requires stable checkpoint', () => {
  const g = grant(), l = newLedger('h', g);
  const s = { phase: 'BLOCKED', runId: 'r', blockedFrom: 'REVIEW_WAIT', blockerCode: 'QUOTA_EXHAUSTED', retryAt: 1000 };
  assert.deepEqual(recoveryDecision(s, g, l, 1001), { kind: 'retry', at: 1001, phase: 'REVIEW_WAIT' });
  assert.equal(recoveryDecision(s, g, l, 1000).at, 1000);
  l.retries.r = g.maxRetries;
  assert.equal(recoveryDecision(s, g, l, 1001).kind, 'global');
  l.retries.r = 0;
  const expiredGrant = { ...g, expiresAt: new Date(1001).toISOString() };
  assert.equal(recoveryDecision(s, expiredGrant, l, 1001).kind, 'global');
  const expiredRun = { ...l, startedAt: new Date(0).toISOString() };
  assert.equal(recoveryDecision(s, { ...g, maxRunSeconds: 1 }, expiredRun, 1001).kind, 'global');
  assert.equal(recoveryDecision({ ...s, reviewerPid: 123 }, g, l, 1001).kind, 'global');
});

test('Authorization boundary caps timeouts, cancels active work and blocks subsequent commands/writes', async () => {
  const previous = process.env.ENGINEERING_LOOP_DEADLINE;
  try {
    process.env.ENGINEERING_LOOP_DEADLINE = '2000';
    assert.equal(remainingTime(95000, 1990), 10);
    assert.throws(() => remainingTime(95000, 2000), /deadline/);
    process.env.ENGINEERING_LOOP_DEADLINE = String(Date.now() + 40);
    await new Promise(resolve => deadlineTimer(95000, resolve));
    assert.throws(() => command(process.execPath, ['-e', 'process.exit(0)'], root), /deadline/);
    let writes = 0;
    const gh = new GitHub(root, cfg.repository, { transport: async () => { writes++; } });
    gh.token = 'fixture';
    await assert.rejects(gh.repo('/pulls', 'POST', {}), /deadline/);
    assert.equal(writes, 0);
  } finally {
    if (previous === undefined) delete process.env.ENGINEERING_LOOP_DEADLINE;
    else process.env.ENGINEERING_LOOP_DEADLINE = previous;
  }
});

test('Inherited deadlines constrain scheduler dispatch and preserve expired checkpoints', async t => {
  const previous = process.env.ENGINEERING_LOOP_DEADLINE;
  const at = Date.now();
  const clock = t.mock.method(Date, 'now', () => at);
  const calls = [];
  const spawn = t.mock.method(childProcess, 'spawnSync', (...args) => {
    calls.push(args);
    return { status: 1 }; // Stop after observing dispatch; never execute a controller.
  });
  syncBuiltinESMExports();
  try {
    for (const value of [String(at - 1), String(at), 'invalid', 'Infinity', '', '   ', String(at + 1000), String(at + 900000), undefined]) {
      if (value === undefined) delete process.env.ENGINEERING_LOOP_DEADLINE;
      else process.env.ENGINEERING_LOOP_DEADLINE = value;
      calls.length = 0;
      const data = fs.mkdtempSync(path.join(root, '.engineering-loop', 'inherited-deadline-'));
      const g = grant(), fixture = { grant: g, controller: root, remote: 'fixture', policies: {} };
      const l = newLedger(validateAuthorization(g, cfg, true), g);
      l.fixture = fixture;
      const state = { cycleId: l.cycleId, runId: 'r', taskId: 'D001', phase: 'MERGE_WAIT' };
      writeJson(path.join(data, 'multi-ledger.json'), l);
      writeJson(path.join(data, 'state.json'), state);
      writeJson(path.join(data, 'control.json'), {});
      let reads = 0;
      const report = await autonomousRun({ root, tool: 'must-not-execute', data,
        cfg: { ...cfg, codexTimeoutMinutes: 1, reviewTimeoutMinutes: 1 }, fixture, resume: true, driverRelease: () => {},
        sourceFactory: () => ({ loadRemote: () => { reads++; return { tasks: [], kind: 'synthetic-git', commit: 'fixture' }; } }) });
      if (value !== undefined && (!Number.isFinite(Number(value)) || Number(value) <= at)) {
        assert.equal(calls.length, 0, `Must not dispatch with deadline ${JSON.stringify(value)}`);
        assert.equal(reads, 0, 'Expired/invalid authority must stop before remote reads');
        assert.match(report.stopReason, /deadline/i);
        assert.equal(report.transitions, 0);
      } else {
        assert.equal(calls.length, 1);
        const effective = Math.min(at + 600000, value === undefined ? Infinity : Number(value));
        assert.equal(calls[0][2].env.ENGINEERING_LOOP_DEADLINE, String(effective));
        assert.ok(calls[0][2].timeout <= effective - at + 10000);
      }
      assert.deepEqual(readJson(path.join(data, 'state.json')), state);
    }
  } finally {
    spawn.mock.restore(); clock.mock.restore(); syncBuiltinESMExports();
    if (previous === undefined) delete process.env.ENGINEERING_LOOP_DEADLINE;
    else process.env.ENGINEERING_LOOP_DEADLINE = previous;
  }
});

test('Slow source read crossing run budget, grant or inherited expiry cannot dispatch or mutate checkpoint', async () => {
  for (const boundary of ['run', 'grant', 'inherited']) {
    const data = fs.mkdtempSync(path.join(root, '.engineering-loop', 'deadline-test-'));
    const realNow = Date.now, at = realNow();
    const g = grant();
    g.maxRunSeconds = boundary === 'run' ? 1 : 1000;
    g.expiresAt = new Date(at + (boundary === 'grant' ? 1000 : 600000)).toISOString();
    const fixture = { grant: g, controller: root, remote: 'fixture', policies: {} };
    const l = newLedger(validateAuthorization(g, cfg, true), g);
    l.fixture = fixture;
    const state = { cycleId: l.cycleId, runId: 'r', taskId: 'D001', phase: 'REVIEW_WAIT' };
    writeJson(path.join(data, 'multi-ledger.json'), l);
    writeJson(path.join(data, 'state.json'), state);
    writeJson(path.join(data, 'control.json'), {});
    const previous = process.env.ENGINEERING_LOOP_DEADLINE;
    try {
      if (boundary === 'inherited') process.env.ENGINEERING_LOOP_DEADLINE = String(at + 1000);
      const report = await autonomousRun({ root, tool: 'must-not-dispatch', data, cfg, fixture, resume: true, driverRelease: () => {},
        sourceFactory: () => ({ loadRemote: () => {
          Date.now = () => at + 2000;
          return { tasks: [], kind: 'synthetic-git', commit: 'fixture' };
        } }) });
      assert.equal(report.stopReason, 'Authorized deadline reached');
      assert.equal(report.modelCalls, 0);
      assert.equal(report.transitions, 0);
      assert.deepEqual(readJson(path.join(data, 'state.json')), state);
    } finally {
      Date.now = realNow;
      if (previous === undefined) delete process.env.ENGINEERING_LOOP_DEADLINE;
      else process.env.ENGINEERING_LOOP_DEADLINE = previous;
    }
  }
});

test('Persisted inherited deadline cannot expand after reload, removed env or a later caller deadline', async () => {
  const g = grant(), l = newLedger(validateAuthorization(g, cfg, true), g), ceiling = Date.now() + 1000;
  assert.equal(bindRunDeadline(l, g, String(ceiling)), ceiling);
  const restored = JSON.parse(JSON.stringify(l));
  assert.equal(bindRunDeadline(restored, g, undefined), ceiling);
  assert.equal(bindRunDeadline(restored, g, String(ceiling + 100000)), ceiling);
  assert.equal(bindRunDeadline(restored, g, String(ceiling - 1)), ceiling - 1);
  const { bindRunDeadline: reloaded } = await import(`./autonomous.mjs?deadline=${Date.now()}`);
  assert.equal(reloaded(JSON.parse(JSON.stringify(restored)), g, String(ceiling + 100000)), ceiling - 1);
  for (const value of [undefined, null, '123', NaN]) assert.throws(() => bindRunDeadline({ ...l, effectiveDeadline: value }, g), /persisted.*deadline/);
  const quotaState = { phase: 'BLOCKED', blockedFrom: 'REVIEW_WAIT', blockerCode: 'QUOTA_EXHAUSTED', retryAt: ceiling, runId: 'r' };
  assert.equal(recoveryDecision(quotaState, g, l, ceiling - 1).kind, 'global', 'No quota retry at the persisted inherited boundary');
});

test('Fresh process resume without inherited env stops at a persisted expired ceiling before source or controller', () => {
  const data = fs.mkdtempSync(path.join(root, '.engineering-loop', 'persisted-expiry-'));
  const g = grant(), l = newLedger(validateAuthorization(g, cfg, true), g);
  const fixture = { grant: g, controller: root, remote: 'synthetic' };
  l.fixture = fixture; l.effectiveDeadline = Date.now() - 1;
  const state = { cycleId: l.cycleId, runId: 'r', taskId: 'D001', phase: 'MERGE_WAIT' };
  writeJson(path.join(data, 'multi-ledger.json'), l); writeJson(path.join(data, 'state.json'), state); writeJson(path.join(data, 'control.json'), {});
  const output = command(process.execPath, ['--input-type=module', '-e', `
    import { autonomousRun } from ${JSON.stringify(new URL('./autonomous.mjs', import.meta.url).href)};
    delete process.env.ENGINEERING_LOOP_DEADLINE;
    const args = JSON.parse(process.argv[1]);
    const r = await autonomousRun({ ...args, resume: true, sourceFactory: () => { throw new Error('Must not read source after persisted expiry'); } });
    console.log(JSON.stringify({ deadline: r.effectiveDeadline, reason: r.stopReason, transitions: r.transitions }));
  `, JSON.stringify({ root, tool: 'must-not-dispatch', data, cfg, fixture })], root);
  const report = JSON.parse(output);
  assert.equal(report.deadline, l.effectiveDeadline); assert.equal(report.transitions, 0); assert.match(report.reason, /Authorized deadline reached/);
  assert.deepEqual(readJson(path.join(data, 'state.json')), state);
});

test('Initial driver persists inherited ceiling before source construction; hard restart cannot extend it', () => {
  const data = fs.mkdtempSync(path.join(root, '.engineering-loop', 'initial-deadline-'));
  const g = grant(), ceiling = Date.now() + 1000, fixture = { grant: g, controller: root, remote: 'synthetic' };
  writeJson(path.join(data, 'control.json'), {});
  const first = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { autonomousRun } from ${JSON.stringify(new URL('./autonomous.mjs', import.meta.url).href)};
    import { readJson } from ${JSON.stringify(new URL('./io.mjs', import.meta.url).href)};
    const args = JSON.parse(process.argv[1]); process.env.ENGINEERING_LOOP_DEADLINE = String(args.ceiling);
    await autonomousRun({ ...args, sourceFactory: () => {
      const l = readJson(args.data + '/multi-ledger.json');
      if (l.effectiveDeadline !== args.ceiling || !l.fixture) process.exit(99);
      process.exit(24);
    } });
  `, JSON.stringify({ root, tool: 'must-not-dispatch', data, cfg, fixture, ceiling })], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10000 });
  assert.equal(first.status, 24); assert.equal(readJson(path.join(data, 'multi-ledger.json')).phase, 'RUNNING');
  const second = command(process.execPath, ['--input-type=module', '-e', `
    import { autonomousRun } from ${JSON.stringify(new URL('./autonomous.mjs', import.meta.url).href)};
    const args = JSON.parse(process.argv[1]); delete process.env.ENGINEERING_LOOP_DEADLINE; Date.now = () => args.ceiling;
    const r = await autonomousRun({ ...args, resume: true, sourceFactory: () => { throw new Error('No source at inherited boundary'); } });
    console.log(JSON.stringify({ reason: r.stopReason, deadline: r.effectiveDeadline, transitions: r.transitions }));
  `, JSON.stringify({ root, tool: 'must-not-dispatch', data, cfg, fixture, ceiling })], root);
  const r = JSON.parse(second); assert.equal(r.deadline, ceiling); assert.equal(r.transitions, 0); assert.match(r.reason, /Authorized deadline reached/);
});

test('Legacy running ledger with unknown inherited ceiling blocks rather than inventing authority', async () => {
  const data = fs.mkdtempSync(path.join(root, '.engineering-loop', 'legacy-deadline-'));
  const g = grant(), l = newLedger(validateAuthorization(g, cfg, true), g); delete l.effectiveDeadline;
  l.fixture = { grant: g, controller: root, remote: 'synthetic' };
  writeJson(path.join(data, 'multi-ledger.json'), l); writeJson(path.join(data, 'control.json'), {});
  let reads = 0;
  const r = await autonomousRun({ root, tool: 'must-not-dispatch', data, cfg, fixture: l.fixture, resume: true,
    sourceFactory: () => { reads++; throw new Error('No source permitted'); } });
  assert.equal(reads, 0); assert.match(r.stopReason, /persisted effective deadline/); assert.equal(r.phase, 'STOPPED');
});

test('Retry crash windows always charge before runnable state; reload finishes one intent without double charge', () => {
  for (const fault of ['before-ledger', 'after-canonical', 'before-runnable', 'after-runnable']) {
    const data = fs.mkdtempSync(path.join(root, '.engineering-loop', 'retry-order-'));
    const g = grant(), original = newLedger(validateAuthorization(g, cfg, true), g);
    const statePath = path.join(data, 'state.json'), canonical = path.join(data, 'identity.json'), latest = path.join(data, 'latest.json');
    const state = { runId: 'r', phase: 'BLOCKED', blockedFrom: 'MERGE_WAIT', blocker: 'retry', blockerCode: 'TRANSIENT_TRANSPORT', deadline: 'old', commitSha: 'pinned' };
    writeJson(statePath, state); writeJson(canonical, original); writeJson(latest, original);
    const ledger = structuredClone(original);
    assert.throws(() => checkpointRetry({ state, decision: { kind: 'retry', phase: 'MERGE_WAIT' }, grant: g, ledger, statePath,
      persist: () => {
        if (fault === 'before-ledger') throw new Error('crash');
        writeJson(canonical, ledger);
        if (fault === 'after-canonical') throw new Error('crash');
        writeJson(latest, ledger);
      }, writeState: (file, value) => {
        assert.equal(readJson(canonical).retries.r, 1); assert.ok(readJson(canonical).retryPending, 'Durable charged intent precedes state release');
        if (fault === 'before-runnable') throw new Error('crash');
        writeJson(file, value); throw new Error('crash');
      } }), /crash/);
    const recovered = readJson(canonical), saved = readJson(statePath);
    assert.equal(recovered.retries.r ?? 0, fault === 'before-ledger' ? 0 : 1);
    if (saved.phase !== 'BLOCKED') assert.equal(recovered.retries.r, 1);
    let stateWrites = 0;
    checkpointRetry({ state: saved, decision: { kind: 'retry', phase: 'MERGE_WAIT' }, grant: g, ledger: recovered, statePath,
      persist: () => { writeJson(canonical, recovered); writeJson(latest, recovered); },
      writeState: (file, value) => { stateWrites++; writeJson(file, value); } });
    assert.equal(readJson(canonical).retries.r, 1); assert.equal(readJson(latest).retries.r, 1);
    assert.equal(readJson(canonical).retryPending, null); assert.equal(readJson(statePath).phase, 'MERGE_WAIT');
    assert.equal(stateWrites, fault === 'after-runnable' ? 0 : 1);
  }
});

test('Hard process exit after retry state release resumes the charged intent and rejects drift or exhausted budgets', () => {
  const data = fs.mkdtempSync(path.join(root, '.engineering-loop', 'retry-process-'));
  const g = grant(), l = newLedger(validateAuthorization(g, cfg, true), g), statePath = path.join(data, 'state.json'), ledgerPath = path.join(data, 'ledger.json');
  const state = { runId: 'r', phase: 'BLOCKED', blockedFrom: 'MERGE_WAIT', blockerCode: 'TRANSIENT_TRANSPORT' };
  writeJson(statePath, state); writeJson(ledgerPath, l);
  const child = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { checkpointRetry } from ${JSON.stringify(new URL('./autonomous.mjs', import.meta.url).href)};
    import { readJson, writeJson } from ${JSON.stringify(new URL('./io.mjs', import.meta.url).href)};
    const { statePath, ledgerPath, grant } = JSON.parse(process.argv[1]), ledger = readJson(ledgerPath);
    checkpointRetry({ state: readJson(statePath), decision: { kind: 'retry', phase: 'MERGE_WAIT' }, grant, ledger, statePath,
      persist: () => writeJson(ledgerPath, ledger), writeState: (f, v) => { writeJson(f, v); process.exit(23); } });
  `, JSON.stringify({ statePath, ledgerPath, grant: g })], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10000 });
  assert.equal(child.status, 23);
  const recovered = readJson(ledgerPath), ready = readJson(statePath);
  assert.equal(recovered.retries.r, 1); assert.equal(ready.phase, 'MERGE_WAIT');
  assert.throws(() => checkpointRetry({ state: { ...ready, commitSha: 'unexpected' }, grant: g, ledger: structuredClone(recovered), statePath, persist: () => {} }), /changed outside intent/);
  checkpointRetry({ state: ready, grant: g, ledger: recovered, statePath, persist: () => writeJson(ledgerPath, recovered), writeState: () => assert.fail('Already released; no duplicate state write') });
  assert.equal(recovered.retries.r, 1); assert.equal(recovered.retryPending, null);
  assert.throws(() => checkpointRetry({ state, decision: { kind: 'retry', phase: 'MERGE_WAIT' }, grant: g,
    ledger: { ...l, retries: { r: g.maxRetries } }, statePath, persist: () => assert.fail('No durable write after exhausted budget') }), /Retry limit/);
});
