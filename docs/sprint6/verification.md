# Sprint 6 — HSK course catalog and progression

This is a LOCAL V1 CANDIDATE. Course navigation and persisted practice work locally; qualified content review, production identity, cloud readiness and publication are still pending. No canonical task was marked DONE.

## Source and boundaries

Branch `feat/v1-hsk-course-catalog` was created from the requested Sprint 5 commit `1d5abb3d227944a1fcbebf68b1a8f9115a518f8e`, with a clean source worktree. The source branch was retained. At session start, `origin/main` was fetched and pinned to `0dc42253180ef38d1c43f1f87c9f0f675a851341`. Its newer tooling authorization was reconciled against the explicit Sprint 6 request: Master Plan, task-status and source manifest bytes were unchanged; no tooling commits were merged into this application branch. AGENTS → implementation brief/status, the relevant Master Plan and Sprint 5 verification were read before changes.

There was no push, merge, deployment, Engineering Loop, Reviewer agent, paid API, cloud database or provider resource creation. Existing manifests, source pin/evidence, FSRS configuration, credentials and learner history were retained. The local PostgreSQL installation and database are reused.

## Actual hierarchy and navigation

| Course                            | Actual units                                         | Actual lessons/current version | Availability                                                         |
| --------------------------------- | ---------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| FOUNDATION — Nền tảng tiếng Trung | Pinyin: cách đọc ký hiệu; Thanh điệu                 | F01v1; F02v1                   | Explicit local draft practice; not an official HSK examination level |
| HSK1                              | Chào hỏi và giới thiệu; Sở thích và câu hỏi đơn giản | L001v2; L002v2                 | Explicit local draft practice, PARTIAL mapping                       |
| HSK2                              | 0                                                    | 0                              | Chưa phát hành học liệu                                              |
| HSK3                              | 0                                                    | 0                              | Chưa phát hành học liệu                                              |
| HSK4                              | 0                                                    | 0                              | Chưa phát hành học liệu; long-term target                            |

F03–F05 remain future Foundation targets. There are no generated HSK2–4 lessons, placeholder exercises or HSK5–9 courses. Available-content counts come from catalog records, not a claimed total HSK corpus.

`/learn` → `/learn/courses/HSK1` → `/learn/courses/HSK1/units/greetings` → `/learn/draft/L001` opens a real saved lesson. Foundation has corresponding course/unit paths. Lessons offer explicit local practice, resume and repeat actions and return links to their actual course/unit. Unknown course and wrong-parent unit paths have recovery links. Unreleased courses have useful empty states and working Foundation/Today links. Loading/error/retry states do not fabricate progress or silently fall back to DEMO.

Progress shows actual current-version starts, attempts, completed practice, independent mastery evidence, pending content and due cards. Historical L001/L002v1 activity is retained separately and does not count as v2 completion. Unit statistics use that unit's lessons. Finishing the current two HSK1 drafts displays `2/2 bài hiện có`; it cannot produce `100% HSK1`, a completed HSK1 course or an HSK2 unlock. Every current course has `coverageVerified=false`.

## Architecture and eligibility

`content/curriculum/catalog.v1.json` is validated authoring metadata. The privileged local seed registers it in the existing PostgreSQL database. Runtime course/progress reads use the database through a scoped repository and existing development identity. UI imports a domain DTO, never SQL or the repository. Existing package manifests retain objectives, minutes, review/publication state and exercise references; those values are joined through immutable version bindings rather than duplicated in the course schema.

Availability (`NOT_RELEASED`, `AVAILABLE`, `PRACTICE_ONLY`, `PREREQUISITE_BLOCKED`) and saved activity (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`) are separate axes. Publication, ability to practice, verified prerequisites, completed practice and independent mastery are separate fields. Parent course/unit release permission is enforced in both curriculum projection and direct server draft access, including historical versions.

Hard skill requirements consume the existing mastery engine projections, require positive independent evidence and apply its Foundation/secure/stale rules. Draft attempts, slide reading, client duration and FSRS ratings cannot satisfy them. All current content is unreviewed, so verified eligibility and independent evidence remain zero. Local practice is an explicit provisional exception; production has no draft bypass. Unit prerequisites express suggested sequence; skill requirements express verified eligibility. No human approval is inferred from source alignment.

The weekly planner now consumes actual course/unit/current-version metadata and stores course context with selected actions. Existing active historical versions stay bound to their sessions. Due/relearning reviews retain priority; draft practice follows completed practice prerequisites with a provisional label. Explicitly disallowed/unreleased candidates are excluded. Caps, pause/rest, review debt, frozen history, idempotency and foreground telemetry retain their existing behavior. Planner version is `weekly-v1-local-2-curriculum`, included in the input fingerprint. No HSK readiness forecast or new mastery engine was introduced.

## Additive migration and preservation

`202610180005_course_catalog.sql` adds six global metadata tables: `courses`, `units`, `lessons`, `lesson_versions`, `unit_prerequisites`, `lesson_skill_prerequisites`. Existing `packages` and `exercise_versions` implement LessonVersion/ExerciseVersion storage. Four stable lessons reference six existing immutable package versions; current-version composite FK ties each pointer to its own lesson. Parent FK, unique IDs/orders, validated references and cycle checks protect the metadata. Seed replay preserves registered bytes and refuses drift instead of overwriting a current pointer or old package.

Runtime has SELECT only on all eight content/catalog tables. No publishing endpoint or runtime DML grant was added. All 18 owner tables retain FORCE RLS; runtime remains non-owner, non-superuser and NOBYPASSRLS. Existing owner transaction/advisory lock, cookie HMAC, Host/Origin checks, forged-identity rejection, runtime proof and production 403 gates are reused. The new `/api/local/curriculum` returns only allowlisted learner metadata; no keys, accepted answers or private reviewer receipts.

Before migration 005, a custom-format Sprint 5 backup and hashes of every original owner row were saved privately under `.local-postgres/sprint6/`. Backup: **812,070 bytes**, SHA-256 `5a48c95e7add6791b494c47abd3afddc23ca79cd5512b6f1450574121aa6683d`. Restore into a disposable database matched all original rows. A separate restore → five migrations → content/catalog seed upgrade preserved all original rows and six version bindings. Fresh installation also produced five courses, four units, four lessons, six versions and 18 FORCE-RLS owner tables. Only generated disposable databases were dropped; the real database was retained. Rollbacks are for disposable installations, never retained data.

A real stop/start of the project PostgreSQL cluster passed. Exact pre/post fingerprints matched all 18 current owner tables and all eight content/catalog tables, including attempts, session cursors, FSRS cards/logs and duration. Runtime repositories reconnected and returned identical four-lesson completed views, settings and progress. An isolated unfinished test-owner checkpoint then resumed; duplicate advance returned the same result and advanced once. The original 18-table historical-row subset still matched afterward. No browser writes ran during this comparison.

## Review readiness and source integrity

`npm.cmd run review:packets` generates four ignored private JSON packets and companion Markdown sheets at `.local-postgres/review-packets/sprint6/`: `F01.1`, `F02.1`, `L001.2`, `L002.2`. Packets contain actual original teaching blocks, Hanzi, tone-marked Pinyin, Vietnamese explanations, prompts, private keys/accepted alternatives/normalizers, concept/skill bindings, existing source locators, provenance/rights, missing audio/transcript status and unresolved questions. Identity, qualifications, date and decision remain null; findings remain empty until a real reviewer supplies them. Re-export preserves existing findings. No review-import or publisher service exists. The directory is ignored and is not a public route or asset directory.

[Public readiness table](review-readiness.md) contains hashes and outstanding questions, without answer keys. All four lessons remain DRAFT, unreviewed and publication-blocked. Preparing a packet or a model assessment is not independent review.

The actual pinned official `hsk-exam-2025-11` PDF was rechecked locally: 406 pages and all 26 existing locators passed. Original PDF hash is `ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941`. No new guessed locators, HSK2.0/GF0025 replacement list, official corpus redistribution or source-manifest edits were introduced. The exact 我叫 + name and 喜欢/喝 mappings remain unresolved; 安 remains supplementary. Source matching does not grant rights or validate language/answer keys. No approved audio/transcript or listening/pronunciation assessment exists.

## Verification

Final results on 2026-10-18 are also recorded in [structured evidence](evidence.json), including report hashes and run timestamps. All final suites have zero failures and zero skipped tests; browser reports also have zero flaky results.

| Check                                                                            | Final result                                                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Lint / strict TypeScript / Prettier / production build                           | PASS                                                                                                    |
| Learning / content / weekly planner / curriculum unit groups                     | 5 + 10 + 10 + 8 = **33 PASS**; includes 750 generated planner inputs                                    |
| Native PostgreSQL integration                                                    | **41/41 PASS**: original 33 plus 8 curriculum tests                                                     |
| Sprint6 hierarchy browser                                                        | Desktop **2/2**, mobile 360px **2/2 PASS**                                                              |
| Sprint5 complete journey/settings regression                                     | Desktop **2/2**, mobile 360px **2/2 PASS**                                                              |
| Legacy persistence / learning / content browser                                  | **6/6 + 4/4 + 6/6 PASS**                                                                                |
| DEMO / production local-API lockout                                              | **22/22 PASS**, desktop and mobile; new curriculum API and private packet paths included                |
| Total browser tests                                                              | **46/46 PASS**                                                                                          |
| Backup restore / fresh installation / upgrade / 18-table historical preservation | PASS                                                                                                    |
| Real PostgreSQL restart and runtime repository reconnect                         | PASS; exact 18 owner + 8 content/catalog tables, four completed views and isolated active-cursor replay |
| Official pinned source verification                                              | PASS: actual 406-page PDF and 26 existing locators                                                      |
| Production public JavaScript scan                                                | **25 files, zero private key markers**                                                                  |

Curriculum tests cover five-course ordering and real associations, Foundation classification, missing/duplicate references, prerequisite cycles, source/level/version binding, draft versus independent evidence, unreleased candidate exclusion, due/rest/pause behavior, private packet completeness and preservation, current versus historical progress, cross-owner isolation, FK/uniqueness, concurrent start, runtime DML denial and actual server course/unit permission. Browser flows complete all four drafts through visible controls, resume after reload, return to the correct course/unit, assert current-content counts and zero false mastery/HSK completion, exercise FSRS, loading/error/retry, forged owner rejection, keyboard activation, 200% CSS zoom, touch targets and axe/overflow checks. The production artifact returns 403 for local APIs and 404 for private packet paths even with local environment flags present.

Browser suites use new temporary owners and actual PostgreSQL writes, without deleting the existing owner's history. Desktop and 360px run separately with new owners and one Next development server each. Images in `evidence/` are actual browser screenshots. Earlier sprint images are retained unchanged; raw browser reports, database evidence, logs, backups, source PDF and reviewer packets remain ignored locally.

Repairs during verification: a new DB helper initially advanced with a stale session version after answering; it now rereads the checkpoint. A new browser test initially reloaded before its navigation completed; it now awaits the destination. The mobile navigation exposed a missing full accessible name, fixed by labeling the existing short mobile link. Course panels received explicit padding. Parent release permission is now also propagated into the course snapshot/planner, so a direct server denial cannot leave a misleading practice CTA. Final results above are reruns after the relevant repairs, not a claim that the initial attempts passed. After the session resumed, PostgreSQL was no longer listening on 5447; that browser rerun failed at the database-mode handshake. Starting the existing project cluster and rerunning all 41 DB checks restored the environment without a reset. A source-verifier invocation using the system Python lacked pypdf; the bundled Python runtime passed the unchanged verifier. Unit screenshot capture now awaits the correct route, heading and 1/1 scope before saving evidence.

Dependency audit on 2026-10-18: production dependencies have 0 reported vulnerabilities. The unchanged development dependency tree retains 5 high advisories in the existing eslint-config-next/fast-glob/micromatch/braces chain. No dependency was added or upgraded, and the suggested mismatched major config downgrade was not applied.

## Restart and next sprint

From `D:\Chinese-Study-Hub`:

```powershell
npm.cmd run db:start
npm.cmd run db:migrate
npm.cmd run db:content
npm.cmd run db:curriculum
npm.cmd run test:db
$env:CSH_APP_ORIGIN = 'http://127.0.0.1:3015'
npm.cmd run dev -- --port 3015
```

Open <http://127.0.0.1:3015>. Use `npm.cmd ci` first on a new checkout and `db:init` for a genuinely new local installation; full instructions are in [README](../../README.md).

No physical Android pilot, screen-reader UAT, qualified human review, approved audio, production authentication or cloud/provider readiness was completed. Headless 360px and CSS 200% zoom checks are not proof of a physical device or browser-toolbar zoom workflow. Existing telemetry limitations and absence of a durable offline queue remain. Next sprint should obtain qualified review of all four lessons/answer keys, resolve the two exact grammar mappings and rights/audio questions, then test with a real Android learner. Production owner identity and Supabase Free/hosting can proceed only under their existing T068/T009/T069, no-billing and content gates. This sprint does not grant that approval.
