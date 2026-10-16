import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { requireThat, hash } from './core.mjs';
import { selectModel, selectedQuota, consumeModelBudget, observeModelEvent } from './model-routing.mjs';
import { safeLaunch, processDiagnostics } from './diagnostics.mjs';

// Absolute authorization boundary inherited by the controller. Checkpoint JSON remains
// writable after expiry so interrupted work can be inspected without replay.
export function remainingTime(limit, at = Date.now()) {
  const value = process.env.ENGINEERING_LOOP_DEADLINE;
  if (value === undefined) return limit;
  const deadline = Number(value);
  if (!Number.isFinite(deadline) || deadline <= at) {
    const error = new Error('Authorized deadline reached; preserve checkpoint');
    error.code = 'AUTHORIZATION_EXPIRED'; throw error;
  }
  return Math.min(limit, deadline - at);
}

export function deadlineTimer(limit, stop) {
  // Expiry between spawn and timer installation must cancel, not orphan the child.
  try { return setTimeout(stop, remainingTime(limit)); }
  catch { return setTimeout(stop, 0); }
}

export function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temp, file);
}
export function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
export function lock(directory, stateFile) {
  fs.mkdirSync(path.dirname(directory), { recursive: true });
  try { fs.mkdirSync(directory); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const ownerFile = path.join(directory, 'owner.json');
    requireThat(fs.existsSync(ownerFile), 'Incomplete lock; inspect it before recovery');
    const owner = readJson(ownerFile), state = fs.existsSync(stateFile) ? readJson(stateFile) : null;
    const smokeFile = path.join(path.dirname(stateFile), 'smoke-writer.json');
    const smoke = fs.existsSync(smokeFile) ? readJson(smokeFile) : null;
    requireThat(owner.host === os.hostname() && !alive(owner.pid) && !(state?.writerPid && alive(state.writerPid)) && !(state?.reviewerPid && alive(state.reviewerPid)) && !(smoke?.writerPid && alive(smoke.writerPid)), 'Another orchestrator or Codex process is active');
    fs.unlinkSync(ownerFile); fs.rmdirSync(directory); fs.mkdirSync(directory);
  }
  writeJson(path.join(directory, 'owner.json'), { pid: process.pid, host: os.hostname(), at: new Date().toISOString() });
  return () => { fs.unlinkSync(path.join(directory, 'owner.json')); fs.rmdirSync(directory); };
}
export function command(executable, args, cwd, options = {}) {
  const timeout = remainingTime(options.timeout ?? 30000);
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', windowsHide: true,
    timeout: 30000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' }, ...options, timeout });
  if (result.status !== 0) {
    const error = new Error(`${path.basename(executable)} failed (exit ${result.status ?? result.error?.code ?? 'unknown'})`);
    if (path.basename(executable).toLowerCase() === 'git' && /Could not resolve host|Connection (?:reset|timed out)|Failed to connect|remote end hung up|Operation timed out/i.test(result.stderr ?? '')) error.code = 'TRANSIENT_TRANSPORT';
    throw error;
  }
  return result.stdout.trimEnd();
}
export const git = (cwd, ...args) => command('git', args, cwd);
function metadataDigest(configPath, hooksPath) {
  const hooks = fs.existsSync(hooksPath) ? fs.readdirSync(hooksPath, { withFileTypes: true }).map(entry => {
    const file = path.join(hooksPath, entry.name);
    return { name: entry.name, kind: entry.isSymbolicLink() ? 'link' : entry.isFile() ? 'file' : 'other',
      hash: entry.isSymbolicLink() ? hash(fs.readlinkSync(file)) : entry.isFile() ? hash(fs.readFileSync(file)) : null };
  }).sort((a, b) => a.name.localeCompare(b.name)) : [];
  return hash(JSON.stringify({ config: fs.existsSync(configPath) ? hash(fs.readFileSync(configPath)) : null, hooks }));
}
export function captureGitMetadata(repo) {
  const configPath = path.resolve(repo, git(repo, 'rev-parse', '--git-path', 'config'));
  const hooksPath = path.resolve(repo, git(repo, 'rev-parse', '--git-path', 'hooks'));
  return { configPath, hooksPath, digest: metadataDigest(configPath, hooksPath) };
}
export function verifyGitMetadata(receipt) {
  requireThat(receipt && metadataDigest(receipt.configPath, receipt.hooksPath) === receipt.digest, 'Developer changed Git config/hooks; inspect before controller Git operations');
}

// Credentials stay in memory, are never logged, and are never inherited by Codex.
export class GitHub {
  constructor(root, repository, { transport = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
    requireThat(/^[\w.-]+\/[\w.-]+$/.test(repository), 'Invalid repository');
    this.root = root; this.repository = repository; this.token = null; this.transport = transport; this.wait = wait;
  }
  authenticate() {
    const credentials = command('git', ['credential', 'fill'], this.root,
      { input: 'protocol=https\nhost=github.com\n\n', timeout: 15000 });
    this.token = credentials.match(/^password=(.*)$/m)?.[1];
    requireThat(this.token, 'No existing Git Credential Manager credential; sign in once outside the loop');
  }
  async api(endpoint, method = 'GET', body) {
    remainingTime(30000);
    if (!this.token) this.authenticate();
    requireThat(endpoint.startsWith('/'), 'Invalid GitHub endpoint');
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await this.transport(`https://api.github.com${endpoint}`, { method,
          signal: AbortSignal.timeout(remainingTime(30000)), redirect: 'error', headers: { 'User-Agent': 'Chinese-Study-Hub-loop',
            Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28' }, body: body === undefined ? undefined : JSON.stringify(body) });
      } catch (cause) {
        const error = new Error(`GitHub ${method} transport failed; credentials/content not logged`);
        if (method === 'GET' && ['TypeError', 'TimeoutError', 'AbortError'].includes(cause.name)) {
          if (attempt < 2) { await this.wait(1000 * 2 ** attempt); continue; }
          error.code = 'TRANSIENT_TRANSPORT';
        }
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`GitHub ${method} failed (${response.status}); reconcile before retry`);
        if (method === 'GET' && [408, 429, 500, 502, 503, 504].includes(response.status)) {
          const retrySeconds = Number(response.headers?.get('retry-after'));
          if (attempt < 2 && (!retrySeconds || retrySeconds <= 60)) { await this.wait(Math.max(1000 * 2 ** attempt, retrySeconds > 0 ? retrySeconds * 1000 : 0)); continue; }
          error.code = 'TRANSIENT_TRANSPORT';
        }
        throw error;
      }
      return response.status === 204 ? null : response.json();
    }
  }
  repo(endpoint = '', method = 'GET', body) { return this.api(`/repos/${this.repository}${endpoint}`, method, body); }
  async comments(number) {
    const comments = [];
    for (let page = 1; page <= 20; page++) {
      const batch = await this.repo(`/issues/${number}/comments?per_page=100&page=${page}`);
      comments.push(...batch); if (batch.length < 100) return comments;
    }
    throw new Error('Too many PR comments; review bridge requires manual reconciliation');
  }
  comment(number, body) { return this.repo(`/issues/${number}/comments`, 'POST', { body }); }
}

export function codexEntrypoint(root) {
  const found = command('where.exe', ['codex.cmd'], root).split(/\r?\n/)[0];
  const entry = path.join(path.dirname(found), 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  requireThat(fs.existsSync(entry), 'Cannot resolve official local Codex CLI entrypoint');
  return entry;
}

export function codexEnvironment(input = process.env) {
  const env = { ...input, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' };
  for (const name of Object.keys(env)) if (/TOKEN|SECRET|PASSWORD|API_KEY|^OPENAI_|^ANTHROPIC_|^GH_|^GITHUB_|^GOOGLE_|^AZURE_|^AWS_/i.test(name)) delete env[name];
  return env;
}

export function validateFreeQuota(result, accountType = 'chatgpt') {
  requireThat(accountType === 'chatgpt', 'Only existing ChatGPT account auth is allowed');
  const limits = Object.values(result.rateLimitsByLimitId ?? { codex: result.rateLimits });
  requireThat(limits.length && limits.every(x => x && x.credits?.hasCredits === false && x.credits?.unlimited === false && typeof x.credits?.balance === 'string' && /^0(?:\.0+)?$/.test(x.credits.balance)),
    'Paid credit eligibility unavailable/nonzero; no model call permitted');
  requireThat(limits.every(x => [x.primary, x.secondary].filter(Boolean).length > 0 && [x.primary, x.secondary].filter(Boolean).every(w => Number.isFinite(w.usedPercent) && w.usedPercent >= 0 && w.usedPercent <= 100)), 'Invalid quota evidence; no model call permitted');
  if (limits.some(x => x.rateLimitReachedType || [x.primary, x.secondary].filter(Boolean).some(w => w.usedPercent >= 100))) {
    const exhausted = limits.flatMap(x => [x.primary, x.secondary].filter(Boolean).filter(w => w.usedPercent >= 100));
    const error = new Error('ChatGPT model limit reached; no paid credits, resets or fallback'); error.code = 'QUOTA_EXHAUSTED';
    if (exhausted.length && exhausted.every(w => Number.isFinite(w.resetsAt))) error.retryAt = Math.max(...exhausted.map(w => w.resetsAt)) * 1000;
    throw error;
  }
  requireThat(limits.every(x => [x.primary, x.secondary].filter(Boolean).every(w => 100 - w.usedPercent > 20)), 'QUOTA_RESERVE: preserve at least 20% ordinary account quota');
  return { checkedAt: new Date().toISOString(), scope: 'account-diagnostic-only', modelQuotaVerified: false, chatgptOnly: true, hasCredits: false, balance: '0', ordinaryQuotaAvailable: true,
    resetCreditsUsed: false, methods: ['initialize', 'account/read', 'account/rateLimits/read'] };
}

export async function freeQuota(root) {
  remainingTime(30000);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [codexEntrypoint(root), 'app-server', '--stdio', '-c', 'forced_login_method="chatgpt"', '-c', 'model_provider="openai"'],
      { cwd: root, env: codexEnvironment(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let pending = '', accountType = null, done = false;
    const send = item => child.stdin.write(JSON.stringify(item) + '\n');
    function finish(error, value) {
      if (done) return; done = true; clearTimeout(timer);
      child.stdin.end();
      if (process.platform === 'win32' && child.pid) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else child.kill();
      error ? reject(error) : resolve(value);
    }
    const timer = deadlineTimer(30000, () => finish(new Error('Account quota read timeout or authorized deadline reached; no model call permitted')));
    child.stderr.on('data', () => {});
    child.stdout.on('data', bytes => {
      pending += bytes.toString('utf8'); if (pending.length > 1024 * 1024) return finish(new Error('Oversized account response'));
      let i;
      while ((i = pending.indexOf('\n')) >= 0 && !done) {
        const line = pending.slice(0, i); pending = pending.slice(i + 1);
        try {
          const event = JSON.parse(line);
          if (event.error && [0, 1, 2].includes(event.id)) return finish(new Error('Account quota API failed; no model call permitted'));
          if (event.id === 0) { send({ method: 'initialized', params: {} }); send({ method: 'account/read', id: 1, params: { refreshToken: false } }); }
          if (event.id === 1) { accountType = event.result?.account?.type; send({ method: 'account/rateLimits/read', id: 2 }); }
          if (event.id === 2) { finish(null, validateFreeQuota(event.result, accountType)); }
        } catch (e) { if (e instanceof SyntaxError) continue; finish(e); }
      }
    });
    child.on('error', () => finish(new Error('Account quota process failed')));
    child.on('close', () => { if (!done) finish(new Error('Account quota process closed unexpectedly')); });
    send({ method: 'initialize', id: 0, params: { clientInfo: { name: 'chinese_study_hub_quota_guard', version: '0.2.0' } } });
  });
}

// Metadata-only RPCs: never thread/start, turn/start or a generation request.
export async function readCodexMetadata(root) {
  remainingTime(30000);
  const entry = codexEntrypoint(root);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, 'app-server', '--stdio', '-c', 'forced_login_method="chatgpt"', '-c', 'model_provider="openai"'],
      { cwd: root, env: codexEnvironment(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let pending = '', done = false, pages = 0, pageId = 10;
    const result = { checkedAt: null, accountType: null, models: [], catalogueComplete: false,
      methods: ['initialize', 'account/read', 'model/list', 'account/rateLimits/read'], inferenceCalls: 0 };
    const send = value => child.stdin.write(JSON.stringify(value) + '\n');
    function finish(error) {
      if (done) return; done = true; clearTimeout(timer); child.stdin.end();
      if (process.platform === 'win32' && child.pid) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else child.kill();
      error ? reject(error) : resolve(result);
    }
    const timer = deadlineTimer(30000, () => finish(new Error('CLI metadata timeout; no model call permitted')));
    child.stderr.on('data', () => {});
    child.stdin.on('error', () => finish(new Error('CLI metadata input pipe failed')));
    child.on('error', () => finish(new Error('CLI metadata process failed')));
    child.on('close', () => { if (!done) finish(new Error('CLI metadata process closed unexpectedly')); });
    child.stdout.on('data', bytes => {
      pending += bytes.toString('utf8'); if (pending.length > 1024 * 1024) return finish(new Error('Oversized CLI metadata'));
      let index;
      while ((index = pending.indexOf('\n')) >= 0 && !done) {
        const line = pending.slice(0, index); pending = pending.slice(index + 1);
        try {
          const e = JSON.parse(line);
          if (e.error && Number.isInteger(e.id)) throw new Error('CLI metadata RPC rejected; no model call permitted');
          if (e.id === 0) { send({ method: 'initialized', params: {} }); send({ method: 'account/read', id: 1, params: { refreshToken: false } }); }
          if (e.id === 1) {
            result.accountType = e.result?.account?.type;
            requireThat(result.accountType === 'chatgpt', 'Only existing ChatGPT CLI auth allowed');
            send({ method: 'model/list', id: pageId, params: { includeHidden: false, limit: 100 } });
          }
          if (e.id === pageId) {
            requireThat(++pages <= 20 && Array.isArray(e.result?.data), 'Incomplete CLI model catalogue');
            result.models.push(...e.result.data.map(m => ({ model: m.model, id: m.id, hidden: m.hidden,
              supportedReasoningEfforts: m.supportedReasoningEfforts, availabilityNux: m.availabilityNux ?? null })));
            if (e.result.nextCursor) { pageId++; send({ method: 'model/list', id: pageId, params: { includeHidden: false, limit: 100, cursor: e.result.nextCursor } }); }
            else { result.catalogueComplete = true; send({ method: 'account/rateLimits/read', id: 2 }); }
          }
          if (e.id === 2) {
            const limits = e.result?.rateLimitsByLimitId ?? (e.result?.rateLimits ? { codex: e.result.rateLimits } : null);
            requireThat(limits && Object.keys(limits).length, 'Missing CLI quota metadata');
            result.rateLimitsByLimitId = Object.fromEntries(Object.entries(limits).map(([id, b]) => [id, {
              limitId: b.limitId, primary: b.primary, secondary: b.secondary, credits: b.credits,
              spendControlReached: b.spendControlReached, rateLimitReachedType: b.rateLimitReachedType,
              model: b.model, normalModelSlug: b.normalModelSlug, models: b.models
            }]));
            result.checkedAt = new Date().toISOString(); finish();
          }
        } catch (e) { if (!(e instanceof SyntaxError)) finish(e); }
      }
    });
    send({ method: 'initialize', id: 0, params: { clientInfo: { name: 'csh_routing_metadata_only', version: '1.0.0' } } });
  });
}

export function codexArguments(entry, { workspace, schema, output, role = 'developer', model, reasoningEffort }) {
  requireThat(['developer', 'reviewer'].includes(role), 'Unknown Codex role');
  // Availability is verified against authenticated model/list in runCodex before dispatch.
  requireThat(typeof model === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(model) && ['low', 'medium', 'high'].includes(reasoningEffort), 'Explicit policy-selected model/reasoning required');
  return [entry, 'exec', '--ignore-user-config', '--ephemeral', '--sandbox', role === 'reviewer' ? 'read-only' : 'workspace-write',
    '--model', model, '-c', `model_reasoning_effort="${reasoningEffort}"`,
    '-c', 'approval_policy="never"', '-c', 'forced_login_method="chatgpt"', '-c', 'model_provider="openai"',
    '-c', 'windows.sandbox="unelevated"', '-c', 'sandbox_workspace_write.network_access=false',
    '--cd', workspace, '--output-schema', schema, '--output-last-message', output, '--json', '--color', 'never', '-'];
}

export async function runCodex(options, dependencies = {}) {
  const { root, role = 'developer', routingContext, routing: explicitPolicy } = options;
  const runtimeConfig = path.join(root, '.engineering-loop', 'config.json');
  const configPolicy = fs.existsSync(runtimeConfig) ? readJson(runtimeConfig).modelRouting : undefined;
  const policy = explicitPolicy ?? configPolicy ?? {};
  let route = selectModel(routingContext, role, policy); // Validate task/proof authorization before metadata RPCs.
  const metadata = dependencies.metadata ?? readCodexMetadata;
  const execute = dependencies.execute ?? (o => executeCodexProcess(o, dependencies.process));
  let quotaBefore;
  const preflightFailure = error => {
    error.receipt = { taskId: route.taskId, role, requestedModel: route.model, actualModel: null, reasoningEffort: route.reasoningEffort,
      dispatchAttempted: false, callsThisAttempt: 0, processId: null, threadId: null, newSession: false, usage: null, quotaBefore: quotaBefore ?? null, quotaAfter: null,
      preflightBlocked: true, blocker: error.message, repairs: route.repair, escalationReason: route.escalationReason,
      diagnostics: { classification: 'PREFLIGHT_BLOCKED', preInference: { state: 'NOT_DISPATCHED', inferenceRequestSent: false } } };
    throw error;
  };
  try { const snapshot = await metadata(root); route = selectModel(routingContext, role, policy, snapshot); quotaBefore = selectedQuota(snapshot, route); } catch (error) { preflightFailure(error); }
  remainingTime(1);
  const directory = path.join(root, '.engineering-loop', 'model-budgets'), file = path.join(directory, `${hash(route.budgetKey)}.json`);
  const locked = fn => { const release = lock(path.join(directory, 'writer.lock'), path.join(directory, 'unused-state.json')); try { return fn(); } finally { release(); } };
  let budget;
  try { budget = locked(() => {
    const next = consumeModelBudget(fs.existsSync(file) ? readJson(file) : null, route);
    if (route.syntheticProof) {
      const proofFile = path.join(directory, `proof-${hash(route.syntheticProof.id)}.json`);
      const proof = fs.existsSync(proofFile) ? readJson(proofFile) : { calls: 0 };
      requireThat(Number.isSafeInteger(proof.calls) && proof.calls >= 0 && proof.calls < route.syntheticProof.maxCalls, 'Synthetic proof call budget exhausted');
      writeJson(proofFile, { calls: proof.calls + 1 });
    }
    writeJson(file, next); return next;
  }); } catch (error) { preflightFailure(error); }
  const receipt = { taskId: route.taskId, role, requestedModel: route.model, actualModel: null,
    reasoningEffort: route.reasoningEffort, actualReasoningEffort: null, routingReason: route.reason, escalationReason: route.escalationReason,
    calls: budget.calls, callsThisAttempt: 1, repairs: route.repair, escalations: budget.escalations, dispatchAttempted: true, usage: null, quotaBefore, quotaAfter: null,
    sandbox: role === 'reviewer' ? 'read-only' : 'workspace-write', newSession: true, resumed: false,
    chatgptOnly: true, paidApiKeysInherited: false, costProof: quotaBefore, processId: null, threadId: null,
    startedAt: new Date().toISOString(), writeProbeAttempted: false, writeProbeDenied: false, writeProbeExitCode: null };
  let result, failure;
  try {
    result = await execute({ ...options, role, route, receipt, observe: event => observeModelEvent(receipt, event, route) });
    requireThat(receipt.actualModel === route.model, 'Actual model identity unreported/unverified; cannot accept result');
  } catch (error) {
    failure = error;
    if (result && receipt.diagnostics) {
      receipt.diagnostics.resultValidation = 'ACTUAL_MODEL_UNVERIFIED';
      receipt.diagnostics.classification = 'RUNNER_RESULT_VALIDATION';
    }
  }
  try {
    receipt.quotaAfter = selectedQuota(await metadata(root), route, Date.now(), false);
    requireThat(!receipt.quotaAfter.reserveReached, 'Post-call selected-model quota reserve reached');
  }
  catch { receipt.quotaAfterError = 'Post-call selected-model quota unavailable or reserve reached'; failure ??= new Error(receipt.quotaAfterError); }
  receipt.finishedAt = new Date().toISOString();
  if (!receipt.usage) receipt.usageUnavailableReason = 'CLI JSON emitted no supported token-usage event';
  locked(() => {
    const saved = readJson(file), attempt = saved.attempts.find(a => a.invocationKey === route.invocationKey);
    requireThat(attempt, 'Missing consumed model-call checkpoint');
    Object.assign(attempt, { status: failure ? 'BLOCKED' : 'COMPLETED', receipt }); writeJson(file, saved);
  });
  if (failure) { failure.receipt = receipt; throw failure; }
  return { ...result, receipt };
}

async function executeCodexProcess({ root, workspace, prompt, schema, output, timeoutMs, role, route, receipt, observe,
  onStart = () => {}, onStop = () => {}, control = () => ({}) }, dependencies = {}) {
  const env = codexEnvironment();
  const entry = (dependencies.entrypoint ?? codexEntrypoint)(root);
  const args = codexArguments(entry, { workspace, schema, output, role, ...route });
  return new Promise((resolve, reject) => {
    const authorizedTimeout = remainingTime(timeoutMs);
    const known = { entry, workspace, schema, output };
    const diagnostics = processDiagnostics(safeLaunch(process.execPath, args, known, 'runner-planned'));
    receipt.diagnostics = diagnostics.value;
    let child;
    try { child = (dependencies.spawn ?? spawn)(process.execPath, args, { cwd: workspace, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (error) {
      diagnostics.value.spawnErrorCode = ['ENOENT', 'EACCES', 'EPERM', 'EINVAL'].includes(error.code) ? error.code : 'SPAWN_ERROR';
      diagnostics.finish(null, null); reject(new Error('Codex process could not be spawned; see filtered diagnostics')); return;
    }
    if (Array.isArray(child.spawnargs)) diagnostics.value.launch = safeLaunch(process.execPath, child.spawnargs.slice(1), known, 'child.spawnargs');
    let ended = false, failure = null, events = 0, pending = '', modelFailure = null;
    child.stdin.on('error', () => terminate('Codex input pipe failed', 'INPUT_PIPE'));
    function lineEvent(line) {
      let event;
      try { event = JSON.parse(line); }
      catch { diagnostics.nonJson(line); return; }
      try {
      diagnostics.event(event);
      if (!event || typeof event !== 'object') return;
      try { observe(event); } catch (error) { terminate(error.message, 'MODEL_EVENT_REJECTED'); }
      if (event.type === 'thread.started') receipt.threadId = event.thread_id;
      if (['error', 'turn.failed'].includes(event.type)) {
        const message = event.message ?? event.error?.message ?? '';
        modelFailure = /usage.limit|rate.limit|quota|limit reached/i.test(message) ? 'MODEL_LIMIT' :
          /stream disconnected|connection|timed out|temporar|overloaded|internal server|503|502/i.test(message) ? 'MODEL_TRANSPORT' : 'MODEL_FAILURE';
      }
      if (event.item?.type === 'command_execution' && event.item.command?.includes('readonly-probe.txt') && /Set-Content|WriteAllText|Out-File|writeFile|New-Item|printf|echo/i.test(event.item.command)) {
        receipt.writeProbeAttempted = true;
        if (Number.isInteger(event.item.exit_code)) receipt.writeProbeExitCode = event.item.exit_code;
        if (/access.*denied|permission denied|read.only|unauthorizedaccess/i.test(event.item.aggregated_output ?? '')) receipt.writeProbeDenied = true;
      }
      } catch { terminate('Malformed Codex JSON event; content omitted', 'MALFORMED_EVENT'); }
    }
    // Parse events but retain only bounded allowlisted error summaries, not model/tool text.
    child.stdout.on('data', bytes => {
      diagnostics.value.stdoutBytes += bytes.length;
      events++; pending += bytes.toString('utf8');
      if (pending.length > 1024 * 1024) { pending = ''; diagnostics.value.truncated = true; terminate('Oversized Codex event', 'OVERSIZED_EVENT'); return; }
      let index;
      while ((index = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, index); pending = pending.slice(index + 1);
        lineEvent(line);
      }
    }); child.stderr.on('data', bytes => diagnostics.stderr(bytes));
    receipt.processId = child.pid;
    try { onStart(child.pid); } catch { terminate('Controller start callback failed', 'START_CALLBACK'); }
    function terminate(reason, code) {
      failure ??= reason; diagnostics.value.stopReason ??= code;
      if (ended) return;
      if (dependencies.stop) { dependencies.stop(child); return; }
      if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else child.kill('SIGTERM');
    }
    const timeout = deadlineTimer(authorizedTimeout, () => terminate('Codex timeout or authorized deadline reached', 'TIMEOUT'));
    const interval = setInterval(() => { if (control()?.stop || control()?.pause) terminate('Operator paused/stopped Codex; inspect partial edits', 'OPERATOR_STOP'); }, 1000);
    child.on('error', e => {
      const code = ['ENOENT', 'EACCES', 'EPERM', 'EINVAL'].includes(e.code) ? e.code : 'PROCESS_ERROR';
      diagnostics.value[child.pid ? 'processErrorCode' : 'spawnErrorCode'] = code;
      failure = `Codex process failed: ${code}`;
    });
    child.once('close', (code, signal) => {
      ended = true; clearTimeout(timeout); clearInterval(interval);
      if (pending.trim()) lineEvent(pending); pending = '';
      try { onStop(); } catch { failure ??= 'Controller stop callback failed'; diagnostics.value.stopReason ??= 'STOP_CALLBACK'; }
      diagnostics.finish(code, signal);
      receipt.finishedAt = new Date().toISOString();
      if (failure || code !== 0) {
        const error = new Error(failure ?? `Codex failed (exit ${code}; ${modelFailure ?? 'UNCLASSIFIED'})`);
        error.code = failure ? 'MODEL_FAILURE' : modelFailure ?? 'MODEL_FAILURE';
        error.receipt = receipt; reject(error);
      }
      else { try { remainingTime(1); requireThat(receipt.threadId, 'Missing fresh Codex session evidence'); resolve({ report: readJson(output), eventChunks: events, receipt }); }
        catch { diagnostics.value.classification = 'RUNNER_PARSER_OR_CONTROL'; diagnostics.value.stopReason = 'OUTPUT_OR_SESSION_INVALID'; reject(new Error('Codex did not return valid structured output/session evidence')); } }
    });
    child.stdin.end(prompt);
  });
}
