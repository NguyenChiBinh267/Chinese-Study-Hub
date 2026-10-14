import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { hash, newExecution } from './core.mjs';
import { git, command, writeJson } from './io.mjs';
import { PLAN, STATUS, MANIFEST } from './plan.mjs';
import { GitSource } from './git-ssot.mjs';

export const fixturePolicy = { allowedFiles: ['docs/engineering-loop/dry-run-fixture.txt'], checks: [],
  acceptanceChecks: [{ kind: 'exact-bytes', file: 'docs/engineering-loop/dry-run-fixture.txt', expectedBase64: 'QVBQUk9WRUQK' }] };
export function makeGitFixture(parent) {
  const directory = path.join(parent, randomUUID().slice(0, 8)), remote = path.join(directory, 'remote.git'), controller = path.join(directory, 'controller');
  fs.mkdirSync(directory, { recursive: true }); git(directory, 'init', '--bare', '--initial-branch=main', remote);
  fs.mkdirSync(controller); git(controller, 'init', '-b', 'main'); git(controller, 'config', 'core.autocrlf', 'false');
  git(controller, 'config', 'user.name', 'Synthetic loop verification'); git(controller, 'config', 'user.email', 'fixture@example.invalid');
  const markdown = `# Engineering loop synthetic specification\n\n## 2.3. Fixture boundary\n\nSynthetic D tasks only; no real backlog, cloud resources or paid services. Controller owns merge and status.\n\n### D001 — exact-byte review/repair fixture [P0]\n\nMục tiêu/phạm vi: Exercise independent developer and reviewer using the existing controller.\nModule/file dự kiến: docs/engineering-loop/dry-run-fixture.txt. Phụ thuộc: Không.\nAcceptance criteria: The actual file must contain exactly APPROVED followed by one LF.\nTest cases: First generator intentionally writes NEEDS_REPAIR plus LF; the independent reviewer must REWORK it. Repair on the same branch, then review new HEAD.\nDefinition of Done: Exact-SHA independent PASS, deterministic bytes, merge into the local bare main, single-task status commit and remote readback.\n\n### D002 — next-pick verification [P0]\n\nModule/file dự kiến: none; picker verification only. Phụ thuộc: D001.\nAcceptance criteria: Be selectable only after D001 status sync; do not execute this task in the fixture cycle.\n`;
  fs.mkdirSync(path.dirname(path.join(controller, PLAN)), { recursive: true }); fs.writeFileSync(path.join(controller, PLAN), markdown);
  writeJson(path.join(controller, STATUS), { schemaVersion: 1, activeRelease: 'fixture', tasks: { D001: { status: 'pending' }, D002: { status: 'pending' } } });
  writeJson(path.join(controller, MANIFEST), { schemaVersion: 1, synthetic: true, planSha256: hash(markdown) });
  fs.writeFileSync(path.join(controller, 'AGENTS.md'), 'Owner authorizes synthetic D001 only. Developer edits only docs/engineering-loop/dry-run-fixture.txt. Reviewer is read-only. No Git changes, SSOT/status/specification edits, API/provider calls, installs, accounts/resources, billing, credits or real tasks by the model. Controller alone may merge/status-sync the isolated local bare fixture.\n');
  git(controller, 'add', '.'); git(controller, 'commit', '-m', 'fixture Git SSOT baseline'); git(controller, 'remote', 'add', 'origin', remote); git(controller, 'push', '-u', 'origin', 'main');
  const source = new GitSource({ root: controller, synthetic: true, expectedRemote: remote, data: path.join(directory, 'operations') });
  const snapshot = source.loadRemote(), task = snapshot.tasks.find(t => t.id === 'D001'), state = newExecution(task, snapshot, 'git-fixture');
  Object.assign(state, { sourceCommit: snapshot.commit, specHash: hash(JSON.stringify(task.spec)), taskStatusHash: snapshot.statusHash,
    fixtureControllerRoot: controller, fixtureRemote: remote, fixtureDirectory: directory });
  return { directory, controller, remote, source, snapshot, task, state };
}
export function fixtureImplementation(fixture, bytes = 'APPROVED\n') {
  const state = fixture.state, repo = path.join(fixture.directory, 'developer');
  command('git', ['clone', '--no-local', '--no-hardlinks', '--no-checkout', fixture.controller, repo], fixture.controller);
  git(repo, 'config', 'core.autocrlf', 'false'); git(repo, 'config', 'user.name', 'Synthetic developer'); git(repo, 'config', 'user.email', 'fixture@example.invalid');
  git(repo, 'remote', 'set-url', 'origin', fixture.remote); git(repo, 'checkout', '-b', 'loop/d001', state.sourceCommit);
  fs.mkdirSync(path.join(repo, 'docs/engineering-loop'), { recursive: true }); fs.writeFileSync(path.join(repo, 'docs/engineering-loop/dry-run-fixture.txt'), bytes);
  git(repo, 'add', '.'); git(repo, 'commit', '-m', 'synthetic implementation'); git(repo, 'push', '-u', 'origin', 'loop/d001');
  Object.assign(state, { worktree: repo, branch: 'loop/d001', baseSha: state.sourceCommit, commitSha: git(repo, 'rev-parse', 'HEAD'), phase: 'MERGE_WAIT', prUrl: 'local-fixture:D001/test' });
  state.review = { type: 'REVIEW', runId: state.runId, taskId: state.taskId, nonce: state.nonce, sourceRevision: state.sourceRevision,
    commitSha: state.commitSha, verdict: 'PASS', findings: [], evidenceSummary: 'Unit test reviewer double, not an actual model verdict.' };
  return state;
}
