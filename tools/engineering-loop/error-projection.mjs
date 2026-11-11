// Lossy diagnostic vocabulary, not arbitrary redacted prose. Every emitted token
// is a fixed constant. Unknown text, paths, account data and quoted values vanish.
const vocabulary = new Set(`a an the this that is are was were has have been not no cannot can could failed failure error warning notice deprecated deprecation experimental features feature enabled disabled unstable under-development configuration config invalid unsupported supported unavailable unexpected required missing parameter value argument option model models reasoning effort low medium high json schema output response format response_format json_schema tools tool shell_tool tool_choice parallel_tool_calls temperature stream streaming instructions system developer message messages input request requests rejected server client account chatgpt authentication authorization login token refresh expired reused sandbox read-only workspace-write policy provider openai built-in reserved detected ignored using use with for to from in on of and or but because only must should please initialize thread turn connection disconnected timeout retry retrying reconnecting network transport quota limit reached exceeded capacity temporarily rate usage plan free credits insufficient billing resource path file directory windows permissions access denied approval never cache warning suppress unstable_features_warning suppress_unstable_features_warning skills skill unavailable not_found unsupported_value invalid_request_error model_not_found insufficient_quota unauthorized forbidden gpt-5.6-luna`.split(/\s+/));
export function projectErrorMessage(value) {
  if (typeof value !== 'string') return null;
  const originalBytes = Buffer.byteLength(value);
  let text = value.slice(0, 4096);
  text = text.replace(/(?:authorization|cookie|password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=].*/gi, ' [redacted] ')
    .replace(/bearer\s+\S+|sk-[\w-]+|gh[pousr]_[\w-]+|ya29\.[\w.-]+/gi, ' [redacted] ')
    .replace(/https?:\/\/\S+|[A-Za-z]:[\\/][^\n]+|[\w.+-]+@[\w.-]+/g, ' [redacted] ')
    .replace(/["'`][^"'`\n]*["'`]/g, ' [redacted] ');
  const words = text.toLowerCase().match(/[a-z][a-z0-9_.-]*/g) ?? [];
  const tokens = words.slice(0, 160).map(word => vocabulary.has(word) ? word : '[redacted]');
  return { tokens, originalBytes, partial: true, truncated: value.length > 4096 || words.length > 160,
    method: 'fixed diagnostic vocabulary; unknown/quoted values omitted', payloadRetained: false, identityEvidence: false };
}
