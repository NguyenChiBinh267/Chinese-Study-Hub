import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { requireThat, hash } from './core.mjs';

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
  requireThat(limits.length && limits.every(x => x && x.credits?.hasCredits === false && x.credits?.unlimited === false && Number(x.credits?.balance) === 0),
    'Paid credit eligibility unavailable/nonzero; no model call permitted');
  requireThat(limits.every(x => [x.primary, x.secondary].filter(Boolean).length > 0 && [x.primary, x.secondary].filter(Boolean).every(w => Number.isFinite(w.usedPercent) && w.usedPercent >= 0 && w.usedPercent <= 100)), 'Invalid quota evidence; no model call permitted');
  if (limits.some(x => x.rateLimitReachedType || [x.primary, x.secondary].filter(Boolean).some(w => w.usedPercent >= 100))) {
    const exhausted = limits.flatMap(x => [x.primary, x.secondary].filter(Boolean).filter(w => w.usedPercent >= 100));
    const error = new Error('ChatGPT model limit reached; no paid credits, resets or fallback'); error.code = 'QUOTA_EXHAUSTED';
    if (exhausted.length && exhausted.every(w => Number.isFinite(w.resetsAt))) error.retryAt = Math.max(...exhausted.map(w => w.resetsAt)) * 1000;
    throw error;
  }
  return { checkedAt: new Date().toISOString(), chatgptOnly: true, hasCredits: false, balance: '0', ordinaryQuotaAvailable: true,
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

export function codexArguments(entry, { workspace, schema, output, role = 'developer' }) {
  requireThat(['developer', 'reviewer'].includes(role), 'Unknown Codex role');
  return [entry, 'exec', '--ignore-user-config', '--ephemeral', '--sandbox', role === 'reviewer' ? 'read-only' : 'workspace-write',
    '-c', 'approval_policy="never"', '-c', 'forced_login_method="chatgpt"', '-c', 'model_provider="openai"',
    '-c', 'windows.sandbox="unelevated"', '-c', 'sandbox_workspace_write.network_access=false',
    '--cd', workspace, '--output-schema', schema, '--output-last-message', output, '--json', '--color', 'never', '-'];
}

export async function runCodex({ root, workspace, prompt, schema, output, timeoutMs, role = 'developer', onStart = () => {}, onStop = () => {}, control = () => ({}) }) {
  const login = spawnSync(process.execPath, [codexEntrypoint(root), 'login', 'status'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: remainingTime(15000) });
  requireThat(login.status === 0 && `${login.stdout}${login.stderr}`.includes('ChatGPT'), 'Codex must use existing ChatGPT account login');
  const costProof = await freeQuota(root);
  const env = codexEnvironment();
  const args = codexArguments(codexEntrypoint(root), { workspace, schema, output, role });
  const receipt = { role, sandbox: role === 'reviewer' ? 'read-only' : 'workspace-write', newSession: true, resumed: false,
    chatgptOnly: true, paidApiKeysInherited: false, costProof, processId: null, threadId: null, startedAt: new Date().toISOString(), writeProbeAttempted: false, writeProbeDenied: false, writeProbeExitCode: null };
  return new Promise((resolve, reject) => {
    const authorizedTimeout = remainingTime(timeoutMs);
    const child = spawn(process.execPath, args, { cwd: workspace, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let ended = false, failure = null, events = 0, pending = '', modelFailure = null;
    // Deliberately discard command output: it can contain secrets or unbounded model text.
    child.stdout.on('data', bytes => {
      events++; pending += bytes.toString('utf8');
      if (pending.length > 1024 * 1024) { terminate('Oversized Codex event'); return; }
      let index;
      while ((index = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, index); pending = pending.slice(index + 1);
        try {
          const event = JSON.parse(line);
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
        } catch { /* Raw model/tool content never enters logs. */ }
      }
    }); child.stderr.on('data', () => {});
    receipt.processId = child.pid;
    onStart(child.pid);
    function terminate(reason) {
      if (ended) return;
      failure = reason;
      if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else child.kill('SIGTERM');
    }
    const timeout = deadlineTimer(authorizedTimeout, () => terminate('Codex timeout or authorized deadline reached'));
    const interval = setInterval(() => { if (control()?.stop || control()?.pause) terminate('Operator paused/stopped Codex; inspect partial edits'); }, 1000);
    child.on('error', e => { failure = `Codex spawn failed: ${e.code}`; });
    child.on('close', code => {
      ended = true; clearTimeout(timeout); clearInterval(interval); onStop(); receipt.finishedAt = new Date().toISOString();
      if (failure || code !== 0) {
        const error = new Error(failure ?? `Codex failed (exit ${code}; ${modelFailure ?? 'UNCLASSIFIED'})`);
        error.code = failure ? 'MODEL_FAILURE' : modelFailure ?? 'MODEL_FAILURE';
        error.receipt = receipt; reject(error);
      }
      else { try { remainingTime(1); requireThat(receipt.threadId, 'Missing fresh Codex session evidence'); resolve({ report: readJson(output), eventChunks: events, receipt }); } catch { reject(new Error('Codex did not return valid structured output/session evidence')); } }
    });
    child.stdin.end(prompt);
  });
}
