# CLI 0.153.4 runtime and model evidence

Scope: PR #5 follow-up from `443398d4cff22c2b4072df5e48382ce98529f69a`. No application task, real PR #6 takeover, merge, status write or runtime grant is activated here. Previous reports remain historical evidence, not rewritten PASS.

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

The JSONL processor receives SessionConfigured but emits only thread_id in thread.started. The declared turn.started has no fields; turn.completed exposes usage. The exec schema does not promise an actual-model identity event. Generic legacy/future event observers elsewhere in the runner do not establish that CLI0.153.4 emits those extensions; mock streams containing them are not runtime evidence. Stderr model mentions and agent-written JSON are not identity evidence either. Ephemeral execution does not grant access to a trustworthy persisted rollout identity channel.

The existing strict model gate remains required. Even successful execution evidence is insufficient to run full-candidate bootstrap review or declare READY while actual identity remains unverified. There is no new setting, self-issued grant or auto-fallback that accepts catalogue/argv as actual model.

## Proposed alternative assurance — not authorized or activated

If the owner later explicitly accepts a different assurance contract for a CLI with no actual-model event, it could require all of the following together: fresh complete authenticated catalogue/effort; exact observed child argv; ChatGPT-only auth with stripped API credentials and known-zero credits; fresh conservative shared quota and20% reserve before/after; independent ephemeral read-only reviewer; strict reroute/unknown-event rejection; exact commit/source/contract/acceptance binding; persistent budgets; and valid completed output/usage/exit/stderr evidence. Record this as **routing constraints verified**, while actualModelVerified remains false.

This alternative cannot prove the provider used the requested model: absence of a reroute notice is not positive identity attestation. It requires an explicit reviewed policy decision replacing the identity requirement, including what upstream reroute reporting is trusted. It is only a proposal in this document. No repeated smoke, second model or Reviewer invocation is authorized by that proposal.

## Bounded verification

Mock tests must pass first, covering exact/near warning strings, error/tool/reroute retention, independent stderr rejection and each required result criterion. A newly owner-authorized real proof may use exactly one Luna/low call, read-only, timeout30s, no retry/fallback, under a fresh20% quota reserve. Once attempted, failed or incomplete evidence stops model verification. Publish VERIFIED versus UNVERIFIED facts separately; retain the strict identity blocker and do not claim READY from a partial result.
