# Phase 2 — local persistence verification

Base: `feat/local-interactive-preview` / `2e1e0c3`. Implementation branch: `feat/local-postgres-learning-foundation`. No Engineering Loop, smoke, Reviewer, cloud, deployment, push, merge or canonical task-status write. Main was fetched and remains `3813bda55be7b77108344de6e5cc6bd74c51f034`; plan/status remain byte-identical. The old authorization prose in the base handoff predates this owner's explicit Phase 2 request; this work claims no backlog completion.

## What is persisted

| Record | Contract |
| --- | --- |
| `time_preferences` | Weekly minutes, selected weekdays, shared cap for each selected day, session minutes, optimistic version and server timestamp. UI retains the existing schedule controls. |
| `lesson_sessions` | Owner, immutable local fixture version, active/completed state and server timestamps. One active session per owner/version. |
| `attempts` | Immutable answer response, exercise version, server fixture comparison and server timestamp. An answer is the typed `response` inside an attempt, not a separate mutable score record. |
| `learning_events` | Append-only owner sequence for answer/completion, payload/engine versions; written in the same transaction. |
| `lesson_progress` | Completion count and last session, updated only by successful complete command. Answer counts/fixture matches are queried from attempts. |
| `api_idempotency` | Owner + endpoint + UUID key + payload digest + committed response, atomically with the command. Same key/new payload is409; same payload returns prior response. |

Only `local-foundation-v1`, an original two-exercise string fixture, is connected to learning persistence. Its public projection has no answer-key fields. A server-only fixture comparator checks the choice against versioned tokens. This is not a validated HSK grader, independent mastery evidence or production content. F01/F02/L001/L002, onboarding level and flashcard ratings stay DEMO in React memory; they never change database progress. Schedule preview remains the existing capacity calculation, not a new planner or FSRS implementation.

## Boundaries and safety

- Route Handlers contain authentication/contract calls, no SQL. Domain contracts/ports are separate from node-postgres repositories and the UI. ESLint prevents UI imports of server/DB/infrastructure modules.
- Runtime connects as `csh_runtime`, migration as separate `csh_migrator`, table ownership as `csh_schema_owner` NOLOGIN. No app request receives the admin credential; it is absent from `.env.local` and absent from repository imports.
- All six owner tables use FORCE RLS and `user_id=auth.uid()` USING/WITH CHECK. Composite owner/session FKs reject cross-owner links. Runtime cannot create tables/roles, assume the owner role, mutate historical attempts/events/idempotency, or write proof metadata.
- Every owner operation checks role/RLS metadata, takes one client/transaction, sets transaction-local verified owner context, and locks that owner. An error rolls back; broken connections are discarded. A/B/unauth and failure→B tests force reuse with poolMax1 and assert claims clear after commit/rollback.
- Learning commands additionally require migration-bound runtime proof. Tests publish it through migration credentials only after real RLS/pool assertions pass. Failed test runs revoke it. This is local-native evidence only; T009's actual Supabase Free/runtime topology and real JWT authentication remain unverified, and SSOT status stays unchanged.
- Local identity requires development mode, explicit opt-in, configured loopback Host/Origin, JSON/custom header for writes and signed HttpOnly/SameSite cookie with server owner allowlist. Client owner/score fields are rejected. This is not real login; anyone controlling the local OS/credentials is trusted. Production disables local access even when local config exists.
- No optimistic saved message. UI updates after server ack/readback; network errors retain explicit LOCAL mode. In-tab retries retain an unacknowledged idempotency key; reload reads committed data. No durable offline queue, background sync or fake saved fallback.
- SQL migration is checksum-guarded and atomic. Rollback is explicitly destructive and requires `--confirm-local-data-loss`; no automatic down migration on acknowledged data. Its reversible schema shape is tested in a separate disposable database.

## Evidence and test scope

The machine-readable results are in [evidence.json](evidence.json), generated from actual test artifacts. Screenshots in `evidence/` show desktop1440px and mobile360px. Browser traces are disabled so signed local session cookies are not retained in traces.

| Final check | Observed result |
| --- | --- |
| Lint / TypeScript strict / production build | PASS / PASS / PASS |
| Real PostgreSQL integration | 10 JUnit test cases PASS (Node counts11 including the security group), including5 security cases |
| Development browser slice | 6/6 PASS: desktop and360px mobile |
| Original DEMO + production lockout | 20/20 PASS on the new production build |
| Native PostgreSQL restart | PASS, PostgreSQL18.4; settings/attempts/events/progress and proof preserved |
| Canonical plan/status/manifest and Engineering Loop | Unchanged |

Database tests use native PostgreSQL, real runtime connections and actual SQL. Browser tests use the UI for schedule, reload, fixture answer, resume, completion and progress; a controlled network interception forwards the real answer to the server, then drops its acknowledgement, and forwards the retry to the real server. It does not fabricate successful persistence. A separate503 UI test is an explicitly mocked refusal, used only to prove the app stays unsaved and LOCAL. Interrupted test fixtures can be completed explicitly by test setup; acknowledged data is never deleted to make tests pass.

Early runs caught NextRequest's loopback URL normalization, a premature test reload before client navigation completed, and a pre-existing desktop brand accessible-name mismatch. Host/port validation now accounts for NextURL normalization without accepting foreign hosts. Tests wait for the target URL before reloading; brand naming now matches visible content. The final result is reported only from completed checks, not from those failed iterations.

The native restart test also exposed Windows handle inheritance: a detached postmaster could keep a captured `pg_ctl` stdout pipe open. The helper now uses ignored stdio with the server's private log file. Restart and subsequent `db:start`/`db:migrate` were rechecked successfully. The original DEMO network test now checks its configured origin instead of hardcoding port3000; external/write requests remain forbidden.

Production build and original DEMO tests use a separate cổng3011 server from the new build. The existing preview at3000 is preserved. Development tests own3010 only while running. Installed Next16.4.2 generated its managed documentation block in AGENTS.md and regenerated next-env.d.ts; the project authorization text was not changed.

## Remaining release work

No production authentication, reviewed/published Chinese lessons/audio, official grading, mastery/FSRS, prerequisite enforcement, actual weekly planner, cloud no-billing proof, free-host benchmark or independent application review is claimed. T009/T068/T069 and competent content/license review gates remain. Local persistence is usable for development fixtures only. The native cluster has local durability, not an off-machine backup or audited disaster recovery plan.

The dependency audit currently reports5 high advisories through the existing ESLint/Next lint dependency chain. Added `pg`/`zod` are not the reported advisory packages. No forced dependency upgrade or disabled audit was used; inspect `.local-postgres/npm-audit.json` locally before release.

Startup and stop/rollback commands are in the root README. API endpoints are isolated under `/api/local/*`; none is presented as a completed production `/api/v1` learning contract.

Implementation references: [PostgreSQL18 RLS](https://www.postgresql.org/docs/18/ddl-rowsecurity.html), [node-postgres single-client transactions](https://node-postgres.com/features/transactions), [Zod schemas](https://zod.dev/api), and the installed Next16.4.2 Route Handler/NextRequest docs under `node_modules/next/dist/docs/`. These references support the design; the result claims above come from this workspace's actual tests.
