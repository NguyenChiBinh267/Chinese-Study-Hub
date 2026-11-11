import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { selectModel as routeModel, supportedModel, selectedQuota, consumeModelBudget, observeModelEvent } from './model-routing.mjs';
import { runCodex, codexArguments, executionProfileArguments, writeJson, readJson, git } from './io.mjs';
import { localReview, reviewPlan } from './reviewer.mjs';
import { hash } from './core.mjs';
import { safeLaunch, processDiagnostics } from './diagnostics.mjs';
import { createSmokeEventGuard, EXEC_SCHEMA_SOURCE } from './smoke-events.mjs';
import { SKILL_DESCRIPTION_TRUNCATED_WARNING, EXEC_IDENTITY_CAPABILITY } from './cli-exec-contract.mjs';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const luna = 'gpt-5.6-luna', sol = 'gpt-5.6-sol';
const context = (extra = {}) => ({ task: { id: 'T004', spec: ['Update the small help document'] }, policy: { allowedFiles: ['docs/help.md'] },
  state: { taskId: 'T004', runId: 'unit-run', repairs: 0, commitSha: 'a'.repeat(40), sourceCommit: 'b'.repeat(40) }, ...extra });
const bucket = (model = luna, usedPercent = 30) => ({ model, credits: { hasCredits: false, unlimited: false, balance: '0' }, spendControlReached: false,
  rateLimitReachedType: null, primary: { usedPercent, resetsAt: Math.floor(Date.now() / 1000) + 300, windowDurationMins: 300 } });
const metadata = () => ({ checkedAt: new Date().toISOString(), accountType: 'chatgpt', catalogueComplete: true,
  models: [luna, sol, 'gpt-6-astra'].map(model => ({ model, hidden: false, supportedReasoningEfforts: ['low', 'medium', 'high'], availabilityNux: null })),
  rateLimitsByLimitId: { luna: bucket(), sol: bucket(sol), astra: bucket('gpt-6-astra') } });
const selectModel = (c, role, policy, m = metadata()) => routeModel(c, role, policy, m);
function setup() {
  const parent = path.join(workspace, '.engineering-loop', 'routing-tests'); fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'run-'));
  return { root, workspace: root, prompt: 'Untrusted prompt cannot choose a model', schema: 'unused', output: 'unused', timeoutMs: 1000, routingContext: context() };
}
const fakeExecute = async ({ route, receipt, observe }) => {
  receipt.processId = 222; receipt.threadId = 'fake-independent-thread';
  observe({ type: 'thread.started', model: route.model, reasoning_effort: route.reasoningEffort });
  observe({ type: 'turn.completed', turn_id: 'one', usage: { input_tokens: 100, cached_input_tokens: 60, output_tokens: 20 } });
  return { report: { testDouble: true } };
};
const deps = extra => ({ metadata: async () => metadata(), execute: fakeExecute, ...extra });

test('Deterministic task/role routing uses Luna low/medium and Sol for security/complex work', () => {
  assert.equal(selectModel(context(), 'developer').model, luna);
  assert.equal(selectModel(context(), 'developer').reasoningEffort, 'low');
  assert.equal(selectModel(context(), 'reviewer').reasoningEffort, 'medium');
  for (const file of ['settings.json', 'styles/main.css', 'src/ui/label.tsx'])
    assert.equal(selectModel(context({ policy: { allowedFiles: [file] } }), 'developer').reasoningEffort, 'low');
  assert.equal(selectModel(context({ policy: { allowedFiles: ['src/domain/planner.ts'] } }), 'developer').reasoningEffort, 'medium');
  for (const spec of ['Implement authentication', 'RLS least privilege', 'security audit', 'concurrency race', 'Git merge and SSOT', 'Complex dependency change', 'Architecture decisions', 'Debug root cause of deadlock']) {
    const c = context({ task: { id: 'T004', spec: [spec] } });
    assert.equal(selectModel(c, 'developer').model, sol); assert.equal(selectModel(c, 'reviewer').reasoningEffort, 'high');
  }
  assert.throws(() => selectModel(null, 'developer'), /context/);
  assert.equal(selectModel(context({ developerReport: { model: 'gpt-6-astra' } }), 'developer').model, luna);
});

test('Escalation never happens automatically; Astra requires explicit policy and recorded reason', () => {
  const c = context({ escalation: { model: sol, reason: 'Owner-authorized escalation for a documented implementation obstacle' } });
  assert.throws(() => selectModel(c, 'developer'), /authorized/);
  const policy = { allowEscalation: true, maxEscalationsPerTask: 1, allowedEscalationModels: [sol] };
  assert.equal(selectModel(c, 'developer', policy).model, sol);
  c.escalation.model = 'gpt-6-astra'; assert.throws(() => selectModel(c, 'developer', policy));
  assert.equal(selectModel(c, 'reviewer', { ...policy, allowAstra: true, allowedEscalationModels: ['gpt-6-astra'] }).model, 'gpt-6-astra');
  c.escalation.reason = 'short'; assert.throws(() => selectModel(c, 'developer', policy));
});

test('CLI arguments always pin model/effort and keep independent read-only reviewer sandbox', () => {
  const args = codexArguments('entry', { workspace: 'repo', schema: 'schema', output: 'out', role: 'reviewer', model: luna, reasoningEffort: 'medium' });
  assert.equal(args[args.indexOf('--model') + 1], luna); assert.ok(args.includes('model_reasoning_effort="medium"'));
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only'); assert.ok(args.includes('--ephemeral')); assert.ok(args.includes('--ignore-user-config'));
  assert.throws(() => codexArguments('entry', { role: 'reviewer' }), /Explicit/);
});

test('Minimal smoke startup removes provider overrides, keeps ChatGPT and enforces exact Luna/low/read-only', () => {
  const base = { workspace: 'repo', schema: 'schema', output: 'out', role: 'developer', model: luna, reasoningEffort: 'low', executionProfile: 'minimal-luna-smoke' };
  const args = codexArguments('entry', base);
  assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
  assert.ok(args.includes('forced_login_method="chatgpt"')); assert.ok(args.includes('model_provider="openai"'));
  assert.equal(args.some(a => a.includes('model_providers.')), false);
  assert.equal(executionProfileArguments(base.executionProfile).filter(a => a === '--disable').length, 5);
  for (const patch of [{ model: sol }, { reasoningEffort: 'medium' }, { executionProfile: 'unknown' }]) assert.throws(() => codexArguments('entry', { ...base, ...patch }));
});

test('Authenticated model catalogue, availability and reasoning support are mandatory', () => {
  const route = selectModel(context(), 'developer'), m = metadata();
  supportedModel(m, route);
  for (const patch of [{ accountType: 'apiKey' }, { catalogueComplete: false }, { models: [] },
    { models: [{ ...m.models[0], hidden: true }] }, { models: [{ ...m.models[0], availabilityNux: { message: 'Upgrade required' } }] },
    { models: [{ ...m.models[0], supportedReasoningEfforts: ['high'] }] }]) assert.throws(() => supportedModel({ ...m, ...patch }, route));
});

test('Exact IDs come only from runtime catalogue; family preference never invents an unavailable version', () => {
  assert.equal(routeModel(context(), 'developer').model, null); // Authorization/classification only, cannot dispatch.
  const m = metadata();
  assert.equal(selectModel(context(), 'developer', {}, m).model, 'gpt-5.6-luna');
  m.models = m.models.map(x => ({ ...x, model: x.model.replace('5.6', '7.2') }));
  assert.equal(selectModel(context(), 'developer', {}, m).model, 'gpt-7.2-luna');
  m.models.push({ ...m.models[0], model: 'gpt-8-luna' });
  assert.throws(() => selectModel(context(), 'developer', {}, m), /unambiguous/);
  m.models = metadata().models.filter(x => x.model === 'gpt-6-astra');
  assert.throws(() => selectModel(context(), 'developer', {}, m), /MODEL_UNAVAILABLE/);
  m.models = [{ ...metadata().models[0], model: 'unknown-tiny' }];
  assert.throws(() => selectModel(context(), 'developer', {}, m), /MODEL_UNAVAILABLE/);
});

test('Light routing chooses lowest supported policy tier; strong routing never downgrades security', () => {
  const m = metadata(), template = m.models[0];
  m.models = [{ ...template, model: 'gpt-5.6-terra' }, m.models[1]];
  assert.equal(selectModel(context(), 'developer', {}, m).model, 'gpt-5.6-terra');
  const c = context({ task: { id: 'T004', spec: ['Security architecture'] } });
  assert.equal(selectModel(c, 'reviewer', {}, m).model, sol);
  m.models = [template];
  assert.throws(() => selectModel(c, 'reviewer', {}, m), /MODEL_UNAVAILABLE/);
  m.models = [{ ...template, supportedReasoningEfforts: ['high'] }];
  assert.throws(() => selectModel(context(), 'developer', {}, m), /MODEL_UNAVAILABLE/);
});

test('Shared account quota is used conservatively when per-model quota is unavailable', () => {
  const route = selectModel(context(), 'developer'), m = metadata();
  m.rateLimitsByLimitId.sol.primary.usedPercent = 100;
  assert.equal(selectedQuota(m, route).model, luna);
  const generic = bucket(); delete generic.model;
  generic.secondary = { ...generic.primary, usedPercent: 35, windowDurationMins: 10080 };
  const shared = selectedQuota({ ...m, rateLimitsByLimitId: { codex: generic } }, route);
  assert.equal(shared.quotaScope, 'shared-account'); assert.equal(shared.modelQuotaVerified, false);
  assert.equal(shared.remainingPercent, 65); assert.equal(shared.usablePercent, 45);
  assert.throws(() => selectedQuota({ ...m, rateLimitsByLimitId: { unknown: generic } }, route), /QUOTA_UNVERIFIED/);
  assert.throws(() => selectedQuota({ ...m, rateLimitsByLimitId: { codex: bucket(sol) } }, route), /QUOTA_UNVERIFIED/);
  m.rateLimitsByLimitId.codex = generic; generic.primary.usedPercent = 80;
  assert.throws(() => selectedQuota(m, route), /RESERVE/);
});

test('20 percent reserve is protected on every window; missing/stale/paid metadata blocks', () => {
  const route = selectModel(context(), 'developer');
  for (const used of [80, 81, 100]) { const m = metadata(); m.rateLimitsByLimitId.luna.primary.usedPercent = used; assert.throws(() => selectedQuota(m, route), /RESERVE/); }
  const m = metadata(); m.rateLimitsByLimitId.luna.primary.usedPercent = 79; selectedQuota(m, route);
  for (const mutate of [q => { q.credits.balance = null; }, q => { q.credits.balance = ''; }, q => { q.credits.balance = '1'; },
    q => { q.spendControlReached = null; }, q => { q.primary.resetsAt = 0; }, q => { q.primary.usedPercent = NaN; },
    q => { q.secondary = { ...q.primary, usedPercent: 90 }; }]) { const x = metadata(); mutate(x.rateLimitsByLimitId.luna); assert.throws(() => selectedQuota(x, route)); }
  assert.throws(() => selectedQuota({ ...m, checkedAt: new Date(Date.now() - 61000).toISOString() }, route), /Stale/);
});

test('Missing shared metadata and reserve equality block without inventing per-model quota', () => {
  const r = selectModel(context(), 'reviewer');
  for (const mutate of [q => { delete q.credits; }, q => { delete q.spendControlReached; }, q => { q.primary = null; },
    q => { q.primary.resetsAt = 1; }, q => { q.primary.usedPercent = 80; }, q => { q.primary.windowDurationMins = null; }]) {
    const m = metadata(), q = bucket(); delete q.model; mutate(q); m.rateLimitsByLimitId = { codex: q };
    assert.throws(() => selectedQuota(m, r));
  }
});

test('Budgets count attempts, repair/escalation limits, and exact invocation replay', () => {
  const r = selectModel(context(), 'developer'), b = consumeModelBudget(null, r);
  assert.equal(b.calls, 1); assert.equal(b.attempts[0].status, 'RESERVED'); assert.throws(() => consumeModelBudget(b, r), /Duplicate/);
  const c = context(); c.state.repairs = 3; assert.throws(() => selectModel(c, 'developer'), /repair/);
  const e = selectModel(context({ escalation: { model: sol, reason: 'Explicit owner-approved diagnostic escalation for this task' } }), 'developer', { allowEscalation: true, maxEscalationsPerTask: 1, allowedEscalationModels: [sol] });
  assert.throws(() => consumeModelBudget(null, e), /recorded failed/);
  b.attempts[0].status = 'BLOCKED';
  const eb = consumeModelBudget(b, e); assert.throws(() => consumeModelBudget(eb, { ...e, invocationKey: 'another' }), /escalation budget/);
  assert.throws(() => consumeModelBudget({ ...b, calls: 0 }, r), /Corrupt/);
});

test('runCodex fake runner records actual model, token usage, both quota snapshots and durable counters', async () => {
  const args = setup(); let runs = 0, snapshots = 0;
  const result = await runCodex(args, deps({ metadata: async () => { snapshots++; return metadata(); }, execute: async o => { runs++; return fakeExecute(o); } }));
  assert.equal(runs, 1); assert.equal(snapshots, 2); assert.equal(result.receipt.actualModel, luna);
  assert.deepEqual(result.receipt.usage, { inputTokens: 100, cachedInputTokens: 60, outputTokens: 20, totalTokens: 120, source: 'turn.completed' });
  assert.ok(result.receipt.quotaBefore && result.receipt.quotaAfter); assert.equal(result.receipt.taskId, 'T004');
  await assert.rejects(runCodex(args, deps()), /Duplicate/);
  const next = structuredClone(args); next.routingContext.state.repairs = 1; next.routingContext.state.commitSha = 'c'.repeat(40);
  assert.equal((await runCodex(next, deps())).receipt.calls, 2);
});

test('Unavailable model or unbound quota stops before fake runner and consumes no model budget', async () => {
  for (const kind of ['model', 'quota']) {
    const args = setup(); let runs = 0;
    await assert.rejects(runCodex(args, deps({ metadata: async () => { const m = metadata(); if (kind === 'model') m.models = []; else m.rateLimitsByLimitId = {}; return m; }, execute: async () => { runs++; } })), error => {
      assert.equal(error.receipt.preflightBlocked, true); assert.equal(error.receipt.dispatchAttempted, false); assert.equal(error.receipt.actualModel, null); return true;
    });
    assert.equal(runs, 0); assert.equal(fs.existsSync(path.join(args.root, '.engineering-loop/model-budgets')), false);
  }
});

test('Shared-account metadata admits a mock only; no per-model allowance is claimed', async () => {
  const args = setup();
  const result = await runCodex(args, deps({ metadata: async () => { const m = metadata(), q = bucket(); delete q.model; m.rateLimitsByLimitId = { codex: q }; return m; } }));
  assert.equal(result.receipt.actualModel, luna); assert.equal(result.receipt.quotaBefore.quotaScope, 'shared-account');
  assert.equal(result.receipt.quotaAfter.modelQuotaVerified, false);
});

test('Reviewer cannot spend quota again on same HEAD via repair, policy or model change after restart', async () => {
  const args = setup(); args.role = 'reviewer'; await runCodex(args, deps());
  args.routingContext.state.repairs = 1;
  args.routingContext.task.spec = ['Security architecture with changed contract'];
  await assert.rejects(runCodex(args, deps()), /Duplicate reviewer HEAD/);
  args.routingContext.state.commitSha = 'c'.repeat(40);
  assert.equal((await runCodex(args, deps())).receipt.calls, 2);
  const r = selectModel(context(), 'reviewer'), legacy = consumeModelBudget(null, r); delete legacy.attempts[0].commitSha;
  assert.throws(() => consumeModelBudget(legacy, { ...r, invocationKey: 'different' }), /legacy review missing HEAD/);
});

test('Failed dispatch consumes a durable call; restarted run cannot refund or repeat it', async () => {
  const args = setup(); let consumed;
  await assert.rejects(runCodex(args, deps({ execute: async () => {
    const dir = path.join(args.root, '.engineering-loop/model-budgets'); const file = fs.readdirSync(dir).find(f => f.endsWith('.json'));
    consumed = readJson(path.join(dir, file)); assert.equal(consumed.calls, 1); assert.equal(consumed.attempts[0].status, 'RESERVED');
    throw new Error('fake process crash');
  } })), /crash/);
  await assert.rejects(runCodex(args, deps()), /Duplicate/);
  const file = path.join(args.root, '.engineering-loop/model-budgets', hash(consumed.key) + '.json');
  assert.equal(readJson(file).calls, 1); assert.equal(readJson(file).attempts[0].status, 'BLOCKED');
});

test('One explicitly authorized escalation can follow a failed same-HEAD call; no repeated escalation', async () => {
  const args = setup(); await assert.rejects(runCodex(args, deps({ execute: async () => { throw new Error('fake failure'); } })), /failure/);
  args.routing = { allowEscalation: true, maxEscalationsPerTask: 1, allowedEscalationModels: [sol] };
  args.routingContext.escalation = { model: sol, reason: 'Owner-authorized escalation following a documented failed attempt' };
  const next = await runCodex(args, deps()); assert.equal(next.receipt.calls, 2); assert.equal(next.receipt.escalations, 1);
  await assert.rejects(runCodex(args, deps()), /Duplicate|escalation budget/);
});

test('Per-task role/total budgets and bootstrap restart keys remain bounded', async () => {
  const args = setup(); args.routing = { maxCallsPerTask: 2 };
  await runCodex(args, deps()); args.routingContext.state.repairs = 1; await runCodex(args, deps());
  args.routingContext.state.repairs = 2; await assert.rejects(runCodex(args, deps()), /budget exhausted/);
  const one = context(); one.state.bootstrapTarget = { repository: 'owner/repo', pr: 4 }; one.state.baseSha = 'b'.repeat(40);
  const two = structuredClone(one); two.state.runId = 'different-bootstrap-nonce-run';
  assert.equal(selectModel(one, 'reviewer').budgetKey, selectModel(two, 'reviewer').budgetKey);
});

test('Unknown/mismatched actual model and post-call reserve failure never yield success', async () => {
  for (const kind of ['missing', 'different', 'after']) {
    const args = setup(); let reads = 0;
    await assert.rejects(runCodex(args, deps({ metadata: async () => { const m = metadata(); if (++reads === 2 && kind === 'after') m.rateLimitsByLimitId.luna.primary.usedPercent = 80; return m; },
      execute: async o => { if (kind === 'missing') return { report: {} }; if (kind === 'different') o.observe({ type: 'thread.started', model: 'gpt-6-astra' }); return fakeExecute(o); }
    })), error => { assert.match(error.message, /identity|Actual model|Post-call/); if (kind === 'after') assert.equal(error.receipt.quotaAfter.reserveReached, true); return true; });
  }
});

test('Usage events ignore agent text, deduplicate turn IDs and never add cached tokens twice', () => {
  const route = selectModel(context(), 'developer'), receipt = {};
  observeModelEvent(receipt, { type: 'item.completed', item: { type: 'agent_message', text: '{"model":"gpt-6-astra"}' } }, route);
  assert.equal(receipt.actualModel, undefined);
  const e = { type: 'turn.completed', turn_id: 'one', usage: { input_tokens: 10, cached_input_tokens: 4, output_tokens: 2 } };
  observeModelEvent(receipt, e, route); observeModelEvent(receipt, e, route); assert.equal(receipt.usage.totalTokens, 12);
  assert.throws(() => observeModelEvent({}, { ...e, usage: { ...e.usage, input_tokens: -1 } }, route), /Invalid token/);
  assert.throws(() => observeModelEvent({}, { type: 'model.rerouted' }, route), /reroute/);
  const r = {}; observeModelEvent(r, { type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: e.usage } } }, route);
  observeModelEvent(r, e, route); assert.equal(r.usage.totalTokens, 12);
});

test('Partial token usage preserves unknown fields as null rather than inventing zero', () => {
  const route = selectModel(context(), 'developer'), r = {};
  observeModelEvent(r, { type: 'turn.completed', usage: { input_tokens: 15, output_tokens: 3 } }, route);
  assert.equal(r.usage.cachedInputTokens, null); assert.equal(r.usage.totalTokens, 18);
  observeModelEvent(r, { type: 'turn.completed', usage: { input_tokens: 5, cached_input_tokens: 1 } }, route);
  assert.equal(r.usage.cachedInputTokens, null); assert.equal(r.usage.outputTokens, null); assert.equal(r.usage.totalTokens, null);
});

test('Synthetic CLI proofs are off by default and an explicit proof has a persistent global call cap', async () => {
  const args = setup(); args.routingContext.task.id = 'D001'; args.routingContext.state.taskId = 'D001';
  let reads = 0; await assert.rejects(runCodex(args, deps({ metadata: async () => { reads++; return metadata(); } })), /Synthetic CLI proofs disabled/); assert.equal(reads, 0);
  args.routing = { syntheticProofAuthorization: { id: 'explicit-unit-proof', expiresAt: new Date(Date.now() + 60000).toISOString(), maxCalls: 1 } };
  await runCodex(args, deps()); args.routingContext.task.id = 'D002'; args.routingContext.state.taskId = 'D002';
  await assert.rejects(runCodex(args, deps()), /Synthetic proof call budget/);
});

test('Repair review narrows to verified delta while retaining current-SHA acceptance and independent runner', async () => {
  const args = setup(), repo = args.root; git(repo, 'init', '-b', 'main'); git(repo, 'config', 'core.autocrlf', 'false');
  git(repo, 'config', 'user.name', 'Routing test'); git(repo, 'config', 'user.email', 'test@example.invalid');
  for (const file of ['a.txt', 'b.txt']) fs.writeFileSync(path.join(repo, file), 'BASE\n'); git(repo, 'add', '.'); git(repo, 'commit', '-m', 'base'); const base = git(repo, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'WRONG\n'); fs.writeFileSync(path.join(repo, 'b.txt'), 'UNCHANGED-REPAIR\n'); git(repo, 'add', '.'); git(repo, 'commit', '-m', 'initial');
  const state = { taskId: 'T004', runId: 'review-unit', nonce: 'nonce', phase: 'REVIEW_WAIT', repairs: 0, baseSha: base, sourceCommit: base,
    commitSha: git(repo, 'rev-parse', 'HEAD'), sourceRevision: 'verified-source', worktree: repo, evidence: [] };
  const task = { id: 'T004', spec: ['Acceptance: APPROVED plus newline'] }, policy = { allowedFiles: ['a.txt', 'b.txt'], acceptanceChecks: [{ kind: 'exact-bytes', file: 'a.txt', expectedBase64: Buffer.from('APPROVED\n').toString('base64') }] };
  const sourceAdapter = { verifyTask: async () => ({ revision: 'verified-source', readbackVerified: true, kind: 'test-double' }) };
  const report = verdict => ({ runId: state.runId, taskId: state.taskId, nonce: state.nonce, commitSha: state.commitSha, sourceRevision: state.sourceRevision,
    verdict, findings: verdict === 'REWORK' ? [{ severity: 'P2', file: 'a.txt', line: 1, message: 'Wrong actual bytes' }] : [], evidenceSummary: 'Independent test-double read of actual task bytes and delta.' });
  const run = verdict => localReview({ root: repo, tool: path.join(workspace, 'tools/engineering-loop'), data: path.join(workspace, '.engineering-loop/routing-review-tests'), state, task, policy, sourceAdapter,
    timeoutMs: 1000, control: () => ({}), runner: async () => ({ report: report(verdict), receipt: { role: 'reviewer', sandbox: 'read-only', newSession: true, processId: 22, threadId: 'separate-fake-thread' } }) });
  state.evidence = [{ commitSha: state.commitSha, checks: [{ name: 'controller byte read', passed: true }] }];
  const first = await run('REWORK'); state.review = first.event; state.reviewerReceipt = first.receipt;
  const previous = state.commitSha; fs.writeFileSync(path.join(repo, 'a.txt'), 'APPROVED\n'); git(repo, 'add', '.'); git(repo, 'commit', '-m', 'repair one file'); state.commitSha = git(repo, 'rev-parse', 'HEAD'); state.repairs = 1;
  const plan = reviewPlan(state, task, policy); assert.equal(plan.kind, 'delta'); assert.equal(plan.diffBase, previous); assert.deepEqual(plan.changedFiles, ['a.txt']);
  assert.equal(reviewPlan(state, { ...task, spec: ['Changed contract'] }, policy).kind, 'task');
  state.evidence = [{ commitSha: state.commitSha, checks: [{ name: 'new HEAD actual bytes', passed: true }] }]; assert.equal((await run('PASS')).event.verdict, 'PASS');
});

async function processFixture(scenario = {}) {
  const options = setup(); options.output = path.join(options.root, 'out.json'); options.timeoutMs = scenario.timeout ? 5 : 1000;
  if (scenario.smoke) {
    options.executionProfile = 'minimal-luna-smoke'; options.schema = path.join(options.root, 'schema.json');
    writeJson(options.schema, { type: 'object', properties: { ok: { type: 'boolean', const: true } }, required: ['ok'], additionalProperties: false });
  }
  let spawns = 0, stops = 0, child;
  const entry = 'fixture-entry';
  const process = { entrypoint: () => entry, spawn: (executable, args) => {
    spawns++;
    if (scenario.throwSpawn) throw Object.assign(new Error('secret spawn details'), { code: 'EACCES' });
    child = new EventEmitter(); child.pid = scenario.spawnError ? undefined : 456;
    child.spawnargs = [executable, ...args];
    if (scenario.readOnly) child.spawnargs[child.spawnargs.indexOf('--sandbox') + 1] = 'read-only';
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.stdin = new Writable({ write(_chunk, _encoding, callback) { callback(); }, final(callback) {
      callback(); queueMicrotask(() => {
        if (scenario.timeout) return;
        for (const text of scenario.stdout ?? []) child.stdout.write(text);
        for (const text of scenario.stderr ?? []) child.stderr.write(text);
        if (scenario.spawnError || scenario.processError) child.emit('error', { code: 'ENOENT' });
        if (scenario.output) writeJson(options.output, scenario.output);
        child.emit('close', scenario.code ?? 1, scenario.signal ?? null);
      });
    } });
    return child;
  }, stop: c => { stops++; queueMicrotask(() => c.emit('close', null, 'SIGTERM')); } };
  try {
    const result = await runCodex(options, { metadata: async () => metadata(), process });
    return { receipt: result.receipt, options, spawns, stops, succeeded: true };
  } catch (error) { return { receipt: error.receipt, error, options, spawns, stops, succeeded: false }; }
}

test('Runner diagnostics: exact reserved-provider config rejection before JSON is persisted without raw secrets', async () => {
  const result = await processFixture({ stderr: ['Error: model_providers contains reserved built-in provider IDs: `openai`. Built-in providers cannot be overridden.\n',
    'Authorization: Bearer very-secret\napi_key=top-secret\n'] });
  const d = result.receipt.diagnostics;
  assert.equal(result.spawns, 1); assert.equal(result.succeeded, false); assert.equal(d.exitCode, 1);
  assert.equal(d.classification, 'CLI_CONFIGURATION'); assert.equal(d.messages[0].code, 'RESERVED_PROVIDER_OVERRIDE');
  assert.equal(d.preInference.state, 'NO_JSON_EVENTS'); assert.equal(d.preInference.inferenceRequestSent, null);
  assert.equal(result.receipt.actualModel, null); assert.equal(result.receipt.usage, null);
  assert.doesNotMatch(JSON.stringify(result.receipt), /very-secret|top-secret|Authorization|api_key=/);
  const files = fs.readdirSync(path.join(result.options.root, '.engineering-loop/model-budgets'));
  const saved = readJson(path.join(result.options.root, '.engineering-loop/model-budgets', files.find(f => f.endsWith('.json'))));
  assert.equal(saved.attempts[0].status, 'BLOCKED'); assert.deepEqual(saved.attempts[0].receipt.diagnostics, d);
});

test('Runner diagnostics: argument/auth/model/sandbox failures have distinct reported signatures', async () => {
  for (const [message, category] of [["error: unexpected argument '--bad' found", 'CLI_ARGUMENT'], ['Authentication failed; please log in', 'AUTHENTICATION'],
    ['The requested model does not exist or you do not have access', 'MODEL_ACCESS'], ['Failed to initialize sandbox', 'SANDBOX']]) {
    const r = await processFixture({ stderr: [message] });
    assert.equal(r.receipt.diagnostics.classification, category); assert.equal(r.receipt.diagnostics.exitCode, 1);
    assert.equal(r.receipt.diagnostics.preInference.inferenceRequestSent, null); assert.equal(r.spawns, 1);
  }
});

test('Runner diagnostics: empty or unrecognized stderr never invents a pre-inference cause', async () => {
  for (const text of ['', 'opaque diagnostic with unknown-secret-value']) {
    const r = await processFixture({ stderr: [text] }); const d = r.receipt.diagnostics;
    assert.equal(d.classification, 'ROOT_CAUSE_UNDETERMINED'); assert.equal(d.stderrBytes, Buffer.byteLength(text));
    assert.equal(d.preInference.state, 'NO_JSON_EVENTS'); assert.equal(d.preInference.inferenceRequestSent, null);
    assert.doesNotMatch(JSON.stringify(d), /unknown-secret-value/); assert.equal(d.messages.length, 0);
  }
});

test('Runner diagnostics: non-JSON stdout and fragmented stderr are diagnosed, raw text is omitted', async () => {
  const r = await processFixture({ stdout: ['error: unexpected argument secret-argument\n'], stderr: ['missing fi', 'eld `name` in secret-config'] });
  assert.equal(r.receipt.diagnostics.nonJsonStdoutLines, 1); assert.equal(r.receipt.diagnostics.jsonEvents, 0);
  assert.equal(r.receipt.diagnostics.messages.length, 2);
  assert.doesNotMatch(JSON.stringify(r.receipt.diagnostics), /secret-argument|secret-config/);
});

test('Runner diagnostics: process spawn errors differ from CLI exit; timeout is recorded without retry', async () => {
  for (const scenario of [{ throwSpawn: true }, { spawnError: true }, { processError: true }, { timeout: true }]) {
    const r = await processFixture(scenario); const d = r.receipt.diagnostics;
    assert.equal(r.spawns, 1); assert.equal(r.succeeded, false);
    if (scenario.timeout) { assert.equal(r.stops, 1); assert.equal(d.classification, 'TIMEOUT'); assert.equal(d.signal, 'SIGTERM'); }
    else if (scenario.processError) { assert.equal(d.classification, 'PROCESS_FAILURE'); assert.equal(d.preInference.inferenceRequestSent, null); }
    else { assert.equal(d.classification, 'SPAWN_FAILURE'); assert.equal(d.preInference.state, 'SPAWN_FAILED'); assert.equal(d.preInference.inferenceRequestSent, false); }
  }
});

test('Runner diagnostics: JSON startup errors, session-only events and malformed successful output stay blocked', async () => {
  const error = await processFixture({ stdout: [JSON.stringify({ type: 'error', message: 'model not found; key=private-value' })] });
  assert.equal(error.receipt.diagnostics.classification, 'MODEL_ACCESS'); assert.equal(error.receipt.diagnostics.jsonEvents, 1);
  assert.doesNotMatch(JSON.stringify(error.receipt.diagnostics), /private-value/);
  const session = await processFixture({ stdout: [JSON.stringify({ type: 'thread.started', thread_id: 'fixture-thread' }) + '\n'], code: 0 });
  assert.equal(session.receipt.diagnostics.preInference.state, 'SESSION_ONLY_NO_TURN_EVENT');
  assert.equal(session.receipt.diagnostics.classification, 'RUNNER_PARSER_OR_CONTROL'); assert.equal(session.succeeded, false);
  const malformed = await processFixture({ stdout: [JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command: 123 } }) + '\n'] });
  assert.equal(malformed.succeeded, false); assert.equal(malformed.receipt.diagnostics.stopReason, 'MALFORMED_EVENT');
});

test('Runner diagnostics: launch uses actual spawnargs and never retains arbitrary config, prompt or environment', async () => {
  const r = await processFixture({ readOnly: true });
  assert.equal(r.receipt.diagnostics.launch.source, 'child.spawnargs'); assert.equal(r.receipt.diagnostics.launch.sandbox, 'read-only');
  const known = { entry: 'entry', workspace: 'repo', schema: 'schema', output: 'out' };
  const launch = safeLaunch('node', ['entry', 'exec', '-c', 'api_key=private-value', '--unknown=other-secret', '--model', 'sk-secret', '--cd', 'unexpected-secret-path'], known, 'test-double');
  assert.doesNotMatch(JSON.stringify(launch), /private-value|other-secret|sk-secret|unexpected-secret-path/);
  assert.equal(launch.stdinRetained, false); assert.equal(launch.environmentRetained, false);
});

test('Minimal smoke real executor wiring keeps read-only receipt and blocks missing actual identity without another call', async () => {
  const r = await processFixture({ smoke: true, stdout: [JSON.stringify({ type: 'thread.started', thread_id: 'fixture' }) + '\n'], code: 0, output: { ok: true } });
  assert.equal(r.spawns, 1); assert.equal(r.succeeded, false); assert.equal(r.receipt.sandbox, 'read-only');
  assert.equal(r.receipt.diagnostics.launch.sandbox, 'read-only');
  assert.equal(r.receipt.diagnostics.launch.args.some(a => a.includes('model_providers.')), false);
  assert.equal(r.receipt.diagnostics.classification, 'RUNNER_RESULT_VALIDATION');
});

test('Runner diagnostics: diagnostics are bounded and do not inspect model/tool text', () => {
  const d = processDiagnostics({});
  d.stderr(Buffer.from('x'.repeat(20000) + 'api_key=secret\n'));
  d.stderr(Buffer.from('Error loading config\n'));
  d.event({ type: 'item.completed', item: { type: 'agent_message', text: 'authentication failed; secret' } });
  d.finish(1, null);
  assert.equal(d.value.truncated, true); assert.equal(d.value.messages.length, 1);
  assert.equal(d.value.omissions[0].reason, 'STDERR_LINE_EXCEEDS_SAFE_BUFFER_LIMIT');
  assert.ok(d.value.omissions[0].observedBytesAtLeast >= 4096); assert.equal('bytes' in d.value.omissions[0], false);
  assert.equal(d.value.classification, 'CLI_CONFIGURATION'); assert.doesNotMatch(JSON.stringify(d.value), /api_key|secret/);
  assert.ok(JSON.stringify(d.value).length < 2000);
});

test('Runner diagnostics: an unterminated final reroute event cannot bypass result rejection', async () => {
  const events = [{ type: 'thread.started', thread_id: 'fixture', model: luna }, { type: 'turn.completed', usage: { input_tokens: 1, output_tokens: 1 } }];
  const r = await processFixture({ stdout: [events.map(e => JSON.stringify(e)).join('\n') + '\n', JSON.stringify({ type: 'model.rerouted' })], code: 0, output: { ok: true } });
  assert.equal(r.succeeded, false); assert.equal(r.receipt.diagnostics.stopReason, 'MODEL_EVENT_REJECTED');
  assert.equal(r.receipt.diagnostics.preInference.state, 'TURN_EVENT_OBSERVED');
});

test('Runner diagnostics: zero exit and valid output do not hide unverified actual model identity', async () => {
  const r = await processFixture({ stdout: [JSON.stringify({ type: 'thread.started', thread_id: 'fixture' }) + '\n'], code: 0, output: { ok: true } });
  assert.equal(r.succeeded, false); assert.equal(r.receipt.actualModel, null);
  assert.equal(r.receipt.diagnostics.classification, 'RUNNER_RESULT_VALIDATION');
  assert.equal(r.receipt.diagnostics.resultValidation, 'ACTUAL_MODEL_UNVERIFIED');
});

test('Smoke guard: version-pinned JSONL supports observational item.updated without logging text', async () => {
  const events = [
    { type: 'thread.started', thread_id: 'fixture', model: luna, reasoning_effort: 'low' },
    { type: 'turn.started' },
    { type: 'item.started', item: { id: 'i1', type: 'reasoning', text: 'PRIVATE_REASONING_TEXT' } },
    { type: 'item.updated', item: { id: 'i1', type: 'reasoning', text: 'PRIVATE_REASONING_UPDATE' } },
    { type: 'item.completed', item: { id: 'i2', type: 'agent_message', text: '{"ok":true}' } },
    { type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 3, output_tokens: 2 } }
  ];
  const stream = events.map(e => JSON.stringify(e)).join('\n');
  const r = await processFixture({ smoke: true, stdout: [stream.slice(0, 41), stream.slice(41, 120), stream.slice(120)], code: 0, output: { ok: true } });
  assert.equal(r.succeeded, false); assert.equal(r.receipt.runtimeVerification.verified, true);
  assert.equal(r.receipt.actualModelVerified, false, 'Synthetic extra model fields do not extend the pinned CLI schema');
  assert.equal(r.receipt.unverifiedReportedModel, luna); assert.equal(r.spawns, 1); assert.equal(r.stops, 0);
  assert.equal(r.receipt.diagnostics.smoke.accepted, 6); assert.equal(r.receipt.diagnostics.smoke.rejected, 0);
  assert.equal(r.receipt.diagnostics.smoke.schemaSource, EXEC_SCHEMA_SOURCE);
  assert.doesNotMatch(JSON.stringify(r.receipt.diagnostics.smoke), /PRIVATE_REASONING|fixture|"i1"|"ok"/);
});

test('Smoke guard: error item is a reported CLI error, never counted as a tool or converted to success', async () => {
  const item = { type: 'item.completed', item: { id: 'error-id', type: 'error', message: 'model gpt-5.6-luna not supported; api_key=DO_NOT_LOG_THIS' } };
  const r = await processFixture({ smoke: true, stdout: [JSON.stringify(item) + '\n'], code: 1 });
  assert.equal(r.succeeded, false); assert.equal(r.stops, 1);
  const d = r.receipt.diagnostics, rejection = d.smoke.firstRejection;
  assert.equal(rejection.eventType, 'item.completed'); assert.equal(rejection.itemType, 'error');
  assert.deepEqual(rejection.eventFields, ['item', 'type']); assert.deepEqual(rejection.itemFields, ['id', 'message', 'type']);
  assert.equal(rejection.reason, 'REPORTED_CLI_ERROR_ITEM'); assert.equal(d.smoke.rejectedToolItems, 0);
  assert.equal(d.classification, 'MODEL_ACCESS'); assert.equal(d.exitCode, 1);
  assert.equal(d.safeErrorDetails[0].mentionedModels[0], luna); assert.equal(d.safeErrorDetails[0].identityEvidence, false);
  assert.doesNotMatch(JSON.stringify(d), /DO_NOT_LOG_THIS|error-id/);
});

const supportedSmokeEvents = ({ warning = true, identity = false } = {}) => [
  { type: 'thread.started', thread_id: 'fake-cli-thread', ...(identity ? { model: luna, reasoning_effort: 'low' } : {}) },
  { type: 'turn.started' },
  ...(warning ? [{ type: 'item.completed', item: { id: 'w', type: 'error', message: SKILL_DESCRIPTION_TRUNCATED_WARNING } }] : []),
  { type: 'item.completed', item: { id: 'answer', type: 'agent_message', text: '{"ok":true}' } },
  { type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 4, output_tokens: 2 } }
];
test('Exact source warning passes as NONFATAL_WARNING without retaining message, length heuristics or raw text', async () => {
  const r = await processFixture({ smoke: true, stdout: [supportedSmokeEvents().map(e => JSON.stringify(e)).join('\n') + '\n'], code: 0, output: { ok: true } });
  assert.equal(r.stops, 0); assert.equal(r.receipt.diagnostics.smoke.nonfatalWarnings, 1);
  assert.equal(r.receipt.diagnostics.smoke.records[2].reason, 'NONFATAL_WARNING');
  assert.equal(r.receipt.diagnostics.smoke.records[2].warningCode, 'SKILL_DESCRIPTION_TRUNCATED_WARNING');
  assert.doesNotMatch(JSON.stringify(r.receipt.diagnostics), /Skill descriptions were shortened/);
  assert.equal(r.receipt.runtimeVerification.verified, true);
  assert.equal(r.succeeded, false, 'Runtime criteria do not grant an alternative model-identity policy');
  assert.equal(r.receipt.requestedModel, luna); assert.equal(r.receipt.catalogVerifiedModel, luna);
  assert.equal(r.receipt.actualModel, null); assert.equal(r.receipt.actualModelVerified, false);
  assert.equal(EXEC_IDENTITY_CAPABILITY.supportedActualModelEvent, null);
  assert.match(r.error.message, /Actual model identity/);
});
test('Near warnings, same-length substitutions, added text and malformed warning envelopes fail closed', () => {
  for (const message of [SKILL_DESCRIPTION_TRUNCATED_WARNING.replace('Skill', 'skill'), SKILL_DESCRIPTION_TRUNCATED_WARNING + ' ', ' ' + SKILL_DESCRIPTION_TRUNCATED_WARNING, SKILL_DESCRIPTION_TRUNCATED_WARNING.replace('skills', 'models'), 'x'.repeat(201), 'model rerouted: luna -> sol']) {
    const g = createSmokeEventGuard(); const r = g.inspect({ type: 'item.completed', item: { id: 'w', type: 'error', message } });
    assert.equal(r.action, 'reject'); assert.equal(g.state.nonfatalWarnings, 0);
  }
  for (const e of [
    { type: 'error', message: SKILL_DESCRIPTION_TRUNCATED_WARNING },
    { type: 'item.updated', item: { id: 'w', type: 'error', message: SKILL_DESCRIPTION_TRUNCATED_WARNING } },
    { type: 'item.completed', item: { id: 'w', type: 'error', message: SKILL_DESCRIPTION_TRUNCATED_WARNING, command: 'write' } }
  ]) assert.equal(createSmokeEventGuard().inspect(e).action, 'reject');
});
test('An exact warning does not exempt later reroute, tools, writes, delegation or malformed stream', async () => {
  const warning = JSON.stringify(supportedSmokeEvents()[2]) + '\n';
  for (const last of [
    JSON.stringify({ type: 'item.completed', item: { id: 'r', type: 'error', message: 'model rerouted: gpt-5.6-luna -> gpt-5.6-sol' } }),
    ...['command_execution', 'file_change', 'collab_tool_call'].map(type => JSON.stringify({ type: 'item.started', item: { id: 'x', type } })),
    '{broken'
  ]) {
    const r = await processFixture({ smoke: true, stdout: [warning + last + '\n'], code: 0, output: { ok: true } });
    assert.equal(r.succeeded, false); assert.equal(r.stops, 1); assert.equal(r.receipt.diagnostics.smoke.nonfatalWarnings, 1); assert.equal(r.receipt.diagnostics.smoke.rejected, 1);
  }
});
test('Stderr remains an independent gate after a recognized warning, even with valid completed output and exit zero', async () => {
  for (const [text, category] of [['Error loading config\n', 'CLI_CONFIGURATION'], ['Failed to initialize sandbox\n', 'SANDBOX'], ['unexpected argument --secret-value\n', 'CLI_ARGUMENT'], ['opaque stderr\n', 'STDERR_UNCLASSIFIED']]) {
    const r = await processFixture({ smoke: true, stdout: [supportedSmokeEvents({ identity: true }).map(e => JSON.stringify(e)).join('\n') + '\n'], stderr: [text], code: 0, output: { ok: true } });
    assert.equal(r.succeeded, false); assert.equal(r.receipt.runtimeVerification.criteria.stderrAccepted, false);
    assert.equal(r.receipt.diagnostics.classification, category); assert.equal(r.receipt.diagnostics.smoke.nonfatalWarnings, 1);
  }
});
test('Runtime evidence requires completed turn, structured schema, valid usage and zero exit independently of identity', async () => {
  const stream = events => events.map(e => JSON.stringify(e)).join('\n') + '\n';
  for (const scenario of [
    { stdout: [stream(supportedSmokeEvents({ identity: true }).slice(0, -1))], output: { ok: true }, code: 0 },
    { stdout: [stream(supportedSmokeEvents({ identity: true }))], output: { ok: false }, code: 0 },
    { stdout: [stream(supportedSmokeEvents({ identity: true }))], output: { ok: true }, code: 1 },
    { stdout: [stream([...supportedSmokeEvents({ identity: true }).slice(0, -1), { type: 'turn.completed', usage: { input_tokens: 1, cached_input_tokens: 2, output_tokens: 0 } }])], output: { ok: true }, code: 0 }
  ]) { const r = await processFixture({ smoke: true, ...scenario }); assert.equal(r.succeeded, false); assert.equal(r.receipt.runtimeVerification.verified, false); }
});

test('Smoke guard: unknown events/items retain only bounded shape and explicit rejection reason', async () => {
  for (const [event, reason] of [
    [{ type: 'future.notice', payload: 'PRIVATE_PAYLOAD' }, 'UNKNOWN_EVENT_TYPE'],
    [{ type: 'item.updated', item: { id: 'private-id', type: 'future_item', data: 'PRIVATE_PAYLOAD' } }, 'UNKNOWN_ITEM_TYPE']
  ]) {
    const r = await processFixture({ smoke: true, stdout: [JSON.stringify(event) + '\n'], code: 1 });
    const d = r.receipt.diagnostics;
    assert.equal(r.succeeded, false); assert.equal(r.spawns, 1); assert.equal(r.stops, 1);
    assert.equal(d.smoke.firstRejection.reason, reason); assert.equal(d.smoke.firstRejection.eventType, event.type);
    assert.equal(d.smoke.firstRejection.payloadRetained, false); assert.equal(d.smoke.rejectedToolItems, 0);
    assert.doesNotMatch(JSON.stringify(d), /PRIVATE_PAYLOAD|private-id/);
  }
});

test('Smoke guard: tool/write/delegation and plan items stay denied at every item lifecycle stage', () => {
  for (const type of ['command_execution', 'file_change', 'mcp_tool_call', 'collab_tool_call', 'web_search', 'todo_list']) {
    for (const stage of ['item.started', 'item.updated', 'item.completed']) {
      const guard = createSmokeEventGuard(); const decision = guard.inspect({ type: stage, item: { id: 'test', type, command: 'PRIVATE_COMMAND' } });
      assert.equal(decision.action, 'reject'); assert.equal(decision.reason, type === 'todo_list' ? 'DISALLOWED_PLAN_ITEM' : 'DISALLOWED_TOOL_OR_WRITE_ITEM');
      assert.doesNotMatch(JSON.stringify(guard.state), /PRIVATE_COMMAND/);
    }
  }
});

test('Smoke guard: malformed JSON, incomplete items and malformed usage fail closed with metadata', async () => {
  for (const [line, reason] of [
    ['{"type":"item.completed",PRIVATE_BROKEN_JSON', 'MALFORMED_JSON'],
    ['[]', 'MALFORMED_EVENT_ENVELOPE'],
    [JSON.stringify({ type: 'item.completed', item: { type: 'agent_message' } }), 'MALFORMED_ITEM_ENVELOPE'],
    [JSON.stringify({ type: 'turn.completed', usage: { input_tokens: -1 } }), 'MALFORMED_USAGE_EVENT']
  ]) {
    const r = await processFixture({ smoke: true, stdout: [line], code: 1 });
    assert.equal(r.succeeded, false); assert.equal(r.receipt.diagnostics.smoke.firstRejection.reason, reason);
    assert.doesNotMatch(JSON.stringify(r.receipt.diagnostics), /PRIVATE_BROKEN_JSON/);
  }
});

test('Smoke guard: repeated errors request one stop and preserve the first cause across exit code 1', async () => {
  const events = [{ type: 'error', message: 'Authentication failed' }, { type: 'turn.failed', error: { message: 'opaque-private-value' } }];
  const r = await processFixture({ smoke: true, stdout: [events.map(e => JSON.stringify(e)).join('\n') + '\n'], code: 1 });
  assert.equal(r.spawns, 1); assert.equal(r.stops, 1); assert.equal(r.receipt.diagnostics.exitCode, 1);
  assert.equal(r.receipt.diagnostics.smoke.firstRejection.eventType, 'error');
  assert.equal(r.receipt.diagnostics.classification, 'AUTHENTICATION');
  assert.doesNotMatch(JSON.stringify(r.receipt.diagnostics), /opaque-private-value/);
});

test('Smoke diagnostics: unknown stderr explains omission and projects safe status/code without raw tokens', () => {
  const d = processDiagnostics({});
  d.stderr(Buffer.from('opaque error HTTP 403 unsupported_value gpt-5.6-luna access_token=PRIVATE_ACCESS\n'));
  d.stderr(Buffer.from('Authorization: Bea')); d.stderr(Buffer.from('rer PRIVATE_BEARER\n'));
  d.finish(1, null);
  assert.equal(d.value.safeErrorDetails[0].httpStatus, 403); assert.equal(d.value.safeErrorDetails[0].errorCode, 'unsupported_value');
  assert.equal(d.value.omissions.length, 2); assert.equal(d.value.omissions[0].reason, 'UNRECOGNIZED_TEXT_CANNOT_BE_SAFELY_PERSISTED');
  assert.equal(d.value.omissions[1].sensitivePatternDetected, true); assert.equal(d.value.classification, 'ROOT_CAUSE_UNDETERMINED');
  assert.doesNotMatch(JSON.stringify(d.value), /PRIVATE_ACCESS|PRIVATE_BEARER|access_token=/);
});

test('Smoke diagnostics: unsafe type/key labels and large streams cannot leak payload or grow logs without bound', () => {
  const guard = createSmokeEventGuard();
  const decision = guard.inspect({ type: 'sk-proj-PRIVATE_TYPE', 'sk-proj-PRIVATE_KEY': 'PRIVATE_VALUE', item: { type: 'Bearer PRIVATE_ITEM' } });
  assert.equal(decision.eventType, '[REDACTED_IDENTIFIER]'); assert.equal(decision.itemType, '[REDACTED_IDENTIFIER]');
  for (let i = 0; i < 100; i++) guard.inspect({ type: 'future.notice', payload: 'PRIVATE_VALUE' });
  assert.equal(guard.state.records.length, 32); assert.equal(guard.state.omittedRecords, 69);
  assert.doesNotMatch(JSON.stringify(guard.state), /PRIVATE_TYPE|PRIVATE_KEY|PRIVATE_ITEM|PRIVATE_VALUE/);
  const d = processDiagnostics({}); for (let i = 0; i < 20; i++) d.stderr(Buffer.from('unknown PRIVATE_TEXT\n'));
  d.finish(1, null); assert.equal(d.value.omissions.length, 8); assert.equal(d.value.omittedDiagnosticRecords, 12);
  assert.doesNotMatch(JSON.stringify(d.value), /PRIVATE_TEXT/);
});
