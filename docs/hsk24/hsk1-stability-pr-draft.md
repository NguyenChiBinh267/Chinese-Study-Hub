# Draft PR: preserve HSK1 catalog failures and make retries explicit

The catalog client discarded HTTP status when reporting failures, and a manual retry kept showing the previous error while the next request was pending. This patch preserves HTTP status/code, distinguishes timeout/network/caller cancellation, cancels obsolete catalog reads, and renders loading until a new response is acknowledged. A known HTTP503 also survives a truncated or timed-out error body. The15-second content-request deadline is unchanged; no automatic retry or success fallback is added.

**Publication state: prepared locally; no GitHub PR or branch publication has occurred.** This file is a reviewable draft, not an opened pull request or an Engineering Loop verdict.

## Exact review scope

- Review base: `9c10241001d47013662c3556c62021be1076f123`.
- Branch: `fix/hsk1-catalog-stability`.
- Runtime/test commits: `b09cf3501f23400594790e968e0f96fcedac6377`, repaired by `57aa693410ac4da4ba17a8f753e1515522a95a02`.
- Three runtime paths: shared content request helper, curriculum UI request state, and local curriculum route timing header. Tests/probe/config add reproducible checks and server timing logs.
- No new or changed lesson/package/catalog data, migrations, Auth/RLS policies, Engineering Loop implementation/configuration, Git SSOT or owner `AGENTS.md` edits.
- Evidence and task mapping: [stabilization report](hsk1-stability-report.md), [machine report](hsk1-stability-report.json), [inactive Loop proposal](hsk1-stability-loop-proposal.json).

## Validation and limits

The report records actual results per run, including pre-fix failures and the independent review's REWORK/repair1/PASS. Fault-injected browser503/network/timeout checks are labeled separately from native PostgreSQL and actual HTTP503 negative controls. Final regression results and evidence hashes are frozen in the machine report; local traces contain private session data and are not uploaded publicly.

Final:141/141unit;35/35selectedSQL across6runs;14/14desktop/mobile browser after repair1; typecheck/lint/build PASS. All final runs have0FAIL/0SKIP, while earlier red/diagnostic failures are retained. Both76293original and81726pre-task row/binding hashes remain unchanged. The browser server starts with an empty compilation cache; later/mobile cases use that warmed server. These local checks do not establish a hosted-production SLA or acceptance of the production-authenticated response wrapper.

Historical evidence remains open: the old curriculum GET was canceled around15seconds without an observed503 response. Fresh-process and empty-compilation-cache probes can pass; these do not prove that the intermittent root cause is repaired. Measured Next development compilation accounts for substantial mode/onboarding latency, but does not establish the old catalog timeout's cause. Added `Server-Timing: app;dur=...` separates handler time from end-to-end elapsed time on future completed local catalog responses.

## Integration blockers before a main-targeted PR/merge

1. Pinned GitHub main is `ad7f4c59442b89701e5e41cd6a120284532c1650`. It contains valid Git SSOT but no application `src`/`package.json`. Baseline9c is154commits ahead/17behind, with a three-dot diff of1380files/1,192,446additions. A PR from this branch to main would include the unintegrated application/corpus, not just this stabilization delta.
2. The baseline branch is not published on origin. A stacked GitHub draft requires an agreed/published baseline; a main integration requires a separately scoped reconciliation that preserves main's newer Loop modules. This task does not silently publish that broader baseline, rebase, merge main, or overwrite newer controller protections.
3. The closest SSOT family is T052, whose T026/T009 prerequisites remain pending. The owner authorized this bounded local stabilization, not whole-task completion or status writes. No configured T052 acceptance policy/bounded Loop task grant exists.
4. Real Loop remains stopped/disabled. A fresh manual read-only review is recorded separately; it is not a controller run. Activation, source/policy reconciliation, explicit allowed task/scope, deterministic acceptance and fresh exact-SHA controller review are still required before claiming Loop completion.
5. Complete the remaining historical cold/transport investigation with a reproducible failure and correlated handler/HTTP/DB evidence. Keep failed/unrun acceptance cases visible; do not merge on a claim that all cold/503 causes are closed.
6. Preserve owner changes and populated database history. Existing material remains DRAFT/unreviewed and publication blocked; runtime tests do not grant language approval, rights, mastery or HSK1 curriculum completion.

No merge, deployment, paid resource, cloud write or task-status change is proposed by this draft.
