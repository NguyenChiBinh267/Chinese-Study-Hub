import { StringDecoder } from 'node:string_decoder';

// Persist allowlisted diagnostic summaries, never arbitrary stderr, prompts,
// agent messages, tool output, credential values or unrecognized config values.
const signatures = [
  ['CLI_CONFIGURATION', 'RESERVED_PROVIDER_OVERRIDE', /model_providers contains reserved built-in provider IDs|built-in providers cannot be overridden/i, 'CLI rejected overrides of reserved built-in providers.'],
  ['CLI_CONFIGURATION', 'INVALID_CONFIG', /error loading (?:default )?config|missing field [`'"]|failed to parse.*(?:config|toml)|TOML parse error/i, 'CLI reported invalid configuration.'],
  ['CLI_ARGUMENT', 'INVALID_ARGUMENT', /unexpected argument|unrecognized (?:argument|option)|invalid value .* for |unknown feature:/i, 'CLI reported an invalid argument, option or feature.'],
  ['AUTHENTICATION', 'AUTH_REQUIRED', /not logged in|please (?:log|sign) in|authentication (?:failed|required)|invalid authentication|\b401\b.*unauthorized/i, 'CLI reported an authentication failure.'],
  ['MODEL_ACCESS', 'MODEL_UNAVAILABLE', /model.*(?:not found|does not exist|not supported|do not have access|not available)|access.*model.*denied/i, 'CLI reported unavailable or denied model access.'],
  ['SANDBOX', 'SANDBOX_FAILURE', /(?:failed|unable|error).*(?:initialize|set.?up|create).*sandbox|sandbox.*(?:initialization failed|setup failed|access denied)/i, 'CLI reported a sandbox setup failure.'],
  ['MODEL_LIMIT', 'QUOTA_LIMIT', /usage.limit|rate.limit|quota.*(?:exceeded|exhausted)|limit reached/i, 'CLI reported a quota or rate limit.'],
  ['TRANSPORT', 'TRANSPORT_FAILURE', /stream disconnected|connection (?:failed|reset|refused)|\b(?:502|503)\b|request timed out/i, 'CLI reported a transport failure.']
];
const switches = new Set(['exec', '--ignore-user-config', '--ephemeral', '--json', '-']);
const features = new Set(['shell_tool', 'multi_agent', 'multi_agent_v2', 'sleep_tool', 'skill_search']);
const config = /^(?:model_reasoning_effort="(?:low|medium|high)"|approval_policy="never"|forced_login_method="chatgpt"|model_provider="openai"|windows\.sandbox="unelevated"|sandbox_workspace_write\.network_access=false|model_providers\.openai\.(?:request_max_retries|stream_max_retries|stream_idle_timeout_ms)=\d{1,8})$/;
export function safeLaunch(executable, argv, { entry, workspace, schema, output }, source) {
  const args = [], paths = new Map([['--cd', workspace], ['--output-schema', schema], ['--output-last-message', output]]);
  let sandbox = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (i === 0 && a === entry || switches.has(a)) args.push(a);
    else if (a === '-c') { const value = argv[++i]; args.push('-c', config.test(value) ? value : '[REDACTED_CONFIG]'); }
    else if (paths.has(a)) { const value = argv[++i]; args.push(a, value === paths.get(a) ? value : '[REDACTED_PATH]'); }
    else if (['--model', '--sandbox', '--color', '--disable'].includes(a)) {
      const v = argv[++i], allowed = a === '--model' ? /^gpt-\d+(?:\.\d+)*-(?:luna|terra|sol|astra)$/.test(v) :
        a === '--sandbox' ? ['read-only', 'workspace-write'].includes(v) : a === '--color' ? v === 'never' : features.has(v);
      args.push(a, allowed ? v : '[REDACTED_VALUE]'); if (a === '--sandbox' && allowed) sandbox = v;
    } else args.push('[REDACTED_ARGUMENT]');
  }
  return { executable, args, cwd: workspace, source, sandbox, stdinRetained: false, environmentRetained: false };
}

export function processDiagnostics(launch) {
  const d = { schemaVersion: 1, launch, exitCode: null, signal: null, spawnErrorCode: null, processErrorCode: null, stopReason: null,
    stdoutBytes: 0, stderrBytes: 0, jsonEvents: 0, nonJsonStdoutLines: 0, stderrLines: 0, truncated: false,
    sessionEventObserved: false, turnEventObserved: false, messages: [], classification: 'ROOT_CAUSE_UNDETERMINED',
    preInference: { state: 'UNKNOWN', inferenceRequestSent: null } };
  let pending = '', dropping = false;
  const decoder = new StringDecoder('utf8');
  function diagnostic(text, source) {
    for (const [category, code, pattern, message] of signatures) if (pattern.test(text)) {
      if (d.messages.length < 8 && !d.messages.some(m => m.code === code && m.source === source)) d.messages.push({ category, code, message, source });
      return;
    }
    // Unknown text is counted but omitted, including strings that look harmless.
  }
  function stderrLine(line) { if (line.trim()) { d.stderrLines++; diagnostic(line, 'stderr'); } }
  function stderr(bytes) {
    d.stderrBytes += bytes.length;
    for (const part of decoder.write(bytes).split(/(?<=\n)/)) {
      if (!dropping) pending += part;
      if (pending.length > 4096) { pending = ''; dropping = true; d.truncated = true; }
      if (part.endsWith('\n')) { if (!dropping) stderrLine(pending); pending = ''; dropping = false; }
    }
  }
  function event(e) {
    d.jsonEvents++;
    if (e?.type === 'thread.started') d.sessionEventObserved = true;
    if (['turn.started', 'turn.completed'].includes(e?.type)) d.turnEventObserved = true;
    if (['error', 'turn.failed'].includes(e?.type)) diagnostic(String(e.message ?? e.error?.message ?? ''), 'json-error');
  }
  function nonJson(line) { if (line.trim()) { d.nonJsonStdoutLines++; diagnostic(line, 'stdout-non-json'); } }
  function finish(code, signal) {
    const tail = decoder.end(); if (!dropping && pending.length + tail.length <= 4096) stderrLine(pending + tail);
    pending = ''; d.exitCode = Number.isInteger(code) ? code : null;
    d.signal = ['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGABRT'].includes(signal) ? signal : null;
    const spawnFailed = d.spawnErrorCode && !d.sessionEventObserved && !d.turnEventObserved;
    d.preInference = { state: spawnFailed ? 'SPAWN_FAILED' : d.turnEventObserved ? 'TURN_EVENT_OBSERVED' :
      d.sessionEventObserved ? 'SESSION_ONLY_NO_TURN_EVENT' : d.jsonEvents ? 'NO_SESSION_OR_TURN_EVENT' : 'NO_JSON_EVENTS',
      inferenceRequestSent: spawnFailed ? false : null };
    d.classification = d.stopReason === 'TIMEOUT' ? 'TIMEOUT' : d.spawnErrorCode ? 'SPAWN_FAILURE' :
      d.processErrorCode ? 'PROCESS_FAILURE' : d.stopReason ? 'RUNNER_PARSER_OR_CONTROL' : d.messages[0]?.category ?? (code === 0 ? 'NO_REPORTED_PROCESS_ERROR' : 'ROOT_CAUSE_UNDETERMINED');
    return d;
  }
  return { value: d, stderr, event, nonJson, finish };
}
