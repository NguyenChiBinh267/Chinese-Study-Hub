import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { runCodex, writeJson, readJson } from './io.mjs';
import { readAssuranceDecision, assuranceBinding, verifyRoutingAssurance } from './model-assurance.mjs';
import { selectModel } from './model-routing.mjs';
import { classifySafeStderr, stderrAccepted } from './stderr-policy.mjs';
import { processDiagnostics } from './diagnostics.mjs';
import { createSmokeEventGuard } from './smoke-events.mjs';
import { SKILL_DESCRIPTION_TRUNCATED_WARNING } from './cli-exec-contract.mjs';

const tool = path.dirname(fileURLToPath(import.meta.url));
const safeLine = '2026-10-16T17:42:38.123456Z  WARN codex_core::shell_snapshot: Failed to create shell snapshot for powershell: Shell snapshot not supported yet for PowerShell\n';
const metadata = () => ({ cliVersion: '0.153.4', checkedAt: new Date().toISOString(), accountType: 'chatgpt', catalogueComplete: true,
  models: [{ model: 'gpt-5.6-luna', hidden: false, supportedReasoningEfforts: ['low', 'medium'], availabilityNux: null }],
  rateLimitsByLimitId: { codex: { credits: { hasCredits: false, unlimited: false, balance: '0' }, spendControlReached: false,
    rateLimitReachedType: null, primary: { usedPercent: 30, resetsAt: Math.floor(Date.now() / 1000) + 600, windowDurationMins: 300 } } } });
const events = () => [{ type: 'thread.started', thread_id: 'fake-fresh-session' }, { type: 'turn.started' },
  { type: 'item.completed', item: { id: 'result', type: 'agent_message', text: '{"ok":true}' } },
  { type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 3, output_tokens: 2 } }];

// The real orchestrator process runner is used with fake child streams only.
async function fixture(s = {}) {
  const parent = path.resolve(tool, '../../.engineering-loop/assurance-tests'); fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'run-'));
  const policyDir = path.join(root, 'tools/engineering-loop'); fs.mkdirSync(policyDir, { recursive: true });
  fs.copyFileSync(path.join(tool, 'model-assurance-policy.json'), path.join(policyDir, 'model-assurance-policy.json'));
  writeJson(path.join(root, '.engineering-loop/config.json'), { repository: 'NguyenChiBinh267/Chinese-Study-Hub' });
  const options = { root, workspace: root, role: s.role ?? 'developer', schema: path.join(root, 'schema.json'), output: path.join(root, 'out.json'),
    timeoutMs: 1000, prompt: 'MOCK_ONLY', routingContext: { task: { id: 'T004', spec: ['Document a small UI help flow'] },
      policy: { allowedFiles: ['docs/help.md'] }, state: { runId: 'mock', taskId: 'T004', commitSha: 'a'.repeat(40), sourceCommit: 'b'.repeat(40), repairs: s.repairs ?? 0 } } };
  writeJson(options.schema, { type: 'object', properties: { ok: { type: 'boolean', const: true } }, required: ['ok'], additionalProperties: false });
  let spawns = 0, metadataCalls = 0, promptBytes = 0, stopped = 0;
  const fake = { entrypoint: () => 'mock-entry', stop: child => { stopped++; queueMicrotask(() => child.emit('close', null, 'SIGTERM')); },
    spawn(executable, args, spawnOptions) {
      spawns++;
      assert.equal(Object.keys(spawnOptions.env).some(k => /API_KEY|^OPENAI_/i.test(k)), false);
      const child = new EventEmitter(); child.pid = 999999; child.spawnargs = [executable, ...args];
      if (s.argv) s.argv(child.spawnargs);
      child.stdout = new PassThrough(); child.stderr = new PassThrough();
      child.stdin = new Writable({ write(chunk, _enc, cb) { promptBytes += chunk.length; cb(); }, final(cb) {
        cb(); queueMicrotask(() => {
          if (s.changeContext) options.routingContext.state.commitSha = 'c'.repeat(40);
          if (s.changeDecision) writeJson(path.join(policyDir, 'model-assurance-policy.json'), { ownerApproved: false });
          for (const e of s.events ?? events()) child.stdout.write(typeof e === 'string' ? e : JSON.stringify(e) + '\n');
          if (s.stderr) child.stderr.write(s.stderr);
          writeJson(options.output, s.output ?? { ok: true }); child.emit('close', s.exit ?? 0, null);
        });
      } });
      return child;
    } };
  let value, error;
  try {
    value = await runCodex(options, { process: fake, metadata: async () => {
      const m = metadata(); metadataCalls++; s.metadata?.(m, metadataCalls); return m;
    } });
  } catch (e) { error = e; }
  const budgets = path.join(root, '.engineering-loop/model-budgets');
  const ledger = fs.existsSync(budgets) ? fs.readdirSync(budgets).filter(x => x.endsWith('.json')).map(x => readJson(path.join(budgets, x))) : [];
  assert.ok(path.resolve(root).startsWith(parent + path.sep)); fs.rmSync(root, { recursive: true, force: true });
  return { value, error, receipt: value?.receipt ?? error?.receipt, spawns, metadataCalls, promptBytes, stopped, ledger, context: options.routingContext };
}

test('Approved routing assurance accepts a complete mock receipt without inventing actual identity', async () => {
  for (const role of ['developer', 'reviewer']) {
    const r = await fixture({ role, stderr: safeLine }); assert.ifError(r.error);
    assert.equal(r.spawns, 1); assert.equal(r.metadataCalls, 2);
    assert.equal(r.receipt.routingAssuranceVerified, true); assert.equal(r.receipt.actualModelVerified, false); assert.equal(r.receipt.actualModel, null);
    assert.equal(r.receipt.runtimeVerification.verified, true); assert.equal(r.receipt.quotaBefore.quotaScope, 'shared-account');
    assert.equal(r.receipt.sandbox, role === 'reviewer' ? 'read-only' : 'workspace-write');
    assert.equal(r.receipt.usage.totalTokens, 12); assert.equal(r.ledger[0].attempts[0].status, 'COMPLETED');
    assert.equal(JSON.stringify(r.receipt).includes('Failed to create shell snapshot'), false);
  }
});

test('Alternative assurance fails before dispatch for version/catalog/auth/quota or repair violations', async () => {
  const changes = [m => { m.cliVersion = '0.154.0'; }, m => { m.models = []; }, m => { m.models[0].supportedReasoningEfforts = ['high']; },
    m => { m.accountType = 'apiKey'; }, m => { m.rateLimitsByLimitId.codex.credits.hasCredits = true; },
    m => { m.rateLimitsByLimitId.codex.primary.usedPercent = 80; }, m => { m.checkedAt = '2020-01-01'; }];
  for (const metadata of changes) { const r = await fixture({ metadata }); assert.ok(r.error); assert.equal(r.spawns, 0); }
  const r = await fixture({ repairs: 3 }); assert.ok(r.error); assert.equal(r.spawns, 0);
});

test('Observed argv model/effort/sandbox mismatch withholds prompt, no retry or fallback', async () => {
  for (const [key, value] of [['--model', 'gpt-6-astra'], ['--sandbox', 'workspace-write'], ['-c', 'model_reasoning_effort="high"']]) {
    const r = await fixture({ role: 'reviewer', argv: args => { args[args.indexOf(key) + 1] = value; } });
    assert.ok(r.error); assert.equal(r.receipt.routingAssuranceVerified, false); assert.equal(r.spawns, 1); assert.equal(r.promptBytes, 0);
    assert.equal(r.receipt.diagnostics.stopReason, 'ARGV_MISMATCH'); assert.equal(r.ledger[0].attempts[0].status, 'BLOCKED');
  }
});

test('Unknown stderr, errors/reroutes, malformed stream, writes and delegation cannot verify assurance', async () => {
  const badEvents = [{ type: 'error', message: 'unapproved error' }, { type: 'model.rerouted' },
    { type: 'item.completed', item: { id: 'x', type: 'error', message: 'Rerouted to another model' } },
    { type: 'item.completed', item: { id: 'x', type: 'file_change', changes: [] } },
    { type: 'item.completed', item: { id: 'x', type: 'collab_tool_call' } }, 'not-json\n'];
  for (const e of badEvents) {
    const r = await fixture({ role: 'reviewer', events: [events()[0], e, ...events().slice(1)] });
    assert.ok(r.error); assert.equal(r.spawns, 1); assert.equal(r.receipt.routingAssuranceVerified, false);
    assert.equal(r.receipt.diagnostics.routingEvents.rejected > 0, true);
  }
  for (const stderr of ['unknown stderr\n', safeLine + 'Failed to initialize sandbox\n']) {
    const stream = events(); stream[0].model = 'gpt-5.6-luna';
    const r = await fixture({ stderr, events: stream }); assert.ok(r.error); assert.equal(r.receipt.runtimeVerification.criteria.stderrAccepted, false);
    assert.equal(r.receipt.actualModel, null); assert.equal(r.receipt.actualModelVerified, false);
    assert.equal(r.receipt.unverifiedReportedModel, 'gpt-5.6-luna');
  }
});

test('Completion/output/usage/exit, after-quota/version and HEAD/policy drift all fail closed', async () => {
  const cases = [{ events: events().slice(0, -1) }, { events: [...events().slice(0, -1), { type: 'turn.completed', usage: { input_tokens: -1 } }] },
    { output: { ok: false } }, { exit: 1 }, { changeContext: true }, { changeDecision: true },
    { metadata: (m, n) => { if (n === 2) m.cliVersion = '0.154.0'; } },
    { metadata: (m, n) => { if (n === 2) m.rateLimitsByLimitId.codex.primary.usedPercent = 80; } }];
  for (const s of cases) { const r = await fixture(s); assert.ok(r.error); assert.equal(r.spawns, 1); assert.equal(r.receipt.routingAssuranceVerified, false); }
});

test('Stderr exact source match only; lossily projected historical evidence stays unclassified', () => {
  assert.ok(classifySafeStderr(safeLine));
  for (const line of [safeLine.replace('PowerShell', 'Cmd'), safeLine.replace('WARN', 'ERROR'), safeLine + 'secret', safeLine.replace('yet', 'now'),
    '[redacted] failed to [redacted] not supported [redacted]', 'x'.repeat(158)]) assert.equal(classifySafeStderr(line), null);
  const d = processDiagnostics({}); d.stderr(Buffer.from(safeLine)); assert.equal(stderrAccepted(d.value), false);
  d.finish(0); assert.equal(stderrAccepted(d.value), true);
  assert.equal(stderrAccepted({ stderrBytes: 158 }), false);
  const bad = processDiagnostics({}); bad.stderr(Buffer.from(safeLine + 'error loading config\n')); bad.finish(0);
  assert.equal(stderrAccepted(bad.value), false); assert.equal(bad.value.messages[0].category, 'CLI_CONFIGURATION');
});

test('Task event guard preserves exact warning and sandboxed reads while blocking errors and reviewer writes', () => {
  const g = createSmokeEventGuard({ taskRole: 'reviewer' });
  assert.equal(g.inspect({ type: 'item.completed', item: { id: 'w', type: 'error', message: SKILL_DESCRIPTION_TRUNCATED_WARNING } }).action, 'accept');
  assert.equal(g.inspect({ type: 'item.completed', item: { id: 'r', type: 'command_execution', command: 'read', aggregated_output: '', exit_code: 0, status: 'completed' } }).action, 'accept');
  assert.equal(g.inspect({ type: 'item.completed', item: { id: 'bad', type: 'command_execution' } }).action, 'reject');
  assert.equal(g.inspect({ type: 'item.completed', item: { id: 'w', type: 'file_change' } }).action, 'reject');
});

test('Owner decision is repository-bound; drift cannot silently restore a weaker mode', () => {
  assert.equal(readAssuranceDecision(path.resolve(tool, '../..'), 'NguyenChiBinh267/Chinese-Study-Hub').ownerApproved, true);
  assert.throws(() => readAssuranceDecision(path.resolve(tool, '../..'), 'another/repo'), /drift/);
});

test('Quota freshness is checked at dispatch and completion respectively, including long tasks', async () => {
  const r = await fixture(); assert.ifError(r.error);
  const now = Date.now(), past = new Date(now - 120000).toISOString();
  r.receipt.startedAt = past; r.receipt.quotaBefore.checkedAt = past;
  const decision = readAssuranceDecision(path.resolve(tool, '../..'), 'NguyenChiBinh267/Chinese-Study-Hub');
  const input = { decision, route: selectModel(r.context, 'developer', {}, metadata()), receipt: r.receipt, budget: r.ledger[0], context: r.context,
    binding: assuranceBinding(r.context), currentBinding: assuranceBinding(r.context), expectedArgs: r.receipt.diagnostics.launch.args, decisionUnchanged: true, at: now };
  assert.equal(verifyRoutingAssurance(input).verified, true);
  r.receipt.quotaBefore.checkedAt = new Date(now - 181000).toISOString();
  assert.equal(verifyRoutingAssurance(input).checks.freshQuotaReserve, false);
  r.receipt.quotaBefore.checkedAt = past; r.receipt.quotaAfter.checkedAt = past;
  assert.equal(verifyRoutingAssurance(input).checks.freshQuotaReserve, false);
});
