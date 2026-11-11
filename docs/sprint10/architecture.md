# Sprint 10 — owner authentication boundary

Implementation base: `6115ce4` on `feat/v1-pronunciation-pilot`, a descendant of the brief's `69e1d8b`. Work continues on `feat/v1-owner-auth-readiness`, preserving the later microphone fixes. Pinned `origin/main`: `0dc42253180ef38d1c43f1f87c9f0f675a851341`. Canonical plan/status, Engineering Loop and PRs are unchanged.

## Modes and identity

| Mode                     | Identity and data access                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEMO                     | Explicit preview; existing tab-only examples. No authenticated production identity or database access.                                            |
| LOCAL_DATABASE_DEV       | Existing loopback/Host/Origin/HMAC development adapter. Both build and runtime must be development.                                               |
| PRODUCTION_AUTHENTICATED | Supabase Auth server verification, exact UUID owner allowlist, server-side PostgreSQL repositories. No development adapter or DRAFT learning API. |

A production build defaults to authenticated mode when no mode is configured. Startup refuses missing/unsafe production configuration. Explicit DEMO remains available for the existing artifact regression; release preflight refuses it as an owner release. A production build cannot activate the development adapter by changing runtime flags.

The integration pins `@supabase/ssr@0.12.7` and `@supabase/supabase-js@2.118.0`; the latter requires Node >=22. Installed Next.js 16.4.2 guides were checked before implementation. The current [Supabase SSR guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs) uses `createServerClient`, `getAll`/`setAll` cookies and Next 16 `proxy.ts`. Each request gets its own SDK client. API handlers independently call `getUser()` against Auth immediately before selecting the owner; they never authorize from `getSession()`, cached cookie user fields, email, headers, query `userId`, or a submitted UUID. The exact returned user ID must match `OWNER_USER_ID`; anonymous/non-authenticated roles are denied.

Proxy refreshes page sessions and forwards refreshed cookies to rendering. The study route-group layout checks identity again, including requests that bypass Proxy. APIs check independently. Origin and raw Host must match configuration; forwarded identity/host headers are not trusted. Mutation endpoints require same-origin JSON and a custom header, with no credentialed CORS opt-in. Redirects accept a small set of internal study paths and reject external, encoded, backslash and auth-loop destinations.

Auth remains a BFF operation: the browser never instantiates Supabase or calls SQL. SDK tokens do not enter React props, localStorage, sessionStorage, IndexedDB or the profile response. Cookies use HttpOnly, SameSite=Strict, path `/`, no Domain, and Secure plus a `__Host-` name over HTTPS. HTTP is allowed only for explicitly configured development loopback integration; it is rejected in the production artifact. Responses carrying sessions/private data are no-store, private, Cookie-varying, with frame/referrer/nosniff headers.

The [Supabase advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide) distinguishes token verification from checking the current user/session remotely. This implementation chooses remote `getUser()` for every authorization, accepting extra latency rather than relying solely on a locally cached JWT. Actual deployment latency, asymmetric-key projects, host/proxy TLS and cloud revocation remain separate deployment evidence.

## Session lifecycle

Password login has no public signup, invitation or email-reset endpoint. A valid non-owner login is signed out locally and cleared. The configured owner reaches Today or a sanitized internal return path. The app refreshes via the SDK cookie adapter; refresh headers and every cookie chunk are retained on redirects/responses. The API session-verification boundary maps provider unavailability to a retryable 503. Login returns a generic failure for SDK sign-in errors, and page-proxy failures can lead to the unauthorized state. Final provider-outage UX has not been reverified while Docker is unavailable.

Logout aborts client protected requests, unmounts the private UI and calls provider session sign-out. Cookies are cleared even when remote revocation cannot be confirmed; that case has distinct UX and is not claimed as a confirmed remote logout. Successful logout broadcasts a token-free signal to other tabs. A terminating tab ignores its own broadcast and stale authorization responses. Returning from history/focus hides the private shell until identity is rechecked. A browser can lack BroadcastChannel; focus/visibility checks remain the fallback, not a claim of immediate cross-device logout. Requests already authorized and committed server-side cannot be rolled back by aborting their client fetch.

The in-process login limiter is 10 attempts/minute. It is not a distributed limiter and resets with a server process; provider-side rate limits remain required in the provisioning runbook. No Redis, paid monitoring or additional service is introduced.

## PostgreSQL trust boundary

The server passes only the verified subject to existing `ownerTransaction`: acquire one runtime connection, BEGIN, check least privilege/FORCE RLS, set transaction-local `request.jwt.claim.sub`, acquire the owner advisory lock, execute parameterized work, COMMIT/ROLLBACK, release. Client requests cannot select claims. RLS USING/WITH CHECK and composite ownership keys remain defense in depth. A holder of the runtime SQL credential can set a custom GUC; the architecture assumes that credential is held exclusively by the trusted server. RLS does not cryptographically verify an arbitrary GUC by itself.

The only additive migration is `202610190006_owner_profile.sql`. All 19 private tables require FORCE RLS; runtime is still `csh_runtime`, non-owner, non-superuser, non-BYPASSRLS, without privileged role membership. Eight content tables are unchanged. Runtime receives only SELECT/INSERT/UPDATE on its profile table. Learning attempts/events/FSRS remain in their existing tables; no historical user ID is rewritten. Idempotency remains scoped to the verified owner.

Profile includes the verified user ID, display name, text-size preference and validated IANA timezone. Its display timezone is separate from the saved planner timezone: changing profile presentation never silently reinterprets an existing schedule. The account screen links to schedule preview/confirmation for that change. Text size applies to the document after reading the profile.

Production startup additionally requires a database-bound, matching migration/role runtime proof whose evidence kind is `supabase-free-runtime-proof-v1` and environment is `production`. A copied native-development proof is rejected. This sprint does not fabricate or publish that attestation. [Production runbook](release-runbook.md) explains the remaining T009 gate, including why existing native bootstrap migrations cannot simply be run against a hosted Supabase auth schema.

## Content boundary

Authenticated mode currently exposes profile, preferences, schedule preview/persistence and aggregate progress. It reuses the pure weekly allocator with an empty published catalog. It does not load DRAFT packages, templates or pronunciation notes. Lesson/grading/FSRS/pronunciation endpoints return `DRAFT_CONTENT_LOCKED` after authentication. Study pages show an explicit unpublished-content state. Existing local learning and DEMO remain available in their own modes.

This is deliberate release gating, not a completed production learning E2E or invented publication approval. F01/F02/L001/L002, the five-course catalog, 31 notes/26 illustration configurations, answer review, audio rights and acoustic calibration retain their prior status. Saved statistics are real database aggregates for the authenticated subject; no local history is transferred to make the account appear populated.
