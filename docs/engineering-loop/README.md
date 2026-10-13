# Engineering loop — Windows

The existing controller now selects independent local Codex review without Work events. Writer lock, persistent state, GitHub transport, picker, repair limit and state semantics are reused. No dependency installs, API keys or new cloud resources were added. Historical manual Work/PR #2 evidence stays in setup-report.json.

Safety settings: `liveEnabled=false`, `authorizedTasks=[]`, `autoMerge=false`, `ssotAllowStatusWrites=false`; controller stopped. T001/T002 remain the only completed SSOT tasks. The automatic synthetic Developer → REWORK → repair → PASS cycle is verified. The whole lifecycle is **not FULLY AUTOMATED**: direct live SOURCE/SSOT are BLOCKED; automatic merge and live SSOT write/readback are unverified.

## Controls

From D:\Chinese-Study-Hub, using existing Node/Git/Codex CLI:

```powershell
node tools/engineering-loop/loop.mjs doctor
node tools/engineering-loop/loop.mjs ssot-status
node tools/engineering-loop/loop.mjs dry-run
node --test tools/engineering-loop/local.test.mjs
node tools/engineering-loop/loop.mjs dry-local
.\tools\engineering-loop\control.ps1 status
.\tools\engineering-loop\control.ps1 pause
.\tools\engineering-loop\control.ps1 stop
```

`dry-local` archives the previous completed/blocked synthetic checkpoint, creates a D001 repository under ignored runtime storage and runs actual CLI processes. It intentionally generates NEEDS_REPAIR, obtains REWORK, repairs the same branch to APPROVED + LF, then reviews the new HEAD. It needs no GitHub comment, Work event, Google access or manual relay. It refuses an active execution or enabled backlog/merge settings. It stops at MERGE_WAIT with PASS and restores stop=true; no synthetic merge, Google write or DONE is invented. Runtime evidence: `.engineering-loop/local-cycle-latest.json`, per-review receipts/packets/diffs and exact-commit test evidence. Curated evidence: local-review-report.json.

`dry-run` retains 18 checks with simulated external adapters. New tests use fake reviewer/Docs transports and actual local Git; they are separate from the real CLI cycle. `dry-github`, manual relay and WORK.md remain the optional legacy Work path. Do not retry creating a trigger during this upgrade.

`step` advances one durable transition. `control.ps1 start` runs the controller hidden; pause/stop terminates its active CLI process tree. Resume clears flags but preserves BLOCKED; restart explicitly. Never enable live tasks just to run a fixture.

## Adapter configuration

Review config.example.json and ignored `.engineering-loop/config.json`. Defaults:

```json
{"reviewerBackend":"local-codex","sourceBackend":"google-docs","ssotBackend":"google-docs","ssotAllowStatusWrites":false,"liveEnabled":false,"authorizedTasks":[],"autoMerge":false}
```

Local review requires direct live Google SOURCE for real tasks. Synthetic source is D001-only and cannot authorize backlog tasks. To use Work later, select `work` for all three backend fields and verify event delivery first. Local review never consumes developer verdicts or relayed Work verdicts.

Each real task needs an owner-reviewed allowlist, targeted checks and deterministic `acceptanceChecks` before developer dispatch. Currently only exact-byte acceptance checks are implemented (file and expectedBase64); meaningful document/code acceptance needs a separately reviewed extension. Existing T004/T005/T068 policies have no deterministic acceptance contract and cannot activate local review as supplied. Optional `sourceSections` lists additional numeric sections: data needs 5/3.2 (ADR-002), learning 6/4.2, tutor 7, offline 4.4 only in its authorized release. Common live sections 2.3/11/12.6/14.1/15 and DoD 10.3 are always read from the guarded revision.

## Independent review and recovery

Lifecycle remains SOURCE_WAIT → DEVELOP_READY → REVIEW_WAIT → REPAIR_READY → MERGE_WAIT → SSOT_WAIT → DONE. REWORK permits at most two repairs. PASS requires current HEAD and passing deterministic acceptance. Timeout, malformed JSON, missing exact-commit tests, crash, exhausted quota, source drift or mutation becomes BLOCKED. No response never means PASS.

Developer/reviewer launch fresh `codex exec --ephemeral --ignore-user-config` processes, no resume or shared conversation. Reviewer uses `--sandbox read-only`, approval never and JSON Schema output. Its verified packet contains specification/revision, exact SHA, actual diff and test evidence, never the developer transcript/COMPLETE verdict. It inspects actual bytes in a detached clone without shared object hardlinks. Fingerprints guard original and snapshot; SHA/source are rechecked after review. The synthetic probe tries only a disposable filename; CLI tool-event denial and file absence are recorded independently.

Every model invocation checks ChatGPT auth and local app-server quota. Unknown/nonzero credits, missing ordinary quota or a model limit blocks the call. Secret/API-key environment values are stripped. No resets, credit purchase, paid fallback or billing setup exists. This uses existing included quota; it does not claim the account's subscription is free. The Windows sandbox/byte checks are fixture evidence, not a full OS security audit.

Ignored runtime files contain state/control/config, atomic checkpoints, packets/evidence, snapshots and locks. The shared lock also protects a live reviewer after controller crash. Recovery to the recorded stable wait phase checks HEAD/clean tree, retained counters and source verification: `node tools/engineering-loop/loop.mjs recover REVIEW_WAIT`. Interrupted writes/publication remain BLOCKED for inspection. Never delete a live lock or reset user edits.

## SOURCE and SSOT

Google Docs remains SSOT; task index is a revision-labelled cache. See [OAuth guide](google-docs-oauth.md) for missing credentials, minimum scope and no-billing prerequisites. Consent alone does not grant an existing Master Plan. Connector credentials are never reused; cache never substitutes for live SOURCE.

API verification checks live v1.1 revision, M0 membership, exact specification/dependencies and done statuses before developer/reviewer turns. Drift requires section reconciliation/cache refresh. A merged exact-SHA PASS plus explicit task/write authorization may update only one status paragraph using requiredRevisionId and full paragraph-text readback. Live OAuth/writes remain untested. No ADR, backlog or other task update is authorized.

Before backlog activation: verify OAuth/per-file/no-billing evidence and one authorized task's live SOURCE and guarded SSOT write/readback; separately authorize/prove automatic merge if desired; supply meaningful task acceptance policies. Bounded content-instance dispatch remains unsupported, so T016/T034/T044/T047/T050/T055 are blocked. T069/T053 hosting/deploy require separate work/authorization. T009/T068/T069, rights and competent content review remain required; AI PASS cannot replace them. No bulk run is authorized.

Sources: [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode), [app-server](https://learn.chatgpt.com/docs/app-server), [Windows sandbox](https://learn.chatgpt.com/docs/windows/windows-sandbox), [Docs scopes](https://developers.google.com/workspace/docs/api/auth), [Docs limits/pricing](https://developers.google.com/workspace/docs/api/limits).
