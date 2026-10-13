import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lock, git, writeJson, runCodex } from './io.mjs';
import { requireThat, hash } from './core.mjs';

const tool = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(tool, '../..');
const runtime = path.join(root, '.engineering-loop');
const workspace = path.join(runtime, 'codex-smoke', new Date().toISOString().replace(/[:.]/g, '-'));
const release = lock(path.join(runtime, 'writer.lock'), path.join(runtime, 'state.json'));
const evidence = { mode: 'real-codex-cli-smoke', startedAt: new Date().toISOString(), accountAuth: 'ChatGPT', sandbox: 'workspace-write', elevated: false, paidApi: false };
try {
  fs.mkdirSync(workspace, { recursive: true });
  git(workspace, 'init', '-b', 'main');
  fs.writeFileSync(path.join(workspace, 'AGENTS.md'), 'Owner authorizes a synthetic Codex CLI smoke test only. Create fixture.txt exactly APPROVED + newline. Do not edit anything outside this test workspace; do not contact GitHub/Google/providers, create resources, install dependencies, commit or push.\n');
  git(workspace, 'add', '--', 'AGENTS.md'); git(workspace, 'commit', '-m', 'synthetic CLI smoke setup');
  const output = path.join(workspace, 'report.json');
  const result = await runCodex({ root, workspace, schema: path.join(tool, 'report.schema.json'), output, timeoutMs: 180000,
    prompt: 'Execute only synthetic task D001-SMOKE, authorized by owner for loop setup. Read AGENTS.md. Create fixture.txt with exactly APPROVED followed by one newline. Read it back and report a real targeted file-byte check. Do not commit or push. Return taskId D001-SMOKE, result COMPLETE, changedFiles [fixture.txt], tests with actual readback evidence, evidence, blocker empty and commitSha empty. No application work or external calls.',
    onStart: pid => writeJson(path.join(runtime, 'smoke-writer.json'), { writerPid: pid }),
    onStop: () => writeJson(path.join(runtime, 'smoke-writer.json'), { writerPid: null }), control: () => ({}) });
  requireThat(fs.readFileSync(path.join(workspace, 'fixture.txt'), 'utf8') === 'APPROVED\n', 'Actual Codex fixture differs from expected bytes');
  requireThat(result.report.taskId === 'D001-SMOKE' && result.report.result === 'COMPLETE', 'Invalid real CLI report');
  evidence.passed = true; evidence.fixtureSha256 = hash('APPROVED\n'); evidence.report = result.report;
} catch (error) { evidence.passed = false; evidence.blocker = error.message; process.exitCode = 1; }
finally {
  evidence.finishedAt = new Date().toISOString();
  writeJson(path.join(runtime, 'codex-smoke-evidence.json'), evidence);
  release();
  console.log(JSON.stringify(evidence, null, 2));
}
