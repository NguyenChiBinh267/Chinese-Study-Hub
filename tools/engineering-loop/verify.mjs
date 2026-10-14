import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { hash, validateSource, readyTasks, newExecution, move, parseBridgeComment, applyReview,
  checkDeadline, allowedPath, validateReport } from './core.mjs';
import { readJson, writeJson, lock, git } from './io.mjs';
import { TOOL, ROOT } from './loop.mjs';
import { deriveRepository } from './plan.mjs';

export async function dryRun() {
  const dir = path.join(ROOT, '.engineering-loop', 'dry-runs', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const results = [], transcript = [];
  function test(name, action) {
    try { action(); results.push({ name, passed: true }); }
    catch (e) { results.push({ name, passed: false, error: e.message }); }
  }
  const source = deriveRepository(ROOT);
  test('Real SSOT index: 70 unique IDs, 34 active, dependency closure and no cycle', () => validateSource(source));
  test('Deterministic picker selects T068 then T004/T005, no inactive tasks', () => assert.deepEqual(readyTasks(source).map(t => t.id), ['T068', 'T004', 'T005']));
  test('Pending dependency excludes T003', () => assert(!readyTasks(source).some(t => t.id === 'T003')));
  test('Cycle causes rejection', () => { const s = structuredClone(source); s.tasks.find(t => t.id === 'T001').dependencies = ['T002']; assert.throws(() => validateSource(s), /cycle/); });
  test('M0 cannot acquire future dependencies', () => { const s = structuredClone(source); s.tasks.find(t => t.id === 'T003').dependencies.push('T027'); assert.throws(() => validateSource(s), /outside release/); });
  test('Lock refuses second writer', () => { const folder = path.join(dir, 'lock'); const release = lock(folder, path.join(dir, 'state.json')); try { assert.throws(() => lock(folder, path.join(dir, 'state.json')), /active/); } finally { release(); } });
  test('Dead orchestrator lock cannot reclaim a still-live writer', () => {
    const folder = path.join(dir, 'orphan'); fs.mkdirSync(folder);
    writeJson(path.join(folder, 'owner.json'), { pid: 99999999, host: os.hostname() });
    writeJson(path.join(dir, 'writer.json'), { writerPid: process.pid });
    assert.throws(() => lock(folder, path.join(dir, 'writer.json')), /active/);
  });
  test('Atomic checkpoint roundtrip', () => { writeJson(path.join(dir, 'checkpoint.json'), { phase: 'REVIEW_WAIT', repairs: 2 }); assert.equal(readJson(path.join(dir, 'checkpoint.json')).repairs, 2); });
  test('Scope rejects traversal, drive paths and extra files', () => {
    for (const p of ['../AGENTS.md', 'C:/secret', 'docs/../AGENTS.md', 'src/app/page.tsx']) assert(!allowedPath(p, ['docs/engineering-loop/dry-run-fixture.txt']));
    assert(allowedPath('config/free-only/policy.json', ['config/free-only/**']));
    assert(!allowedPath('config/free-only-else/policy.json', ['config/free-only/**']));
  });
  const task = { id: 'D001' }, state = newExecution(task, source, 'local-simulation');
  const cfg = { reviewers: ['owner'] };
  const comment = event => ({ id: 1, user: { login: 'owner' }, body: `CSH_LOOP_EVENT\n\`\`\`json\n${JSON.stringify({ runId: state.runId, taskId: state.taskId, nonce: state.nonce, ...event })}\n\`\`\`` });
  test('Unauthorized author cannot supply PASS', () => { const c = comment({ type: 'REVIEW' }); c.user.login = 'developer'; assert.equal(parseBridgeComment(c, cfg, state), null); });
  test('Wrong nonce cannot replay a review', () => assert.equal(parseBridgeComment(comment({ type: 'REVIEW', nonce: 'old' }), cfg, state), null));
  test('Malformed bridge JSON is ignored', () => assert.equal(parseBridgeComment({ ...comment({}), body: 'CSH_LOOP_EVENT\n```json\nno\n```' }, cfg, state), null));
  test('Review timeout persists BLOCKED', () => { const s = structuredClone(state); move(s, 'REVIEW_WAIT', { deadline: new Date(0).toISOString() }); checkDeadline(s); assert.equal(s.phase, 'BLOCKED'); assert.match(s.blocker, /Timeout/); });
  test('Stale SHA cannot approve new edits', () => { const s = structuredClone(state); move(s, 'REVIEW_WAIT', { commitSha: 'new' }); assert.throws(() => applyReview(s, { type: 'REVIEW', commitSha: 'old', verdict: 'PASS', findings: [], evidenceSummary: 'read actual diff' }, 'new'), /Stale/); });
  test('Unsupported PASS with unresolved findings rejected', () => {
    const s = structuredClone(state); move(s, 'REVIEW_WAIT', { commitSha: 'head' });
    assert.throws(() => applyReview(s, { type: 'REVIEW', commitSha: 'head', verdict: 'PASS', findings: [{ severity: 'P1', file: 'x', line: 1, message: 'bad' }], evidenceSummary: 'read diff' }, 'head'), /unresolved/);
  });
  test('Developer false completion or incorrect file report rejected', () => {
    assert.throws(() => validateReport({ taskId: 'D001', result: 'COMPLETE', changedFiles: ['x'], tests: [], evidence: [], blocker: '' }, state, ['x']), /Incomplete/);
    assert.throws(() => validateReport({ taskId: 'D001', result: 'COMPLETE', changedFiles: ['y'], tests: [{ passed: true }], evidence: [], blocker: '' }, state, ['x']), /match Git/);
  });
  test('Third REWORK blocks after two repairs', () => {
    const s = structuredClone(state);
    for (let i = 0; i < 3; i++) {
      move(s, 'REVIEW_WAIT', { commitSha: `head${i}` });
      applyReview(s, { type: 'REVIEW', commitSha: `head${i}`, verdict: 'REWORK', findings: [{ severity: 'P1', file: 'fixture.txt', line: 1, message: 'Needs repair' }], evidenceSummary: 'fixture read' }, `head${i}`);
    }
    assert.equal(s.repairs, 2); assert.equal(s.phase, 'BLOCKED');
  });
  test('Real local Git dry-run: handoff -> failing fixture -> REWORK -> repair -> PASS -> checkpoint restart', () => {
    const repo = path.join(dir, 'fixture-repo'); fs.mkdirSync(repo);
    git(repo, 'init', '-b', 'main'); git(repo, 'config', 'user.name', 'Local loop fixture'); git(repo, 'config', 'user.email', 'fixture@example.invalid');
    fs.writeFileSync(path.join(repo, 'brief.txt'), 'Synthetic task D001; file must say APPROVED\n');
    git(repo, 'add', '--', 'brief.txt'); git(repo, 'commit', '-m', 'fixture baseline');
    git(repo, 'checkout', '-b', 'loop/d001');
    move(state, 'SOURCE_WAIT'); transcript.push({ phase: state.phase, bridge: 'simulated SOURCE; no Work call' });
    move(state, 'DEVELOPING');
    fs.writeFileSync(path.join(repo, 'fixture.txt'), 'NEEDS_REPAIR\n'); git(repo, 'add', '--', 'fixture.txt'); git(repo, 'commit', '-m', 'fixture with intentional review defect');
    state.commitSha = git(repo, 'rev-parse', 'HEAD'); move(state, 'REVIEW_WAIT');
    transcript.push({ phase: state.phase, commitSha: state.commitSha, bridge: 'simulated PR; local Git commit is real' });
    const finding = { severity: 'P1', file: 'fixture.txt', line: 1, message: 'Expected APPROVED' };
    assert.notEqual(fs.readFileSync(path.join(repo, 'fixture.txt'), 'utf8'), 'APPROVED\n');
    applyReview(state, { type: 'REVIEW', commitSha: state.commitSha, verdict: 'REWORK', findings: [finding], evidenceSummary: 'Local test adapter read file' }, state.commitSha);
    transcript.push({ phase: state.phase, repairs: state.repairs });
    fs.writeFileSync(path.join(repo, 'fixture.txt'), 'APPROVED\n'); git(repo, 'add', '--', 'fixture.txt'); git(repo, 'commit', '-m', 'repair fixture');
    state.commitSha = git(repo, 'rev-parse', 'HEAD'); move(state, 'REVIEW_WAIT');
    writeJson(path.join(dir, 'state.json'), state);
    const resumed = readJson(path.join(dir, 'state.json'));
    assert.equal(git(repo, 'rev-parse', 'HEAD'), resumed.commitSha);
    assert.equal(fs.readFileSync(path.join(repo, 'fixture.txt'), 'utf8'), 'APPROVED\n');
    applyReview(resumed, { type: 'REVIEW', commitSha: resumed.commitSha, verdict: 'PASS', findings: [], evidenceSummary: 'Local test adapter verified actual file bytes' }, resumed.commitSha);
    move(resumed, 'DONE'); writeJson(path.join(dir, 'state.json'), resumed);
    transcript.push({ phase: resumed.phase, commitSha: resumed.commitSha, repairs: resumed.repairs, fixtureHash: hash('APPROVED\n') });
  });
  const evidence = { mode: 'local-simulation', at: new Date().toISOString(), scope: 'Real local Git/files/state; simulated GitHub/Work/Codex adapters',
    noExternalWrites: true, noModelCalls: true, passed: results.filter(r => r.passed).length, total: results.length, results, transcript, directory: dir };
  writeJson(path.join(dir, 'evidence.json'), evidence);
  assert.equal(evidence.passed, evidence.total, 'Dry-run verification failed');
  return evidence;
}
