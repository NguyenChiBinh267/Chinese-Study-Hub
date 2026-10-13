import fs from 'node:fs';
import path from 'node:path';
import { hash, requireThat, now } from './core.mjs';
import { readJson, writeJson } from './io.mjs';

export const DOCUMENT_ID = '1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30';
export const SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const secretDirectory = () => path.join(process.env.LOCALAPPDATA, 'ChineseStudyHub', 'oauth');

export function paragraphs(doc) {
  const result = [];
  function elements(content, tabId = null) {
    for (const element of content ?? []) {
      if (element.paragraph) result.push({ text: (element.paragraph.elements ?? []).map(x => x.textRun?.content ?? '').join('').trimEnd(),
        startIndex: element.startIndex, endIndex: element.endIndex, tabId, style: element.paragraph.paragraphStyle?.namedStyleType ?? 'NORMAL_TEXT' });
      if (element.table) for (const row of element.table.tableRows ?? []) for (const cell of row.tableCells ?? []) elements(cell.content, tabId);
    }
  }
  function tabs(items) { for (const tab of items ?? []) { elements(tab.documentTab?.body?.content, tab.tabProperties?.tabId); tabs(tab.childTabs); } }
  if (doc.tabs?.length) tabs(doc.tabs); else elements(doc.body?.content);
  return result;
}

export function taskEntry(doc, id) {
  requireThat(doc.documentId === DOCUMENT_ID && doc.title?.includes('v1.1') && doc.revisionId, 'Wrong/missing live SSOT version/revision');
  requireThat(/^T\d{3}$/.test(id), 'Only a single base Task ID can be written/read in live SSOT');
  const p = paragraphs(doc), matches = p.map((x, i) => x.text.startsWith(`${id} —`) && x.style === 'HEADING_3' ? i : -1).filter(i => i >= 0);
  requireThat(matches.length === 1, 'Task heading is missing/ambiguous');
  const start = matches[0]; let end = start + 1;
  while (end < p.length && !p[end].style.startsWith('HEADING')) end++;
  const entry = p.slice(start, end), dep = entry.find(x => x.text.includes('Phụ thuộc:'))?.text.split('Phụ thuộc:')[1].split('.')[0];
  requireThat(dep !== undefined, 'Task dependencies missing');
  const active = p.find(x => x.text.startsWith('M0 ACTIVE34:'))?.text.split('.')[0];
  requireThat(active && [...active.matchAll(/T\d{3}/g)].length === 34 && active.includes(id), 'Task outside active M0');
  return { paragraphs: entry, spec: entry.filter(x => !x.text.startsWith(`Trạng thái ${id}:`)).map(x => x.text),
    dependencies: [...dep.matchAll(/T\d{3}/g)].map(x => x[0]), doneIds: p.filter(x => /^Trạng thái T\d{3}: done\b/.test(x.text)).map(x => x.text.match(/T\d{3}/)[0]),
    insertIndex: entry.at(-1).endIndex - 1, tabId: entry[0].tabId };
}

export function assertRevision(actual, expected) { requireThat(actual === expected, 'Live SSOT revision drift; read affected sections and refresh caches before proceeding'); }
export function liveSections(doc, ids) {
  const p = paragraphs(doc), selected = [];
  for (const id of ids) {
    const matches = p.map((x, i) => x.style.startsWith('HEADING') && x.text.startsWith(`${id}. `) ? i : -1).filter(i => i >= 0);
    requireThat(matches.length === 1, `Required live section ${id} missing/ambiguous`);
    const start = matches[0], level = Number(p[start].style.slice(-1)); let end = start + 1;
    while (end < p.length && !(p[end].style.startsWith('HEADING') && Number(p[end].style.slice(-1)) <= level)) end++;
    selected.push(...p.slice(start, end).map(x => x.text));
  }
  return [...new Set(selected)];
}
export function statusEdit(doc, id, text) {
  requireThat(text.startsWith(`Trạng thái ${id}: done`) && !text.includes('\n'), 'Invalid scoped status text');
  const entry = taskEntry(doc, id), existing = entry.paragraphs.filter(p => p.text.startsWith(`Trạng thái ${id}:`));
  requireThat(existing.length <= 1, 'Ambiguous task status location');
  if (existing.length) {
    const p = existing[0], range = { startIndex: p.startIndex, endIndex: p.endIndex - 1, ...(p.tabId ? { tabId: p.tabId } : {}) };
    return { requests: [{ deleteContentRange: { range } }, { insertText: { location: { index: p.startIndex, ...(p.tabId ? { tabId: p.tabId } : {}) }, text } }],
      before: paragraphs(doc).map(p => p.text).join('\n'), expected: paragraphs(doc).map(q => q.startIndex === p.startIndex && q.tabId === p.tabId ? text : q.text).join('\n') };
  }
  const all = paragraphs(doc), last = entry.paragraphs.at(-1), position = all.findIndex(p => p.startIndex === last.startIndex && p.tabId === last.tabId);
  return { requests: [{ insertText: { location: { index: entry.insertIndex, ...(entry.tabId ? { tabId: entry.tabId } : {}) }, text: '\n' + text } }],
    before: all.map(p => p.text).join('\n'), expected: all.map((p, i) => i === position ? p.text + '\n' + text : p.text).join('\n') };
}

export class FixtureSource {
  constructor(file) { this.file = file; }
  async verifyTask(state, task) {
    requireThat(state.mode === 'dry-local' && state.taskId === 'D001', 'Synthetic source cannot authorize a real backlog task');
    const spec = readJson(this.file);
    const revision = `fixture:${hash(JSON.stringify(spec))}`;
    assertRevision(revision, state.sourceRevision);
    requireThat(JSON.stringify(spec.spec) === JSON.stringify(task.spec) && spec.id === state.taskId, 'Synthetic task specification drift');
    return { kind: 'synthetic-fixture', revision, readbackVerified: true, relevantSections: task.spec, doneIds: [] };
  }
}

// OAuth secrets never leave this module, enter model prompts, repository files or logs.
export class GoogleDocsSource {
  constructor({ root, cfg, fetchImpl = fetch, authProvider = null }) {
    this.root = root; this.cfg = cfg; this.fetch = fetchImpl; this.authProvider = authProvider;
    this.directory = secretDirectory(); this.access = null;
    requireThat(!path.resolve(this.directory).toLowerCase().startsWith(path.resolve(root).toLowerCase() + path.sep), 'OAuth secret directory must stay outside repository');
  }
  status() {
    const files = ['client.json', 'tokens.json', 'zero-cost.json'];
    const missing = files.filter(file => !fs.existsSync(path.join(this.directory, file)));
    return { backend: 'google-docs', documentId: DOCUMENT_ID, credentialDirectory: this.directory, scope: SCOPE,
      status: missing.length ? 'BLOCKED' : 'UNVERIFIED', missingFiles: missing, liveReadVerified: false, liveWriteVerified: false,
      noCloudResourcesCreated: true, noConnectorTokenReuse: true };
  }
  costProof() {
    const file = path.join(this.directory, 'zero-cost.json');
    requireThat(fs.existsSync(file), 'SSOT zero-cost/no-billing proof missing; no API requests made');
    const proof = readJson(file);
    requireThat(proof.ownerConfirmed === true && proof.existingProject === true && proof.billingDisabled === true &&
      proof.standardUseNoAdditionalCost === true && proof.noQuotaPurchase === true &&
      Date.now() - Date.parse(proof.checkedAt) >= 0 && Date.now() - Date.parse(proof.checkedAt) < 24 * 3600000,
      'SSOT zero-cost proof invalid/expired; owner must verify actual project billing/terms');
    return proof;
  }
  budget(write) {
    const file = path.join(this.root, '.engineering-loop', 'ssot-request-budget.json');
    const day = now().slice(0, 10);
    const counts = fs.existsSync(file) ? readJson(file) : {};
    if (counts.day !== day) Object.assign(counts, { day, read: 0, write: 0 });
    const kind = write ? 'write' : 'read', limit = write ? 4 : 24;
    requireThat(counts[kind] < limit, 'Local SSOT daily request cap reached; no paid quota/fallback');
    counts[kind]++; writeJson(file, counts);
  }
  async token() {
    if (this.authProvider) return this.authProvider(); // Unit-test injection only, never selectable in CLI config.
    this.costProof();
    if (this.access && this.access.expiresAt > Date.now() + 60000) return this.access.token;
    const clientFile = path.join(this.directory, 'client.json'), tokenFile = path.join(this.directory, 'tokens.json');
    requireThat(fs.existsSync(clientFile) && fs.existsSync(tokenFile), 'SSOT local OAuth credentials missing (connector login is not local OAuth)');
    const client = readJson(clientFile).installed, token = readJson(tokenFile);
    requireThat(!fs.lstatSync(this.directory).isSymbolicLink() && !fs.lstatSync(clientFile).isSymbolicLink() && !fs.lstatSync(tokenFile).isSymbolicLink(), 'OAuth store/files cannot be symlinks');
    requireThat(client?.client_id && client.token_uri === 'https://oauth2.googleapis.com/token' && token.refresh_token && token.scope === SCOPE, 'Unsupported/broad OAuth scope/client');
    const response = await this.fetch(client.token_uri, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: client.client_id,
        client_secret: client.client_secret ?? '', refresh_token: token.refresh_token, grant_type: 'refresh_token' }) });
    requireThat(response.ok, `OAuth refresh failed (${response.status}); tokens not logged`);
    const data = await response.json(); requireThat(data.access_token && (!data.scope || data.scope === SCOPE), 'Unexpected refreshed OAuth scope');
    this.access = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return this.access.token;
  }
  async request(write = false, body) {
    const token = await this.token();
    this.budget(write);
    const response = await this.fetch(`https://docs.googleapis.com/v1/documents/${DOCUMENT_ID}${write ? ':batchUpdate' : '?includeTabsContent=true'}`, {
      method: write ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${token}`, ...(write ? { 'Content-Type': 'application/json' } : {}) }, body: write ? JSON.stringify(body) : undefined });
    requireThat(response.ok, `Google Docs ${write ? 'write' : 'read'} failed (${response.status}); no automatic retry/paid quota`);
    return response.json();
  }
  async verifyTask(state, task) {
    requireThat(state.mode === 'live' && /^T\d{3}$/.test(state.taskId) && task.id === state.taskId, 'Google SSOT cannot authorize a synthetic/mismatched task');
    const doc = await this.request(); assertRevision(doc.revisionId, state.sourceRevision);
    const entry = taskEntry(doc, state.taskId);
    const expected = task.spec.filter(x => !x.startsWith(`Trạng thái ${state.taskId}:`));
    requireThat(JSON.stringify(entry.spec) === JSON.stringify(expected) && JSON.stringify(entry.dependencies) === JSON.stringify(task.dependencies), 'Live task specification/dependencies differ from cached packet');
    requireThat(entry.dependencies.every(id => entry.doneIds.includes(id)), 'Live task dependencies not done');
    const extra = this.cfg.policies?.[task.id]?.sourceSections ?? [];
    requireThat(Array.isArray(extra) && extra.every(x => /^\d+(?:\.\d+)*$/.test(x)), 'Invalid owner-configured extra source sections');
    const relevantSections = [...entry.spec, ...liveSections(doc, ['2.3', '11', '12.6', '14.1', '15', '10.3', ...extra])];
    return { kind: 'google-docs-live', revision: doc.revisionId, readbackVerified: true, doneIds: entry.doneIds, relevantSections };
  }
  async syncTask(state, task) {
    requireThat(state.phase === 'SSOT_WAIT' && state.mode === 'live' && this.cfg.liveEnabled && this.cfg.authorizedTasks.includes(state.taskId) &&
      this.cfg.ssotAllowStatusWrites === true && task.id === state.taskId && state.mergeVerified === true && state.review?.verdict === 'PASS' && state.review.commitSha === state.commitSha,
      'SSOT status write not authorized/merged/reviewed');
    const doc = await this.request(); assertRevision(doc.revisionId, state.sourceRevision);
    const status = `Trạng thái ${state.taskId}: done — ${now().slice(0, 10)}. Evidence commit ${state.commitSha}; PR ${state.prUrl}; independent reviewer PASS; targeted checks recorded in repository. Residual risks: see task evidence.`;
    const edit = statusEdit(doc, task.id, status);
    await this.request(true, { requests: edit.requests, writeControl: { requiredRevisionId: doc.revisionId } });
    const after = await this.request();
    requireThat(paragraphs(after).map(p => p.text).join('\n') === edit.expected && after.revisionId !== doc.revisionId, 'SSOT readback differs outside the single authorized status paragraph');
    const entry = taskEntry(after, task.id);
    return { type: 'SSOT_SYNC', runId: state.runId, taskId: state.taskId, nonce: state.nonce, commitSha: state.commitSha,
      completedTaskId: task.id, previousRevision: doc.revisionId, revision: after.revisionId, readbackVerified: true, unrelatedPlanChanges: false, doneIds: entry.doneIds };
  }
}
