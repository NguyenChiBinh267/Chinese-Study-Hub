# CLI 0.153.4 runtime and model evidence

Scope: PR #5 follow-up through `e0dc869742e5dd2975acff004d21c24e84ed5e5a`. Owner approved Alternative Model Assurance on 2026-10-17. This changes the model-assurance contract only. No application task, real PR #6 takeover, merge, status write or runtime grant is activated here. Previous reports remain historical evidence, not rewritten PASS.

## Exact nonfatal warning

Version-pinned sources read for this change:

- [exec_events.rs](https://raw.githubusercontent.com/openai/codex/rust-v0.153.4/codex-rs/exec/src/exec_events.rs): error items may describe nonfatal notifications; top-level error/turn.failed are separate events.
- [event_processor_with_jsonl_output.rs](https://raw.githubusercontent.com/openai/codex/rust-v0.153.4/codex-rs/exec/src/event_processor_with_jsonl_output.rs): collect_warning emits item.completed/error while status stays Running; model reroutes also become error items.
- [ext/skills/src/render.rs](https://raw.githubusercontent.com/openai/codex/rust-v0.153.4/codex-rs/ext/skills/src/render.rs): the static SKILL_DESCRIPTION_TRUNCATED_WARNING constant.

The runner compares the entire runtime message with that source constant in memory. Only item.completed with the expected envelope and an exactly equal message is accepted as NONFATAL_WARNING. No trimming, case folding, prefix/keyword/length match or general error exemption. A same-length mutation, extra text/field or wrong lifecycle fails closed. Receipts retain the constant's code, event shape and count, never the runtime message. The checked-in expected source constant is not a captured runtime payload.

Unknown errors, reroutes, top-level errors, turn.failed, malformed JSON/usage, tools, writes and delegation remain rejected. Stderr is independent: the JSON warning neither clears nor excuses it. For this minimal smoke, any nonblank stderr lacking a separately verified safe classification prevents runtime verification; known launch/config/auth/sandbox diagnostics retain their own classification. No stderr allowlist was expanded from inference about the warning.

## Runtime proof is separate from model proof

The smoke records CLI-supported execution criteria separately: turn.completed observed, valid structured output against the supplied schema, exit0, valid nonnegative input/cached/output usage with cached≤input, no event/control-policy violation, and independently accepted stderr. Each must pass. A warning by itself, output file by itself or exit0 does not pass. Post-call quota/reserve validation remains required by the runner. A failed process leaves runtime verification false, not a fabricated result.

Receipt fields:

| Field | Meaning |
| --- | --- |
| requestedModel | Explicit model selected by deterministic routing for argv. |
| catalogVerifiedModel | That exact model/effort was advertised by fresh authenticated CLI model/list; not a generation identity claim. |
| actualModel / actualModelVerified | A supported trustworthy identity channel would be required; neither catalogue nor argv is copied into actual identity. For this version-pinned smoke, these stay null/false. |
| unverifiedReportedModel | Optional test/future-extension field, if present outside the pinned exec schema; never verifies the model. |
| runtimeVerification | CLI execution criteria only; cannot approve model safety, review or merge. |
| routingAssuranceVerified | All approved alternative routing checks passed for this invocation; never actual backend identity or a task verdict. Defaults false on failure. |

The JSONL processor receives SessionConfigured but emits only thread_id in thread.started. The declared turn.started has no fields; turn.completed exposes usage. The exec schema does not promise an actual-model identity event. Generic legacy/future event observers elsewhere in the runner do not establish that CLI0.153.4 emits those extensions; mock streams containing them are not runtime evidence. Stderr model mentions and agent-written JSON are not identity evidence either. Ephemeral execution does not grant access to a trustworthy persisted rollout identity channel.

For the exact approved CLI version, the owner-approved alternative below replaces the requirement for unavailable exec identity evidence. `actualModel=null` and `actualModelVerified=false` remain mandatory; extension/test fields remain unverified observations. Without the repository-bound decision file, the previous strict identity gate remains. A changed/malformed decision or wrong repository blocks; it cannot silently select a weaker mode.

## Approved alternative assurance — routing constraints only

Decision `owner-alternative-model-assurance-2026-10-17` is recorded in `tools/engineering-loop/model-assurance-policy.json`, bound to this repository, PR #5's reference HEAD and CLI0.153.4. It grants no task, merge, status or deployment authority. The runner requires all of these together:

- Exact CLI version from metadata-only `--version` before/after; fresh complete authenticated catalogue supporting the selected model and effort.
- Actual `child.spawnargs` equal the runner's complete pinned argv. An argv mismatch withholds the prompt; no retry or fallback.
- ChatGPT login, stripped API credentials and known-zero paid credits. Fresh quota snapshots before/after, every applicable shared/model window above at least20% reserve. Shared quota is never described as separate model quota.
- Persistent role/total call and escalation limits; at most two repairs; duplicate-review safeguards retained.
- New ephemeral process/session, read-only Reviewer sandbox, unchanged exact HEAD/source/task/contract binding. The existing controller/reviewer still reads actual bytes and performs deterministic acceptance; routing assurance cannot produce PASS.
- Valid completed structured output, exit0 and full token usage; independent stderr classification; no unknown/malformed event, unapproved error, reroute or delegation. Task sessions may report schema-valid sandboxed commands, plans and Developer file changes; Reviewer file-change events remain forbidden. The minimal smoke still forbids all tools/writes/plans.

Only after all checks pass does the receipt set `routingAssuranceVerified=true`. This path is covered by fake child-process tests; it has not received a new real inference proof in this change.

This alternative cannot prove the provider used the requested model: absence of a reroute notice is not positive identity attestation. The owner explicitly accepted that limitation. Trust is restricted to the pinned CLI's authenticated catalogue, argv/auth/quota enforcement and surfaced event errors/reroutes; no backend identity claim follows. No additional inference, Reviewer run or operational grant follows from this policy approval.

## Independent stderr policy and historical limitation

[core/src/shell_snapshot.rs at rust-v0.153.4](https://raw.githubusercontent.com/openai/codex/rust-v0.153.4/codex-rs/core/src/shell_snapshot.rs) lines104-117 return an optional snapshot after `snapshot.ok()`; lines155-161 warn when writing fails; lines202-209 explicitly reject PowerShell/Cmd snapshot support. The exact PowerShell unsupported-snapshot warning is therefore a nonfatal optional-feature diagnostic, separate from sandbox initialization. `stderr-policy.mjs` accepts only its exact source-defined body, expected WARN target and valid timestamp envelope. Runtime text is compared in memory and discarded; receipts retain a fixed classification code. Extra text, another target/level, near-match or any other line blocks. Known config/auth/sandbox errors remain independent, even alongside a safe warning. Oversized/truncated or unfinished diagnostics never pass.

The historical smoke's **158 stderr bytes are still UNCLASSIFIED**. Its filtered projection resembles the source warning, but resemblance/length cannot establish exact equality. The raw bytes/hash were not retained. A read-only query of existing local logs for that smoke's exact thread/time found no matching records. This is an observability gap, not proof of benign stderr or a newly diagnosed cause. The new exact classifier cannot be retroactively applied to lossy evidence. The historical receipt remains unchanged and BLOCKED; no new smoke is authorized in this turn.

## Bounded verification

Mock/regression tests run without inference. No smoke or Reviewer is run in this policy change. A full-candidate bootstrap review requires all runtime gates first, fresh quota/call budget, pinned PR/repository/branch/HEAD/base and independent read-only review of the entire candidate. With the historical stderr unresolved, review preparation remains BLOCKED and no model budget is consumed. Actual identity is transparently unverified under the approved alternative; unresolved stderr and missing full-candidate review still prevent READY.
