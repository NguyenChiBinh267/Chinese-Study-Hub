import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { selectModel as routeModel, supportedModel, selectedQuota, consumeModelBudget, observeModelEvent } from './model-routing.mjs';
import { runCodex, codexArguments, writeJson, readJson, git } from './io.mjs';
import { localReview, reviewPlan } from './reviewer.mjs';
import { hash } from './core.mjs';

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
