import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { hash, now, requireThat, newExecution } from './core.mjs';
import { git, readJson, writeJson, lock } from './io.mjs';
import { GitSource, readyGitTasks } from './git-ssot.mjs';

const STABLE = ['QUEUED', 'SOURCE_WAIT', 'DEVELOP_READY', 'REPAIR_READY', 'REVIEW_WAIT', 'MERGE_WAIT', 'SSOT_WAIT', 'CACHE_SYNCING', 'PUBLISHING'];
export function validateAuthorization(grant, cfg, synthetic = false, at = Date.now()) {
  requireThat(grant?.schemaVersion === 1 && grant.ownerApproved === true && typeof grant.grantId === 'string' && grant.grantId.length >= 16, 'One-time owner authorization missing');
  requireThat(grant.repository === cfg.repository && grant.release === (synthetic ? 'fixture' : 'M0'), 'Authorization repository/release mismatch');
  requireThat(Number.isFinite(Date.parse(grant.expiresAt)) && Date.parse(grant.expiresAt) > at, 'Authorization expired');
  requireThat(grant.tasks?.length && new Set(grant.tasks).size === grant.tasks.length && grant.tasks.every(id => (synthetic ? /^D\d{3}$/ : /^T\d{3}$/).test(id)), 'Invalid authorization task scope');
  requireThat(grant.autoMerge === true && grant.statusWrites === true && grant.maxServiceCost === 0 && grant.allowPaidCredits === false && grant.allowNewServices === false, 'Zero-touch requires explicit merge/status authority and zero-cost constraints');
  for (const key of ['maxTasks', 'maxModelCalls', 'maxRunSeconds', 'maxRetries', 'maxQuotaWaitSeconds']) requireThat(Number.isInteger(grant[key]) && grant[key] > 0, `Authorization limit missing: ${key}`);
  requireThat(grant.maxRetries <= 3, 'Retry bound exceeds 3');
  if (synthetic) requireThat(!cfg.liveEnabled && !cfg.autoMerge && !cfg.ssotAllowStatusWrites && cfg.authorizedTasks.length === 0, 'Fixture cannot activate real authority');
  else {
    requireThat(/^[a-f0-9]{40}$/.test(grant.bootstrapReviewedSha ?? ''), 'Bootstrap PASS SHA must be authorized');
    requireThat(cfg.liveEnabled && cfg.autoMerge && cfg.ssotAllowStatusWrites && JSON.stringify([...cfg.authorizedTasks].sort()) === JSON.stringify([...grant.tasks].sort()), 'Dormant/configured authority does not match the explicit grant');
  }
  return hash(JSON.stringify(grant));
}

// Missing contracts/attestations are task-local. Source/security/unknown errors always stop the run.
export function preflight(task, policy, source, commit) {
  if (!policy?.allowedFiles?.length || !Array.isArray(policy.checks) || !policy.acceptanceChecks?.length) return 'Missing acceptance contract';
  if (['T053', 'T069', 'T016', 'T034', 'T044', 'T047', 'T050', 'T055'].includes(task.id)) return 'Separate hosting/content-instance authority required';
  const gates = policy.acceptanceChecks.filter(c => c.kind === 'owner-evidence');
  if (gates.length) {
    const proof = source.ownerEvidence(commit, task.id);
    if (!proof || proof.taskId !== task.id || proof.verified !== true || proof.verifiedBy !== 'owner' ||
      gates.some(c => !proof.scopes?.includes(c.scope)) || !Number.isFinite(Date.parse(proof.checkedAt)) || Date.parse(proof.checkedAt) > Date.now() ||
      !(Date.parse(proof.expiresAt) > Date.now()) || !/^[a-f0-9]{64}$/.test(proof.artifactSha256 ?? '') || !proof.evidenceUrls?.length) return 'Missing/invalid pinned human-only evidence';
    // Detailed evidence validation remains mandatory at acceptance against final artifact bytes.
  }
  return null;
}
export function recoveryDecision(state, grant, ledger, at = Date.now()) {
  if (state.phase !== 'BLOCKED') return null;
  if (state.writerPid || state.reviewerPid || !STABLE.includes(state.blockedFrom)) return { kind: 'global', reason: 'Unsafe interrupted process/write checkpoint' };
  if (state.blockerCode === 'QUOTA_EXHAUSTED') {
    const deadline = Math.min(ledger.effectiveDeadline ?? Infinity, Date.parse(grant.expiresAt), Date.parse(ledger.startedAt) + grant.maxRunSeconds * 1000);
    if (Number.isFinite(deadline) && Math.max(at, state.retryAt) >= deadline) return { kind: 'global', reason: 'Quota retry outside authorized run/grant deadline' };
    if (!Number.isFinite(state.retryAt) || state.retryAt - at > grant.maxQuotaWaitSeconds * 1000) return { kind: 'global', reason: 'Quota reset unavailable/outside authorized wait budget' };
    if ((ledger.retries[state.runId] ?? 0) >= grant.maxRetries) return { kind: 'global', reason: 'Quota retry limit' };
    return { kind: 'retry', at: Math.max(at, state.retryAt), phase: state.blockedFrom };
  }
  if (state.blockerCode === 'TRANSIENT_TRANSPORT' && ['SOURCE_WAIT', 'MERGE_WAIT', 'SSOT_WAIT', 'CACHE_SYNCING', 'PUBLISHING'].includes(state.blockedFrom)) {
    if ((ledger.retries[state.runId] ?? 0) >= grant.maxRetries) return { kind: 'global', reason: 'Transport retry limit' };
    return { kind: 'retry', at: at + Math.min(60, 2 ** (ledger.retries[state.runId] ?? 0)) * 1000, phase: state.blockedFrom };
  }
  if (state.blockerCode === 'TASK_LOCAL' && !state.mergePendingSha && !state.mergeSha && !state.statusPendingSha) return { kind: 'task', reason: state.blocker };
  return { kind: 'global', reason: state.blocker || 'Unknown/integrity failure' };
}
export function chooseTask(snapshot, grant, ledger) {
  const attempted = new Set(ledger.outcomes.map(x => x.taskId));
  return readyGitTasks(snapshot).find(t => grant.tasks.includes(t.id) && !attempted.has(t.id));
}
export function newLedger(grantHash, grant) {
  const startedAt = now();
  return { schemaVersion: 1, cycleId: randomUUID(), grantHash, grantId: grant.grantId, startedAt,
    effectiveDeadline: Math.min(Date.parse(grant.expiresAt), Date.parse(startedAt) + grant.maxRunSeconds * 1000),
    phase: 'RUNNING', outcomes: [], retries: {}, modelCalls: 0, transitions: 0, controllerPids: [], expectedHead: null };
}

export function bindRunDeadline(ledger, grant, inherited = process.env.ENGINEERING_LOOP_DEADLINE) {
  const inheritedDeadline = inherited === undefined ? Infinity : Number(inherited);
  requireThat(inherited === undefined || inherited.trim() !== '' && Number.isFinite(inheritedDeadline), 'Invalid inherited deadline');
  requireThat(Number.isSafeInteger(ledger.effectiveDeadline), 'Missing/invalid persisted effective deadline; reconcile legacy authority');
  const deadline = Math.min(ledger.effectiveDeadline, inheritedDeadline, Date.parse(grant.expiresAt), Date.parse(ledger.startedAt) + grant.maxRunSeconds * 1000);
  requireThat(Number.isSafeInteger(deadline), 'Invalid run deadline');
  ledger.effectiveDeadline = deadline; return deadline;
}

// Write-ahead retry intent: charge canonical grant identity BEFORE releasing state.
// A restart completes the same charged intent rather than charging/replaying it again.
export function checkpointRetry({ state, decision, grant, ledger, statePath, persist, writeState = writeJson }) {
  const digest = value => hash(JSON.stringify(value));
  const runnable = phase => ({ ...state, phase, blocker: null, blockerCode: null, deadline: null });
  if (!ledger.retryPending) {
    requireThat(state.phase === 'BLOCKED' && decision?.kind === 'retry' && STABLE.includes(decision.phase), 'Invalid retry checkpoint');
    const attempt = (ledger.retries[state.runId] ?? 0) + 1;
    requireThat(Number.isSafeInteger(attempt) && attempt > 0 && attempt <= grant.maxRetries, 'Retry limit');
    const next = runnable(decision.phase);
    ledger.retryPending = { runId: state.runId, attempt, phase: decision.phase, fromHash: digest(state), toHash: digest(next) };
    ledger.retries[state.runId] = attempt; ledger.wait = null;
    persist();
  }
  const pending = ledger.retryPending;
  requireThat(pending.runId === state.runId && STABLE.includes(pending.phase) && Number.isSafeInteger(pending.attempt) &&
    pending.attempt > 0 && pending.attempt <= grant.maxRetries && ledger.retries[state.runId] === pending.attempt, 'Retry intent/counter drift');
  if (digest(state) === pending.fromHash) {
    requireThat(state.phase === 'BLOCKED' && digest(runnable(pending.phase)) === pending.toHash, 'Retry intent state drift');
    writeState(statePath, runnable(pending.phase));
  } else requireThat(state.phase === pending.phase && digest(state) === pending.toHash, 'Retry checkpoint changed outside intent');
  ledger.retryPending = null; persist();
}
export function summarize(ledger, snapshot, reason) {
  return { ...ledger, phase: 'STOPPED', stoppedAt: now(), stopReason: reason,
    dependencyBlocked: snapshot.tasks.filter(t => t.status !== 'done' && t.dependencies.some(d => snapshot.tasks.find(x => x.id === d)?.status !== 'done')).map(t => t.id),
    sourceKind: snapshot.kind, remoteHead: snapshot.commit, manualRelay: false,
    externalGitHubLifecycleVerified: false, realBacklogExecuted: ledger.outcomes.some(x => /^T/.test(x.taskId)), fullyAutomatedProject: false };
}

// Driver delegates every transition to the existing controller, with its existing writer lock/state machine.
// The ledger is execution evidence only; it never marks Git SSOT tasks done or satisfies dependencies.
export async function autonomousRun({ root, tool, data, cfg, fixture = null, resume = false, driverRelease = null, sourceFactory = options => new GitSource(options) }) {
  const synthetic = !!fixture;
  const grant = synthetic ? fixture.grant : cfg.zeroTouchAuthorization;
  const grantHash = validateAuthorization(grant, cfg, synthetic);
  const statePath = path.join(data, 'state.json'), ledgerPath = path.join(data, synthetic ? 'multi-ledger.json' : 'autonomous-ledger.json');
  const release = driverRelease ?? lock(path.join(data, 'git-driver.lock'), statePath);
  const grantDirectory = path.join(data, 'grant-ledgers', synthetic ? 'synthetic' : 'live');
  const grantPath = id => path.join(grantDirectory, `${hash(id)}.json`);
  const identityPath = grantPath(grant.grantId);
  let ledger, snapshot, reason = 'No eligible task', src;
  const controlPath = path.join(data, 'control.json');
  const readControl = () => readJson(controlPath);
  // Final identity/latest checkpoints must be durable before another driver takes the lock.
  try {
  try {
    // Import the pre-registry checkpoint before any other grant can replace it.
    const latest = fs.existsSync(ledgerPath) ? readJson(ledgerPath) : null;
    if (latest) {
      requireThat(typeof latest.grantId === 'string' && latest.grantId.length >= 16, 'Invalid prior grant identity');
      if (!fs.existsSync(grantPath(latest.grantId))) writeJson(grantPath(latest.grantId), latest);
    }
    let candidate;
    if (resume) {
      requireThat(latest?.grantId === grant.grantId, 'Resume grant differs from latest cycle');
      candidate = readJson(identityPath);
      requireThat(candidate.cycleId === latest.cycleId, 'Grant cycle checkpoint mismatch');
      requireThat(candidate.grantHash === grantHash && candidate.phase === 'RUNNING', 'Grant drift or stopped cycle; new explicit run required');
    } else {
      requireThat(!fs.existsSync(identityPath), 'Consumed grant cannot be reused to reset budgets; issue a new explicit grant');
      candidate = newLedger(grantHash, grant);
    }
    ledger = candidate;
    const persist = () => { writeJson(identityPath, ledger); writeJson(ledgerPath, ledger); };
    const runDeadline = bindRunDeadline(ledger, grant);
    if (synthetic && !resume) ledger.fixture = fixture;
    // Persist the inherited ceiling in both identity/latest checkpoints before any work.
    persist();
    if (resume && synthetic) fixture = ledger.fixture;
    requireThat(Date.now() < runDeadline, 'Authorized deadline reached');
    src = sourceFactory({ root: synthetic ? fixture.controller : root, synthetic,
      expectedRemote: synthetic ? fixture.remote : `https://github.com/${cfg.repository}.git`, data: path.join(data, 'git-operations', ledger.cycleId.slice(0, 8)) });
    if (!synthetic) {
      const bootstrap = readJson(path.join(data, 'bootstrap-latest.json'));
      requireThat(bootstrap.review?.verdict === 'PASS' && bootstrap.review.commitSha === grant.bootstrapReviewedSha && bootstrap.review.findings.length === 0 &&
        bootstrap.reviewerReceipt?.sandbox === 'read-only' && bootstrap.reviewerReceipt?.newSession && bootstrap.checks?.every(c => c.passed), 'Missing independent exact-SHA bootstrap PASS');
      const main = src.fetchHead(); git(root, 'merge-base', '--is-ancestor', grant.bootstrapReviewedSha, main);
    }
    ledger.driverPids ??= []; ledger.driverPids.push(process.pid);
    persist();
    while (true) {
      validateAuthorization(grant, cfg, synthetic);
      if (!synthetic) requireThat(validateAuthorization(readJson(path.join(data, 'config.json')).zeroTouchAuthorization, readJson(path.join(data, 'config.json'))) === grantHash, 'Owner grant changed during cycle');
      const ctl = readControl();
      if (ctl.pause || ctl.stop) { reason = 'Operator stop/pause'; break; }
      if (Date.now() - Date.parse(ledger.startedAt) >= grant.maxRunSeconds * 1000) { reason = 'Run time budget'; break; }
      if (Date.now() >= runDeadline) { reason = 'Authorized deadline reached'; break; }
      if (ledger.retryPending) checkpointRetry({ state: readJson(statePath), grant, ledger, statePath, persist });
      // Respect durable backoff before any remote read, including after restart.
      const pendingAt = Math.max(ledger.remoteWait?.at ?? 0, ledger.wait?.at ?? 0);
      if (Date.now() < pendingAt) {
        await new Promise(resolve => setTimeout(resolve, Math.min(1000, pendingAt - Date.now()))); continue;
      }
      try {
        snapshot = src.loadRemote();
        ledger.remoteWait = null;
        persist();
      } catch (error) {
        if (error.code !== 'TRANSIENT_TRANSPORT') throw error;
        const attempts = ledger.remoteRetries ?? 0;
        requireThat(attempts < grant.maxRetries, 'Remote read transport retry limit');
        ledger.remoteRetries = attempts + 1;
        ledger.remoteWait = { at: Date.now() + Math.min(60, 2 ** attempts) * 1000 };
        persist(); continue;
      }
      if (Date.now() >= runDeadline) { reason = 'Authorized deadline reached'; break; }
      let state = fs.existsSync(statePath) ? readJson(statePath) : null;
      if (!state || ['DONE', 'BLOCKED'].includes(state.phase)) {
        if (state && state.cycleId === ledger.cycleId && !ledger.outcomes.some(x => x.runId === state.runId)) {
          if (state.phase === 'BLOCKED') {
            const decision = ledger.wait?.runId === state.runId ? ledger.wait : recoveryDecision(state, grant, ledger);
            if (decision.kind === 'retry') {
              ledger.wait = { runId: state.runId, ...decision }; persist();
              if (Date.now() < decision.at) { await new Promise(resolve => setTimeout(resolve, Math.min(1000, decision.at - Date.now()))); continue; }
              checkpointRetry({ state, decision, grant, ledger, statePath, persist }); continue;
            }
            if (decision.kind === 'global') { reason = `Global blocker: ${decision.reason}`; break; }
          }
          const expected = state.phase === 'DONE' ? state.statusSha : state.sourceCommit;
          requireThat(snapshot.commit === expected, 'Remote source changed between task checkpoints');
          ledger.expectedHead = expected;
          const outcome = { runId: state.runId, taskId: state.taskId, phase: state.phase, blocker: state.blocker,
            sourceCommit: state.sourceCommit, reviewedSha: state.commitSha, mergeSha: state.mergeSha, statusSha: state.statusSha,
            verdict: state.review?.verdict, repairs: state.repairs, processReceipts: state.processReceipts ?? [], events: state.events };
          ledger.outcomes.push(outcome); persist();
          writeJson(path.join(data, 'history', `${state.runId}-autonomous.json`), state);
        }
        requireThat(!state || state.cycleId === ledger.cycleId || !state.writerPid && !state.reviewerPid &&
          (state.mode === 'git-fixture' && ['DONE', 'BLOCKED'].includes(state.phase) || !resume && state.mode === 'live' && state.phase === 'DONE' && snapshot.tasks.find(t => t.id === state.taskId)?.status === 'done'), 'Existing execution belongs to another/active cycle');
        requireThat(!ledger.expectedHead || snapshot.commit === ledger.expectedHead, 'Concurrent source update between tasks; stop/reconcile');
        if (ledger.outcomes.length >= grant.maxTasks) { reason = 'Task budget'; break; }
        const task = chooseTask(snapshot, grant, ledger);
        if (!task) break;
        const policy = synthetic ? fixture.policies[task.id] : cfg.policies[task.id];
        state = newExecution(task, snapshot, synthetic ? 'git-fixture' : 'live');
        Object.assign(state, { cycleId: ledger.cycleId, authorizationHash: grantHash, sourceCommit: snapshot.commit, specHash: hash(JSON.stringify(task.spec)), taskStatusHash: snapshot.statusHash,
          ...(synthetic ? { fixtureControllerRoot: fixture.controller, fixtureRemote: fixture.remote, fixturePolicies: fixture.policies, fixtureInitialDefect: task.id === 'D001' } : {}) });
        const blocker = preflight(task, policy, src, snapshot.commit);
        if (blocker) Object.assign(state, { phase: 'BLOCKED', blockedFrom: 'QUEUED', blocker, blockerCode: 'TASK_LOCAL' });
        if (Date.now() >= runDeadline) { reason = 'Authorized deadline reached'; break; }
        writeJson(statePath, state); persist();
        if (blocker) continue;
      }
      requireThat(state.cycleId === ledger.cycleId, 'Unrelated active execution');
      if (['DEVELOP_READY', 'REPAIR_READY', 'REVIEW_WAIT'].includes(state.phase)) {
        if (ledger.modelCalls >= grant.maxModelCalls) { reason = 'Model call budget'; break; }
        // Count before dispatch, so a driver crash cannot hide an attempted model invocation.
        ledger.modelCalls++; persist();
      }
      if (Date.now() >= runDeadline) { reason = 'Authorized deadline reached'; break; }
      const child = spawnSync(process.execPath, [path.join(tool, 'loop.mjs'), 'step'], { cwd: root, windowsHide: true, encoding: 'utf8',
        // Controller owns deadline cancellation and checkpoint cleanup; parent allows bounded cleanup time.
        env: { ...process.env, ENGINEERING_LOOP_DEADLINE: String(runDeadline) },
        timeout: Math.min((cfg.codexTimeoutMinutes + cfg.reviewTimeoutMinutes + 5) * 60000, runDeadline - Date.now() + 10000), maxBuffer: 8 * 1024 * 1024 });
      ledger.transitions++; if (child.pid) ledger.controllerPids.push(child.pid); persist();
      requireThat(child.status === 0, 'Controller exited; preserve checkpoint for restart, no automatic replay of unsafe writes');
      state = readJson(statePath);
      console.log(JSON.stringify({ cycleId: ledger.cycleId, taskId: state.taskId, phase: state.phase, repairs: state.repairs, blocker: state.blocker }));
      // Deterministic fixture failpoint: process exits after durable MERGE_WAIT, then driver resumes automatically.
      if (synthetic && fixture.restartProbe && (!ledger.restartProbe && state.phase === 'MERGE_WAIT' || ledger.restartProbe && !ledger.statusRestartProbe && state.phase === 'SSOT_WAIT')) {
        const probe = { taskId: state.taskId, phase: state.phase, commitSha: state.commitSha, mergeSha: state.mergeSha, driverPid: process.pid, at: now() };
        if (state.phase === 'MERGE_WAIT') ledger.restartProbe = probe; else ledger.statusRestartProbe = probe;
        persist();
        return { phase: 'RESTART_REQUIRED', ledgerPath };
      }
    }
  } catch (error) { reason = `Global blocker: ${error.message}`; }
  if (ledger) {
    if (!snapshot) snapshot = { tasks: [], kind: synthetic ? 'synthetic-git' : 'git-origin-main', commit: null };
    const report = summarize(ledger, snapshot, reason);
    if (fs.existsSync(statePath)) {
      const active = readJson(statePath);
      if (active.cycleId === ledger.cycleId && !ledger.outcomes.some(x => x.runId === active.runId)) report.activeCheckpoint = {
        taskId: active.taskId, runId: active.runId, phase: active.phase, blockedFrom: active.blockedFrom, blocker: active.blocker,
        blockerCode: active.blockerCode, sourceCommit: active.sourceCommit, commitSha: active.commitSha, mergeSha: active.mergeSha, statusPendingSha: active.statusPendingSha };
    }
    writeJson(identityPath, report);
    writeJson(ledgerPath, report);
    writeJson(path.join(data, synthetic ? 'multi-cycle-latest.json' : 'autonomous-report.json'), report);
    writeJson(controlPath, { pause: false, stop: true, changedAt: now() });
    return report;
  }
  throw new Error(reason);
  } finally { release(); }
}

export function superviseFixture({ root, tool, data, start = false }) {
  const results = [];
  for (let i = 0; i < 3; i++) {
    const action = i === 0 && start ? 'dry-multi' : 'multi-resume';
    const child = spawnSync(process.execPath, [path.join(tool, 'loop.mjs'), action], { cwd: root, windowsHide: true, encoding: 'utf8',
      timeout: 10800000, maxBuffer: 8 * 1024 * 1024 });
    if (child.stdout) process.stdout.write(child.stdout);
    results.push({ action, processId: child.pid, exitCode: child.status });
    requireThat(child.status === 0, 'Fixture driver crashed outside its checkpoint; no unsafe retry');
    const ledger = readJson(path.join(data, 'multi-ledger.json'));
    if (ledger.phase === 'STOPPED') {
      const report = readJson(path.join(data, 'multi-cycle-latest.json'));
      report.supervisor = { processId: process.pid, drivers: results, automaticRestart: results.length > 1, ownerTransitions: 0 };
      writeJson(path.join(data, 'multi-cycle-latest.json'), report); return report;
    }
    requireThat(ledger.phase === 'RUNNING' && ledger.restartProbe, 'Unrecognized driver stop; preserve checkpoint');
  }
  throw new Error('Supervisor restart bound reached');
}
