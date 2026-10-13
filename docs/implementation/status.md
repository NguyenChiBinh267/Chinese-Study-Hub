# Implementation status — SSOT cache

Release **M0/v0.1**; current task **T002: done — SSOT synced with revision guard/readback**.
Source: **v1.1**, revision `AHj4eMTRwJbEwy0-KTvCTLLRAhi79Zwo0Ool8CV1B9Kq77PWTzNsRIVStWII_Qzh4-nfCkWB-WoeC_QG_1gE4u_oFtkspt_hm0boVRAhBmM`; synced **2026-10-13T22:12:47.553+07:00**.
[Activation/backlog SSOT](https://docs.google.com/document/d/1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30#heading=h.e4gkrknsyse0); decisions/gates: [brief.md](brief.md).

## M0 — exactly 34 IDs

T001, T002 **done** (SSOT synced).
All following **pending**:
T003, T004, T005, T006, T007, T008, T009, T010, T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024, T025, T026, T052, T053, T064, T065, T066, T067, T068, T069.

## Remaining activation buckets — 36 IDs

- M1/v0.2 (14): T032–T039, T041–T045, T061 — pending.
- M2/v0.3 (7): T027–T031, T040, T070 — pending.
- M3/v0.4 (3): T046–T048 — pending.
- M4/v0.5 (3): T049–T051 — pending.
- M5/v1.0 (3): T054–T056 — pending.
- Optional/deferred (6): T057–T058 pronunciation, T062–T063 multi-user/scale — deferred; T059 voice tutor, T060 optimizer — pending/optional P2.

34+14+7+3+3+3+6=70; every ID belongs once. Only T001/T002 complete; future pending does not mean active.

Project root: `D:\Chinese-Study-Hub`; all subsequent project work belongs here.

## T001 evidence / blockers / next (historical checkpoint)

2026-10-13: moved all three handoff files from the initial Codex workspace to this project root; SHA-256 matched for each file before metadata updates, originals removed. `AGENTS.md`, `docs/implementation/brief.md`, `docs/implementation/status.md`; read live v1.1, selected sections and task dependencies. Documentation checks: 34 M0 IDs; 70 unique covered IDs; M0 dependency closure; seven ADRs; hosting pending T069; fees0; no future features activated, fabricated revision, secrets or long logs. Cache refresh on changed revision is mandatory; startup path AGENTS → brief → status preserves scope.

T001 blocker: none. SSOT readback: only T001 evidence updated; outside text/headings unchanged. Its note supersedes historical planning-wide pending prose. Token budgets not tokenizer-measured. Service/account/role/host/content/eval gates remain unverified; no runtime/device tests implied.
Next ready: **T002** and **T004**, each depends only on T001. Recommend T002 (rights register), then T068 (needs T001+T002); T003 needs T001+T068, T005 needs T002. No next task started.

## T002 evidence / blockers / next — current checkpoint

2026-10-13: `content/sources/register.json` + `docs/implementation/rights.md`; this status updated. Seven records: S01, S01-VOCAB, S02, S03, AUDIO-001, S08-code, S08-data. JSON metadata/IDs/evidence/URL syntax/rights gates/code-data separation validated; source links and terms manually compared. No source bytes/checksums, import, lessons, accounts, installs, AI calls or fees; reviewer approvals null.

Verified: CTI overview/limited reproduction terms; separate related official PDF cover 2025-11/2026-07; GF0025-2021 metadata/purpose/effective 2021-07-01 via official-source search index. Exact S01 1219 PDF, complete MOE HTML/attachment/second URL and detailed blueprint remain unverified. Yoyo chart advertised free but audio reuse rights/quality unknown, reference-only. Hanzi Writer code MIT; data APL with notices/derivative obligations, conditional unpinned candidates, not approved content.

T002 register blocker: none. Downstream gates: T005 exact exam-source/blueprint readback; T014 mapping/import rights + provenance (also needs T005/T013); T016 original no-fee audio/contributor grants + competent answer/audio review (needs T014/T013); T068 actual free eligibility/account/quota/no-billing checks. These tasks remain pending.

Next ready: **T005** (T002), **T068** (T001+T002), **T004** (T001). Recommend T068 for zero-cost eligibility gate; T003 still needs T068. No next task started.

Cache note: AGENTS.md and brief.md held byte-identical per T002 request; their T001 authorization/checkpoint is historical, superseded by this explicit T002 assignment. SSOT readback confirmed only the T002 note added and outside text/headings unchanged. The source revision difference from brief is limited to that note; use this status revision and reread affected sections before another task. No architecture/release change.

## Engineering loop setup — outside the SSOT backlog

2026-10-13: local Windows orchestrator, dependency picker, persistent state/lock, bounded repair/timeouts, GitHub bridge and controls implemented. Real synthetic D001 PR #2: Codex CLI -> independent manually invoked web review REWORK -> Codex repair -> independent PASS for fd687214a0b3eb5b020876988a738b7ca32457a4. One repair; source timeout/recovery and start/stop/resume verified. Reviewer artifacts were relayed verbatim through existing Git credentials after connector comment write returned 403. This is not proof of an automatic Work event trigger.

Automatic operation: BLOCKED (no verified Work GitHub event trigger; connector Issues comment integration returns 403). Real task execution/auto-merge disabled; no additional SSOT Task ID started/completed. SSOT revision re-read unchanged; brief/status metadata reconciled. T001/T002 remain the only completed backlog IDs. Evidence: docs/engineering-loop/setup-report.json; docs/engineering-loop/README.md. Historical T001/T002-only authorization notes are superseded only for this explicitly requested tooling setup.
