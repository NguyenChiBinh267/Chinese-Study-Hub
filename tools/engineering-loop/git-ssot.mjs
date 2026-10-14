import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { hash, requireThat, now, allowedPath } from './core.mjs';
import { git, command, writeJson } from './io.mjs';
import { PLAN, STATUS, MANIFEST, PROTECTED, derive, parsePlan } from './plan.mjs';

export function blob(root, commit, file) {
  requireThat(/^[a-f0-9]{40}$/.test(commit) && allowedPath(file, [file]), 'Unsafe pinned Git read');
  const r = spawnSync('git', ['show', `${commit}:${file}`], { cwd: root, windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 30000 });
  requireThat(r.status === 0, `Pinned Git SSOT file unavailable: ${file}; migration must be reviewed/merged to main`);
  return r.stdout;
}
export function changedPaths(root, base, head) {
  return git(root, 'diff', '--name-only', '--no-renames', base, head, '--').split(/\r?\n/).filter(Boolean);
}
export function scopeGate(root, state, policy) {
  const files = changedPaths(root, state.baseSha, state.commitSha);
  requireThat(files.length > 0, 'Empty task branch');
  for (const file of files) {
    if (file === state.handoffFile) {
      requireThat(state.handoffHash === hash(blob(root, state.commitSha, file)), 'Controller handoff changed'); continue;
    }
    requireThat(allowedPath(file.toLowerCase(), policy.allowedFiles.map(x => x.toLowerCase())) &&
      !allowedPath(file.toLowerCase(), PROTECTED.map(x => x.toLowerCase())), `Protected/out-of-task change: ${file}`);
  }
  git(root, 'diff', '--check', state.baseSha, state.commitSha, '--');
  return files;
}
function fixtureSource(text, status, manifest, commit) {
  const parsed = parsePlan(text), tasks = parsed.tasks.map(t => ({ ...t, status: status.tasks[t.id]?.status, release: 'fixture' }));
  requireThat(manifest.synthetic === true && tasks.length > 1 && tasks.every(t => /^D\d{3}$/.test(t.id)) && status.activeRelease === 'fixture', 'Synthetic source cannot include/authorize real backlog IDs');
  const done = new Set(), visiting = new Set();
  function visit(id) { requireThat(!visiting.has(id), 'Fixture dependency cycle'); if (done.has(id)) return; visiting.add(id);
    const task = tasks.find(t => t.id === id); requireThat(task && ['pending', 'done'].includes(task.status), 'Invalid fixture task/status');
    for (const dep of task.dependencies) visit(dep); visiting.delete(id); done.add(id); }
  for (const task of tasks) visit(task.id);
  return { schemaVersion: 1, version: 'synthetic-v1', activeRelease: 'fixture', revision: `git:${commit}`, tasks,
    activeIds: tasks.map(t => t.id), common: [], parsed, sourceUrl: 'synthetic local Git bare remote' };
}
export const readyGitTasks = source => source.tasks.filter(t => source.activeIds.includes(t.id) && t.status === 'pending' &&
  t.dependencies.every(id => source.tasks.find(x => x.id === id)?.status === 'done'))
  .sort((a, b) => (a.id === 'T068' ? -1 : b.id === 'T068' ? 1 : a.priority - b.priority || a.id.localeCompare(b.id)));

export class GitSource {
  constructor({ root, synthetic = false, expectedRemote = 'https://github.com/NguyenChiBinh267/Chinese-Study-Hub.git', data }) {
    this.root = root; this.synthetic = synthetic; this.expectedRemote = expectedRemote; this.data = data ?? path.join(root, '.engineering-loop');
    requireThat(git(root, 'remote', 'get-url', 'origin') === expectedRemote, 'Git origin identity changed');
    if (synthetic) requireThat(path.isAbsolute(expectedRemote) && fs.existsSync(expectedRemote) && git(expectedRemote, 'rev-parse', '--is-bare-repository') === 'true', 'Fixture needs existing local bare remote');
    else requireThat(expectedRemote === 'https://github.com/NguyenChiBinh267/Chinese-Study-Hub.git', 'Unapproved real source remote');
  }
  fetchHead() { git(this.root, 'fetch', 'origin', 'main'); return git(this.root, 'rev-parse', 'origin/main'); }
  snapshot(commit) {
    const planBytes = blob(this.root, commit, PLAN), statusBytes = blob(this.root, commit, STATUS), manifestBytes = blob(this.root, commit, MANIFEST);
    const text = planBytes.toString('utf8'), status = JSON.parse(statusBytes.toString('utf8')), manifest = JSON.parse(manifestBytes.toString('utf8'));
    requireThat(manifest.planSha256 === hash(planBytes), 'Pinned plan/manifest hash mismatch');
    if (!this.synthetic) {
      requireThat(manifest.snapshotFile === 'source-export-v1.1.md' && manifest.statusAuthority === STATUS && manifest.specificationAuthority === PLAN, 'Wrong single-source/provenance authority');
      requireThat(hash(blob(this.root, commit, 'docs/master-plan/source-export-v1.1.md')) === manifest.snapshotSha256, 'Original source snapshot provenance drift');
    }
    const source = this.synthetic ? fixtureSource(text, status, manifest, commit) : derive(text, status, `git:${commit}`, manifest);
    return { ...source, kind: this.synthetic ? 'synthetic-git' : 'git-origin-main', commit, planHash: hash(planBytes), statusHash: hash(statusBytes), manifestHash: hash(manifestBytes), statuses: status };
  }
  loadRemote() { return this.snapshot(this.fetchHead()); }
  async verifyTask(state, task) {
    requireThat(state.sourceCommit && state.sourceRevision === `git:${state.sourceCommit}`, 'Missing pinned Git source commit');
    const head = this.fetchHead(), pinned = this.snapshot(state.sourceCommit);
    const ownMerge = ['MERGE_WAIT', 'SSOT_WAIT', 'CACHE_SYNCING'].includes(state.phase) && [state.mergePendingSha, state.mergeSha].filter(Boolean).includes(head);
    const ownStatus = ['SSOT_WAIT', 'CACHE_SYNCING'].includes(state.phase) && state.statusPendingSha === head;
    requireThat(head === state.sourceCommit || ownMerge || ownStatus, 'Git source HEAD drift; reconcile before continuing');
    if (head !== state.sourceCommit) {
      const current = this.snapshot(head);
      requireThat(current.planHash === pinned.planHash && current.manifestHash === pinned.manifestHash, 'Specification/manifest changed during own merge/status write');
      requireThat(!ownMerge || current.statusHash === pinned.statusHash, 'Unexpected status edit in merged task');
      if (ownStatus) requireThat(Object.keys(current.statuses.tasks).every(id => id === state.taskId ?
        current.statuses.tasks[id].status === 'done' && current.statuses.tasks[id].evidence?.runId === state.runId :
        JSON.stringify(current.statuses.tasks[id]) === JSON.stringify(pinned.statuses.tasks[id])), 'Unrelated concurrent task statuses changed');
    }
    const actual = pinned.tasks.find(t => t.id === state.taskId);
    requireThat(actual && actual.id === task.id && pinned.activeIds.includes(task.id), 'Task outside pinned active release');
    requireThat(JSON.stringify(actual.spec) === JSON.stringify(task.spec) && JSON.stringify(actual.dependencies) === JSON.stringify(task.dependencies), 'Pinned task specification/dependencies drift');
    requireThat(actual.dependencies.every(id => pinned.tasks.find(t => t.id === id)?.status === 'done'), 'Pinned task dependencies not done');
    const specHash = hash(JSON.stringify(actual.spec));
    requireThat(!state.specHash || state.specHash === specHash, 'Task spec hash drift');
    requireThat(!state.taskStatusHash || state.taskStatusHash === pinned.statusHash, 'Task status hash drift');
    const extra = state.policy?.sourceSections ?? [];
    const relevantSections = this.synthetic ? actual.spec : ['2.3', '11', '12.6', '14.1', '15', '10.3', ...extra].flatMap(id => {
      requireThat(pinned.parsed.sections[id], `Missing pinned section ${id}`); return pinned.parsed.sections[id]; });
    return { kind: pinned.kind, revision: state.sourceRevision, readbackVerified: true, observedMain: head, baseCommitSha: pinned.commit,
      specHash, taskStatusHash: pinned.statusHash, planHash: pinned.planHash, doneIds: pinned.tasks.filter(t => t.status === 'done').map(t => t.id), relevantSections };
  }
  ownerEvidence(commit, taskId) {
    try { return JSON.parse(blob(this.root, commit, `docs/master-plan/owner-evidence/${taskId}.json`).toString('utf8')); }
    catch { return null; }
  }
}

function reviewed(state, cfg, synthetic) {
  requireThat(state.review?.verdict === 'PASS' && state.review.commitSha === state.commitSha && state.review.taskId === state.taskId &&
    state.review.runId === state.runId && state.review.nonce === state.nonce && state.review.sourceRevision === state.sourceRevision &&
    state.review.findings.length === 0 && !state.writerPid && !state.reviewerPid, 'No independent exact-SHA PASS or concurrent process');
  if (synthetic) requireThat(state.mode === 'git-fixture' && /^D\d{3}$/.test(state.taskId) && cfg.liveEnabled === false && cfg.autoMerge === false && cfg.authorizedTasks.length === 0, 'Invalid synthetic authorization');
  else requireThat(state.mode === 'live' && cfg.liveEnabled === true && cfg.authorizedTasks.includes(state.taskId), 'Real task not authorized');
}
function verifyMerge(source, state, sha) {
  const parents = git(source.root, 'rev-list', '--parents', '-n', '1', sha).split(' ');
  requireThat(parents.length === 3 && parents[1] === state.sourceCommit && parents[2] === state.commitSha, 'Merge does not contain exact reviewed SHA and pinned main parent');
  git(source.root, 'merge-base', '--is-ancestor', state.commitSha, sha);
  requireThat(changedPaths(source.root, state.commitSha, sha).length === 0, 'Merge result differs from reviewed tree');
}
export class GitMerge {
  constructor({ source, cfg, checks, push = (root, sha) => git(root, 'push', 'origin', `${sha}:refs/heads/main`) }) {
    this.source = source; this.cfg = cfg; this.checks = checks; this.push = push;
  }
  async confirmMerged(state, task, policy, mergeSha, checkpoint = () => {}) {
    reviewed(state, this.cfg, this.source.synthetic);
    requireThat(state.phase === 'MERGE_WAIT' && /^[a-f0-9]{40}$/.test(mergeSha), 'Invalid observed merge');
    state.mergePendingSha = mergeSha; checkpoint(state);
    requireThat(this.source.fetchHead() === mergeSha, 'Main advanced beyond observed merge; reconcile');
    await this.source.verifyTask(state, task); verifyMerge(this.source, state, mergeSha); scopeGate(state.worktree, state, policy);
    const checks = await this.checks(state.worktree, policy, { state, source: this.source });
    requireThat(checks.length > 0 && checks.every(x => x.passed), 'Merged task deterministic acceptance failed');
    state.mergeChecks = checks; state.mergeSha = mergeSha; state.mergeVerified = true; checkpoint(state); return mergeSha;
  }
  async merge(state, task, policy, checkpoint = () => {}) {
    reviewed(state, this.cfg, this.source.synthetic);
    requireThat(state.phase === 'MERGE_WAIT', 'Not awaiting merge');
    if (!this.source.synthetic) requireThat(this.cfg.autoMerge === true, 'Automatic merge is disabled');
    requireThat(git(state.worktree, 'rev-parse', 'HEAD') === state.commitSha && git(state.worktree, 'status', '--porcelain') === '', 'Task HEAD/tree changed');
    await this.source.verifyTask(state, task);
    scopeGate(state.worktree, state, policy);
    const checks = await this.checks(state.worktree, policy, { state, source: this.source });
    requireThat(checks.length > 0 && checks.every(x => x.passed), 'Merge deterministic acceptance failed');
    state.mergeChecks = checks;
    let head = this.source.fetchHead();
    if (state.mergePendingSha && head === state.mergePendingSha) {
      verifyMerge(this.source, state, head); state.mergeSha = head; state.mergeVerified = true; checkpoint(state); return head;
    }
    requireThat(head === state.sourceCommit, 'Concurrent main update before merge');
    if (!state.mergePendingSha) {
      const repo = path.join(this.source.data, 'merge', state.runId.slice(0, 8));
      requireThat(!fs.existsSync(repo), 'Uncheckpointed merge workspace exists; inspect before retry');
      fs.mkdirSync(path.dirname(repo), { recursive: true });
      command('git', ['clone', '--no-local', '--no-hardlinks', '--no-checkout', state.worktree, repo], this.source.root);
      git(repo, 'remote', 'set-url', 'origin', this.source.expectedRemote); git(repo, 'config', 'core.autocrlf', 'false');
      git(repo, 'checkout', '--detach', state.sourceCommit); git(repo, 'merge', '--no-ff', '--no-commit', state.commitSha);
      git(repo, 'diff', '--cached', '--check'); git(repo, 'commit', '-m', `Merge ${state.taskId} independently reviewed ${state.commitSha}`);
      state.mergePendingSha = git(repo, 'rev-parse', 'HEAD'); state.mergeRepository = repo; checkpoint(state);
    }
    this.push(state.mergeRepository, state.mergePendingSha); // Non-force push: an advanced main rejects this merge, never overwrites it.
    head = this.source.fetchHead(); requireThat(head === state.mergePendingSha, 'Remote merge readback mismatch/concurrent update');
    verifyMerge(this.source, state, head); state.mergeSha = head; state.mergeVerified = true; checkpoint(state); return head;
  }
}

export class GitSSOT {
  constructor({ source, cfg, push = (root, sha) => git(root, 'push', 'origin', `${sha}:refs/heads/main`) }) { this.source = source; this.cfg = cfg; this.push = push; }
  async syncTask(state, task, checkpoint = () => {}) {
    reviewed(state, this.cfg, this.source.synthetic);
    requireThat(state.phase === 'SSOT_WAIT' && state.mergeVerified && state.mergeSha && task.id === state.taskId, 'Status needs verified merge/same task');
    if (!this.source.synthetic) requireThat(this.cfg.ssotAllowStatusWrites === true, 'Git status writes disabled');
    let head = this.source.fetchHead();
    requireThat(head === state.mergeSha || state.statusPendingSha && head === state.statusPendingSha, 'Concurrent main update before status synchronization');
    verifyMerge(this.source, state, state.mergeSha);
    const merged = this.source.snapshot(state.mergeSha), original = this.source.snapshot(state.sourceCommit);
    requireThat(merged.planHash === original.planHash && merged.statusHash === original.statusHash && merged.manifestHash === original.manifestHash, 'Merged branch changed SSOT/specification');
    if (!state.statusPendingSha) {
      requireThat(merged.statuses.tasks[state.taskId]?.status === 'pending', 'Status already done or not pending; inspect duplicate run');
      requireThat(state.mergeChecks?.length && state.mergeChecks.every(x => x.passed), 'Missing controller merge check evidence');
      state.completionTimestamp ??= now(); checkpoint(state);
      const updated = structuredClone(merged.statuses);
      updated.tasks[state.taskId] = { ...updated.tasks[state.taskId], status: 'done', evidence: {
        runId: state.runId, taskId: state.taskId, prUrl: state.prUrl, reviewedSha: state.commitSha, mergeSha: state.mergeSha,
        sourceCommit: state.sourceCommit, specificationHash: state.specHash, checks: state.mergeChecks, reviewerVerdict: 'PASS', completedAt: state.completionTimestamp } };
      const repo = path.join(this.source.data, 'status', state.runId.slice(0, 8));
      requireThat(!fs.existsSync(repo), 'Uncheckpointed status workspace exists; inspect before retry');
      fs.mkdirSync(path.dirname(repo), { recursive: true });
      command('git', ['clone', '--no-local', '--no-hardlinks', '--no-checkout', this.source.root, repo], this.source.root);
      git(repo, 'remote', 'set-url', 'origin', this.source.expectedRemote); git(repo, 'config', 'core.autocrlf', 'false');
      git(repo, 'fetch', 'origin', 'main'); git(repo, 'checkout', '--detach', state.mergeSha);
      writeJson(path.join(repo, STATUS), updated); git(repo, 'add', '--', STATUS);
      requireThat(git(repo, 'diff', '--cached', '--name-only') === STATUS, 'Status commit includes unrelated files');
      git(repo, 'diff', '--cached', '--check'); git(repo, 'commit', '-m', `status: complete ${state.taskId} run ${state.runId}`);
      state.statusPendingSha = git(repo, 'rev-parse', 'HEAD'); state.statusRepository = repo; state.expectedStatusHash = hash(blob(repo, state.statusPendingSha, STATUS)); checkpoint(state);
    }
    if (head !== state.statusPendingSha) this.push(state.statusRepository, state.statusPendingSha);
    head = this.source.fetchHead(); requireThat(head === state.statusPendingSha, 'Remote status readback mismatch/concurrent update');
    const after = this.source.snapshot(head);
    requireThat(after.statusHash === state.expectedStatusHash && after.planHash === merged.planHash && after.manifestHash === merged.manifestHash, 'Status/spec readback mismatch');
    requireThat(changedPaths(this.source.root, state.mergeSha, head).join('\n') === STATUS, 'Status commit changed specification/ADR/other files');
    const parents = git(this.source.root, 'rev-list', '--parents', '-n', '1', head).split(' ');
    requireThat(parents.length === 2 && parents[1] === state.mergeSha, 'Unexpected status commit ancestry');
    for (const id of Object.keys(merged.statuses.tasks)) requireThat(id === state.taskId ?
      after.statuses.tasks[id].status === 'done' && after.statuses.tasks[id].evidence.runId === state.runId && after.statuses.tasks[id].evidence.reviewedSha === state.commitSha :
      JSON.stringify(after.statuses.tasks[id]) === JSON.stringify(merged.statuses.tasks[id]), 'Unrelated task status changed');
    state.statusSha = head; state.syncedRevision = `git:${head}`; checkpoint(state);
    return { type: 'SSOT_SYNC', taskId: state.taskId, completedTaskId: state.taskId, commitSha: state.commitSha,
      previousRevision: state.sourceRevision, revision: state.syncedRevision, readbackVerified: true, unrelatedPlanChanges: false,
      doneIds: after.tasks.filter(t => t.status === 'done').map(t => t.id) };
  }
}
