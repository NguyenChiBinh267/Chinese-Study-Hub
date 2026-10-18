import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootstrapStateFile, resumeBootstrapTarget, validateBootstrapTarget, validateBootstrapIdentity, validateBootstrapMergeGrant, bootstrapSnapshot, controllerCheckHandoff, applyScopedRepairPatch, bootstrapMerge } from './bootstrap.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, GitHub, writeJson, readJson } from './io.mjs';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { bootstrapPolicy } from './bootstrap.mjs';
import { acceptanceChecks, validateLocalReview } from './reviewer.mjs';
import { allowedPath } from './core.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
fs.mkdirSync(path.join(root, '.engineering-loop'), { recursive: true });
const sha = 'a'.repeat(40), base = 'b'.repeat(40), repo = 'NguyenChiBinh267/Chinese-Study-Hub';
const target = () => ({ repository: repo, pr: 4, branch: 'loop/bootstrap-grant-followup', baseBranch: 'main', baseSha: base, initialHeadSha: sha });
const pr = () => ({ number: 4, state: 'open', merged: false, draft: true, head: { sha, ref: target().branch, repo: { full_name: repo } }, base: { sha: base, ref: 'main', repo: { full_name: repo } } });
const state = () => ({ bootstrapTarget: target(), pr: 4, branch: target().branch, commitSha: sha, baseSha: base, sourceRevision: `git-bootstrap:${repo}#4:${base}:${sha}`, runId: 'run', nonce: 'nonce',
  review: { verdict: 'PASS', commitSha: sha, sourceRevision: `git-bootstrap:${repo}#4:${base}:${sha}`, runId: 'run', nonce: 'nonce', findings: [] },
  reviewerReceipt: { role: 'reviewer', sandbox: 'read-only', newSession: true, threadId: 'fresh-independent-thread', processId: 123, costProof: { chatgptOnly: true, hasCredits: false, balance: '0' } }, checks: [{ passed: true, commitSha: sha }] });
const grant = () => ({ ownerApproved: true, pr: 4, repository: repo, merge: true, commitSha: sha, baseSha: base, expiresAt: new Date(Date.now() + 60000).toISOString() });

test('Constructed bootstrap policy validates unchanged SSOT bytes without granting repair writes', () => {
  const head = git(root, 'rev-parse', 'HEAD'), policy = bootstrapPolicy(root, head, head);
  assert.equal(policy.acceptanceReadOnlyFiles.length, 4);
  for (const file of policy.acceptanceReadOnlyFiles) assert.equal(allowedPath(file, policy.allowedFiles), false);
  const checks = acceptanceChecks(root, policy);
  assert.equal(checks.length, 4);
  assert.ok(checks.every(c => c.passed), JSON.stringify(checks));
  const syntheticState = { ...state(), taskId: 'B001' };
  const report = { ...syntheticState.review, taskId: 'B001', evidenceSummary: 'Synthetic validation of actual pinned acceptance bytes.' };
  assert.doesNotThrow(() => validateLocalReview(report, syntheticState, sha, checks));
  const withoutReadScope = acceptanceChecks(root, { ...policy, acceptanceReadOnlyFiles: [] });
  assert.ok(withoutReadScope.every(c => !c.passed && /outside task policy/.test(c.reason)));
  assert.throws(() => validateLocalReview(report, syntheticState, sha, withoutReadScope), /deterministic/);
  const mismatched = acceptanceChecks(root, { ...policy, acceptanceChecks: policy.acceptanceChecks.map(c => ({ ...c, expectedBase64: '' })) });
  assert.ok(mismatched.every(c => !c.passed && c.actualHash !== c.expectedHash));
  assert.throws(() => validateLocalReview(report, syntheticState, sha, mismatched), /deterministic/);
  for (const file of ['docs/master-plan/README.md', '../AGENTS.md']) {
    const denied = acceptanceChecks(root, { ...policy, acceptanceChecks: [{ kind: 'required-file', file }] });
    assert.equal(denied[0].passed, false);
    assert.match(denied[0].reason, /outside task policy/);
  }
});

// Exercise bootstrapMerge and its real command/deadline guard; no external command is launched.
for (const pending of [false, true]) for (const pushAt of [1999, 2000, 2001]) {
  test(`Bootstrap ${pending ? 'pending retry' : 'fresh merge'} push boundary at ${pushAt} with expiry 2000`, async t => {
    const data = fs.mkdtempSync(path.join(root, '.engineering-loop', 'bootstrap-expiry-'));
    const next = 'c'.repeat(40), initial = { ...state(), ...(pending ? { mergePendingSha: next, mergeRepository: data } : {}) };
    writeJson(path.join(data, 'bootstrap-latest.json'), initial);
    const authorization = { ...grant(), expiresAt: new Date(2000).toISOString() };
    const previous = process.env.ENGINEERING_LOOP_DEADLINE;
    delete process.env.ENGINEERING_LOOP_DEADLINE;
    let at = 1000, pushes = 0;
    t.mock.method(Date, 'now', () => at);
    t.mock.method(GitHub.prototype, 'repo', async () => { if (pending) at = pushAt; return pr(); });
    const rename = fs.renameSync;
    t.mock.method(fs, 'renameSync', (...args) => { rename(...args); if (!pending && args[1] === path.join(data, 'bootstrap-latest.json')) at = pushAt; });
    t.mock.method(childProcess, 'spawnSync', (executable, args, options) => {
      assert.equal(executable, 'git');
      if (args[0] === 'push') {
        pushes++;
        assert.ok(options.timeout <= 2000 - at, 'Push timeout must fit inside the grant');
        return { status: 1, stderr: 'synthetic stop after observing push', stdout: '' };
      }
      let stdout = args[0] === 'remote' ? `https://github.com/${repo}.git` : '';
      if (args[0] === 'rev-parse') stdout = args[1] === 'origin/main' ? base : options.cwd === root ? sha : next;
      return { status: 0, stdout, stderr: '' };
    });
    syncBuiltinESMExports();
    try {
      await assert.rejects(bootstrapMerge({ root, data, cfg: { repository: repo, bootstrapMergeAuthorization: authorization } }),
        pushAt < 2000 ? /git failed/ : /authorization|deadline/);
      assert.equal(pushes, pushAt < 2000 ? 1 : 0);
      assert.equal(readJson(path.join(data, 'bootstrap-latest.json')).mergePendingSha, next);
      assert.equal(process.env.ENGINEERING_LOOP_DEADLINE, undefined, 'Caller deadline must be restored on failure');
      assert.equal(fs.existsSync(path.join(data, 'writer.lock')), false);
    } finally {
      t.mock.restoreAll(); syncBuiltinESMExports();
      if (previous === undefined) delete process.env.ENGINEERING_LOOP_DEADLINE;
      else process.env.ENGINEERING_LOOP_DEADLINE = previous;
    }
  });
}

test('Bootstrap keeps tighter inherited deadline and restores it even on lock failure', async t => {
  const data = fs.mkdtempSync(path.join(root, '.engineering-loop', 'bootstrap-inherited-'));
  writeJson(path.join(data, 'bootstrap-latest.json'), state());
  const previous = process.env.ENGINEERING_LOOP_DEADLINE;
  t.mock.method(Date, 'now', () => 1000);
  const cfg = { repository: repo, bootstrapMergeAuthorization: { ...grant(), expiresAt: new Date(2000).toISOString() } };
  try {
    process.env.ENGINEERING_LOOP_DEADLINE = '1500';
    t.mock.method(childProcess, 'spawnSync', (executable, args, options) => {
      assert.equal(executable, 'git'); assert.ok(['remote', 'fetch'].includes(args[0])); assert.equal(options.timeout, 500);
      if (args[0] === 'remote') return { status: 0, stdout: `https://github.com/${repo}.git`, stderr: '' };
      return { status: 1, stdout: '', stderr: 'synthetic stop' };
    });
    syncBuiltinESMExports();
    await assert.rejects(bootstrapMerge({ root, data, cfg }), /git failed/);
    assert.equal(process.env.ENGINEERING_LOOP_DEADLINE, '1500');
    fs.mkdirSync(path.join(data, 'git-driver.lock'));
    await assert.rejects(bootstrapMerge({ root, data, cfg }), /Concurrent/);
    assert.equal(process.env.ENGINEERING_LOOP_DEADLINE, '1500');
    process.env.ENGINEERING_LOOP_DEADLINE = 'invalid';
    await assert.rejects(bootstrapMerge({ root, data, cfg }), /Invalid inherited/);
    assert.equal(process.env.ENGINEERING_LOOP_DEADLINE, 'invalid');
  } finally {
    t.mock.restoreAll(); syncBuiltinESMExports();
    if (previous === undefined) delete process.env.ENGINEERING_LOOP_DEADLINE;
    else process.env.ENGINEERING_LOOP_DEADLINE = previous;
  }
});
test('Bootstrap identity pins explicit draft PR repository/base/branch/HEAD', () => {
  validateBootstrapIdentity(pr(), target(), sha);
  for (const patch of [{ number: 3 }, { number: 2 }, { state: 'closed' }, { merged: true }, { draft: false }, { head: { ...pr().head, ref: 'main' } },
    { head: { ...pr().head, repo: { full_name: 'fork/Chinese-Study-Hub' } } }, { base: { ...pr().base, repo: { full_name: 'fork/Chinese-Study-Hub' } } },
    { base: { ...pr().base, ref: 'other' } }]) assert.throws(() => validateBootstrapIdentity({ ...pr(), ...patch }, target(), sha));
  assert.throws(() => validateBootstrapIdentity(pr(), { ...target(), baseSha: sha }, sha), /drift/);
  assert.throws(() => validateBootstrapIdentity(pr(), target(), base), /drift/);
});

test('Bootstrap refuses implicit/invalid target and pins any explicitly selected open draft PR', () => {
  assert.throws(() => validateBootstrapTarget(null));
  for (const patch of [{ pr: 0 }, { pr: NaN }, { pr: 4.5 }, { repository: 'other' }, { baseBranch: 'develop' },
    { branch: 'main' }, { branch: '--all' }, { branch: '../main' }, { branch: 'loop//test' }, { baseSha: 'bad' }, { initialHeadSha: '' }])
    assert.throws(() => validateBootstrapTarget({ ...target(), ...patch }));
  const next = { ...target(), pr: 27, branch: 'loop/next-candidate' };
  validateBootstrapIdentity({ ...pr(), number: 27, head: { ...pr().head, ref: next.branch } }, next, sha);
  assert.throws(() => validateBootstrapIdentity(pr(), target(), 'bad'), /HEAD/);
});

test('Bootstrap repair budget is pinned per PR across other candidates and source drift blocks', () => {
  const data = fs.mkdtempSync(path.join(root, '.engineering-loop', 'bootstrap-target-'));
  const recorded = { ...state(), phase: 'BLOCKED', repairs: 2 };
  writeJson(bootstrapStateFile(data, target()), recorded);
  writeJson(path.join(data, 'bootstrap-latest.json'), { ...recorded, pr: 27 });
  assert.equal(resumeBootstrapTarget(data, target()).repairs, 2);
  assert.equal(resumeBootstrapTarget(data, { ...target(), pr: 27 }).repairs, 0);
  for (const patch of [{ baseSha: sha }, { branch: 'loop/changed' }, { initialHeadSha: base }])
    assert.throws(() => resumeBootstrapTarget(data, { ...target(), ...patch }), /drift|checkpoint/);
  writeJson(bootstrapStateFile(data, target()), { ...recorded, mergePendingSha: 'c'.repeat(40) });
  assert.throws(() => resumeBootstrapTarget(data, target()), /merge is pending/);
  assert.equal(readJson(bootstrapStateFile(data, target())).repairs, 2);
});
test('Initial merge authorization must be explicit, exact-SHA and unexpired', () => {
  assert.throws(() => validateBootstrapMergeGrant(null, state()), /authorization/);
  for (const patch of [{ ownerApproved: false }, { merge: false }, { pr: 2 }, { commitSha: base }, { baseSha: sha }, { expiresAt: '2000-01-01' }]) assert.throws(() => validateBootstrapMergeGrant({ ...grant(), ...patch }, state()));
  validateBootstrapMergeGrant(grant(), state());
  const other = { ...state(), bootstrapTarget: { ...target(), pr: 27 }, pr: 27 };
  assert.throws(() => validateBootstrapMergeGrant({ ...grant(), pr: 27 }, other), /target/);
  assert.throws(() => validateBootstrapMergeGrant(grant(), { ...state(), bootstrapTarget: undefined }), /target/);
});
test('Bootstrap merge cannot accept stale/self verdict, findings, missing deterministic or sandbox evidence', () => {
  for (const patch of [{ review: { ...state().review, verdict: 'REWORK' } }, { review: { ...state().review, commitSha: base } }, { review: { ...state().review, nonce: 'stale' } },
    { review: { ...state().review, findings: [{ severity: 'P1' }] } }, { reviewerReceipt: { sandbox: 'workspace-write', newSession: true } }, { checks: [] }, { checks: [{ passed: false }] }])
    assert.throws(() => validateBootstrapMergeGrant(grant(), { ...state(), ...patch }), /independent/);
});
test('Bootstrap snapshot detaches exact bytes even when clone already has the PR branch name', () => {
  const parent = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.engineering-loop/bootstrap-tests', String(Date.now()));
  const original = path.join(parent, 'original'), copy = path.join(parent, 'copy'); fs.mkdirSync(original, { recursive: true });
  git(original, 'init', '-b', 'loop/local-codex-reviewer'); git(original, 'config', 'core.autocrlf', 'false');
  git(original, 'config', 'user.name', 'Bootstrap fixture'); git(original, 'config', 'user.email', 'fixture@example.invalid');
  fs.writeFileSync(path.join(original, 'fixture.txt'), 'EXACT\n'); git(original, 'add', '.'); git(original, 'commit', '-m', 'bootstrap snapshot fixture');
  const head = git(original, 'rev-parse', 'HEAD'); bootstrapSnapshot(original, copy, head, original);
  assert.equal(git(copy, 'rev-parse', 'HEAD'), head); assert.equal(git(copy, 'branch', '--show-current'), '');
  assert.equal(git(copy, 'status', '--porcelain'), ''); assert.equal(fs.readFileSync(path.join(copy, 'fixture.txt'), 'utf8'), 'EXACT\n');
});
test('Bootstrap testing-denial handoff preserves BLOCKED and never replaces human evidence or reviewer verdict', () => {
  const report = { result: 'BLOCKED', blocker: 'Sandbox EPERM prevents child-process regression checks', tests: [{ passed: false }] };
  assert.equal(controllerCheckHandoff(report), true); assert.equal(report.result, 'BLOCKED');
  for (const blocker of ['Missing publication rights', 'No account consent', 'Model quota exhausted', 'Unknown implementation failure']) assert.equal(controllerCheckHandoff({ ...report, blocker }), false);
  assert.equal(controllerCheckHandoff({ ...report, tests: [{ passed: true }] }), false);
});
test('Scoped repair patch preserves non-overlapping root edits and rejects conflicts without overwrite', () => {
  const parent = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.engineering-loop/bootstrap-patch-tests', String(Date.now()));
  const original = path.join(parent, 'original'), copy = path.join(parent, 'copy'); fs.mkdirSync(path.join(original, 'tools/engineering-loop'), { recursive: true });
  git(original, 'init', '-b', 'main'); git(original, 'config', 'core.autocrlf', 'false'); git(original, 'config', 'user.name', 'Patch fixture'); git(original, 'config', 'user.email', 'fixture@example.invalid');
  const file = 'tools/engineering-loop/fixture.mjs', lines = Array.from({ length: 20 }, (_, n) => `line ${n}`);
  fs.writeFileSync(path.join(original, file), lines.join('\n') + '\n'); git(original, 'add', '.'); git(original, 'commit', '-m', 'baseline');
  const head = git(original, 'rev-parse', 'HEAD'); bootstrapSnapshot(original, copy, head, original);
  const repair = [...lines]; repair[2] = 'reviewer fix'; fs.writeFileSync(path.join(original, file), repair.join('\n') + '\n');
  const rootEdit = [...lines]; rootEdit[17] = 'owner edit'; fs.writeFileSync(path.join(copy, file), rootEdit.join('\n') + '\n'); git(copy, 'add', '.'); git(copy, 'commit', '-m', 'preserved root change');
  applyScopedRepairPatch({ worktree: original, commitSha: head }, copy, [file], path.join(parent, 'not-yet-created', 'repair.patch'));
  const result = fs.readFileSync(path.join(copy, file), 'utf8'); assert.ok(result.includes('reviewer fix')); assert.ok(result.includes('owner edit'));
  git(copy, 'restore', '--', file); const conflict = [...rootEdit]; conflict[2] = 'conflicting owner edit'; fs.writeFileSync(path.join(copy, file), conflict.join('\n') + '\n'); git(copy, 'add', '.'); git(copy, 'commit', '-m', 'conflict');
  assert.throws(() => applyScopedRepairPatch({ worktree: original, commitSha: head }, copy, [file], path.join(parent, 'conflict.patch')));
  assert.equal(fs.readFileSync(path.join(copy, file), 'utf8'), conflict.join('\n') + '\n');
});
