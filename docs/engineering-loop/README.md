# Engineering loop — Windows

Local orchestrator for Chinese Study Hub. It uses the existing Node.js/Git/Codex CLI and Git Credential Manager; no dependency packages, OpenAI API key, GitHub Actions runner, server, billing or new credentials are required. The Google Doc remains SSOT. The 70-task JSON index is a revision-labelled cache; only 34 M0 tasks are active. The deterministic local picker is explicitly **not Work**.

Current setup: real backlog disabled (`liveEnabled=false`, `authorizedTasks=[]`, `autoMerge=false`). T001/T002 remain the only completed project tasks. Do not enable a task because a local simulation passed. Work trigger availability must be checked on the actual account; official documentation says availability depends on plan/workspace settings. A desktop recurring automation is not a GitHub event trigger.

## Controls

Run from `D:\Chinese-Study-Hub`:

```powershell
.\tools\engineering-loop\control.ps1 doctor
.\tools\engineering-loop\control.ps1 pick
.\tools\engineering-loop\control.ps1 dry-run
node .\tools\engineering-loop\smoke.mjs
.\tools\engineering-loop\control.ps1 dry-github
.\tools\engineering-loop\control.ps1 step
.\tools\engineering-loop\control.ps1 start
.\tools\engineering-loop\control.ps1 status
.\tools\engineering-loop\control.ps1 pause
.\tools\engineering-loop\control.ps1 stop
.\tools\engineering-loop\control.ps1 resume
```

`dry-run` exercises real local Git/files/checkpoints with simulated external adapters. It creates no real PR or Work verdict. `smoke.mjs` invokes the actual Codex CLI through the existing ChatGPT login in a separate synthetic repository; its evidence reports actual file-byte readback. `dry-github` creates a real synthetic issue, branch and PR, runs the actual Codex CLI and requires real reviewer comments. The initial Codex fixture intentionally contains NEEDS_REPAIR so the first REVIEW must fail; the repair changes it to APPROVED. It never changes SSOT or merges fixture content into main.

`step` advances one durable state transition. `start` launches the controller hidden; `pause`/`stop` signal it and terminate its active Codex process tree. `resume` clears control flags; run `start` again if the prior process exited. Resume does not erase BLOCKED. A timeout, ambiguous external side effect, source drift or interrupted developer write stops the task for inspection. After checking the blocker, `node tools/engineering-loop/loop.mjs recover SOURCE_WAIT` (or the recorded prior REVIEW_WAIT/MERGE_WAIT/SSOT_WAIT) reconciles the actual PR/worktree and restarts only that wait, preserving repair counters. Interrupted writes require explicit local inspection. Never delete an active writer lock or reset a worktree to recover. Repeated dry-runs/smoke write ignored runtime evidence; checked-in evidence files are curated checkpoints.

## Persistent state and review

Runtime files in `.engineering-loop` are ignored by Git: config, state, control, locks, reports, evidence and task worktrees. State includes exact run/task, SSOT revision, retry count, nonce, branch, issue/PR, commit and events. Writes use temporary file + rename. One shared lock covers controller and CLI smoke; a dead controller cannot reclaim a live child writer. On each transition/restart the controller checks actual local root/task Git state and GitHub PR identity/head; source approval and review come from live-SSOT-attested Work comments. Uncertain effects are BLOCKED instead of replayed blindly.

Lifecycle: QUEUED → SOURCE_WAIT → DEVELOP_READY → REVIEW_WAIT → REWORK/repair (maximum 2) → MERGE_WAIT → SSOT_WAIT → DONE. A real task is not done until its reviewed head is merged and Work has written/read back the single task status in SSOT. Without autoMerge, MERGE_WAIT awaits an actual merge. Missing responses timeout into BLOCKED. Only exact configured reviewer login/runId/nonce/HEAD is accepted. GitHub author proves the account that wrote a comment, not cryptographic proof of which application produced it; the trusted reviewer must be Work or the owner, never the developer.

The actual protocol and saved reviewer prompt are in [WORK.md](../../tools/engineering-loop/WORK.md). GitHub transports issue briefs, PRs, evidence and structured SOURCE/REVIEW/SSOT_SYNC issue comments. The local controller does not call a hypothetical Work API. A Work event task must watch PR activity, comments and commit updates in the named repository, filter title `[loop]`, and ignore its own events unless a new request/head appears.

If the connector cannot write comments but the owner has separately verified local Git write access, the independent reviewer may return a JSON handoff artifact. Save the verbatim event and observed chat provenance as `{"event":{...},"provenance":{"chatUrl":"https://chatgpt.com/c/OBSERVED_ID","manuallyInvoked":true}}` in `.engineering-loop/review-inbox`. `node tools/engineering-loop/loop.mjs relay .engineering-loop/review-inbox/source.json` posts it with exact artifact hash/provenance and verifies readback. The relay never invents a verdict and never counts as an automatic Work trigger. It uses existing local credentials, not expanded connector scopes.

## Initial activation gates

1. GitHub and Codex account login must already work; GitHub bridge uses the existing Git Credential Manager credential in memory. No token is written to the repository or forwarded to the developer.
2. Set up the event-triggered Work reviewer on the actual supported account, with repository read/comment and Google Docs read/scoped-write access. No upgrade or paid fallback is allowed. If unsupported, the local picker remains usable; automatic independent review is BLOCKED.
3. Complete the real synthetic PR → REWORK → repair → PASS cycle and record evidence that the trigger fired automatically. A manually requested review is a useful bridge test, but not proof of event delivery.
4. Only then activate owner-approved Task IDs and per-task file/check policies in `.engineering-loop/config.json`. Code tasks require concrete targeted checks; content families require materialized bounded instances. Future releases, deployments/cloud accounts and reviewer rights are not activated by this setup. No 70-task bulk run.

Codex uses `--ignore-user-config`, ChatGPT-only login, workspace-write, approval policy never and an unelevated Windows sandbox with network access disabled in configuration. It blocks rather than requests an unsandboxed fallback. Official documentation describes weaker network isolation in the unelevated legacy sandbox; the CLI smoke verifies the requested fixture, not a full OS isolation/security audit. Task allowlists and secret detection are publication checks, not protection against every hostile local process. Never treat these controls as permission to process untrusted credentials/content without review.

Published evidence excludes raw Codex streams and secrets. Logs contain compact task phases/errors. Local secret/config files are ignored. Task checks are selected by owner policy, not executable commands supplied by the model. Documentation uses scope/JSON/whitespace/source review; code checks must be added before code-task activation. T068, T009, T069 and content-review gates remain intact.

Sources: [non-interactive Codex](https://learn.chatgpt.com/docs/non-interactive-mode), [Work scheduled/event tasks](https://learn.chatgpt.com/docs/automations), [Windows sandbox](https://learn.chatgpt.com/docs/windows/windows-sandbox).
