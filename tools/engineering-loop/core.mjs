import { createHash, randomUUID } from 'node:crypto';

export const hash = value => createHash('sha256').update(value).digest('hex');
export const now = () => new Date().toISOString();
export const TERMINAL = new Set(['DONE', 'BLOCKED']);
export function requireThat(value, message) { if (!value) throw new Error(message); }

export function validateSource(source) {
  requireThat(source.schemaVersion === 1 && source.version === 'v1.1', 'Unsupported SSOT version');
  requireThat(source.documentId === '1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30', 'Wrong SSOT document');
  requireThat(typeof source.revision === 'string' && source.revision.length > 10, 'Missing source revision');
  requireThat(source.activeRelease === 'M0', 'Only M0 is activated');
  const ids = new Set(source.tasks.map(t => t.id));
  requireThat(ids.size === 70 && source.tasks.length === 70, 'Expected 70 unique task IDs');
  requireThat(source.activeIds.length === 34 && new Set(source.activeIds).size === 34, 'Expected 34 M0 IDs');
  for (let i = 1; i <= 70; i++) requireThat(ids.has(`T${String(i).padStart(3, '0')}`), 'Missing task ID');
  const visited = new Set(), visiting = new Set();
  function visit(id) {
    requireThat(!visiting.has(id), `Dependency cycle: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    const task = source.tasks.find(t => t.id === id);
    requireThat(task && Array.isArray(task.dependencies) && task.spec?.length, `Invalid task: ${id}`);
    requireThat(['done', 'pending', 'blocked', 'in-progress', 'deferred'].includes(task.status), `Unknown task status: ${id}`);
    for (const dep of task.dependencies) {
      requireThat(ids.has(dep), `Unknown dependency: ${dep}`);
      if (source.activeIds.includes(id)) requireThat(source.activeIds.includes(dep), `M0 dependency outside release: ${id}/${dep}`);
      visit(dep);
    }
    visiting.delete(id); visited.add(id);
  }
  for (const id of ids) visit(id);
  return source;
}

export function readyTasks(source) {
  validateSource(source);
  return source.tasks.filter(t => source.activeIds.includes(t.id) && t.status === 'pending' &&
    t.dependencies.every(id => source.tasks.find(d => d.id === id)?.status === 'done'))
    .sort((a, b) => (a.id === 'T068' ? -1 : b.id === 'T068' ? 1 : a.priority - b.priority || a.id.localeCompare(b.id)));
}

export function newExecution(task, source, mode = 'live') {
  return { schemaVersion: 1, runId: randomUUID(), taskId: task.id, mode, phase: 'QUEUED',
    sourceRevision: source.revision, repairs: 0, branch: null, baseSha: null, commitSha: null,
    issue: null, pr: null, worktree: null, evidence: [], events: [], consumedComments: [],
    nonce: randomUUID(), deadline: null, writerPid: null, blocker: null, createdAt: now(), updatedAt: now() };
}

export function move(state, phase, detail = {}) {
  Object.assign(state, detail, { phase, updatedAt: now() });
  state.events.push({ at: state.updatedAt, phase, repairs: state.repairs });
  return state;
}

export function parseBridgeComment(comment, config, state) {
  if (!config.reviewers.includes(comment.user?.login)) return null;
  const match = comment.body?.match(/CSH_LOOP_EVENT\s*```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  let event;
  try { event = JSON.parse(match[1]); } catch { return null; }
  if (event.runId !== state.runId || event.taskId !== state.taskId || event.nonce !== state.nonce) return null;
  if (!['SOURCE', 'REVIEW', 'SSOT_SYNC'].includes(event.type)) return null;
  return { ...event, commentId: comment.id, author: comment.user.login };
}

export function applyReview(state, event, headSha) {
  requireThat(state.phase === 'REVIEW_WAIT', 'Not awaiting a review');
  requireThat(event.type === 'REVIEW' && event.commitSha === headSha && headSha === state.commitSha, 'Stale review commit');
  requireThat(['PASS', 'REWORK', 'BLOCKED'].includes(event.verdict), 'Invalid verdict');
  requireThat(Array.isArray(event.findings) && typeof event.evidenceSummary === 'string' && event.evidenceSummary.length > 0, 'Review needs findings and independent evidence');
  for (const finding of event.findings) {
    requireThat(['P0', 'P1', 'P2', 'P3'].includes(finding.severity) && typeof finding.file === 'string' &&
      Number.isInteger(finding.line) && finding.line > 0 && typeof finding.message === 'string', 'Invalid finding');
  }
  requireThat(event.verdict !== 'PASS' || event.findings.length === 0, 'PASS cannot have unresolved findings');
  requireThat(event.verdict !== 'REWORK' || event.findings.length > 0, 'REWORK needs concrete findings');
  state.review = event;
  if (event.verdict === 'BLOCKED') return move(state, 'BLOCKED', { blocker: 'Independent reviewer blocked task' });
  if (event.verdict === 'PASS') return move(state, 'MERGE_WAIT');
  if (state.repairs >= 2) return move(state, 'BLOCKED', { blocker: 'Repair limit reached (2)' });
  state.repairs++;
  return move(state, 'REPAIR_READY');
}

export function checkDeadline(state, timestamp = Date.now()) {
  if (state.deadline && timestamp >= Date.parse(state.deadline)) move(state, 'BLOCKED', { blockedFrom: state.phase, blocker: `Timeout waiting in ${state.phase}` });
  return state;
}

export function allowedPath(file, allowed) {
  if (file.includes('\\') || file.startsWith('/') || file.split('/').some(p => p === '..' || p === '.git') || file.includes(':')) return false;
  return allowed.some(pattern => pattern.endsWith('/**') ? file.startsWith(pattern.slice(0, -2)) : file === pattern);
}

export function validateReport(report, state, changedFiles) {
  requireThat(report.taskId === state.taskId && ['COMPLETE', 'BLOCKED'].includes(report.result), 'Invalid developer report');
  requireThat(Array.isArray(report.tests) && Array.isArray(report.evidence) && Array.isArray(report.changedFiles), 'Missing developer evidence');
  requireThat(typeof report.blocker === 'string', 'Missing blocker field');
  requireThat(report.changedFiles.slice().sort().join('\n') === changedFiles.slice().sort().join('\n'), 'Report changed files do not match Git');
  requireThat(report.result !== 'COMPLETE' || report.tests.length > 0 && report.tests.every(t => t.passed === true) && report.blocker === '', 'Incomplete developer checks');
  return report;
}
