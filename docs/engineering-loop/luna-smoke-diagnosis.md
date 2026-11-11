# Luna smoke startup diagnosis (no inference)

The historical attempt at b2cb6ca exited 1 with no parsed JSON event. The retained harness added three `model_providers.openai.*` overrides. Codex CLI 0.153.4 rejects that configuration: `openai` is a reserved built-in provider ID and cannot be overridden.

This configuration rejection was reproduced using **app-server startup/initialize only**, never exec or an inference request. Baseline initialize succeeded (exit 0); the same provider overrides caused exit 1, zero stdout bytes and no initialize response. A follow-up capture with closed stdin produced the same config rejection without sending any RPC. Root/help exec and features/list were metadata/help operations only. Do not interpret `help exec` as an executed smoke.

The filtered error from this new metadata check says:

> model_providers contains reserved built-in provider IDs: `openai`. Built-in providers cannot be overridden.

That text was **not recovered from the original smoke**. Its stderr was discarded by io.mjs and raw/non-JSON stdout was not retained. The historical report and persistent budget receipt cannot recover it. Exact historical attribution therefore remains `ROOT_CAUSE_UNDETERMINED`; the reproduced invalid configuration is strong causal evidence, recorded separately from that uncertainty. Renaming the provider to a custom provider is not part of this patch and is not an authorized paid/provider fallback.

The reconstructed launch is Node's installed Codex launcher, with model gpt-5.6-luna, reasoning low, ephemeral session, ignore-user-config, read-only sandbox, approval never, forced ChatGPT/OpenAI, unelevated Windows sandbox and workspace network disabled. The harness disabled shell_tool/multi_agent/multi_agent_v2/sleep_tool/skill_search and appended:

```text
model_providers.openai.request_max_retries=0
model_providers.openai.stream_max_retries=0
model_providers.openai.stream_idle_timeout_ms=15000
```

The JSON report records the complete ordered argv and paths, stdin, 30-second timeout, evidence sources and error categories. This is reconstruction from retained source, not a historical process argv capture. The old receipt's sandbox=workspace-write came from its developer role label; the harness changed the actual launch argument to read-only. Neither value proves OS sandbox enforcement or a model request was made.

No authentication/model-access/sandbox error is established for the old attempt. Common flags and sandbox values are advertised by local help; the historical metadata advertised Luna and ChatGPT login. Those facts do not verify generation access. No controller timeout was reported, and absent JSON is not proof of absent inference. Unchanged rounded shared-account quota is not proof of zero token consumption.

## Receipt diagnostics

The real process executor now records exit code/signal, spawn failures, stdout/stderr byte counts, JSON/non-JSON event counts, session/turn observations, stop reason and diagnostic category. Actual child.spawnargs is preferred over planned argv, with its provenance and sanitized sandbox/config values. The existing role-derived sandbox field remains a planned role label; consult diagnostics.launch for launch arguments. Prompt, environment, model/tool text and raw output are not stored.

Only recognized error signatures become bounded static summaries. Unknown text is counted and omitted; arbitrary config values/arguments are redacted. This avoids leaking unrecognized secrets, including across fragmented stderr chunks. Categories describe reported signatures, not independent proof of their underlying cause. Empty/unknown stderr remains ROOT_CAUSE_UNDETERMINED. Spawn failure, CLI argument/config, authentication, model access, sandbox, timeout and result/session parsing are distinct. A zero process exit cannot override actual-model identity validation.

preInference records observed stages and inferenceRequestSent=null when unknown. No JSON events never implies inferenceRequestSent=false. Only no-dispatch/OS spawn failure records false. Diagnostics never grant authority, refund a call, retry, change model selection, relax quota/identity/acceptance checks, change reviewer permissions or turn BLOCKED into PASS.

Mock tests exercise the real process-executor event wiring with in-memory fake processes. They cover pre-JSON exit, recognized and unknown stderr, fragmented/truncated output, secret omission, actual argv provenance, spawn failure, timeout, malformed/missing output, missing actual model identity and a final event without a newline. No model process is spawned by these tests. Historical reports, the consumed one-call proof budget, live flags and grant implementation remain unchanged.

See [luna-smoke-diagnosis.json](luna-smoke-diagnosis.json) for evidence and validation counts. This work does not repair/re-run the one-shot harness or establish a successful Luna smoke.
