import fs from 'node:fs';
import path from 'node:path';
import { hash, requireThat } from './core.mjs';

// Direct owner decision, not a task/merge/status grant. Any semantic change needs
// a new reviewed owner decision; malformed/drifted policy never falls back.
const authorized = { schemaVersion: 1, decisionId: 'owner-alternative-model-assurance-2026-10-17', ownerApproved: true,
  approvedOn: '2026-10-17', repository: 'NguyenChiBinh267/Chinese-Study-Hub', referencePr: 5,
  referenceHead: 'e0dc869742e5dd2975acff004d21c24e84ed5e5a', cliVersion: '0.153.4', mode: 'alternative-routing-assurance',
  verifyActualBackendModel: false, minimumQuotaReservePercent: 20, grantsTaskMergeStatusOrDeploymentAuthority: false };
export function readAssuranceDecision(root, repository) {
  const file = path.join(root, 'tools/engineering-loop/model-assurance-policy.json');
  if (!fs.existsSync(file)) return null;
  const policy = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  requireThat(JSON.stringify(policy) === JSON.stringify(authorized) && repository === policy.repository, 'Alternative assurance decision/repository drift');
  return { ...policy, digest: hash(JSON.stringify(policy)) };
}
export function assuranceBinding(context) {
  return hash(JSON.stringify({ task: context.task, policy: context.policy, runId: context.state.runId, commitSha: context.state.commitSha,
    source: context.state.sourceCommit ?? context.state.sourceRevision, repairs: context.state.repairs }));
}
export function verifyRoutingAssurance({ decision, route, receipt, budget, context, binding, currentBinding, expectedArgs, decisionUnchanged, at = Date.now() }) {
  const d = receipt.diagnostics, q = [receipt.quotaBefore, receipt.quotaAfter];
  const checks = {
    ownerDecision: decision.ownerApproved === true && decision.grantsTaskMergeStatusOrDeploymentAuthority === false && decisionUnchanged,
    exactCliVersion: receipt.cliVersionBefore === decision.cliVersion && receipt.cliVersionAfter === decision.cliVersion,
    catalog: receipt.catalogVerifiedModel === route.model && receipt.catalogVerifiedEffort === route.reasoningEffort,
    actualArgv: d?.launch?.source === 'child.spawnargs' && d.launch.executable === process.execPath && JSON.stringify(d.launch.args) === JSON.stringify(expectedArgs),
    chatgptWithoutApiKeys: receipt.chatgptOnly === true && receipt.paidApiKeysInherited === false && q.every(x => x?.chatgptOnly === true && x.hasCredits === false && x.balance === '0'),
    freshQuotaReserve: q.every((x, index) => {
      // Before evidence must be fresh at dispatch; a legitimate long task does
      // not make that historical preflight stale at completion.
      const anchor = index === 0 ? Date.parse(receipt.startedAt) : at;
      return x && Number.isFinite(anchor) && Number.isFinite(Date.parse(x.checkedAt)) && anchor - Date.parse(x.checkedAt) >= 0 && anchor - Date.parse(x.checkedAt) <= 60000 &&
        x.reservePercent >= decision.minimumQuotaReservePercent && x.reserveReached === false && x.remainingPercent > x.reservePercent;
    }),
    persistentBudgets: [budget.calls, budget.developer, budget.reviewer, budget.escalations].every(x => Number.isSafeInteger(x) && x >= 0) &&
      budget.calls === budget.developer + budget.reviewer && budget.calls > 0 && budget.calls <= route.policy.maxCallsPerTask &&
      budget[route.role] <= route.policy[route.role === 'reviewer' ? 'maxReviewerCalls' : 'maxDeveloperCalls'] &&
      budget.escalations <= route.policy.maxEscalationsPerTask && Number.isInteger(route.repair) && route.repair >= 0 && route.repair <= 2,
    boundTaskHeadAndSource: binding === currentBinding && /^[a-f0-9]{40}$/.test(route.commitSha ?? '') && context.state.commitSha === route.commitSha &&
      typeof (context.state.sourceCommit ?? context.state.sourceRevision) === 'string' && (context.state.sourceCommit ?? context.state.sourceRevision).length > 0,
    separateSessionAndSandbox: receipt.newSession === true && receipt.resumed === false && Number.isSafeInteger(receipt.processId) && receipt.processId > 0 && receipt.processId !== process.pid &&
      typeof receipt.threadId === 'string' && receipt.threadId.length > 0 && (route.role !== 'reviewer' || receipt.sandbox === 'read-only'),
    runtimeAndEventPolicy: receipt.runtimeVerification?.verified === true && d?.routingEvents?.rejected === 0
  };
  return { verified: Object.values(checks).every(Boolean), checks, decisionId: decision.decisionId, decisionDigest: decision.digest,
    commitSha: route.commitSha, taskId: route.taskId, binding, actualModelVerified: false,
    scope: 'Routing constraints only; not backend identity, task verdict, merge/status authority or release approval' };
}
