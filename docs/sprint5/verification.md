# Sprint 5 — LOCAL V1 CANDIDATE verification

Workspace: `D:\Chinese-Study-Hub`. Branch `feat/v1-learning-experience`, created from requested base `83590552619235f0f01a52e263a56970ee40138c`. The later typography correction from `2ee6926` is preserved in the new branch. Original branch/history and local credentials/database are retained. No push, merge, deploy, provider setup, paid calls, Engineering Loop, Reviewer agent or canonical task-status edits.

## Implemented behavior

The development journey is onboarding → saved budget/day caps/timezone → Today → F01 → due FSRS → F02 → L001v2/L002v2 → persisted feedback/completion → review/progress/next action. A returning local owner with saved settings enters Today from `/`. DEMO remains a separate in-memory preview; the old two-item local fixture remains available for regression.

L001v2 and L002v2 each contain six concepts, six exercises and three teaching sections. Original short dialogues include simplified Chinese, Pinyin and Vietnamese. Choice and Pinyin reuse existing grading. Sequence uses an exact permutation of unique tokens; short Hanzi uses NFC, whitespace/listed-punctuation removal and an exact answer. It is not free conversation grading. Private keys and pre-answer feedback stay server-side. Wrong answers, duplicate submissions, cursor and completion remain immutable/persisted. Historical L001/L002v1 manifests, package hashes and attempts remain valid.

All four current lessons remain `REVIEW_PENDING / DRAFT_UNREVIEWED / publication BLOCKED`. Completing a draft prerequisite only enables an explicitly optional next draft practice suggestion; **it does not establish a secure unlock**. The runtime planner sets verified eligibility false for every unreviewed package. Draft attempts, self-ratings and foreground telemetry provide zero independent mastery evidence. Listening/pronunciation remain unassessed; no audio or TTS is supplied.

## Deterministic planner contract

`weekly-plan.ts` is pure: explicit `asOf`, saved settings, database cards, sessions, progress, accepted milliseconds and day exceptions. No AI or client SQL. The repository reads/writes within the existing per-owner transaction/advisory lock, FORCE RLS and runtime proof.

- Monday-based local week using an IANA timezone. Requested/whole-week feasible/capacity shortfall, remaining budget and remaining capacity are separate. Past days are never filled with forced makeup minutes.
- Actual minutes come only from accepted foreground intervals, proportionally clipped at local date/week boundaries. Completion estimates do not become actual time; event replay cannot increase totals. A zero-wall-time interval with positive active time is rejected.
- Due/relearning precede resume and new work. Stable state/due/ID ordering, no scheduled review before its local due date, no future-due card as Today's action. An active review intent is not scheduled twice. The estimate uses a bounded 14-day reveal-to-rating median if at least six useful observations exist, otherwise 30 seconds/card; it is never credited as study time.
- New pending blocks respect budget, remaining day caps and max session length. Reviews may consume the 10% buffer within those bounds. Unallocated due debt remains visible and suppresses additional lessons. `due_at` is never rewritten by planning.
- Only the finite eligible local practice path is allocated. No filler/repeated lesson is invented to meet 3/6/9 hours. Unused capacity remains unused. A short slot is a checkpoint estimate, not permission to split a grading attempt.
- Completed/in-progress block history stays frozen. Unobserved active intent reserves capacity; changed settings cannot retroactively erase prior intent/time. The new pending portion is reallocated. An abandoned active observer may retain its estimated reservation until review is resumed and closed; accepted time is still accurate.
- Paused effective budget is zero while the configured budget is retained for resume. Day overrides support skip or ten minutes. Replan follows saved settings, date/foreground, new committed learning/review data and explicit user commands. Only pending records are superseded; historical plans/blocks remain.
- Persisted plan ID, version, planner version, `asOf`, input fingerprint and reason codes. One active plan per owner/week. Settings+plan save is atomic, optimistic and idempotent. Same-key lost-ACK retries return the committed result; stale edits have a read-back recovery action.

The completion-time/HSK forecast remains `INSUFFICIENT_REVIEWED_DATA`. Fifteen-minute lesson design targets and response-cost estimates have not been established by a learner pilot.

## Source alignment and rights

The actual official 2025-11 syllabus PDF was verified locally again: 406 physical pages, 4,636,209 bytes, SHA-256 `ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941`. `scripts/verify-hsk-source.py` checks the 26 existing narrow locators (8 vocabulary, 9 characters, 3 tasks, 3 topics, 3 broad grammar entries). v2 directly pins that source hash; immutable v1 metadata and the historical evidence file were not rewritten. Exact patterns 我叫+name and the specific 喜欢/喝 teaching interpretation remain UNVERIFIED under the existing broad grammar references; 安 is SUPPLEMENTARY. Source facts do not certify Vietnamese interpretation or grant redistribution rights. No PDF/corpus/third-party audio is committed or served.

## Migration, backup and preservation

`202610180004_weekly_experience.sql` adds `study_settings`, `study_day_overrides`, `weekly_plans`, `planned_blocks`: 18 owner tables total with enabled/forced RLS. Runtime has SELECT/INSERT/UPDATE on the new owner tables, no DELETE/owner/BYPASSRLS privileges. Composite owner foreign keys protect plan/session links. Existing 14 table definitions and content versions are preserved; the original time-preference row remains the budget authority. The sidecar falls back correctly for old clients without new settings.

Before migration, `scripts/sprint5-preserve.mjs backup` produced an ignored custom-format Phase4 backup and fingerprints of every historical owner row. A disposable restore matched; a separate restore → additive migration → six-version seed test also matched all historical rows. Backup metadata: 287,740 bytes, SHA-256 `d9b0371445cc88da71df1affad05e33b94b4e61490031402705bc859efe78c56`. Backup, credentials, owner IDs, source PDF, JUnit and raw logs remain in ignored `.local-postgres/` and are not printed in this report. Rollback is only for disposable databases; do not apply it to data to retain.

The real PostgreSQL restart check compares all current 18 owner tables and both content tables byte-for-byte as row hashes. `verify-sprint5-restart.ts` additionally reconnects through runtime repositories and checks identical saved four-lesson completion/cursor/answers, settings and progress. No browser suite writes during that restart comparison. Only after the whole-row match, an unfinished F01 fixture owned by a new DB-test UUID is advanced through the runtime repository; its duplicate advance returns the same result and the cursor increments once. The real development owner is never advanced by this script.

## Verification evidence

Final run results are recorded below. Browser suites use temporary development owners and real local PostgreSQL, without deleting user history. Sprint5 viewports run separately to give each a fresh owner and avoid multiple Next dev locks. Images under `evidence/` are browser renders, not mockups.

| Check | Result |
| --- | --- |
| Strict TypeScript, lint, Prettier, production build | PASS |
| Learning unit groups | 5 PASS |
| Content unit groups | 10 PASS |
| Weekly/content-v2 unit groups | 10 PASS, including 750 generated planner inputs |
| Native PostgreSQL suites | 33 PASS |
| Sprint5 desktop / mobile 360px | Desktop 2/2 PASS; mobile 360px 2/2 PASS |
| Legacy persistence / learning / content browser suites | 6/6 + 4/4 + 6/6 PASS, desktop and mobile |
| DEMO + production development-API lockout | 22/22 PASS, including all new study and v2 routes |
| Backup restore / upgrade preservation | PASS |
| Real PostgreSQL restart + application reconnect | PASS; exact 18+2 table fingerprints, four completed projections, isolated active cursor advance + idempotent replay |

Coverage includes a new owner, correct/incorrect/duplicate answers, lost ACK and same-key retry, reload resume, real FSRS reveal/rating, provisional mastery, 3/6/9-hour plans, capacity consent, lower-than-spent budget, missed-day replan, pause/rest, review overload, local week clipping, cross-user/forged-owner rejection, keyboard and axe/overflow checks. Synthetic historical calendar/duration rows in the DB tests are explicitly test fixtures, not learner evidence. Initial repairs: the DB runner initially omitted the added suite, then the new suite exposed an empty-settings fallback and an ambiguous SQL ordering alias; both were fixed and all 33 checks reran successfully. The first settings browser test supplied a session longer than its daily cap; correcting that invalid setup then exposed a too-strict select locator. The locator was fixed and a bounded action timeout added. One waiting test run was stopped before rerunning; no learner rows were removed. Final raw results are private; the successful reruns are reported here.

Dependency audit on 2026-10-18: production dependencies report 0 vulnerabilities. The full tree still reports 5 high advisories through the existing `eslint-config-next` → `fast-glob` / `micromatch` / `braces` development chain. npm suggests a mismatched major framework-config downgrade; it was not applied blindly. No dependencies were added or upgraded in this sprint. This limitation is not a production-readiness claim.

Final production public-JavaScript scan found zero `privateKeys`, `keyRef` or v2 private key-ID markers. Public API allowlists and production 403 responses were also checked; server-side package files intentionally retain private keys for grading.

## Remaining limits and Sprint 6

This is a **LOCAL V1 CANDIDATE**, never `PRODUCTION_READY`. There is no production auth/cloud deployment, reviewed content/publication authority, approved audio, independent mastery evidence or complete HSK1 coverage. T009/T068/T069 and all content/release gates remain unchanged. No durable offline write queue, Android hardware UAT or screen-reader UAT has been proven. A headless 360px viewport is not a physical Android test. Unacknowledged unload/network telemetry tails can be lost and are not counted.

Sprint 6 should first obtain competent human review of all four packages/answer keys and rights decisions, resolve the two exact grammar mappings, and provide licensed or original reviewed audio/transcripts before assessing listening/pronunciation. Then run a small owner pilot for session duration, short/sequence usability and review-cost estimates, including a physical Android device and keyboard/screen reader. Production identity/hosting writes may proceed only after their existing authorization and free-service/RLS/content gates are met; this sprint does not grant that approval.
