# Safe application baseline integration

Client date: 2026-11-01. This is a local integration candidate, not a merge, deployment, publication, task-status update or Engineering Loop completion.

## Provenance and scope

- Source: `fix/hsk1-catalog-stability` at `6be987aac67617396f83836d5570c7b8fada6263`.
- Verified main: `ad7f4c59442b89701e5e41cd6a120284532c1650`; merge-base `3813bda55be7b77108344de6e5cc6bd74c51f034`.
- The earlier curriculum checkpoint was 154 commits ahead of main. Source6be includes three later stabilization/report commits, so the actual comparison is **157 source-only /17 main-only commits**. The import manifest retains all157 source commit IDs/parents/subjects.
- Candidate: `integration/app-baseline-main-20261101`, separate worktree under `D:\Chinese-Study-Hub\.local-postgres\app-baseline-20261101\candidate`.
- Imported runtime core: `872d03fc1ad14bb755345331208f704853f2347f`, with exactly one parent: verified main. No source-history merge/rebase was used. The final report commit is a documentation descendant; its exact delivered SHA is recorded in the handoff receipt and response.

The source branch/ref and its pre-existing local `AGENTS.md` edit remain unchanged. No source checkout/reset or discard was performed. A workspace-local worktree was used to keep all work inside the authorized directory and preserve the source checkout.

## File decisions

[Import manifest](app-baseline-import-manifest.json) lists every source path, blob, decision and reason, plus all88 original main paths.

| Group | Integration decision |
|---|---|
| Next.js/TypeScript, routes, components, domain/application/repositories, runtime configuration | Import source application files; preserve UI→server→domain/repository boundaries |
| SQL migration/rollback files, content packages and runtime metadata, tests/scripts | Import exact source definitions; do not apply migrations, reseed/reset content or create new teaching material |
| Offline cloud-proof harness | Import because existing offline unit/type checks depend on it; no account/project/provider/deployment action |
| Existing main files | Keep86 exact mode/type/Git blobs; append only to `.gitignore` and `.gitattributes` while preserving their original bytes as prefixes |
| Source versions of55 shared main paths | Do not overwrite main, including AGENTS, controller code, SSOT, engineering-loop docs and implementation handoffs |
|31 main-only paths | Retain all of them, including newer routing/assurance/recovery/controller protections |
| Source `next-env.d.ts` | Exclude generated types; regenerate locally and ignore in Git |
| Secrets, DB files/dumps, node_modules, .next, graph/cache/test outputs | Do not import or stage. Only selected local connection configuration is copied into ignored paths for testing; raw evidence stays local |

**1384 source files are imported:1379 exact source blobs and5 declared adjusted files.** Two existing main configuration files are append-only. The initial core adds four wholly new paths: the manifest, two read-only verifiers and one preparation regression test. Content packages are unchanged, including their immutable old versions and DRAFT/publication gates. Generated planning metadata already referenced by immutable runtime manifests is a required versioned input; it is distinct from transient build/cache artifacts.

`sourceSha256` in the manifest hashes source blob bytes. Its `importedSha256` records the initial controlled copy, before the listed integration adjustments. Final adjusted file blobs/hashes are recorded in the machine report. Git-normalized blob bytes and local Windows working-file bytes are not silently treated as identical.

## Deliberate integration adjustments

1. `next.config.ts`: documented `agentRules:false` prevents Next16.4.2 from rewriting main's repository instructions. Installed documentation was inspected before this change. No agent-feedback hook/service was enabled.
2. `playwright.hsk24.config.ts`: bounded optional local port, preserving default3037; candidate uses3041. Browser same-origin headers now derive from its configured base URL. Timeouts/retry limits and owner checks are unchanged.
3. `benchmarks/cloud-proof/prepare-shared.mjs`: a fresh checkout exposed a missing generated dependency. The old generator rejected the current transaction graph's public course-outline JSON with `SHARED_SOURCE_ESCAPE`. It now allows exactly `content/curriculum/catalog.v1.json` in addition to bounded source TypeScript dependencies. Other content and private configuration remain excluded.
4. `package.json`: local preparation/typegen hooks make typecheck/build reproducible without copying source caches. Package dependency specifications and `package-lock.json` remain unchanged;25 installed direct dependency versions match the lockfile. Fresh `npm ci --ignore-scripts --offline --no-audit --no-fund` installed396 packages from cache. Its ESLint deprecation warning is retained; no upgrade/audit-fix was performed.
5. `.gitignore`/`.gitattributes`: append runtime/cache exclusions, generated next-env exclusion and the two source asset text rules; do not replace main's rules.

The initial clean-checkout typecheck failure and failed preparation log are retained as integration evidence. A new regression verifies that the generated transaction graph matches current source hashes and includes only the explicit public outline outside `src`. Generated files remain ignored.

## Fresh candidate verification

Results are generated from this candidate's new logs in [the machine report](app-baseline-integration-report.json), not inherited source PASS counts. Source `docs/hsk24` reports are historical provenance; their old local artifacts were not copied into the candidate as fresh acceptance.

| New candidate check | Actual result |
|---|---|
| Unit | **142 PASS /0 FAIL /0 SKIP**; includes new clean-preparation regression |
| Selected native SQL,6 runs | **35 PASS /0 FAIL /0 SKIP**: native2, Foundation6, HSK1 11, HSK2 6, HSK3 5, HSK4 5 |
| Browser | **14 PASS /0 FAIL /0 SKIP**, retries0;7desktop+7mobile360 |
| Typecheck/lint/supplemental lint/production build | **PASS** after the documented preparation fix |
| Real HTTP controls | Valid catalog200/200 with129HSK1 activities; deliberately absent DB503/503 with`LOCAL_DB_UNAVAILABLE`, no false empty success |
| Production client marker scan |33JS/maps,970491bytes,5288expansion key IDs,0hits; bounded scan, not formal non-leak proof |
| Private/binding preservation | **83308 pre-task rows/bindings unchanged**, including the original76293;667bindings retained |
| Complete content/meta preservation | **11380 rows across9tables unchanged** by full-row fingerprints; counts overlap package bindings, so do not sum them into a unique global total |
| Applied migrations/schema |7migration histories/digests match; before/after schema fingerprint unchanged; no migration applied |

The first clean typecheck/preparation failed and was repaired before the142-case run. These failures remain recorded, not overwritten as PASS. Browser/server logs also contain `aborted/ECONNRESET` and an`uncaughtException` label while all14assertions passed. No exact cause is inferred from that label and no clean-console claim is made.

The acceptance set covers unit/content validation, native SQL grading/idempotency/owner isolation/FSRS/progress/Today, cold-first/warm catalog and explicit UI fault states, desktop/360px lesson/navigation/Today, typecheck, lint and production build. Browser-injected network/timeout/503 cases, real PostgreSQL negative controls and actual HTTP probes are reported separately. Cold means the first flow in a fresh development process/compilation directory; later/mobile cases use a warmed server. This is not a cold OS/database-cache or hosted-production benchmark.

The final source-preservation and candidate-provenance readbacks follow testing. Source evidence such as the old14997ms canceled request is not converted into a newly diagnosed or closed incident. The historical cold/503 root-cause gate remains **OPEN** even if this candidate's selected acceptance passes.

## Existing database and schema

The existing PostgreSQL18 cluster was stopped at session start; only its existing `start` command was used. No init, migration application, rollback, reset, DB import or cloud database creation was executed. All testing uses the same populated loopback sandbox `csh_hsk24_bf294b6506c1` at5447 with the existing runtime role and fresh synthetic test owners.

- Read-only repeatable-read audit confirms all7 applied migration versions/checksums match candidate files; there are no unapplied/mismatched migration entries. The aggregate migration digest matches local runtime proof.
- Application schema fingerprint covers relations, columns, constraints, indexes, policies, functions and grants in app schemas, plus the two local roles. It is compared before/after; it is not a complete cluster/production audit.
- Every pre-existing private-row/package-binding key/hash is compared against the pre-task snapshot; the original76293 baseline is also checked separately.
- A second read-only audit hashes complete canonical PostgreSQL JSONB rows for all9 `app_content`/`app_meta` tables, preserving multiplicity and comparing count+SHA256. This includes complete package manifests, not merely their declared binding hashes. Raw content/meta rows are not written into the receipt.
- Existing learning-write guards still enforce runtime role privileges/memberships,19 FORCE-RLS tables and exact migration/database/runtime proof. These local checks do not mark official T009 done.

## Review, SSOT and remaining gates

Fresh independent manual review is bound to the exact candidate SHA and actual file/test evidence. It is not a real controller review, Loop PASS, human-language approval, taskDONE, publication/mastery permission or merge authorization.

The candidate's preserved controller returned actual `ssot-status=VERIFIED_READ` for pinned main (70tasks/34active, liveWriteVerified=false). This read-only command is not a DEVELOP/REVIEW/MERGE lifecycle. Main's canonical statuses remain unchanged, including pending T009/T026/T052 and M1 authoring/effectiveness gates. No private source grant/ledger or synthetic D004 DONE was imported as task authority.

Before merge/activation: accept the broad existing app baseline as an explicitly reviewed scope; resolve any failed candidate acceptance; retain source cold/503 and other declared limits; preserve newer main controller protections; complete applicable task-specific dependency/rights/account/review gates. Existing DRAFT content is not published by accepting a code candidate. No deploy/API activation or task status is inferred from imported code.

See [local draft PR](app-baseline-local-pr-draft.md) and [Loop takeover proposal](engineering-loop-takeover.md). No push, merge, deploy, paid service, autonomous backlog or real Loop run occurred in this task.
