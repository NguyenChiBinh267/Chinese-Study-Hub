import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hash, move, validateReport } from './core.mjs';
import { git, readJson, writeJson, validateFreeQuota, captureGitMetadata, verifyGitMetadata } from './io.mjs';
import { GitSource, GitMerge, GitSSOT, readyGitTasks, blob, scopeGate } from './git-ssot.mjs';
import { acceptanceChecks, schemaValid } from './acceptance.mjs';
import { PLAN, STATUS, MANIFEST, deriveRepository, derive, importSnapshot } from './plan.mjs';
import { validateImport } from './validate-import.mjs';
import { makeGitFixture, fixtureImplementation, fixturePolicy } from './fixtures.mjs';
import { preparedPolicies } from './policies.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.join(root, '.engineering-loop', 'git-tests', String(Date.now())); fs.mkdirSync(directory, { recursive: true });
const cfg = { liveEnabled: false, autoMerge: false, authorizedTasks: [], ssotAllowStatusWrites: false };
const make = () => makeGitFixture(directory);
const merge = (f, extra = {}) => new GitMerge({ source: f.source, cfg, checks: acceptanceChecks, ...extra });
const sync = (f, extra = {}) => new GitSSOT({ source: f.source, cfg, ...extra });
const commitMain = (f, name = 'concurrent.txt') => {
  git(f.controller, 'fetch', 'origin', 'main'); git(f.controller, 'merge', '--ff-only', 'origin/main');
  fs.writeFileSync(path.join(f.controller, name), 'concurrent update\n'); git(f.controller, 'add', '--', name); git(f.controller, 'commit', '-m', 'concurrent fixture update'); git(f.controller, 'push', 'origin', 'main');
};
test('Official full import preserves paragraphs, all URLs, ADRs and activation/dependency graph', () => {
  const r = validateImport(root); assert.equal(r.taskCount, 70); assert.equal(r.sourceParagraphs, 912); assert.deepEqual(r.orderedParagraphMismatches, []);
  assert.deepEqual(r.missingExternalUrls, []); assert.deepEqual(r.doneIds, ['T001', 'T002']);
  assert.deepEqual(Object.values(r.buckets), [34, 14, 7, 3, 3, 3, 6]);
});
test('Index is derived from canonical specification and single status source', () => {
  const s = deriveRepository(root); assert.deepEqual(s.tasks.filter(t => t.status === 'done').map(t => t.id), ['T001', 'T002']);
  assert(s.tasks.every(t => !t.spec.some(x => /^Trạng thái T\d{3}:/.test(x))));
  assert.deepEqual(readyGitTasks(s).map(t => t.id), ['T068', 'T004', 'T005']);
  assert.throws(() => importSnapshot(root, readJson(path.join(root, MANIFEST)).originalRevision), /already exist/);
  const statuses = readJson(path.join(root, STATUS)); statuses.tasks.T004.status = 'done';
  assert.throws(() => derive(fs.readFileSync(path.join(root, PLAN), 'utf8'), statuses, s.revision, readJson(path.join(root, MANIFEST))), /lacks controller/);
});
test('Git source uses pinned main, disregards edited developer specification', async () => {
  const f = make(); fixtureImplementation(f); fs.appendFileSync(path.join(f.state.worktree, PLAN), '\nDeveloper forged source\n');
  const proof = await f.source.verifyTask(f.state, f.task); assert.equal(proof.baseCommitSha, f.state.sourceCommit); assert.equal(proof.specHash, f.state.specHash);
  git(f.state.worktree, 'add', '--', PLAN); git(f.state.worktree, 'commit', '-m', 'forged specification'); f.state.commitSha = git(f.state.worktree, 'rev-parse', 'HEAD');
  assert.throws(() => scopeGate(f.state.worktree, f.state, { ...fixturePolicy, allowedFiles: [...fixturePolicy.allowedFiles, 'docs/master-plan/**'] }), /Protected/);
});
test('Any source HEAD drift blocks without silently accepting cached specification', async () => {
  const f = make(); fixtureImplementation(f); commitMain(f);
  await assert.rejects(f.source.verifyTask(f.state, f.task), /HEAD drift/);
  await assert.rejects(merge(f).merge(f.state, f.task, fixturePolicy), /HEAD drift/);
});
test('Origin identity and real/synthetic domain cannot be interchanged', () => {
  const f = make(); assert.throws(() => new GitSource({ root: f.controller }), /identity/);
  assert.throws(() => new GitSource({ root: f.controller, expectedRemote: f.remote }), /Unapproved real/);
});
test('Pinned status hash and task specification hash reject stale source packet', async () => {
  const f = make(); f.state.taskStatusHash = 'stale'; await assert.rejects(f.source.verifyTask(f.state, f.task), /status hash/);
  f.state.taskStatusHash = f.snapshot.statusHash; f.state.specHash = 'stale'; await assert.rejects(f.source.verifyTask(f.state, f.task), /spec hash/);
});
test('Real local bare merge/status readback/next pick with explicit reviewer test double', async () => {
  const f = make(); fixtureImplementation(f); const mergeSha = await merge(f).merge(f.state, f.task, fixturePolicy);
  assert.deepEqual(git(f.controller, 'rev-list', '--parents', '-n', '1', mergeSha).split(' ').slice(1), [f.state.sourceCommit, f.state.commitSha]);
  move(f.state, 'SSOT_WAIT'); const e = await sync(f).syncTask(f.state, f.task);
  assert.equal(e.readbackVerified, true); assert.equal(f.source.fetchHead(), f.state.statusSha);
  assert.equal(git(f.controller, 'diff', '--name-only', mergeSha, f.state.statusSha), STATUS);
  assert.deepEqual(readyGitTasks(f.source.loadRemote()).map(t => t.id), ['D002']);
  assert.equal(f.source.snapshot(f.state.statusSha).planHash, f.snapshot.planHash);
});
test('Wrong SHA, developer verdict, unresolved finding or concurrent process cannot merge', async () => {
  const mutations = [s => s.review.commitSha = 'wrong', s => s.review.nonce = 'wrong', s => s.review.verdict = 'REWORK',
    s => s.review.findings = [{ severity: 'P1' }], s => s.writerPid = process.pid];
  for (const mutate of mutations) { const f = make(); fixtureImplementation(f); mutate(f.state); await assert.rejects(merge(f).merge(f.state, f.task, fixturePolicy), /PASS|concurrent/); assert.equal(f.source.fetchHead(), f.state.sourceCommit); }
});
test('Deterministic acceptance defeats false reviewer PASS at merge', async () => {
  const f = make(); fixtureImplementation(f, 'WRONG\n'); await assert.rejects(merge(f).merge(f.state, f.task, fixturePolicy), /acceptance/);
  assert.equal(f.source.fetchHead(), f.state.sourceCommit);
});
test('Failed merge push resumes same pending commit without duplicate merge', async () => {
  const f = make(); fixtureImplementation(f); const file = path.join(f.directory, 'checkpoint.json'); let calls = 0;
  await assert.rejects(merge(f, { push: () => { calls++; throw new Error('simulated transport failure'); } }).merge(f.state, f.task, fixturePolicy, s => writeJson(file, s)), /transport/);
  const pending = f.state.mergePendingSha; f.state = readJson(file); assert.equal(f.state.phase, 'MERGE_WAIT');
  assert.equal(await merge(f).merge(f.state, f.task, fixturePolicy), pending); assert.equal(calls, 1);
});
test('Crash after actual merge push recovers remote merge and never pushes a duplicate', async () => {
  const f = make(); fixtureImplementation(f); const file = path.join(f.directory, 'checkpoint.json');
  await assert.rejects(merge(f, { push: (repo, sha) => { git(repo, 'push', 'origin', `${sha}:refs/heads/main`); throw new Error('simulated controller crash after merge push'); } })
    .merge(f.state, f.task, fixturePolicy, s => writeJson(file, s)), /crash/);
  f.state = readJson(file); const pending = f.state.mergePendingSha;
  const result = await merge(f, { push: () => { throw new Error('duplicate push forbidden'); } }).merge(f.state, f.task, fixturePolicy);
  assert.equal(result, pending); assert.equal(f.state.mergeVerified, true);
});
test('Non-force merge push rejects actual concurrent remote update', async () => {
  const f = make(); fixtureImplementation(f); let concurrent;
  const m = merge(f, { push: (repo, sha) => { commitMain(f); concurrent = f.source.fetchHead(); git(repo, 'push', 'origin', `${sha}:refs/heads/main`); } });
  await assert.rejects(m.merge(f.state, f.task, fixturePolicy), /git failed/); assert.equal(f.source.fetchHead(), concurrent); assert.equal(f.state.mergeVerified, undefined);
});
test('Failed status push reloads SSOT_WAIT and reuses status commit, never reimplements/remerges', async () => {
  const f = make(); fixtureImplementation(f); await merge(f).merge(f.state, f.task, fixturePolicy); move(f.state, 'SSOT_WAIT');
  const file = path.join(f.directory, 'checkpoint.json'), reviewed = f.state.commitSha, merged = f.state.mergeSha;
  await assert.rejects(sync(f, { push: () => { throw new Error('simulated status push failure'); } }).syncTask(f.state, f.task, s => writeJson(file, s)), /failure/);
  const pending = f.state.statusPendingSha; f.state = readJson(file); assert.equal(f.state.phase, 'SSOT_WAIT');
  await sync(f).syncTask(f.state, f.task); assert.equal(f.state.statusSha, pending); assert.equal(f.state.commitSha, reviewed); assert.equal(f.state.mergeSha, merged);
});
test('Crash after actual status push and duplicate sync reuse remote readback only', async () => {
  const f = make(); fixtureImplementation(f); await merge(f).merge(f.state, f.task, fixturePolicy); move(f.state, 'SSOT_WAIT');
  const file = path.join(f.directory, 'checkpoint.json');
  await assert.rejects(sync(f, { push: (repo, sha) => { git(repo, 'push', 'origin', `${sha}:refs/heads/main`); throw new Error('simulated crash after status push'); } }).syncTask(f.state, f.task, s => writeJson(file, s)), /crash/);
  f.state = readJson(file); const pending = f.state.statusPendingSha;
  const adapter = sync(f, { push: () => { throw new Error('duplicate status push forbidden'); } });
  await adapter.syncTask(f.state, f.task); await adapter.syncTask(f.state, f.task); assert.equal(f.state.statusSha, pending);
});
test('Concurrent update after merge blocks status; no overwrite or premature done', async () => {
  const f = make(); fixtureImplementation(f); await merge(f).merge(f.state, f.task, fixturePolicy); move(f.state, 'SSOT_WAIT'); commitMain(f);
  const current = f.source.fetchHead(); await assert.rejects(sync(f).syncTask(f.state, f.task), /Concurrent main/);
  assert.equal(f.source.fetchHead(), current); assert.equal(f.source.snapshot(current).tasks.find(t => t.id === 'D001').status, 'pending');
});
test('Status synchronization rejects wrong Task ID/unverified merge/PASS', async () => {
  const f = make(); fixtureImplementation(f); await assert.rejects(sync(f).syncTask(f.state, f.task), /verified merge/);
  await merge(f).merge(f.state, f.task, fixturePolicy); move(f.state, 'SSOT_WAIT'); await assert.rejects(sync(f).syncTask(f.state, { id: 'D002' }), /same task/);
});
test('Schema subset blocks unsupported keywords and validates required/type/enum/range', () => {
  const schema = { type: 'object', required: ['n'], additionalProperties: false, properties: { n: { type: 'integer', minimum: 0 } } };
  assert(schemaValid({ n: 0 }, schema)); for (const value of [{}, { n: -1 }, { n: '1' }, { n: 0, extra: true }]) assert(!schemaValid(value, schema));
  assert.throws(() => schemaValid({}, { $ref: 'unknown' }), /Unsupported/);
});
test('Required file/schema/headings/provenance/rights/secrets/paid checks reject false success', () => {
  const repo = path.join(directory, 'acceptance'); fs.mkdirSync(repo); fs.writeFileSync(path.join(repo, 'report.md'), '# Good\nloading empty error offline');
  fs.writeFileSync(path.join(repo, 'data.json'), JSON.stringify({ sources: [{ url: 'https://example.invalid', observedAt: '2026-10-14', evidence: 'observed sample source evidence', verification: 'unverified', rightsStatus: 'unknown', published: true }] }));
  const policy = { allowedFiles: ['report.md', 'data.json'], acceptanceChecks: [
    { kind: 'required-file', file: 'missing.md' }, { kind: 'required-headings', file: 'report.md', headings: ['Missing'] },
    { kind: 'json-schema', file: 'data.json', schema: { type: 'object', required: ['absent'] } }, { kind: 'rights-gate', file: 'data.json' },
    { kind: 'owner-evidence', scope: 'account-zero-cost' }, { kind: 'targeted-command', commandId: 'not-owner-allowlisted' }
  ] }; assert(acceptanceChecks(repo, policy).every(x => x.passed === false));
  fs.writeFileSync(path.join(repo, 'report.md'), 'billingEnabled=true'); assert.equal(acceptanceChecks(repo, { ...policy, acceptanceChecks: [{ kind: 'no-paid-config', file: 'report.md' }] })[0].passed, false);
});
test('Prepared T068/T004/T005 policies have concrete acceptance and mandatory owner gates', () => {
  for (const id of ['T068', 'T004', 'T005']) { assert(preparedPolicies[id].acceptanceChecks.length >= 8); assert(preparedPolicies[id].acceptanceChecks.some(c => c.kind === 'owner-evidence')); }
});
test('Model quota exhaustion blocks before any paid fallback', () => {
  assert.throws(() => validateFreeQuota({ rateLimits: { credits: { hasCredits: false, unlimited: false, balance: '0' }, primary: { usedPercent: 100 } } }), /model limit/);
});
test('Developer tests cannot relabel intentional failed acceptance as passed', () => {
  assert.throws(() => validateReport({ taskId: 'D001', result: 'COMPLETE', changedFiles: ['fixture.txt'], tests: [{ passed: false }], evidence: ['intentional failure'], blocker: '' }, { taskId: 'D001' }, ['fixture.txt']), /Incomplete/);
});
test('Developer cannot redirect publisher/config/hooks while retaining clean source diff', () => {
  const f = make(); fixtureImplementation(f); const receipt = captureGitMetadata(f.state.worktree);
  verifyGitMetadata(receipt); fs.appendFileSync(receipt.configPath, '\n[core]\n hooksPath = attacker-hooks\n');
  assert.throws(() => verifyGitMetadata(receipt), /config\/hooks/);
});
test('Per-screen states and official practice label cannot receive generic success', () => {
  const repo = path.join(directory, 'contracts'); fs.mkdirSync(repo); fs.writeFileSync(path.join(repo, 'flow.md'), '# Today\nloading empty error offline CTA\n# Player\nloading CTA\n');
  fs.writeFileSync(path.join(repo, 'exam.json'), JSON.stringify({ practiceLabel: 'verified-official-format', gaps: ['unverified blueprint'], sources: [{ verification: 'unverified' }] }));
  const policy = { allowedFiles: ['flow.md', 'exam.json'], acceptanceChecks: [
    { kind: 'section-contract', file: 'flow.md', sections: ['Today', 'Player'], required: ['loading', 'empty', 'error', 'offline', 'CTA'] },
    { kind: 'practice-label', file: 'exam.json' }
  ] }; assert(acceptanceChecks(repo, policy).every(x => x.passed === false));
});
test('Allowlisted targeted command runs; unsupported command and bogus verified provenance do not', () => {
  const repo = path.join(directory, 'commands'); fs.mkdirSync(repo);
  const policy = { allowedFiles: ['data.json'], checks: [{ id: 'safe-read', executable: process.execPath, args: ['-e', 'process.exit(0)'] }],
    acceptanceChecks: [{ kind: 'targeted-command', commandId: 'safe-read' }] };
  assert.equal(acceptanceChecks(repo, policy)[0].passed, true);
  fs.writeFileSync(path.join(repo, 'data.json'), JSON.stringify({ sources: [{ url: 'https://example.invalid', observedAt: '2026-10-14', evidence: 'Claim with no independent readback', verification: 'verified', sha256: 'a'.repeat(64) }] }));
  assert.equal(acceptanceChecks(repo, { ...policy, acceptanceChecks: [{ kind: 'source-provenance', file: 'data.json' }] })[0].passed, false);
});
