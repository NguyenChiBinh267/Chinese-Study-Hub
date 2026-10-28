import { hash, requireThat } from './core.mjs';

export const ROUTING_DEFAULTS = Object.freeze({ quotaReservePercent: 20, maxCallsPerTask: 6, maxDeveloperCalls: 3,
  maxReviewerCalls: 3, maxEscalationsPerTask: 0, allowEscalation: false, allowAstra: false,
  allowedEscalationModels: [], syntheticProofAuthorization: null });
export function routingPolicy(input = {}, taskId) {
  const p = { ...ROUTING_DEFAULTS, ...input, ...(input.tasks?.[taskId] ?? {}) };
  for (const [key, max] of [['maxCallsPerTask', 6], ['maxDeveloperCalls', 3], ['maxReviewerCalls', 3]])
    requireThat(Number.isInteger(p[key]) && p[key] > 0 && p[key] <= max, `Invalid routing budget: ${key}`);
  requireThat(Number.isInteger(p.quotaReservePercent) && p.quotaReservePercent >= 20 && p.quotaReservePercent <= 95, 'Invalid quota reserve');
  requireThat(Number.isInteger(p.maxEscalationsPerTask) && p.maxEscalationsPerTask >= 0 && p.maxEscalationsPerTask <= 1, 'Invalid escalation budget');
  requireThat(typeof p.allowEscalation === 'boolean' && typeof p.allowAstra === 'boolean' && Array.isArray(p.allowedEscalationModels), 'Invalid escalation policy');
  return p;
}
// Family order is a conservative routing policy, not measured price or per-model quota.
const family = model => /^gpt-\d+(?:\.\d+)*-(luna|terra|sol|astra)$/.exec(model)?.[1];
const families = ['luna', 'terra', 'sol', 'astra'];
export function selectModel(context, role, input = {}, metadata) {
  const { task, policy, state } = context ?? {};
  requireThat(task?.id && task.id === state?.taskId && typeof state.runId === 'string' && state.runId.length > 0 &&
    Array.isArray(task.spec) && task.spec.length && task.spec.every(x => typeof x === 'string') &&
    Array.isArray(policy?.allowedFiles) && policy.allowedFiles.length && policy.allowedFiles.every(x => typeof x === 'string'), 'Missing verified task routing context');
  requireThat(['developer', 'reviewer'].includes(role) && Number.isInteger(state.repairs) && state.repairs >= 0 && state.repairs <= 2, 'Invalid role/repair routing context');
  const p = routingPolicy(input, task.id), files = policy.allowedFiles.map(f => f.replace(/\\/g, '/'));
  // Only controller/source task data is classified; never prompts, COMPLETE claims or findings.
  const text = [task.title ?? '', ...task.spec, ...files].join('\n');
  const highRisk = task.complexity === 'complex' || policy.riskLevel === 'high' || /\b(?:complex|architecture|architectural|deadlock|root.cause|auth(?:entication|orization)?|rls|security|concurrency|race|oauth|claims|least.privilege|ssot|git\s+(?:merge|push)|grant|quota|sandbox)\b|phức tạp|kiến trúc|tools\/engineering-loop\/|supabase\/|migrations\//i.test(text);
  const simple = !highRisk && files.every(f => /\.(?:md|txt|json|css|scss)$/.test(f) || /(?:^|\/)(?:ui|components)\//.test(f)) && files.length <= 4;
  let model = null;
  let reasoningEffort = highRisk ? (role === 'reviewer' ? 'high' : 'medium') : (role === 'reviewer' || !simple ? 'medium' : 'low');
  const reason = highRisk ? 'verified task contains architecture/complex debugging/security/concurrency/Git/SSOT/control-plane risk' : simple ? 'small documentation/data/style/UI scope' : 'ordinary scoped development';
  let escalationReason = null;
  if (context.escalation) {
    const e = context.escalation;
    requireThat(p.allowEscalation && p.maxEscalationsPerTask > 0 && typeof e.reason === 'string' && e.reason.trim().length >= 20 && e.reason.length <= 500 &&
      !/sk-(?:proj-)?[A-Za-z0-9_-]{25,}|gh[pousr]_[A-Za-z0-9]{20,}|ya29\./.test(e.reason) &&
      p.allowedEscalationModels.includes(e.model) && ['sol', ...(p.allowAstra ? ['astra'] : [])].includes(family(e.model)), 'Model escalation not authorized');
    reasoningEffort = role === 'reviewer' ? 'high' : 'medium'; escalationReason = e.reason;
  }
  const synthetic = /^D\d/.test(task.id) || ['dry-local', 'dry-github', 'git-fixture'].includes(state.mode);
  if (synthetic) requireThat(typeof p.syntheticProofAuthorization?.id === 'string' && p.syntheticProofAuthorization.id.length >= 16 && Date.parse(p.syntheticProofAuthorization.expiresAt) > Date.now() &&
    Number.isInteger(p.syntheticProofAuthorization.maxCalls) && p.syntheticProofAuthorization.maxCalls > 0 && p.syntheticProofAuthorization.maxCalls <= 8, 'Synthetic CLI proofs disabled; one-time bounded proof authorization required');
  if (metadata) {
    requireThat(metadata.accountType === 'chatgpt' && metadata.catalogueComplete === true && Array.isArray(metadata.models), 'Unverified ChatGPT CLI model catalogue');
    const eligible = metadata.models.filter(m => m.hidden === false && m.availabilityNux === null &&
      Array.isArray(m.supportedReasoningEfforts) && m.supportedReasoningEfforts.some(e => (e.reasoningEffort ?? e) === reasoningEffort));
    const preferred = (highRisk ? ['sol'] : ['luna', 'terra', 'sol']).find(f => eligible.some(m => family(m.model) === f));
    const candidates = eligible.filter(m => preferred && family(m.model) === preferred);
    requireThat(candidates.length === 1, 'MODEL_UNAVAILABLE: no unambiguous advertised model for routing class/effort');
    model = candidates[0].model;
    if (escalationReason) {
      requireThat(families.indexOf(family(context.escalation.model)) > families.indexOf(family(model)), 'Model escalation must increase the verified routing tier');
      model = context.escalation.model;
    }
    supportedModel(metadata, { model, reasoningEffort });
  }
  const budgetKey = synthetic ? `proof:${p.syntheticProofAuthorization.id}:${task.id}` : state.bootstrapTarget ?
    `bootstrap:${state.bootstrapTarget.repository}#${state.bootstrapTarget.pr}:${state.baseSha}` : `task:${state.runId}:${task.id}`;
  const invocationKey = hash(JSON.stringify({ role, model, escalation: Boolean(escalationReason), commit: state.commitSha, repair: state.repairs,
    source: state.sourceCommit ?? state.sourceRevision, contract: hash(JSON.stringify(task.spec)), policy: hash(JSON.stringify(policy)) }));
  return { taskId: task.id, role, model, reasoningEffort, reason, escalationReason, repair: state.repairs, commitSha: state.commitSha, budgetKey, invocationKey,
    syntheticProof: synthetic ? p.syntheticProofAuthorization : null, policy: p };
}
export function supportedModel(metadata, route) {
  requireThat(metadata.accountType === 'chatgpt' && metadata.catalogueComplete === true && Array.isArray(metadata.models), 'Unverified ChatGPT CLI model catalogue');
  const m = metadata.models.find(m => m.model === route.model);
  requireThat(m && m.hidden === false && m.availabilityNux === null && Array.isArray(m.supportedReasoningEfforts) &&
    m.supportedReasoningEfforts.some(e => (e.reasoningEffort ?? e) === route.reasoningEffort), `MODEL_UNAVAILABLE: ${route.model}/${route.reasoningEffort} not advertised by authenticated CLI`);
  return m;
}
export function selectedQuota(metadata, route, at = Date.now(), enforceReserve = true) {
  supportedModel(metadata, route);
  requireThat(Number.isFinite(Date.parse(metadata.checkedAt)) && at - Date.parse(metadata.checkedAt) >= 0 && at - Date.parse(metadata.checkedAt) <= 60000, 'Stale quota metadata');
  const all = metadata.rateLimitsByLimitId ?? {}, entries = Object.entries(all);
  // Shared Codex allowance is an account ceiling, never a claim of per-model quota.
  const specific = entries.filter(([, b]) => b && (b.model === route.model || b.normalModelSlug === route.model || Array.isArray(b.models) && b.models.includes(route.model)));
  const shared = entries.filter(([id, b]) => id === 'codex' && b && !b.model && !b.normalModelSlug && (!b.models || Array.isArray(b.models) && b.models.length === 0));
  requireThat(specific.length > 0 || shared.length === 1, 'QUOTA_UNVERIFIED: no selected-model or shared Codex account allowance');
  const chosen = [...new Map([...entries.filter(([id]) => id === 'codex'), ...specific]).entries()];
  const buckets = chosen.map(([id, b]) => {
    requireThat(b.credits?.hasCredits === false && b.credits?.unlimited === false && typeof b.credits?.balance === 'string' &&
      /^0(?:\.0+)?$/.test(b.credits.balance), 'Paid credit eligibility unavailable/nonzero');
    requireThat(b.spendControlReached === false && !b.rateLimitReachedType, 'Account/model spending or quota limit reached');
    const windows = [b.primary, b.secondary].filter(Boolean);
    requireThat(windows.length > 0 && windows.every(w => Number.isFinite(w.usedPercent) && w.usedPercent >= 0 && w.usedPercent <= 100 &&
      Number.isFinite(w.resetsAt) && w.resetsAt * 1000 > at && Number.isFinite(w.windowDurationMins) && w.windowDurationMins > 0), 'Incomplete model quota metadata');
    if (enforceReserve) requireThat(windows.every(w => 100 - w.usedPercent > route.policy.quotaReservePercent), 'QUOTA_RESERVE: selected model/account at reserved quota boundary');
    return { id, windows: windows.map(w => ({ usedPercent: w.usedPercent, remainingPercent: 100 - w.usedPercent, resetsAt: w.resetsAt, windowDurationMins: w.windowDurationMins })) };
  });
  const remainingPercent = Math.min(...buckets.flatMap(b => b.windows.map(w => w.remainingPercent)));
  return { checkedAt: metadata.checkedAt, model: route.model, quotaScope: specific.length ? (shared.length ? 'model-and-account' : 'model-specific') : 'shared-account',
    modelQuotaVerified: specific.length > 0, remainingPercent, usablePercent: Math.max(0, remainingPercent - route.policy.quotaReservePercent), reservePercent: route.policy.quotaReservePercent, buckets,
    reserveReached: buckets.some(b => b.windows.some(w => w.remainingPercent <= route.policy.quotaReservePercent)),
    chatgptOnly: true, hasCredits: false, balance: '0', ordinaryQuotaAvailable: true, resetCreditsUsed: false };
}

export function consumeModelBudget(previous, route) {
  requireThat(typeof route.model === 'string' && /^[a-zA-Z0-9._-]{1,100}$/.test(route.model), 'Unresolved model route');
  const b = previous ? structuredClone(previous) : { schemaVersion: 1, key: route.budgetKey, calls: 0, developer: 0, reviewer: 0, escalations: 0, attempts: [] };
  requireThat(b.key === route.budgetKey && [b.calls, b.developer, b.reviewer, b.escalations].every(x => Number.isSafeInteger(x) && x >= 0) &&
    Array.isArray(b.attempts) && b.attempts.length === b.calls && b.developer + b.reviewer === b.calls && b.escalations <= b.calls, 'Corrupt persistent model budget');
  requireThat(b.calls < route.policy.maxCallsPerTask && b[route.role] < route.policy[route.role === 'developer' ? 'maxDeveloperCalls' : 'maxReviewerCalls'], 'Task model-call budget exhausted');
  requireThat(!b.attempts.some(a => a.invocationKey === route.invocationKey), 'Duplicate model invocation for same task/role/HEAD; no automatic replay');
  requireThat(route.role !== 'reviewer' || !b.attempts.some(a => a.role === 'reviewer' && (!a.commitSha || a.commitSha === route.commitSha)), 'Duplicate reviewer HEAD or legacy review missing HEAD; reconcile before another review');
  requireThat(!route.escalationReason || b.escalations < route.policy.maxEscalationsPerTask, 'Task escalation budget exhausted');
  requireThat(!route.escalationReason || b.attempts.some(a => a.role === route.role && a.commitSha === route.commitSha && a.status === 'BLOCKED' && !a.escalationReason), 'Escalation requires a recorded failed same-HEAD attempt');
  b.calls++; b[route.role]++; if (route.escalationReason) b.escalations++;
  b.attempts.push({ invocationKey: route.invocationKey, role: route.role, model: route.model, commitSha: route.commitSha, repair: route.repair,
    escalationReason: route.escalationReason, status: 'RESERVED', at: new Date().toISOString() });
  return b;
}

export function observeModelEvent(receipt, event, route) {
  // Never inspect agent_message text or tool output for control/usage metadata.
  const identity = ['thread.started', 'turn.started', 'turn.completed'].includes(event.type) ? event :
    event.type === 'session_meta' ? event.payload : null;
  if (identity?.model) {
    requireThat(/^[a-zA-Z0-9._-]{1,100}$/.test(identity.model), 'Invalid actual model identity');
    receipt.actualModel = identity.model;
    requireThat(receipt.actualModel === route.model, 'Actual model differs from authorized route');
  }
  if (identity?.reasoning_effort) { receipt.actualReasoningEffort = identity.reasoning_effort; requireThat(identity.reasoning_effort === route.reasoningEffort, 'Actual reasoning differs from route'); }
  if (['model.rerouted', 'model/rerouted'].includes(event.type)) throw new Error('Unapproved server model reroute; no automatic fallback');
  const cumulative = event.type === 'event_msg' && event.payload?.type === 'token_count' ? event.payload.info?.total_token_usage : null;
  const raw = event.type === 'turn.completed' ? event.usage : cumulative;
  if (raw) {
    const v = [raw.input_tokens, raw.cached_input_tokens, raw.output_tokens].map(n => n ?? null);
    requireThat(v.every(n => n === null || Number.isSafeInteger(n) && n >= 0) && (v[0] === null || v[1] === null || v[1] <= v[0]), 'Invalid token usage metadata');
    const add = (a, b) => a === null || b === null ? null : a + b;
    if (cumulative) {
      if (receipt.usage?.source !== 'turn.completed') receipt.usage = { inputTokens: v[0], cachedInputTokens: v[1], outputTokens: v[2], totalTokens: add(v[0], v[2]), source: 'token_count.total' };
      return;
    }
    if (event.turn_id) {
      receipt.usageTurnIds ??= [];
      if (receipt.usageTurnIds.includes(event.turn_id)) return;
      receipt.usageTurnIds.push(event.turn_id);
    }
    if (receipt.usage?.source !== 'turn.completed') receipt.usage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, source: 'turn.completed' };
    receipt.usage.inputTokens = add(receipt.usage.inputTokens, v[0]); receipt.usage.cachedInputTokens = add(receipt.usage.cachedInputTokens, v[1]); receipt.usage.outputTokens = add(receipt.usage.outputTokens, v[2]);
    receipt.usage.totalTokens = add(receipt.usage.inputTokens, receipt.usage.outputTokens);
  }
}
