import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { requireThat } from './core.mjs';

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
    requireThat(owner.host === os.hostname() && !alive(owner.pid) && !(state?.writerPid && alive(state.writerPid)) && !(smoke?.writerPid && alive(smoke.writerPid)), 'Another orchestrator or Codex writer is active');
    fs.unlinkSync(ownerFile); fs.rmdirSync(directory); fs.mkdirSync(directory);
  }
  writeJson(path.join(directory, 'owner.json'), { pid: process.pid, host: os.hostname(), at: new Date().toISOString() });
  return () => { fs.unlinkSync(path.join(directory, 'owner.json')); fs.rmdirSync(directory); };
}
export function command(executable, args, cwd, options = {}) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', windowsHide: true,
    timeout: 30000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' }, ...options });
  requireThat(result.status === 0, `${path.basename(executable)} failed (exit ${result.status ?? result.error?.code ?? 'unknown'})`);
  return result.stdout.trimEnd();
}
export const git = (cwd, ...args) => command('git', args, cwd);

// Credentials stay in memory, are never logged, and are never inherited by Codex.
export class GitHub {
  constructor(root, repository) {
    requireThat(/^[\w.-]+\/[\w.-]+$/.test(repository), 'Invalid repository');
    this.root = root; this.repository = repository; this.token = null;
  }
  authenticate() {
    const credentials = command('git', ['credential', 'fill'], this.root,
      { input: 'protocol=https\nhost=github.com\n\n', timeout: 15000 });
    this.token = credentials.match(/^password=(.*)$/m)?.[1];
    requireThat(this.token, 'No existing Git Credential Manager credential; sign in once outside the loop');
  }
  async api(endpoint, method = 'GET', body) {
    if (!this.token) this.authenticate();
    requireThat(endpoint.startsWith('/'), 'Invalid GitHub endpoint');
    const response = await fetch(`https://api.github.com${endpoint}`, { method,
      signal: AbortSignal.timeout(30000), redirect: 'error', headers: { 'User-Agent': 'Chinese-Study-Hub-loop',
        Accept: 'application/vnd.github+json', Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28' }, body: body === undefined ? undefined : JSON.stringify(body) });
    requireThat(response.ok, `GitHub ${method} failed (${response.status}); reconcile before retry`);
    return response.status === 204 ? null : response.json();
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

export async function runCodex({ root, workspace, prompt, schema, output, timeoutMs, onStart, onStop, control }) {
  const login = spawnSync(process.execPath, [codexEntrypoint(root), 'login', 'status'], { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 15000 });
  requireThat(login.status === 0 && `${login.stdout}${login.stderr}`.includes('ChatGPT'), 'Codex must use existing ChatGPT account login');
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' };
  for (const name of Object.keys(env)) if (/TOKEN|SECRET|PASSWORD|API_KEY|^GH_|^GITHUB_|^GOOGLE_|^AZURE_|^AWS_/i.test(name)) delete env[name];
  const args = [codexEntrypoint(root), 'exec', '--ignore-user-config', '--ephemeral', '--sandbox', 'workspace-write',
    '-c', 'approval_policy="never"', '-c', 'forced_login_method="chatgpt"', '-c', 'model_provider="openai"',
    '-c', 'windows.sandbox="unelevated"', '-c', 'sandbox_workspace_write.network_access=false',
    '--cd', workspace, '--output-schema', schema, '--output-last-message', output, '--json', '--color', 'never', '-'];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: workspace, env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let ended = false, failure = null, events = 0;
    // Deliberately discard command output: it can contain secrets or unbounded model text.
    child.stdout.on('data', () => { events++; }); child.stderr.on('data', () => {});
    onStart(child.pid);
    function terminate(reason) {
      if (ended) return;
      failure = reason;
      if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else child.kill('SIGTERM');
    }
    const timeout = setTimeout(() => terminate('Codex timeout'), timeoutMs);
    const interval = setInterval(() => { if (control()?.stop || control()?.pause) terminate('Operator paused/stopped Codex; inspect partial edits'); }, 1000);
    child.on('error', e => { failure = `Codex spawn failed: ${e.code}`; });
    child.on('close', code => {
      ended = true; clearTimeout(timeout); clearInterval(interval); onStop();
      if (failure || code !== 0) reject(new Error(failure ?? `Codex failed (exit ${code})`));
      else { try { resolve({ report: readJson(output), eventChunks: events }); } catch { reject(new Error('Codex did not return valid structured output')); } }
    });
    child.stdin.end(prompt);
  });
}
