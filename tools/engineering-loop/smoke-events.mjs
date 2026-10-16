// codex exec JSONL, verified against openai/codex rust-v0.153.4:
// codex-rs/exec/src/exec_events.rs (not the app-server notification protocol).
import { isKnownNonfatalWarning } from './cli-exec-contract.mjs';
export const EXEC_SCHEMA_SOURCE = 'https://raw.githubusercontent.com/openai/codex/rust-v0.153.4/codex-rs/exec/src/exec_events.rs';
const events = new Set(['thread.started', 'turn.started', 'turn.completed', 'turn.failed', 'error', 'item.started', 'item.updated', 'item.completed']);
const tools = new Set(['command_execution', 'file_change', 'mcp_tool_call', 'collab_tool_call', 'web_search']);
const knownItems = new Set(['agent_message', 'reasoning', 'error', 'todo_list', ...tools]);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function name(v) {
  if (v === undefined) return null;
  // Type labels and keys are untrusted too. Never echo token-shaped/dynamic payloads.
  return typeof v === 'string' && /^[a-z][a-z0-9_.]{0,47}$/.test(v) && !/(?:bearer|secret|password|credential)|^[a-z0-9]{25,}$/.test(v) ? v : '[REDACTED_IDENTIFIER]';
}
function fields(v) { return object(v) ? Object.keys(v).slice(0, 32).map(name).sort() : []; }
export function createSmokeEventGuard() {
  const state = { schemaVersion: 1, schemaSource: EXEC_SCHEMA_SOURCE, eventsSeen: 0, accepted: 0, rejected: 0,
    omittedRecords: 0, records: [], firstRejection: null, rejectedToolItems: 0, nonfatalWarnings: 0, turnCompleted: false };
  function record(e, reason, action = 'reject', bytes = null) {
    const row = { eventType: name(e?.type), itemType: name(e?.item?.type), eventFields: fields(e), itemFields: fields(e?.item),
      eventFieldCount: object(e) ? Object.keys(e).length : 0, itemFieldCount: object(e?.item) ? Object.keys(e.item).length : 0,
      reason, action, payloadRetained: false, metadataPolicy: 'bounded identifiers only; unsafe names redacted; values omitted' };
    if (bytes !== null) row.bytes = bytes;
    if (state.records.length < 32) state.records.push(row); else state.omittedRecords++;
    if (action === 'reject') { state.rejected++; state.firstRejection ??= row; } else state.accepted++;
    return row;
  }
  function inspect(e) {
    state.eventsSeen++;
    if (!object(e) || typeof e.type !== 'string') return record(e, 'MALFORMED_EVENT_ENVELOPE');
    if (!events.has(e.type)) return record(e, 'UNKNOWN_EVENT_TYPE');
    if (e.type.startsWith('item.')) {
      if (!object(e.item) || typeof e.item.type !== 'string' || typeof e.item.id !== 'string' || !e.item.id) return record(e, 'MALFORMED_ITEM_ENVELOPE');
      if (!knownItems.has(e.item.type)) return record(e, 'UNKNOWN_ITEM_TYPE');
      if (tools.has(e.item.type)) { state.rejectedToolItems++; return record(e, 'DISALLOWED_TOOL_OR_WRITE_ITEM'); }
      if (e.item.type === 'todo_list') return record(e, 'DISALLOWED_PLAN_ITEM');
      if (e.item.type === 'error') {
        if (isKnownNonfatalWarning(e.item.message)) {
          if (e.type !== 'item.completed' || Object.keys(e).length !== 2 || Object.keys(e.item).length !== 3) return record(e, 'MALFORMED_WARNING_ENVELOPE');
          state.nonfatalWarnings++; const row = record(e, 'NONFATAL_WARNING', 'accept');
          row.warningCode = 'SKILL_DESCRIPTION_TRUNCATED_WARNING'; return row;
        }
        return record(e, typeof e.item.message === 'string' ? 'REPORTED_CLI_ERROR_ITEM' : 'MALFORMED_ERROR_ITEM');
      }
      if (typeof e.item.text !== 'string') return record(e, 'MALFORMED_TEXT_ITEM');
    }
    if (e.type === 'error' || e.type === 'turn.failed') return record(e,
      typeof (e.type === 'error' ? e.message : e.error?.message) === 'string' ? 'REPORTED_CLI_ERROR' : 'MALFORMED_ERROR_EVENT');
    if (e.type === 'thread.started' && (typeof e.thread_id !== 'string' || !e.thread_id)) return record(e, 'MALFORMED_THREAD_EVENT');
    if (e.type === 'turn.completed' && (!object(e.usage) || !['input_tokens', 'cached_input_tokens', 'output_tokens'].every(k => Number.isSafeInteger(e.usage[k]) && e.usage[k] >= 0) || e.usage.cached_input_tokens > e.usage.input_tokens)) return record(e, 'MALFORMED_USAGE_EVENT');
    if (e.type === 'turn.completed') state.turnCompleted = true;
    return record(e, 'SCHEMA_SUPPORTED_OBSERVATIONAL_EVENT', 'accept');
  }
  function malformed(bytes) { state.eventsSeen++; return record(null, 'MALFORMED_JSON', 'reject', bytes); }
  return { state, inspect, malformed };
}
