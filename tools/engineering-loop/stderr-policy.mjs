// Source: rust-v0.153.4 core/src/shell_snapshot.rs:155-161,202-209.
// Optional shell-state snapshot support, not sandbox initialization or access.
const body = 'Failed to create shell snapshot for powershell: Shell snapshot not supported yet for PowerShell';
export function classifySafeStderr(line) {
  if (typeof line !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,9}Z)\s+WARN codex_core::shell_snapshot: (.*)$/.exec(line.replace(/\r?\n$/, ''));
  if (!match || !Number.isFinite(Date.parse(match[1])) || match[2] !== body) return null;
  return { code: 'WINDOWS_POWERSHELL_SNAPSHOT_UNSUPPORTED', classification: 'SOURCE_VERIFIED_NONFATAL_STDERR', payloadRetained: false };
}
export function stderrAccepted(d) {
  return d?.stderrFinalized === true && !d.truncated && d.stderrRejectedLines === 0 && Number.isSafeInteger(d.stderrBytes) && d.stderrBytes >= 0;
}
