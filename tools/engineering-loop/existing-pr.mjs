import path from 'node:path';
import fs from 'node:fs';
import { hash, requireThat, move } from './core.mjs';
import { git, command } from './io.mjs';
import { scopeGate } from './git-ssot.mjs';
import { acceptanceChecks } from './acceptance.mjs';

export function validateExistingTarget(target, taskId, repository, baseSha) {
  requireThat(target?.taskId === taskId && /^T\d{3}$/.test(taskId) && target.repository === repository &&
    Number.isSafeInteger(target.pr) && target.pr > 0 && target.baseSha === baseSha && /^[a-f0-9]{40}$/.test(baseSha) &&
    /^[a-f0-9]{40}$/.test(target.headSha ?? '') && typeof target.branch === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(target.branch) && !target.branch.includes('..') && !target.branch.includes('//') &&
    !/[/.]$/.test(target.branch) && !target.branch.endsWith('.lock') && target.branch !== 'main', 'Missing/invalid pinned existing PR mapping');
  return target;
}
export function validateExistingIdentity(pr, target) {
  requireThat(pr.number === target.pr && pr.state === 'open' && !pr.merged && pr.draft === true &&
    pr.head?.repo?.full_name === target.repository && pr.base?.repo?.full_name === target.repository &&
    pr.base.ref === 'main' && pr.base.sha === target.baseSha && pr.head.ref === target.branch && pr.head.sha === target.headSha,
  'Existing PR identity/base/HEAD/state drift');
}
// Titles are untrusted duplicate hints, never authority or evidence of completion.
export async function existingCandidate(gh, cfg, taskId, baseSha) {
  const mapped = cfg.existingPullRequests?.[taskId];
  const matches = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await gh.repo(`/pulls?state=open&base=main&per_page=100&page=${page}`);
    requireThat(Array.isArray(batch), 'Invalid existing PR discovery');
    matches.push(...batch.filter(pr => new RegExp(`\\b${taskId}\\b`, 'i').test(pr.title ?? '') || pr.number === mapped?.pr));
    if (batch.length < 100) {
      requireThat(matches.length <= 1, 'Multiple existing candidates; do not regenerate task');
      if (!mapped) { requireThat(matches.length === 0, 'Existing task candidate requires pinned mapping; do not regenerate task'); return null; }
      const target = validateExistingTarget(mapped, taskId, cfg.repository, baseSha);
      requireThat(matches.length === 1, 'Pinned existing PR missing from open candidates');
      validateExistingIdentity(matches[0], target); return { ...target };
    }
  }
  throw new Error('Existing PR discovery incomplete; do not create a duplicate');
}
export async function adoptExisting({ root, data, state, cfg, task, policy, source, gh, target, save }) {
  requireThat(cfg.liveEnabled === true && cfg.authorizedTasks.includes(task.id) && cfg.sourceBackend === 'git' &&
    cfg.reviewerBackend === 'local-codex' && state.mode === 'live' && state.phase === 'QUEUED' &&
    !state.writerPid && !state.reviewerPid && state.evidence.length === 0, 'Existing PR adoption needs authorized fresh task and local independent review');
  validateExistingTarget(target, task.id, cfg.repository, state.sourceCommit);
  validateExistingIdentity(await gh.repo(`/pulls/${target.pr}`), target);
  await source.verifyTask(state, task);
  git(root, 'fetch', 'origin', target.branch);
  requireThat(git(root, 'rev-parse', `origin/${target.branch}`) === target.headSha, 'Fetched existing HEAD drift');
  git(root, 'merge-base', '--is-ancestor', target.baseSha, target.headSha);
  const worktree = path.join(data, 'adopted', state.runId);
  requireThat(!fs.existsSync(worktree), 'Existing adoption workspace requires checkpoint reconciliation');
  move(state, 'HANDOFF_CREATING', { adoptedPullRequest: { ...target }, baseSha: target.baseSha, commitSha: target.headSha,
    branch: target.branch, pr: target.pr, prUrl: `https://github.com/${target.repository}/pull/${target.pr}`, worktree }); save(state);
  fs.mkdirSync(path.dirname(worktree), { recursive: true });
  command('git', ['clone', '--no-local', '--no-hardlinks', '--no-checkout', root, worktree], root);
  git(worktree, 'config', 'core.autocrlf', 'false');
  const clonedBranch = git(worktree, 'for-each-ref', '--format=%(objectname)', `refs/heads/${target.branch}`);
  if (clonedBranch) { requireThat(clonedBranch === target.headSha, 'Clone branch differs from pinned candidate'); git(worktree, 'checkout', target.branch); }
  else git(worktree, 'checkout', '-b', target.branch, target.headSha);
  git(worktree, 'remote', 'set-url', 'origin', `https://github.com/${cfg.repository}.git`);
  scopeGate(worktree, state, policy);
  // No handoff commit, issue, PR, developer, push, merge or imported PASS.
  move(state, 'SOURCE_WAIT'); save(state);
}
export async function prepareExistingReview({ state, task, policy, source, gh, save }) {
  requireThat(state.phase === 'SOURCE_WAIT' && state.adoptedPullRequest && !state.writerPid && !state.reviewerPid &&
    state.repairs === 0 && !state.review, 'Invalid existing candidate review entry');
  validateExistingIdentity(await gh.repo(`/pulls/${state.pr}`), state.adoptedPullRequest);
  const proof = await source.verifyTask(state, task);
  requireThat(git(state.worktree, 'rev-parse', 'HEAD') === state.adoptedPullRequest.headSha &&
    state.commitSha === state.adoptedPullRequest.headSha && git(state.worktree, 'status', '--porcelain') === '', 'Adopted bytes/HEAD changed');
  const files = scopeGate(state.worktree, state, policy), checks = acceptanceChecks(state.worktree, policy, { state, source });
  // All configured executable checks still use the normal allowlist.
  requireThat((policy.checks ?? []).length === 0, 'Existing PR executable evidence needs a reviewed check adapter');
  state.evidence.push({ commitSha: state.commitSha, checks, files, origin: 'controller checked actual existing bytes; not developer COMPLETE or review approval',
    artifactHashes: Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(path.join(state.worktree, file)))])) });
  state.sourceAttestation = { ...proof, attestedAt: new Date().toISOString() };
  move(state, 'REVIEW_WAIT', { deadline: null }); save(state);
}
