import fs from 'node:fs';
import path from 'node:path';
import { hash, requireThat, validateSource } from './core.mjs';
import { readJson, writeJson } from './io.mjs';

export const PLAN = 'docs/master-plan/master-plan-v1.1.md';
export const STATUS = 'docs/master-plan/task-status.json';
export const MANIFEST = 'docs/master-plan/source-manifest.json';
export const PROTECTED = ['docs/master-plan/**', 'tools/engineering-loop/**', 'AGENTS.md', 'docs/implementation/brief.md', 'docs/implementation/status.md'];
export function plain(line) {
  return line.replace(/^#{1,6}\s+/, '').replace(/\s+\{#[^}]+\}\s*$/, '')
    .replace(/(?<!\\)\[([^\]]*(?:\\\][^\]]*)*)\]\([^\n]*?\)/g, '$1')
    .replace(/(?<!\\)`([^`]+)`/g, '$1').replace(/(?<!\\)\*\*([^*]+)\*\*/g, '$1')
    .replace(/\\([\\`*_{}\[\]()#+\-.!><$:;=~|/])/g, '$1').trimEnd();
}
export function parsePlan(markdown) {
  const lines = markdown.replace(/^\uFEFF/, '').split(/\r?\n/), tasks = [], sections = {};
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].match(/^(#{1,6})\s+(.*)$/); if (!heading) continue;
    const title = plain(lines[i]), task = title.match(/^([TD]\d{3}) — /);
    let end = i + 1; while (end < lines.length && !/^#{1,6}\s/.test(lines[end])) end++;
    const spec = [title, ...lines.slice(i + 1, end).map(plain).filter(x => x.trim())];
    if (task) {
      requireThat(!spec.some(x => /^Trạng thái T\d{3}:/.test(x)), 'Canonical plan cannot contain mutable task statuses');
      const dep = spec.find(x => x.includes('Phụ thuộc:'))?.split('Phụ thuộc:')[1]?.split('.')[0];
      requireThat(dep !== undefined, `Missing dependencies: ${task[1]}`);
      tasks.push({ id: task[1], title, spec, dependencies: [...dep.matchAll(/[TD]\d{3}/g)].map(x => x[0]), priority: /\[P0/.test(title) ? 0 : /\[P1/.test(title) ? 1 : 2 });
    }
    const id = title.match(/^(\d+(?:\.\d+)*)\./)?.[1];
    if (id) {
      let sectionEnd = i + 1;
      while (sectionEnd < lines.length && !(lines[sectionEnd].match(/^(#{1,6})\s/)?.[1].length <= heading[1].length)) sectionEnd++;
      sections[id] = lines.slice(i, sectionEnd).map(plain).filter(x => x.trim());
    }
  }
  return { lines, tasks, sections };
}
function expandIds(text) {
  const result = [];
  for (const match of text.matchAll(/T(\d{3})(?:[–-](?:T)?(\d{3}))?/g)) {
    const first = Number(match[1]), last = Number(match[2] ?? match[1]);
    requireThat(last >= first && last <= 70, 'Invalid activation range');
    for (let n = first; n <= last; n++) result.push(`T${String(n).padStart(3, '0')}`);
  }
  return result;
}
export function activation(parsed) {
  const text = parsed.sections['12.6']?.join('\n'); requireThat(text, 'Missing activation section');
  const labels = { M0: 'M0 ACTIVE34', M1: 'M1/v0.2 ACTIVE14', M2: 'M2/v0.3 ACTIVE7', M3: 'M3/v0.4', M4: 'M4/v0.5', M5: 'M5/v1.0', optional: 'OPTIONAL/DEFERRED' };
  const buckets = {};
  for (const [key, label] of Object.entries(labels)) {
    const start = text.indexOf(label + ':'); requireThat(start >= 0, `Missing activation bucket ${key}`);
    const tail = text.slice(start + label.length + 1), end = tail.search(/[.;\n]/);
    buckets[key] = expandIds(end < 0 ? tail : tail.slice(0, end));
  }
  requireThat(JSON.stringify(Object.values(buckets).map(x => x.length)) === JSON.stringify([34, 14, 7, 3, 3, 3, 6]), 'Wrong activation counts');
  const all = Object.values(buckets).flat(); requireThat(all.length === 70 && new Set(all).size === 70, 'Activation buckets missing/duplicate IDs');
  return buckets;
}
export function derive(planText, statuses, revision, manifest = {}) {
  requireThat(plain(planText.split(/\r?\n/).find(x => /^#\s/.test(x)) ?? '') === 'Chinese Study Hub — Master Plan v1.1' && manifest.version === 'v1.1', 'Canonical title/manifest version mismatch; never substitute v1.0');
  const parsed = parsePlan(planText), buckets = activation(parsed);
  requireThat(statuses.schemaVersion === 1 && statuses.activeRelease === 'M0' && Object.keys(statuses.tasks).length === 70, 'Invalid status source');
  const tasks = parsed.tasks.map(task => {
    requireThat(statuses.tasks[task.id] && typeof statuses.tasks[task.id].status === 'string', `Missing official status ${task.id}`);
    const entry = statuses.tasks[task.id];
    if (entry.status === 'done') {
      const e = entry.evidence;
      const imported = ['T001', 'T002'].includes(task.id) && e?.kind === 'historical-owner-verified-import' &&
        e.originalRevision === manifest.originalRevision && e.sourceNote?.startsWith(`Trạng thái ${task.id}: done`);
      const completed = e?.taskId === task.id && typeof e.runId === 'string' && e.runId.length >= 30 &&
        [e.reviewedSha, e.mergeSha, e.sourceCommit].every(sha => typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha)) &&
        e.reviewerVerdict === 'PASS' && e.checks?.length > 0 && e.checks.every(c => c.passed === true) && Number.isFinite(Date.parse(e.completedAt));
      requireThat(imported || completed, `Done status lacks controller/verified import evidence: ${task.id}`);
    }
    return { ...task, release: buckets.M0.includes(task.id) ? 'M0' : 'inactive', status: entry.status };
  });
  const common = ['2.3', '11', '12.6', '14.1', '15', '10.3'].flatMap(id => { requireThat(parsed.sections[id], `Missing section ${id}`); return parsed.sections[id]; });
  const source = { schemaVersion: 1, version: 'v1.1', documentId: manifest.originalDocumentId ?? '1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30',
    sourceUrl: 'git:origin/main:' + PLAN, revision, activeRelease: 'M0', activeIds: buckets.M0, tasks, common,
    planHash: hash(planText), statusHash: hash(JSON.stringify(statuses)), buckets, parsed };
  return validateSource(source);
}
export function deriveRepository(root) {
  const text = fs.readFileSync(path.join(root, PLAN), 'utf8'), statuses = readJson(path.join(root, STATUS)), manifest = readJson(path.join(root, MANIFEST));
  return derive(text, statuses, `git-candidate:${hash(text + JSON.stringify(statuses))}`, manifest);
}
export function importSnapshot(root, expectedRevision) {
  requireThat([PLAN, STATUS, MANIFEST].every(file => !fs.existsSync(path.join(root, file))), 'Migration artifacts already exist; preserve official specification/status and reconcile explicitly, never reimport/reset');
  const directory = path.join(root, 'docs/master-plan'), raw = fs.readFileSync(path.join(directory, 'source-export-v1.1.md'));
  const text = raw.toString('utf8'); requireThat(text.startsWith('# Chinese Study Hub — Master Plan v1.1'), 'Wrong exported source title');
  const statusNotes = text.split(/\r?\n/).filter(x => /^Trạng thái T\d{3}:/.test(x));
  requireThat(statusNotes.length === 2 && statusNotes.every(x => /^Trạng thái T00[12]: done/.test(x)), 'Unexpected source completion notes');
  const body = text.split(/\r?\n/).filter(x => !/^Trạng thái T\d{3}:/.test(x)).join('\n');
  const header = '<!-- Git SSOT candidate: specification below preserved from official export. Mutable status notes moved to task-status.json. Historical planning/status prose is not current execution status. Owner migration decision replaces Google Docs runtime authority only after this PR is reviewed and merged to main; ADRs/release specifications unchanged. -->\n\n';
  const planText = header + body, parsed = parsePlan(planText), buckets = activation(parsed), tasks = {};
  for (const task of parsed.tasks) {
    const note = statusNotes.find(x => x.startsWith(`Trạng thái ${task.id}:`));
    tasks[task.id] = { status: note ? 'done' : /DEFERRED/.test(task.title) ? 'deferred' : 'pending',
      ...(note ? { evidence: { kind: 'historical-owner-verified-import', originalRevision: expectedRevision, sourceNote: plain(note) } } : {}) };
  }
  const statuses = { schemaVersion: 1, activeRelease: 'M0', tasks }, importedAt = new Date().toISOString();
  const manifest = { schemaVersion: 1, state: 'CANDIDATE_UNTIL_REVIEWED_MERGED_TO_MAIN', originalDocumentId: '1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30',
    originalUrl: 'https://docs.google.com/document/d/1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30', originalRevision: expectedRevision, version: 'v1.1', importedAt,
    retrieval: 'Official Google Drive text/markdown export; complete response, revision checked before and after',
    snapshotFile: 'source-export-v1.1.md', snapshotBytes: raw.length, snapshotSha256: hash(raw), planFile: 'master-plan-v1.1.md', planSha256: hash(planText),
    transforms: ['Added owner-approved migration authority note', 'Removed exactly two mutable task-status paragraphs; retained verbatim in initial task-status evidence', 'LF line endings'],
    statusAuthority: STATUS, specificationAuthority: PLAN, layoutEquivalentClaim: false, completeSemanticEquivalenceClaim: false };
  const result = derive(planText, statuses, 'git-import:' + hash(planText), manifest);
  requireThat(JSON.stringify(result.tasks.filter(t => t.status === 'done').map(t => t.id)) === JSON.stringify(['T001', 'T002']), 'Unexpected done IDs');
  fs.writeFileSync(path.join(root, PLAN), planText); writeJson(path.join(root, STATUS), statuses); writeJson(path.join(root, MANIFEST), manifest);
  return { tasks: result.tasks.length, buckets: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])), doneIds: ['T001', 'T002'], snapshotSha256: manifest.snapshotSha256 };
}
