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

export function makeMultiGitFixture(parent) {
  const f = makeGitFixture(parent);
  let markdown = fs.readFileSync(path.join(f.controller, PLAN), 'utf8').split('### D002')[0];
  const definitions = [
    ['D002', 'second dependent task', 'D001', 'docs/engineering-loop/second-fixture.txt', 'SECOND'],
    ['D003', 'missing human evidence', 'Không', 'docs/engineering-loop/human-fixture.txt', 'HUMAN'],
    ['D004', 'independent task after blocker', 'Không', 'docs/engineering-loop/fourth-fixture.txt', 'FOURTH'],
    ['D005', 'blocked dependency descendant', 'D003', 'docs/engineering-loop/fifth-fixture.txt', 'FIFTH'] ];
  const policies = { D001: fixturePolicy };
  for (const [id, title, dep, file, value] of definitions) {
    markdown += `### ${id} — ${title} [P0]\n\nModule/file dự kiến: ${file}. Phụ thuộc: ${dep}.\nAcceptance criteria: File contains exactly ${value} followed by one LF.\nDefinition of Done: Independent exact-SHA PASS, local Git merge/status readback.\n\n`;
    policies[id] = { allowedFiles: [file], checks: [], acceptanceChecks: [{ kind: 'exact-bytes', file, expectedBase64: Buffer.from(value + '\n').toString('base64') }] };
  }
  policies.D003.acceptanceChecks.push({ kind: 'owner-evidence', file: policies.D003.allowedFiles[0], scope: 'synthetic-human-only' });
  fs.writeFileSync(path.join(f.controller, PLAN), markdown);
  writeJson(path.join(f.controller, STATUS), { schemaVersion: 1, activeRelease: 'fixture', tasks: Object.fromEntries(Object.keys(policies).map(id => [id, { status: 'pending' }])) });
  writeJson(path.join(f.controller, MANIFEST), { schemaVersion: 1, synthetic: true, planSha256: hash(markdown), policies });
  fs.writeFileSync(path.join(f.controller, 'AGENTS.md'), 'Owner authorizes only synthetic D001-D005 per pinned fixture specification and packet scope. Fresh developer/reviewer; reviewer read-only. No model Git changes/commits/push, spec/status/tooling edits, external APIs/providers, accounts/resources, billing/credits/install or real backlog tasks. Controller alone may merge/status-sync this local bare remote. D003 requires human evidence; never invent it.\n');
  git(f.controller, 'add', '.'); git(f.controller, 'commit', '-m', 'multi-task fixture contracts'); git(f.controller, 'push', 'origin', 'main');
  return { controller: f.controller, remote: f.remote, policies, restartProbe: true,
    grant: { schemaVersion: 1, ownerApproved: true, grantId: `synthetic-${randomUUID()}`, repository: 'NguyenChiBinh267/Chinese-Study-Hub', release: 'fixture', tasks: Object.keys(policies),
      autoMerge: true, statusWrites: true, maxServiceCost: 0, allowPaidCredits: false, allowNewServices: false,
      maxTasks: 5, maxModelCalls: 12, maxRunSeconds: 10800, maxRetries: 3, maxQuotaWaitSeconds: 60, expiresAt: new Date(Date.now() + 86400000).toISOString() } };
}
