# Implementation brief — SSOT cache

Source: [Chinese Study Hub — Master Plan v1.1][source].
Version: **v1.1**; source revision: `AHj4eMQz6r1beJJrD1yX1U81Pa0nuWZYdTbkf2rosfEmAOkIMI5bhtkz5jdOyQRiHyaZHh-QL_wX-hQi4084CHDxO0tmjpsPOO4KydfeRzY`.
lastSyncedAt: **2026-10-13T17:40:49+07:00** (Asia/Saigon). This is a cache; live SSOT controls decisions.

Goal: Vietnamese UI; owner only, Android/Windows; Simplified Chinese/zh-CN toward HSK4. M0 is a reviewed online slice, not full HSK1.

v0.1: owner login → weekly hours/availability/preview → Today → F01/F02/L001/L002 with approved audio/answers → server grading → immutable attempts/mastery → cards/FSRS → review/progress/next block. Atomic/idempotent writes; unacknowledged network failure = unsaved, retry online. Mastery measures skills; FSRS schedules recall.

## Decision register

Accepted design is not implementation evidence.

| ADR | Source status | Decision |
|---|---|---|
| 001 | Accepted | Next.js/TypeScript modular monolith; UI/BFF/domain/repository boundaries. |
| 002 | Accepted (revised) | Supabase Free/PostgreSQL/Auth/Storage; private learner schema, owner FKs, least-privilege runtime/RLS; separate migration credentials. |
| 003 | Accepted | Immutable attempts/review logs; transactional mastery/card projections; pinned FSRS adapter/config. |
| 004 | Accepted | Bounded offline packages/outbox, server authority, active-device lease/conflict replay; activates v0.3. |
| 005 | Accepted v1.1 | Provider-neutral text tutor + Gemini Free after verification, v0.2; approved explanations fallback; recording/STT v0.3. |
| 006 | **Proposed/Pending T069 hosting**; content-versioning **Accepted** | Vercel Hobby preferred candidate, Render Free alternative; benchmark before selection. Preserve immutable content versions. |
| 007 | Accepted, mandatory | One owner; one-time/recurring service fees **0**; no billing/payment, paid fallback/upgrade, trial or temporary credits dependency. |

## Scope and unresolved gates

M0 has exactly 34 IDs; all 70 belong to separate activation buckets in status. T007/T008 build only M0 schema; §5 is long-term. Offline/sync/lease/conflicts/recording activate v0.3; text tutor v0.2. Core works with AI off; AI cannot score, change mastery/unlocks/planner or publish.

- T002/T013/T016: rights, reviewed keys/audio, competent reviewer; unknown rights cannot publish, missing review stays beta/gap.
- T005: exam-version/blueprint gaps; unverified details stay internal practice.
- T068: actual account eligibility/quota/no-payment/terms; zero-cost is a hard constraint, not verified deployment.
- T009: Free runtime/RLS/claims/pool proof before learning writes; failure needs evidenced SSOT revision, never service_role/RLS bypass or paid addon.
- T069: host benchmark after T006/T009/T010/T011/T068, before ADR-006 lock/T053. Both fail → local free proof/blocked cloud release.
- T037/T039: Gemini availability/quota/consent/evals, v0.2; T031/T040/T070: offline/speech/advanced recovery, v0.3.

Later: v0.2 complete reviewed HSK1, writing/text tutor/privacy; v0.3 offline/recording/ops; v0.4 HSK2, v0.5 HSK3, v1.0 HSK4. T057/058 and T062/063 deferred; T059/060 optional P2.

## Read only what the task needs

[§2.3 entry packet](https://docs.google.com/document/d/1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30#heading=h.795ac3f3ucmd) · [§3 ADRs](https://docs.google.com/document/d/1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30#heading=h.8wcdxyd5qrua) · [§11 roadmap](https://docs.google.com/document/d/1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30#heading=h.q3e1njtu6uql) · [T001](https://docs.google.com/document/d/1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30#heading=h.ac8e1wip1rqr) · [§12.6 activation](https://docs.google.com/document/d/1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30#heading=h.e4gkrknsyse0) · [§14.1 acceptance](https://docs.google.com/document/d/1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30#heading=h.c6cr2zhvlc7j) · [§15 protocol/change log](https://docs.google.com/document/d/1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30#heading=h.qq2uevq206f1).

Scope: §2.3/11/12.6/14 override future-feature wording in §4–10. Changed revision → §15.4/affected sections → reconcile brief/status before work. Without connector: owner-approved snapshot, SSOT updates pending. Read status for readiness; one task only.

[source]: https://docs.google.com/document/d/1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30
