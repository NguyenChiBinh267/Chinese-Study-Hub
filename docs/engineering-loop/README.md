# Git-native engineering loop — operations

Latest bounded owner-authorization follow-up: [readiness report](owner-authorization-readiness-report.json), [diagnostic receipt](owner-readiness-diagnostic-receipt.json), and [operating contract](owner-readiness.md). Final status BLOCKED: 143 mock/regression checks and 18 legacy checks pass, but the one permitted diagnostic stopped before actual-model/usage/final-output proof. Its safe projection and 201-byte count match a source-defined nonfatal skill-description warning; raw-message equality is not claimed. No further model run or full-candidate bootstrap review followed. Existing-PR takeover is mock-verified and dormant; PR #6 remains unchanged. No authorization or historical PASS is inferred.

Adaptive model routing/quota policy: [model-routing.md](model-routing.md). Exact model IDs come from the authenticated CLI catalogue. When per-model quota is absent, the guard uses verified shared Codex account limits with a 20% reserve. See [metadata/mock readiness](model-routing-readiness.json); actual generation remains untested. Synthetic model proofs are disabled by default.

The subsequent one-shot Luna smoke exited 1. [Startup diagnosis](luna-smoke-diagnosis.md) distinguishes a metadata-reproduced reserved-provider configuration error from the original missing stderr. Process receipts now include filtered diagnostics; no smoke was rerun for this investigation.

A later owner-authorized attempt uses executionProfile=minimal-luna-smoke: exact gpt-5.6-luna/low, read-only, tools/delegation disabled, unchanged ChatGPT auth and no model_providers.openai overrides. Metadata startup/catalogue/quota passed and 62 related mock tests passed. The single smoke was stopped by its harness after an unrecognized non-answer item; actual model identity, token usage and a valid final response remain unverified. [Fix/smoke report](luna-smoke-fix-report.json) is BLOCKED. Unknown stderr was omitted by the secret-safe diagnostic allowlist; no missing error text is reconstructed. No retry/fallback, backlog, bootstrap, full E2E or live activation followed. Built-in transport retry settings are not overridden or claimed to be zero; the harness stops on an observed retry/error. No real quota saving is established.

[Event observability patch](luna-event-observability.md) replaces the smoke's duplicate classifier with a version-pinned shared guard. Rejected types/field names/reasons and explicit stderr omission diagnostics are retained without payloads. Verification is mock-only; historical BLOCKED evidence stays unchanged.

[Adaptive routing integration checkpoint](adaptive-routing-integration-report.json) preserves the unpushed branch through b1bbdaf and PR #4's P1/P2 fixes, then fixes persisted inherited deadlines and retry write ordering. Targeted mock/deterministic tests pass 109/109; the legacy simulation passes 18/18. The one newly authorized Luna/low attempt on 142a696 exited 1 with an actual CLI error item, zero observed tools and no actual-model/token telemetry. Quota remained above the 20% reserve. Safe diagnostics and omission reasons are in [the smoke receipt](adaptive-routing-integration-smoke.json); root cause remains undetermined. No retry, fallback, further harness repair or model review followed. The candidate remains a draft integration, not an independent full-candidate PASS or permission to run application tasks.

Zero-touch scheduling/bootstrap is documented in [zero-touch.md](zero-touch.md). It reuses this controller and its phase/merge/status adapters. `multi-proof` runs multiple synthetic tasks and supervised restart; `bootstrap-review <PR>` reviews an explicitly selected open draft candidate; PR #3 is merged and is not modified. Real authority remains disabled. Historical single-task proof below remains intact.

The existing controller now uses Git SOURCE/status and independent local Codex review. No Google API/OAuth/Picker/Cloud project or Work event is on the critical path. The owner approved this authority change; PR #3 was merged as 99f00827664fa2ac1c3263d3d98b4e25d9ad5c72 and Git SSOT now exists on verified origin/main. Prior bootstrap REWORK is retained; the follow-up candidate requires full independent review before authorization. SOURCE reads pinned main, never the local candidate as fallback.

Specification: docs/master-plan/master-plan-v1.1.md. The only mutable status source: docs/master-plan/task-status.json. Manifest/original snapshot/import validation live beside them. Task index is derived in memory from pinned Git blobs. Historical Work/manual PR #2, local-review and pre-Git cache/handoffs are retained as evidence; they do not control readiness.

## Run checks and isolated fixtures

From D:\Chinese-Study-Hub, with existing Node/Git/Codex:

```powershell
node tools/engineering-loop/validate-import.mjs
node tools/engineering-loop/loop.mjs candidate-pick
node tools/engineering-loop/loop.mjs ssot-status
node tools/engineering-loop/loop.mjs doctor
node tools/engineering-loop/loop.mjs dry-run
node --test tools/engineering-loop/local.test.mjs tools/engineering-loop/git.test.mjs tools/engineering-loop/autonomous.test.mjs tools/engineering-loop/bootstrap.test.mjs tools/engineering-loop/recovery.test.mjs tools/engineering-loop/model-routing.test.mjs
node tools/engineering-loop/loop.mjs dry-git
```

`candidate-pick` labels branch-derived readiness explicitly; it authorizes nothing. `pick` and `ssot-check T001` fetch origin/main and require valid pinned Git SSOT. Missing or invalid artifacts block, without Google/cache fallback. Legacy 18-check dry-run simulates external adapters; local/Git unit tests use explicitly marked reviewer/transport doubles plus actual local Git. They are not external GitHub lifecycle proof.

`dry-git` uses isolated local bare remote and D001/D002 IDs outside the real backlog. It runs actual Codex Developer → local Reviewer REWORK → same-branch repair → new-HEAD PASS → actual Git merge → single-task status push/readback → DONE → next pick D002. D002 is not executed. One fresh controller process per transition reloads persistent state. Four separate CLI role sessions use existing ChatGPT included ordinary quota. Real safety flags remain false/empty, and stop=true is restored. Root task-status.json remains unchanged. Runtime evidence: .engineering-loop/git-cycle-latest.json and per-review packets/diffs/receipts. Curated proof: git-native-report.json.

The initial generator intentionally creates NEEDS_REPAIR; generator checks go in tests, its known acceptance failure stays in evidence and controller acceptance. It is never called passed. The independent reviewer must REWORK, and final APPROVED + LF bytes must be verified. A failed developer check still blocks; no false COMPLETE bypass was introduced.

## Configuration and source binding

Defaults in config.example.json/ignored runtime config:

```json
{"sourceBackend":"git","ssotBackend":"git","reviewerBackend":"local-codex","liveEnabled":false,"authorizedTasks":[],"autoMerge":false,"ssotAllowStatusWrites":false}
```

SOURCE/SSOT backends in the migrated controller are Git only; selecting legacy Google/Work SOURCE is rejected. Legacy OAuth module/guide/tests remain historical and are never called by the Git path. Optional Work review/relay remains disabled until a real supported/free trigger is separately verified; no trigger creation is retried. It cannot write SOURCE/status. WORK.md is review-only guidance; its former protocol is archived.

Before live selection fetch/verify the exact GitHub origin/main. Read specification/status/manifest from that commit, validate version/title/provenance hashes, 70 IDs/buckets/DAG/M0 closure and dependencies done. Packets bind run/task/nonce, source/base SHA, spec/status/policy hashes, acceptance, allowed files and owner checks. Never trust specification from the developer branch. Any source HEAD/policy drift blocks; the sole exceptions are already-checkpointed exact own merge/status commits with unchanged specification and verified single-task status. No silent rebase or cached-source acceptance.

Prepared T068/T004/T005 contracts cover required paths, supported JSON schema subset, screen sections/states, source URLs/evidence/hash claims, rights/publication, internal vs verified exam labels, dependency/scope/whitespace, secrets/paid config and allowlisted commands. Unsupported schema/check/command or missing human evidence blocks. These contracts are proposals requiring owner review before activation, not real-task completion proof. Owner evidence is pinned outside developer scope as described in docs/master-plan/README.md. Account, legal and competent-language facts cannot be invented by either model. Final artifact approvals bind actual bytes; adding proof on main during a run requires explicit source reconciliation. An unattended human approval/reconciliation lane is not implemented.

## Processes, merge and status

The existing phase semantics remain SOURCE_WAIT → DEVELOP_READY → REVIEW_WAIT → REPAIR_READY → MERGE_WAIT → SSOT_WAIT → DONE (plus durable write/cache phases). REWORK permits at most two repairs. Fresh ephemeral Developer and read-only Reviewer processes have different PIDs/thread IDs and no shared conversation. Reviewer reads exact detached snapshot/diff/actual bytes/tests, with before/after fingerprints; developer COMPLETE is not a verdict. Deterministic acceptance must pass independently. Timeout, malformed/stale verdict, missing evidence, crash/quota limit or mutation becomes BLOCKED.

Every invocation verifies ChatGPT auth and ordinary available quota with zero/known-no credits; secrets/API-provider overrides are removed from the environment. No API key, paid credits, resets, fallback or new subscription/resource exists. This uses an existing account, not a claim that its subscription is free. Scope and Git config/hooks are checked before controller publication. Windows sandbox/fixture checks are not a complete OS security audit.

Real automatic merge stays disabled. If separately authorized later, the controller rechecks PASS/current HEAD/source/scope/acceptance/no concurrent process, creates a two-parent merge whose parents are pinned main and reviewed SHA, then pushes non-force. An advanced main rejects the push. Server permissions/protection can also reject; they are never weakened. No paid GitHub auto-merge feature is required. Manual GitHub merge may be confirmed only if exact reviewed SHA and pinned parent/tree are preserved; squash/rebase or later concurrent main changes block and require reconciliation.

Merge/status intent SHA is persisted before push. Recovery after an actual push recognizes the same remote commit instead of creating/pushing a duplicate. Status sync verifies merged ancestry and unchanged specification/status base, changes only the authorized task in task-status.json, records run/PR/reviewed/merge/source/checks/verdict/time, commits only that path, pushes non-force and reads exact remote HEAD/blob plus every unrelated task back. DONE occurs only after readback and cache refresh. A failed status push stays recoverable at SSOT_WAIT; implementation/merge are not repeated.

## Controls and blockers

```powershell
.\tools\engineering-loop\control.ps1 status
.\tools\engineering-loop\control.ps1 pause
.\tools\engineering-loop\control.ps1 stop
.\tools\engineering-loop\control.ps1 resume
.\tools\engineering-loop\control.ps1 start
node tools/engineering-loop/loop.mjs recover SSOT_WAIT
```

Start uses the existing hidden controller. Resume clears control flags but never erases BLOCKED. Recovery requires the recorded prior stable wait phase and actual source/HEAD/clean tree; it preserves pending merge/status SHAs and repair count. Interrupted writer/publication needs inspection. Never delete a live lock, reset edits or edit checkpoints to bypass drift. One shared writer lock protects the controller/model; a separate fixture-driver lock prevents duplicate dry-git drivers. All real activation requires clean main and a separately authorized Task ID/policy.

Verified: complete text/spec import validation, actual local CLI/Git-bare lifecycle, fresh-controller checkpoint reload, local non-force races and failure/duplicate recovery. Unverified: external GitHub merge/status lifecycle, real backlog, provider/account/legal/language eligibility and a full OS security audit. Do not claim FULLY AUTOMATED for the real project. The follow-up tooling review/authorization and human gates, T009/T068/T069, bounded content instances and hosting/deploy require separate work/authorization. No real backlog or main merge is authorized by this follow-up; merged PR #2/#3 remain untouched.
