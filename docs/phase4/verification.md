# Phase 4 — local playable foundation lessons

Result: **PHASE4_IMPLEMENTATION_COMPLETE — LOCAL DEVELOPMENT only.**

Scope: LOCAL DEVELOPMENT only, based on exact `4944034` on `feat/hsk3-foundation-content`. This is not T013/T016 completion, content approval, official HSK authorship or production readiness. No Engineering Loop, Reviewer/subagent, paid API, cloud, push, merge or task-status write was used.

## Delivered behavior

Choose LOCAL DATABASE at `/learn` → open `/learn/draft/F01` → read original Vietnamese explanations, identify written initials/finals, enter tone-marked/numeric Pinyin → receive server grading → reload/resume → finish practice → F02 written tones → FSRS review → truthful progress. The existing six screens, old DEMO routes and Phase3 token fixture remain available.

| Draft | New concept senses | Teaching / retrieval | State and limits |
| --- | --- | --- | --- |
| F01 | 3 | 4 / 6 | Playable original internal foundation; not an official HSK unit |
| F02 | 6 | 5 / 8 | Playable written-tone foundation; listening/pronunciation unassessed |
| L001 | 6 | 3 / 2 | Original HSK1 PARTIAL draft; proper name supplementary |
| L002 | 6 | 2 / 2 | Original HSK1 PARTIAL draft; exact teaching pattern unresolved |

All four use schemaVersion1 and immutable version IDs/hashes, `REVIEW_PENDING`, `DRAFT_UNREVIEWED`, publication `BLOCKED`, no human receipt and no media. A 15-minute estimate is a design target, not measured pilot duration. Each micro-lesson declares at most one primary new grammar pattern. Draft practice access never claims secure foundation or unlock eligibility.

## Exact source verification

Read the [specified official PDF](https://hsk.cn-bj.ufileos.com/3.0/新版HSK考试大纲1219.pdf), not an old HSK list or GF0025-2021. Cover: 《HSK 考试大纲》 / 中外语言交流合作中心, published2025-11, implementation2026-07. The exact download has406 physical pages,4,636,209bytes, SHA256 `ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941`. The cover, TOC and relevant HSK1 section boundaries were read; cover and selected vocabulary/grammar renders were visually inspected. The PDF/renders remain only in ignored `.local-postgres/source-research/`, never Git/public assets. Only26 narrow references were recorded (under the ≤50-entry research bound).

Locator convention: zero-based `pdfIndex`; `physicalPage = pdfIndex + 1`; numbered body `printedPage = pdfIndex - 2`.

| HSK1 section | Zero-based body range checked | Physical pages | Printed pages | Selected references |
| --- | --- | --- | --- | --- |
| Tasks | 4–7 | 5–8 | 2–5 | Personal basic infoI at index4; socialVI / food preferencesVII at5 |
| Topics | 58–59 | 59–60 | 56–57 | Personal info, basic politeness, food/drinks at58 |
| Vocabulary | 79–85 | 80–86 | 77–83 | 8 narrow entry/reading/level references below |
| Character recognition | 355–356 | 356–357 | 353–354 | 9 characters below |
| Grammar | 385–387 | 386–388 | 383–385 | modal particle 呢 at385; verb predicate / verb-object phrase at386 |

Section divider indices3/57/78/354/384 were also checked. Selected vocabulary ordinals (all level1): 茶17/index79, 喝77/index80, 叫91/index81, 呢144/你146/你好147/index82, 我221/喜欢225/index84. Characters: 茶17/好65/喝67/欢73/叫84/呢124/你126 at index355; 我186/喜192 at356.

**Count: 8 vocabulary +9 characters +3 tasks +3 topics +3 broad grammar categories =26 distinct checked references.** These are reference records, not26 new senses or a percentage of HSK coverage. Internal sense IDs are project identifiers. Entry/reading/level/locator checking does not attest the Vietnamese semantic explanation or a human-reviewed answer key. The level1 verb reading of 叫 is not collapsed with a higher-level preposition sense.

Unresolved: `g-jiao-pattern` (我叫+name) and `g-like-pattern` (喜欢+phrase) are `UNVERIFIED`; the broad categories are checked but the precise teaching interpretation is original. 安 is a `SUPPLEMENTARY` proper name, with no HSK1 membership claim and no verified coverage credit. Both L001/L002 therefore remain PARTIAL. F01/F02 alignment is NOT_APPLICABLE internal foundation.

Rights remain `UNKNOWN / REFERENCE_ONLY`. Public availability is not a redistribution license. No official exercise/audio/textbook dialogue or complete corpus was imported. All teaching exercises here are original, unreviewed drafts.

### Immutable provenance nuance

The web PDF was read while the private download was still incomplete. Original v1 manifests/evidence record that creation state and have `sourceSnapshotSha256: null`. They were not rewritten after attempts existed. Additive `source-pin.json` records the completed full-PDF checksum and normalized-LF evidence digest,26 successful matches and scope/date. Catalog loading requires that pin and evidence digest; publication validation still requires a source-pinned new content version and all approvals. A new version is required for corrections/publication. The Phase4 registry/player is intentionally bounded to four v1 drafts; future coexistence of revised versions needs an explicit registry/routing extension, not replacement of the existing v1 files. The physical PDF writes `nǐ hǎo`; the web parser joined `nǐhǎo`. The verifier normalizes only Pinyin whitespace, preserving tones/characters.

Recheck with Python+pypdf and the same private PDF: `python scripts/verify-hsk-source.py <path-to-exact-pdf>`. This verifies source facts, not language/rights approval.

## Architecture and validation

- `content/staging/slice/`: four immutable JSON manifests, bounded evidence and additive source pin. Private keys stay outside UI/public assets.
- `src/modules/content/domain/`: strict versioned Zod schemas, DAG/source/concept/skill/key/media/publication validators, lifecycle guard, public allowlist and deterministic grading. Errors identify file, record, field and code. Runtime supports choice and bounded typed Pinyin, not arbitrary free-text semantics.
- Pinyin normalizer preserves NFC, ü/v input convention, numeric/marked forms and neutral0/5/bare forms when explicitly taught. It rejects wrong/missing full tones, misplaced marks and ambiguous sense/answer sets. It does not assess sound.
- `application/catalog.ts`: schema-order stable manifest hashing, bounded source/entry validation and mandatory source-pin/evidence digest. `scripts/validate-content-assets.ts` checks actual bytes/path confinement/hash for authoring/seed only. Runtime rejects media-bearing Phase4 packages until a reviewed media adapter exists. This avoids dynamic whole-workspace tracing in the Next build.
- `infrastructure/postgres-content.ts`: reuses ownerTransaction, existing sessions/attempts/events/receipt/FSRS/mastery flow. Grading+attempt binding+unreviewed evidence+card+receipt commit together; failure rolls back. Advance uses optimistic versions, server sequencing and persisted cursor. No publisher endpoint or authority adapter exists.
- API routes under `/api/local/content/` reuse development build/runtime, loopback Host/Origin, HMAC identity and strict DTO gates. Public list/package/React props have no private keys/keyRef/accepted answers/review receipts. Post-submission feedback belongs only to submitted answers of that owner. Production rejects draft APIs even with local env flags.
- UI has loading/empty/error/retry, pending controls, visible saved feedback, Pinyin toggle, Chinese language metadata, keyboard/focus management and mobile layout. Today recommends optional practice, not fictitiously unlocked content. Review/progress label draft evidence honestly.

No new dependency was needed. `ts-fsrs@5.4.2` config/adapter and mastery-v1-local-1 eligibility rules are unchanged. New concept cards use controlled server templates, UNIQUE owner/template and a10-new-card/day UTC cap; old templates remain unchanged. Self-ratings never call mastery projection. Draft evidence is `unreviewed_fixture`, answer-exposed/provisional, `durationVerified=false`, no independent/delayed mastery or unlock. Existing evidence is not retroactively upgraded.

## PostgreSQL, backup and restart

Migration: `supabase/migrations/202610170003_content_duration.sql`; inverse under `supabase/rollbacks/` is tested only on disposable databases. No acknowledged data was rolled back.

Adds global runtime-SELECT-only `app_content.packages/exercise_versions` and four owner FORCE-RLS tables: content_session_state, activity_leases, duration_events, content_attempt_bindings. Runtime remains nonowner/nonsuperuser/NOBYPASSRLS/no memberships; all14 owner tables require FORCE RLS. Historical checks are extended for versioned new event/grading sources without rewriting old rows. Composite owner FKs, package/key bindings, append-only receipts/evidence and per-owner locks remain enforced. Runtime proof is invalidated by migration and restored only by actual DB tests.

Pre-upgrade backup: ignored `.local-postgres/phase4/phase3-backup.dump`,70,808bytes, SHA256 `c6794ca34838722f66f12c6ffba1df8c8bfa6b29fb3be704b1d21f9718f52ffe`. `phase4-preserve.mjs restore-test` restored a generated disposable DB and matched all historical row fingerprints. `upgrade-test` restored Phase3, applied Phase4 and seeded4 packages, preserving every historical row. Fresh migration/rerun/rollback/reapply also runs in the existing DB suite on a generated disposable DB.

**Real PostgreSQL stop/start PASS.** With all test servers stopped, captured private row fingerprints for all14 owner tables plus both content tables, then ran `db:stop` and `db:start` on the project cluster. Every fingerprint matched afterward, including historical/new attempts, cursor, FSRS cards/logs, evidence and duration receipts. A new runtime pool/application repository reconnected and reproduced the completed F01/F02 answers, feedback and saved cursor exactly. The initial read-check CLI invocation exposed a TSX/CommonJS top-level-await incompatibility before any stop; wrapping the entrypoint in async main fixed it, and the complete real restart sequence then passed. Reproduce around a deliberate local restart with `node scripts/phase4-preserve.mjs capture-restart` / `verify-restart` and `node --env-file=.env.local --import tsx scripts/verify-content-restart.ts capture` / `verify`. Never restart a different cluster.

Historical preservation checks compare all pre-existing rows in10 original owner tables; new test-owner activity is added, so this is not a claim that the entire database is unchanged. Browser suites use temporary server-side owners. Neither original user history nor historical attempt/card versions were deleted to reset tests.

## Duration evidence

Rule `foreground-idle60-v1`: visible+focused intervals, last interaction cap60s, samples≤15s, monotonic elapsed bound, stable event IDs, distinct observed/received timestamps. Opening/returning after idle closes the old interval before resetting interaction time. Hidden/blurred intervals are excluded. One server lease per owner serializes tabs; overlapping intervals across sessions/clients are rejected, not counted twice.

Server validates owner/session, ordering, bounds, lease expiry, clock skew/stale horizon and overlap under owner lock. Immutable receipts return the original result on duplicate; a changed payload with the same ID conflicts. Classifications are VALIDATED_TELEMETRY, SUSPICIOUS_INVALID and MISSING_INSUFFICIENT. Only accepted milliseconds are aggregated. Duration remains client-observed and user-controllable; it never becomes trusted independent evidence. Missing key approval, exposure/repeat/delay and mastery gates are not weakened.

Unacknowledged intervals retry with the same ID in the current tab (bounded in-memory queue). Reload/unload, prolonged outage or discarded unacknowledged tail can lose telemetry; no durable offline/recovery guarantee. A tab that loses its lease can explicitly resume. Unit arithmetic and server/real-DB tests cover idle/hidden/skew/overlap/duplicate/concurrency; browser covers foreground and two tabs. Native Android power/background behavior is not attested.

## Executed checks

| Command / check | Result |
| --- | --- |
| `npm.cmd run lint` | PASS, no ESLint warnings |
| `npm.cmd run typecheck` | PASS, also rerun after CLI repair |
| `npm.cmd run format:check` + Prettier check of new CLI files | PASS |
| `npm.cmd run build` | PASS, no asset tracing warnings after repair |
| `npm.cmd run test:learning:unit` | 5/5 PASS, original grading/mastery/FSRS goldens |
| `npm.cmd run test:content:unit` | 10/10 PASS |
| `npm.cmd run test:db` | 25 real PostgreSQL JUnit cases PASS,0 skipped |
| `npm.cmd run test:local` | 6/6 PASS, desktop/mobile original persistence suite |
| `npm.cmd run test:learning:browser` | 4/4 PASS, desktop/mobile original FSRS/mastery suite |
| `npm.cmd run test:content:browser` | 6/6 PASS, desktop/mobile, retries0; final full run2.7min |
| `npx.cmd playwright test --config playwright.persistence-demo.config.ts` | 22/22 PASS, production DEMO and old/new local API lockout,41.9s |
| Exact-PDF/source verifier | PASS,406pages/26 actual locators |
| Private backup restore / Phase3 upgrade / fresh migration roundtrip | PASS |
| Real PostgreSQL stop/start + row/repository/historical verification | PASS |
| Frontend evidence record checker + rendered inspection | PASS,8 new screenshots |
| `npm.cmd audit --omit=dev --json` |0 reported vulnerabilities; full audit5 high dev-chain entries remain |

New DB cases verify publisher denial, all14 RLS tables/cross-owner isolation, private projections, server sequencing/stale versions, atomic binding/evidence/card writes, duplicate/concurrent/lost-ack replay, deliberate mid-write failure/rollback, duration receipts, F01/F02 completion, Pinyin correctness, provisional mastery and manifest drift. All original tests remain; the old table-count assertion changes10→14 to reflect the additive schema.

Browser checks cover desktop1440×1000/mobile360×800: library → F01 teaching → choice/typed server response → lost ACK retry with identical key → saved feedback/cursor reload → complete F01/F02 → L001/L002 PARTIAL/supplementary labels → real FSRS rating → progress0 independent. Extra tests cover two-tab lease, forged score/owner422, publisher PATCH405, loading/empty/error and real-server retry. Axe checks F01; keyboard Pinyin toggle/focus and language tags are asserted. Layout is checked at320/360/720/1440 CSSpx and body zoom200%; this is automated CSS reflow/zoom, not native Chrome zoom-menu UAT or TalkBack/NVDA/native-device acceptance.

Failures and repairs were retained honestly: initial E2E raced consecutive async teaching buttons/shared interrupted sessions; waits now follow acknowledged busy state and interrupted practice is completed through UI, never deleted. A later focus assertion ran before start-focus settled; its first repair incorrectly selected the teaching heading rather than the step heading. The selector/wait was corrected to `.player-heading h2`. A language-tag assertion also selected the hidden desktop brand on mobile; it now scopes to visible lesson content. No timeout increase, retry policy change, assertion removal or production-key exposure was used. Initial PDF extraction during streaming failed EOF; the completed exact snapshot was then verified. Pinyin extraction spacing mismatch was inspected against the rendered row before explicit whitespace normalization. Build tracing warnings from arbitrary asset-root reads were fixed by moving the offline asset validator out of runtime, not by hiding warnings.

## Remaining gates / next slice

Competent human Mandarin/text/answer review; explicit rights/license decisions; approved reference audio/consent/transcript/quality; authorized publication; fully source-pinned new immutable versions; reviewed duration eligibility/pilot calibration; production auth and actual cloud T009/T068/T069 remain outstanding. Browser automation is not human content/audio/accessibility approval. No approved listening/pronunciation task, complete HSK1 corpus, tutor, offline sync or production backend was added.

Audit on2026-10-17: production dependencies0 reported vulnerabilities; full audit5 high entries in the existing dev lint chain (`braces → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next`), all from GHSA-vfj7-8cjw-p6xm. Audit suggested a forced incompatible eslint-config-next14 downgrade; it was not applied to Next16. Audit counts do not establish absence of other bugs. Existing package-lock/dependency versions are preserved.

Smallest next slice: obtain a qualified volunteer's concrete corrections/key decisions for F01/F02, then author a new immutable source-pinned/review-receipt version with a reviewed original audio sample and rights record. Add one approved listening retrieval path through the same transaction/evidence gates. Until those actual inputs exist, keep written practice provisional; do not expand into a full corpus or fabricate review/unlocks.

Restart commands and user flow are in the root README. Preview: `http://127.0.0.1:3010/learn` → LOCAL DATABASE. Git protected SSOT/Engineering Loop/source register paths remain identical to4944034; origin/main was verified at3813bda55be7b77108344de6e5cc6bd74c51f034. Previous feature branch refs are preserved.

Delivery preview was restarted on127.0.0.1:3010 after the production suite. Library and F01 page returned HTTP200; local status reported enabled=true, active=false for a fresh request (select LOCAL DATABASE to enter). Startup via a hidden detached process was rejected by execution policy; the normal managed development-server session started successfully without changing policy.
