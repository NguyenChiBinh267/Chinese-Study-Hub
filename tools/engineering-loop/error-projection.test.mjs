import test from 'node:test';
import assert from 'node:assert/strict';
import { projectErrorMessage } from './error-projection.mjs';
import { processDiagnostics } from './diagnostics.mjs';

test('Diagnostic projection retains useful fixed words but no arbitrary values or quoted secrets', () => {
  const r = projectErrorMessage('Warning: unsupported parameter "response_format" for this model. owner=private-name https://host/token?a=secret C:\\private\\token');
  assert.ok(r.tokens.includes('warning')); assert.ok(r.tokens.includes('unsupported')); assert.ok(r.tokens.includes('parameter'));
  assert.doesNotMatch(JSON.stringify(r), /private-name|host|response_format|C:\\|token\?a/);
  for (const value of ['Bearer privateabc', 'password=hello model', 'api_key=secret-value', 'sk-proj-abcdef123', 'ghp_abc123', 'ya29.abcdef']) assert.doesNotMatch(JSON.stringify(projectErrorMessage(value)), /privateabc|hello|secret-value|abcdef|abc123/);
});
test('Error projections are bounded, partial and never model identity evidence', () => {
  const r = projectErrorMessage('unsupported '.repeat(10000)); assert.ok(r.truncated); assert.ok(r.tokens.length <= 160); assert.equal(r.partial, true); assert.equal(r.identityEvidence, false);
  const d = processDiagnostics({}); d.event({ type: 'item.completed', item: { type: 'error', message: 'Experimental features enabled: shell_tool' } });
  d.stderr(Buffer.from('Warning: configuration ignored\n')); d.finish(1, null);
  assert.equal(d.value.errorProjections.length, 2); assert.equal(d.value.classification, 'ROOT_CAUSE_UNDETERMINED');
  d.event({ type: 'item.completed', item: { type: 'agent_message', text: 'authentication failed' } }); assert.equal(d.value.errorProjections.length, 2);
  for (let i = 0; i < 30; i++) d.event({ type: 'error', message: 'unknown-value' }); assert.equal(d.value.errorProjections.length, 8);
});
