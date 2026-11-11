# Phase 3 — local grading, FSRS and evidence foundation

Scope: local development, based on `1efa408` on a separate feature branch. No Engineering Loop, Reviewer/subagent, model inference, paid API, cloud, deploy, push, merge or canonical task-status write. This report does not mark any backlog task DONE or attest language/content competence.

## Working slice

Select LOCAL DATABASE → `/learn/local-foundation-v1` → answer two explicit internal string-choice exercises → server grades/returns feedback → complete → `/review` → reveal from server → Again/Hard/Good/Easy → `/progress`. Schedule, attempts, completion, cards, ratings, due dates and evidence projections read from PostgreSQL after reload.

Only choice recognition for the two immutable fixture exercise IDs is supported. Server validates choice bounds, exercise membership/version, active session and owner; rejects extra score/correct/owner fields. Expected strings remain in the server module, absent from the public fixture/card queue projection. Choice texts necessarily include the possible correct answer; the question itself intentionally asks to recognize a target string. This is not a secure exam or validated Chinese language assessment. Feedback identifying the correct token is returned only after submission.

The existing six screens and all original DEMO lessons/cards remain available. Onboarding level, F01/F02/L001/L002 and their flashcards remain DEMO; local review uses its own explicitly defined token templates and cannot import arbitrary client content. Learning, review and progress screens show local scope. No optimistic saved state or silent DEMO fallback. Unacknowledged in-tab retries retain the idempotency key; refresh reads committed state. No offline queue.

## FSRS contract

- Exact MIT dependency `ts-fsrs@5.4.2`, implementing FSRS-6, Node >=20; tested here against the installed Node/Next build. [Primary project documentation](https://github.com/open-spaced-repetition/ts-fsrs), [API](https://open-spaced-repetition.github.io/ts-fsrs/).
- Default parameters from that pinned library with retention0.9 and fuzz disabled for reproducible replay. Full weights, maximum interval, learning/relearning steps and flags persist on each card and log. No optimization or custom scheduling formula.
- Full Card representation survives JSONB, including due, state, stability, difficulty, elapsed/scheduled days, learning_steps, reps/lapses and optional last_review. Adapter explicitly handles absent last_review on new cards.
- All four ratings use library `next`, with a trusted PostgreSQL timestamp after locking. UTC timestamptz/ISO storage, localized display. Preview dates computed at reveal are estimates; final dates computed at rating. No client clock/timezone accepted as scheduling authority. No separate local-calendar daily grouping is claimed.
- Only two controlled templates (distinct token concepts), maximum two cards per owner. UNIQUE(owner,template) prevents repeat lessons creating more. No backfill from historical Phase2 attempts. New content, sibling families, large queues/overload planning require their own validated contracts.
- Reveal is an owner/idempotent command and records exposure; rating requires reveal, due eligibility and exact card version. Lock + owner transaction serialize concurrent commands. Log, card update and receipt commit together; duplicate receipt returns prior outcome before evaluating the changed card. Stale version409; config/version/template mismatch blocks. No undo/rescheduling override.
- Queue reads PostgreSQL by `(user_id,due_at,id)`. Self-rating changes FSRS only. It never calls the mastery projector or unlocks another lesson.

## Mastery contract and explicit limits

Pure engine `mastery-v1-local-1` implements Master Plan §6.2 thresholds: unseen/learning/practicing, secure with >=5 independent attempts across >=3 items and >=2 UTC evidence dates, weighted last5>=0.8 and delayed probe>=48h accuracy>=0.8; last3<0.6 needs review. Same-item exposure inside24h, assisted/hinted/repeated/exposed answers, self/AI/unreviewed keys and unverified duration are excluded. Duplicate evidence IDs do not inflate counts. Invalid/future timestamps cannot add evidence. Foundation prerequisite helper additionally requires3 distinct items and accuracy>=0.8.

The plan describes both a stale downgrade and preserving status with a stale flag. This implementation preserves the status computed from evidence and flags staleness after30days; prerequisite helper refuses stale evidence. These are proposed v1 thresholds, not claims of pilot calibration.

**Runtime fixture evidence remains ineligible**: no competent key review and no approved plausibility-duration rule. Immutable `mastery_evidence` links each new attempt, owner, concept/skill, objective result and exclusion reason. `skill_mastery` stores the projection/version. It honestly shows zero independent evidence / insufficient data rather than granting mastery. Assisted/independent/delayed cases with reviewed keys are deterministic unit fixtures only, never inserted as real learner achievements. Speaking/writing/Chinese competence remain unknown. No new prerequisite-based content is unlocked. Historical attempts are not reclassified.

## Database and preservation

Additive migration `202610170002_local_learning.sql` creates mastery_evidence, skill_mastery, cards and review_logs, owner composites and due index. All10 owner tables use FORCE RLS. Runtime remains nonowner, nonsuperuser, NOBYPASSRLS with no privileged memberships. Evidence/review logs are append-only for runtime. Migration credentials remain outside application requests; production local-identity lockout is preserved.

Migration runner now verifies individual existing checksums and ordered pending migrations atomically; applied Phase2 SQL is unchanged. Runtime proof binds the complete migration set and is invalidated by upgrade. `test:db` must pass again before learning writes. Rollback SQL is versioned and tested only in a separate disposable database; the CLI rollback is still explicitly destructive to the entire local schema, requires `--confirm-local-data-loss`, and is never applied to acknowledged project data.

A private pre-upgrade pg_dump and row fingerprints are in ignored `.local-postgres/`. All6 old tables were byte-identical immediately after migration. Final verification restores that backup into a disposable database and compares original rows against the upgraded database. All historical sessions, attempts, events and receipts remain byte-identical. The first legacy browser regression reused the configured development identity: its2 acknowledged schedule saves increased one preference version by2 (values unchanged), and its2 completions increased one progress projection by2. These2 mutable rows are explicitly accounted for rather than falsely reported byte-identical. Both browser configs now isolate subsequent runs with a temporary server-side development owner. No historical attempt/evidence is deleted or rewritten to reset tests; test counts are fixture activity, not real student achievements.

## Dependency advisory assessment (2026-10-17)

All5 high audit entries share one root advisory, [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), stack exhaustion on deeply nested brace patterns:

| Package | Installed | Path / exposure |
| --- | --- | --- |
| eslint-config-next |16.4.2|Direct dev lint config|
| @next/eslint-plugin-next |16.4.2|eslint-config-next dependency|
| fast-glob |3.3.1|plugin dependency|
| micromatch |4.0.8|fast-glob dependency|
| braces |3.0.3|micromatch dependency; root vulnerable package|

`npm audit --omit=dev` reports0 vulnerabilities at verification time; that does not prove absence of all production vulnerabilities. No app handler accepts glob patterns or imports this lint chain. Untrusted developer/CI glob inputs remain a denial-of-service concern. The advisory lists **no patched version**, and registry latest braces remains3.0.3. Audit proposes downgrading eslint-config-next to14.2.35, a breaking mismatch for Next16, not a verified compatible root fix. No forced major downgrade, audit suppression or unverifiable patch was applied. Compatible upstream fix remains pending; newer fast-glob alone does not establish removal of braces. New ts-fsrs dependency is not among the reported vulnerable packages.

## Verification and operation

Actual results and scope are recorded in `evidence.json`; private raw test reports stay ignored. Desktop1440px/mobile360px are Chromium tests, not real Android/TalkBack or pedagogical pilot evidence. Screenshots under `evidence/` show the new local review/progress.

| Check | Final scope |
| --- | --- |
| Unit |5 groups: deterministic grading/mastery and pinned-library FSRS goldens|
| Real native PostgreSQL |18 JUnit cases, including6 RLS/pool security cases before learning gate opens|
| New grading/review browser |4 cases: desktop and360px mobile, lost acknowledgement/retry, reload, error, empty queue and accessibility|
| Legacy persistence browser |6 cases across desktop/mobile|
| Original DEMO and production lockout |20 cases across desktop/mobile|
| Native PostgreSQL restart |Actual stop/start; all10 owner tables and proof survive unchanged|
| Lint / strict typecheck / production build |Run against this candidate; see machine report for recorded result|

The first unit run exposed an undefined optional `last_review` property on a new card; the serializer now omits it, matching actual JSONB/library roundtrip. An overly strict post-test preservation comparison correctly noticed the2 acknowledged mutable projection updates described above; it did not indicate migration data loss. One subsequent run with concurrent dev/production browser servers timed out navigating to the fixture (5/6 passed); its private report is retained. The same source/config passed6/6 when run alone, without loosening assertions or enabling retries. The DOM snapshot alone does not establish the timeout's cause; prefer sequential browser suites and monitor that limitation. Evidence distinguishes these investigations from final passes.

```powershell
cd D:\Chinese-Study-Hub
npm.cmd ci
npm.cmd run db:start
npm.cmd run db:migrate
npm.cmd run test:db
npm.cmd run test:learning:unit
$env:CSH_APP_ORIGIN = 'http://127.0.0.1:3010'
npm.cmd run dev -- --port 3010
```

On a fresh local installation use `db:init` before `test:db`. Existing project credentials/config must be preserved. Browser tests own their ports: `test:learning:browser`3012 uses a temporary server-side development owner, `test:local`3010, production DEMO regression3011 after build. Do not run two Next dev instances against the same `.next/dev` lock. End the preview before running browser configs.

Remaining release blockers: competent content/key/rights review and duration eligibility contract; real auth and T068/T009/T069 cloud/free/runtime/host gates; application-level independent review/device UAT; the dev dependency advisory above. These are not bypassed by a local FSRS/SQL test. No production deployment readiness is claimed.
