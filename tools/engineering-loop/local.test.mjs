import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { newExecution, move, applyReview, checkDeadline, validateReport } from './core.mjs';
import { git, writeJson, readJson, lock, codexArguments, codexEnvironment, validateFreeQuota } from './io.mjs';
import { acceptanceChecks, validateLocalReview, localReview, reviewTransition, repositoryFingerprint } from './reviewer.mjs';
import { DOCUMENT_ID, SCOPE, taskEntry, statusEdit, assertRevision, liveSections, GoogleDocsSource, FixtureSource } from './ssot.mjs';

const tool = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(tool, '../..');
const data = path.join(root, '.engineering-loop', 'adapter-tests', `${Date.now()}`);
fs.mkdirSync(data, { recursive: true });
const task = { id: 'D001', spec: ['Acceptance: exactly APPROVED followed by LF'], dependencies: [] };
const policy = { allowedFiles: ['fixture.txt'], acceptanceChecks: [{ kind: 'exact-bytes', file: 'fixture.txt', expectedBase64: Buffer.from('APPROVED\n').toString('base64') }] };
const source = { verifyTask: async () => ({ kind: 'test-double', revision: 'fixture-rev', readbackVerified: true }) };
function fixture(content = 'APPROVED\n') {
  const repo = path.join(data, `repo-${Math.random().toString(36).slice(2)}`); fs.mkdirSync(repo);
  git(repo, 'init', '-b', 'main'); git(repo, 'config', 'core.autocrlf', 'false');
  git(repo, 'config', 'user.name', 'Adapter fixture'); git(repo, 'config', 'user.email', 'fixture@example.invalid');
  fs.writeFileSync(path.join(repo, 'fixture.txt'), content); git(repo, 'add', '.'); git(repo, 'commit', '-m', 'fixture');
  const state = newExecution(task, { revision: 'fixture-rev' }, 'dry-local');
  Object.assign(state, { phase: 'REVIEW_WAIT', worktree: repo, baseSha: git(repo, 'rev-parse', 'HEAD'), commitSha: git(repo, 'rev-parse', 'HEAD'),
    developerReceipt: { processId: 111, threadId: 'developer-thread' }, developerReport: { tests: [{ passed: true }] } });
  state.evidence.push({ commitSha: state.commitSha, checks: [{ name: 'actual bytes', passed: true }] });
  return state;
}
const report = (s, extra = {}) => ({ runId: s.runId, taskId: s.taskId, nonce: s.nonce, commitSha: s.commitSha,
  sourceRevision: s.sourceRevision, verdict: 'PASS', findings: [], evidenceSummary: 'Read actual fixture bytes and exact commit diff.', ...extra });

test('Cycle final-artifact human evidence failure blocks locally before any reviewer model call', async () => {
  const s = fixture(); s.cycleId = 'cycle'; let calls = 0;
  const gatedPolicy = { ...policy, acceptanceChecks: [...policy.acceptanceChecks, { kind: 'owner-evidence', file: 'fixture.txt', scope: 'ux-walkthrough' }] };
  await reviewTransition({ root, tool, data, state: s, task, policy: gatedPolicy, sourceAdapter: { ...source, ownerEvidence: () => null }, timeoutMs: 1000,
    runner: async () => { calls++; throw new Error('Must not invoke model'); } });
  assert.equal(calls, 0); assert.equal(s.phase, 'BLOCKED'); assert.equal(s.blockerCode, 'TASK_LOCAL'); assert.equal(s.blockedFrom, 'REVIEW_WAIT');
  assert.equal(git(s.worktree, 'status', '--porcelain'), '');
});
const receipt = { role: 'reviewer', sandbox: 'read-only', newSession: true, processId: 222, threadId: 'reviewer-thread' };
const review = (s, runner, sourceAdapter = source) => localReview({ root, tool, data, state: s, task, policy, sourceAdapter,
  timeoutMs: 2000, control: () => ({}), runner });
const quota = () => ({ rateLimits: { credits: { hasCredits: false, unlimited: false, balance: '0' }, primary: { usedPercent: 25 } } });

test('Developer COMPLETE cannot carry PASS or reviewer findings', () => {
  for (const extra of [{ verdict: 'PASS' }, { findings: [] }]) assert.throws(() => validateReport({ taskId: 'D001', result: 'COMPLETE', tests: [{ passed: true }], changedFiles: ['fixture.txt'], evidence: [], blocker: '', ...extra }, task, ['fixture.txt']), /cannot supply/);
});
test('Reviewer arguments enforce fresh ephemeral read-only session and no escalation', () => {
  const args = codexArguments('entry', { workspace: 'repo', schema: 'schema', output: 'out', role: 'reviewer', model: 'gpt-6-luna', reasoningEffort: 'medium' });
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only'); assert(args.includes('--ephemeral'));
  assert(args.includes('--ignore-user-config')); assert(args.includes('approval_policy="never"'));
  assert(!args.includes('resume')); assert(!args.some(x => x.includes('danger-full-access')));
});
test('Paid API credentials are removed from child environment', () => {
  const env = codexEnvironment({ PATH: 'bin', OPENAI_API_KEY: 'secret', OPENAI_BASE_URL: 'https://example.invalid', GOOGLE_TOKEN: 'secret', GH_TOKEN: 'secret', AWS_SECRET_ACCESS_KEY: 'secret' });
  assert.equal(env.PATH, 'bin'); assert(!Object.keys(env).some(k => /KEY|TOKEN|SECRET|OPENAI/.test(k)));
});
test('Zero credit guard accepts ordinary ChatGPT quota', () => assert.equal(validateFreeQuota(quota()).balance, '0'));
test('Model limit, API auth, missing credit evidence or paid balance stop before invocation', () => {
  const cases = [quota(), quota(), quota(), quota()];
  cases[0].rateLimits.primary.usedPercent = 100; cases[1].rateLimits.credits.balance = '1';
  delete cases[2].rateLimits.credits; delete cases[3].rateLimits.primary;
  for (const q of cases) assert.throws(() => validateFreeQuota(q));
  assert.throws(() => validateFreeQuota(quota(), 'apiKey'));
});
test('Fabricated PASS rejected by independently read wrong bytes', () => {
  const s = fixture('NEEDS_REPAIR\n'); assert.throws(() => validateLocalReview(report(s), s, s.commitSha, acceptanceChecks(s.worktree, policy)), /deterministic/);
});
test('HEAD, nonce, source revision and missing evidence invalidate review', () => {
  const s = fixture(), checks = acceptanceChecks(s.worktree, policy);
  assert.throws(() => validateLocalReview(report(s), s, 'new-head', checks), /HEAD/);
  for (const extra of [{ nonce: 'old' }, { sourceRevision: 'old' }, { commitSha: 'old' }, { evidenceSummary: '' }, { garbage: true }]) assert.throws(() => validateLocalReview(report(s, extra), s, s.commitSha, checks));
});
test('Independent local review works with no Work event or comment', async () => {
  const s = fixture(), before = repositoryFingerprint(s.worktree);
  const r = await review(s, async input => {
    assert.equal(input.role, 'reviewer'); assert.notEqual(input.workspace, s.worktree);
    assert(input.prompt.includes(s.commitSha)); assert(!input.prompt.includes('result":"COMPLETE'));
    assert.equal(fs.readFileSync(path.join(input.workspace, 'fixture.txt'), 'utf8'), 'APPROVED\n');
    return { report: report(s), receipt };
  });
  applyReview(s, r.event, s.commitSha); assert.equal(s.phase, 'MERGE_WAIT'); assert.equal(repositoryFingerprint(s.worktree), before);
});
test('Reviewer cannot reuse developer thread or process', async () => {
  for (const extra of [{ threadId: 'developer-thread' }, { processId: 111 }]) {
    const s = fixture(); await assert.rejects(review(s, async () => ({ report: report(s), receipt: { ...receipt, ...extra } })), /reused/);
  }
});
test('Reviewer source/snapshot mutation is detected and cannot approve', async () => {
  const s = fixture(); await assert.rejects(review(s, async input => {
    fs.writeFileSync(path.join(input.workspace, 'fixture.txt'), 'mutated'); return { report: report(s), receipt };
  }), /mutation/);
});
test('Missing exact commit test evidence blocks before model runner', async () => {
  const s = fixture(); s.evidence = []; let called = false;
  await assert.rejects(review(s, async () => { called = true; }), /test evidence/); assert.equal(called, false);
});
test('Empty or failed actual test checks cannot support reviewer PASS', async () => {
  for (const checks of [[], [{ name: 'targeted', passed: false }]]) {
    const s = fixture(); s.evidence[0].checks = checks;
    await assert.rejects(review(s, async () => ({ report: report(s), receipt })), /test evidence/);
  }
});
test('Reviewer crash/timeout/malformed JSON becomes persisted BLOCKED, never PASS', async () => {
  for (const error of ['Codex timeout', 'Codex failed (exit 1)', 'Codex did not return valid structured output']) {
    const s = fixture(); await reviewTransition({ root, tool, data, state: s, task, policy, sourceAdapter: source, runner: async () => { throw new Error(error); } });
    writeJson(path.join(data, 'recovery.json'), s); assert.equal(readJson(path.join(data, 'recovery.json')).phase, 'BLOCKED'); assert.equal(s.review, undefined); assert.equal(s.blocker, error);
  }
  const s = fixture(); await assert.rejects(review(s, async () => ({ report: { verdict: 'PASS' }, receipt })), /Malformed/);
});
test('Live revision drift before/after review blocks', async () => {
  for (const after of [false, true]) {
    const s = fixture(); let calls = 0, ran = false;
    const drifting = { verifyTask: async () => ({ revision: ++calls > (after ? 1 : 0) ? 'changed' : s.sourceRevision, readbackVerified: true }) };
    await assert.rejects(review(s, async () => { ran = true; return { report: report(s), receipt }; }, drifting), /drift/); assert.equal(ran, after);
  }
});
test('Two repairs maximum survives persistent recovery', () => {
  let s = fixture(); const finding = { severity: 'P1', file: 'fixture.txt', line: 1, message: 'Repair required' };
  for (let i = 0; i < 3; i++) {
    move(s, 'REVIEW_WAIT'); applyReview(s, { ...report(s, { verdict: 'REWORK', findings: [finding] }), type: 'REVIEW' }, s.commitSha);
    writeJson(path.join(data, 'repair.json'), s); s = readJson(path.join(data, 'repair.json'));
  }
  assert.equal(s.repairs, 2); assert.equal(s.phase, 'BLOCKED'); assert.match(s.blocker, /Repair limit/);
});
test('Missing reviewer response deadline persists BLOCKED', () => {
  const s = fixture(); s.deadline = new Date(0).toISOString(); checkDeadline(s); assert.equal(s.phase, 'BLOCKED');
});
test('Orphan writer lock cannot be reclaimed while reviewer remains alive', () => {
  const p = path.join(data, 'reviewer-lock'); fs.mkdirSync(p);
  writeJson(path.join(p, 'owner.json'), { pid: 99999999, host: os.hostname() });
  const state = path.join(data, 'reviewer-state.json'); writeJson(state, { reviewerPid: process.pid });
  assert.throws(() => lock(p, state), /active/);
});
test('Fixture source refuses real backlog and specification drift', async () => {
  const s = fixture(), f = path.join(data, 'source.json'); writeJson(f, task);
  await assert.rejects(new FixtureSource(f).verifyTask({ ...s, mode: 'live', taskId: 'T004' }, task), /cannot authorize/);
  await assert.rejects(new FixtureSource(f).verifyTask(s, task), /drift/);
});

function nativeDoc(revision = 'native-rev', done = false) {
  const lines = [['M0 ACTIVE34: ' + Array.from({ length: 34 }, (_, i) => `T${String(i + 1).padStart(3, '0')}`).join(', ') + '.', 'NORMAL_TEXT'],
    ['T001 — verified fixture task', 'HEADING_3'], ['Phụ thuộc: không.', 'NORMAL_TEXT'], ['Acceptance: unicode 汉字 😀 preserved.', 'NORMAL_TEXT']];
  if (done) lines.push(['Trạng thái T001: done — old receipt', 'NORMAL_TEXT']);
  lines.push(['T002 — unrelated', 'HEADING_3'], ['Phụ thuộc: T001.', 'NORMAL_TEXT'], ['ADR-002 unchanged', 'NORMAL_TEXT']);
  let index = 1; const content = lines.map(([text, style]) => { const startIndex = index; index += text.length + 1; return { startIndex, endIndex: index,
    paragraph: { paragraphStyle: { namedStyleType: style }, elements: [{ textRun: { content: text + '\n' } }] } }; });
  return { documentId: DOCUMENT_ID, title: 'Master Plan v1.1', revisionId: revision, tabs: [{ tabProperties: { tabId: 'native-tab' }, documentTab: { body: { content } } }] };
}
test('Native Docs UTF-16 indices/tab ID scope one status and preserve other text', () => {
  for (const done of [false, true]) {
    const d = nativeDoc('native-rev', done), e = statusEdit(d, 'T001', 'Trạng thái T001: done — new receipt');
    assert.equal(e.requests.length, done ? 2 : 1); assert(e.expected.includes('ADR-002 unchanged')); assert(e.expected.includes('汉字 😀'));
    const insert = e.requests.at(-1).insertText; assert.equal(insert.location.tabId, 'native-tab');
    assert(!e.requests.some(x => x.replaceAllText));
  }
});
test('SSOT drift and ambiguous status cannot write', () => {
  assert.throws(() => assertRevision('changed', 'expected'), /drift/);
  assert.throws(() => statusEdit(nativeDoc(), 'T001', 'Trạng thái T002: done'), /Invalid/);
  assert.throws(() => taskEntry(nativeDoc(), 'D001'), /single base Task/);
});
test('Only recommended per-file scope is selected', () => assert.equal(SCOPE, 'https://www.googleapis.com/auth/drive.file'));
test('Missing live required sections cannot be substituted with cached summaries', () => assert.throws(() => liveSections(nativeDoc(), ['2.3']), /missing/));
test('Mismatched Task ID cannot reach SSOT write transport', async () => {
  let calls = 0; const adapter = ssotCase(async () => { calls++; });
  await assert.rejects(adapter.syncTask(ssotState(), { id: 'T002' }), /not authorized/); assert.equal(calls, 0);
});
test('Disabled SSOT write and missing OAuth/cost proof make zero Docs requests', async () => {
  let calls = 0; const adapter = new GoogleDocsSource({ root: data, cfg: { liveEnabled: false }, fetchImpl: async () => { calls++; } });
  await assert.rejects(adapter.syncTask({ phase: 'SSOT_WAIT', mode: 'live' }, { id: 'T001' }), /not authorized/);
  // The actual configured store is absent during setup. No test credentials are written anywhere.
  if (adapter.status().missingFiles.length) await assert.rejects(adapter.request(), /missing/);
  assert.equal(calls, 0);
});
function ssotCase(fetchImpl) {
  return new GoogleDocsSource({ root: data, cfg: { liveEnabled: true, authorizedTasks: ['T001'], ssotAllowStatusWrites: true }, authProvider: async () => 'unit-test-no-secret', fetchImpl });
}
const ssotState = () => ({ phase: 'SSOT_WAIT', mode: 'live', taskId: 'T001', sourceRevision: 'native-rev', commitSha: 'exact-head',
  mergeVerified: true, review: { verdict: 'PASS', commitSha: 'exact-head' }, prUrl: 'https://example.invalid/test', runId: 'test', nonce: 'test' });
test('Mock Docs transport sends requiredRevisionId then reads back just this status', async () => {
  let calls = 0, changed;
  const adapter = ssotCase(async (url, options) => {
    calls++;
    if (options.method === 'POST') { const b = JSON.parse(options.body); assert.equal(b.writeControl.requiredRevisionId, 'native-rev'); assert.equal(b.requests.length, 1); changed = b.requests[0].insertText.text.trim(); return { ok: true, json: async () => ({}) }; }
    const doc = nativeDoc(calls === 1 ? 'native-rev' : 'native-rev-2');
    if (calls > 1) { const c = doc.tabs[0].documentTab.body.content; c.splice(4, 0, { startIndex: 500, endIndex: 500 + changed.length + 1, paragraph: { elements: [{ textRun: { content: changed + '\n' } }], paragraphStyle: { namedStyleType: 'NORMAL_TEXT' } } }); }
    return { ok: true, json: async () => doc };
  });
  const event = await adapter.syncTask(ssotState(), { id: 'T001' }); assert.equal(event.readbackVerified, true); assert.equal(calls, 3);
});
test('Mock Docs revision conflict/429 has no retry or paid fallback', async () => {
  for (const status of [409, 429]) {
    let calls = 0; const adapter = ssotCase(async (url, options) => { calls++; return options.method === 'POST' ? { ok: false, status } : { ok: true, json: async () => nativeDoc() }; });
    await assert.rejects(adapter.syncTask(ssotState(), { id: 'T001' }), /no automatic retry/); assert.equal(calls, 2);
  }
});
test('Mock Docs concurrent unrelated changes fail readback, never DONE', async () => {
  let calls = 0; const adapter = ssotCase(async (url, options) => { calls++; return { ok: true, json: async () => options.method === 'POST' ? {} : nativeDoc(calls === 1 ? 'native-rev' : 'changed-unrelated', true) }; });
  await assert.rejects(adapter.syncTask(ssotState(), { id: 'T001' }), /readback differs/);
});
