# Sprint 10 — owner Auth verification

**SPRINT10_PARTIAL. PRODUCTION_READY = false.**

The implementation and real local Supabase Auth checks exist. Final-source Auth integration cannot currently be rerun because Docker fails to start its engine with a locked/stale `sailor-ingest.sock` rename error. Earlier real-provider results are preserved and explicitly distinguished from final-source verification. No mock-only authentication is substituted.

Branch `feat/v1-owner-auth-readiness`; base `6115ce4` preserves the microphone fixes after brief base `69e1d8b`. Pinned main `0dc42253180ef38d1c43f1f87c9f0f675a851341` was rechecked on 2026-10-20. Delivery reports the local commit separately. No push, merge, deploy, cloud provisioning, billing activation, canonical status edit or ownership transfer occurred.

## Implemented and checked

Supabase SSR BFF, verified remote getUser, exact owner UUID allowlist, restoration/refresh, logout/revocation and cross-tab invalidation, HttpOnly/Strict/Secure cookie policy, safe redirects, origin/CSRF checks, protected pages/APIs, dev/production lockout, owner profile/timezone, real saved schedule and owner progress aggregates. The browser never calls SQL or instantiates a Supabase client.

The real integration fixture used GoTrue v2.197.0 and its separate PostgreSQL database, disposable actual users/passwords, real expiry/refresh/revocation and signup disabled. The loopback prefix gateway does not mint user JWTs or fabricate identity. The provider lifecycle suite changed only the disposable fixture password, without sending email/SMS or changing any human account. The deliberately held logout HTTP request tests cancellation, not simulated authentication.

## Recorded results

| Check | Result / scope |
| --- | --- |
| Unit | 87 PASS |
| Native PostgreSQL | 42 PASS; A/B isolation, profile USING/WITH CHECK, transaction/reused connection cleanup, idempotency/concurrency |
| Direct real GoTrue lifecycle | 8 PASS in earlier provider run; final rerun unavailable |
| Auth browser | 8 PASS in earlier desktop/360px integration; final-source rerun UNVERIFIED |
| Production artifact startup refusal | 10 PASS; missing owner, insecure origin/TLS, admin role, leaked-public values, dev flags and runtime NODE_ENV spoofing |
| Browser artifact scan | 35 artifacts PASS for bounded private-value/server-key/answer-key checks; not a formal information-flow proof |
| Lint, security lint, typecheck, format, build | PASS in recorded logs |
| Dependency audit | 0 production findings; 5 high development-tree findings retained |
| Preservation/recovery | All original rows across 26 tables retained; 8 content tables identical; pre-auth backup restored in disposable DB |

Browser results below are derived from available XML, with failures/errors/skips shown. Reports span the implementation session and have individual timestamps in the [manifest](evidence.json). They are accumulated coverage, not an independent exact-SHA review or a claim of fresh Auth verification. Missing/interrupted reports do not count as PASS.

| Suite | Result | Passed/expected | Failures/errors/skips |
| --- | --- | --- | --- |
| production | PASS | 22/22 | 0/0/0 |
| local | PASS | 6/6 | 0/0/0 |
| learning | PASS | 4/4 | 0/0/0 |
| content | PASS | 6/6 | 0/0/0 |
| sprint5-desktop | PASS | 2/2 | 0/0/0 |
| sprint5-mobile | PASS | 2/2 | 0/0/0 |
| sprint6-desktop | PASS | 2/2 | 0/0/0 |
| sprint6-mobile | PASS | 2/2 | 0/0/0 |
| sprint7-desktop | PASS | 5/5 | 0/0/0 |
| sprint7-mobile | PASS | 5/5 | 0/0/0 |
| sprint8 | PASS | 18/18 | 0/0/0 |
| sprint9 | PASS | 8/8 | 0/0/0 |
| auth | EARLIER REAL-PROVIDER PASS | 8/8 | 0/0/0 |

Accumulated native browser cases passed: **82/82**. The earlier 8 Auth cases are separate. Duplicate diagnostic reruns are excluded. Source and report hashes are recorded before the local commit.

The Sprint6 mobile accessibility rerun waits for the destination URL, HSK1 heading and streamed page title before the unchanged Axe audit. Both cases passed. The earlier title-readiness failure remains in private evidence; no accessibility rules were disabled.

## Development repair and remaining blocker

Earlier cold development runs repeatedly reloaded the root while initializing LOCAL DATABASE. A warmed diagnostic completed the full study journey, but it did not establish reliable cold startup. Unsuccessful layout/source-scan/Webpack variants and interrupted runs were retained as diagnostics.

The delivered native/DEMO path preserves the original providers and native fetch responses. Only authenticated mode uses the Auth runtime and protected-request cancellation. Next 16.4.2's installed CLI supports `--no-server-fast-refresh`; the local dev command and Auth preview use it. The full Sprint5 desktop and 360px journeys passed with this configuration, including all four drafts, actual grading/FSRS, saved progress, reload, wrong answers, lost acknowledgements and schedule recovery. This verifies the delivered configuration; it does not assert a proven upstream root cause or relax interaction assertions.

Docker startup currently fails when renaming `sailor-ingest.sock` to its stale name. No factory reset, WSL shutdown, unrelated-container cleanup or deletion of Docker data was performed. Final Auth revalidation and its live preview remain unavailable until the local engine can start. Earlier real GoTrue results are not re-labelled as current.

## Preserved gates

The only schema addition is the RLS owner profile table: 19 private and 8 content tables. Runtime remains non-owner, non-superuser, non-BYPASSRLS and without privileged role membership. Trusted server identity is passed through transaction-local claims; possession of the runtime SQL credential remains a server trust assumption, not cryptographic JWT validation inside a GUC. Historical ownership was not changed. A future import requires reviewed/idempotent association, backup and explicit approval; there is no transfer command in this sprint.

Authenticated mode permits profile, schedule and aggregate progress. DRAFT lessons, course content, grading, review cards and pronunciation remain locked. The five-course catalog, F01/F02/L001/L002, 31 notes/illustrations, recorder/acoustic pipeline, FSRS 5.4.2 and mastery restrictions are preserved in development. Local practice is not publication approval or a completed production learning E2E. Sprint9 real-microphone accuracy remains PARTIAL.

Managed owner/free-account/no-billing evidence, hosted role/pooler/RLS, actual HTTPS/cookies, signing-key rotation and physical Android are UNVERIFIED. Native proof is rejected as production T009 attestation. T009/T068/T069/T053 and human content/answer/audio/rights reviews remain gated. No production deployment is authorized by this work.

See [architecture](architecture.md), [official free-service register](free-service-register.md) (observed 2026-10-19, account evidence missing) and [release/data runbook](release-runbook.md).

## Local operation

Final preview check (2026-10-20): `/today` returned HTTP 200 in `LOCAL_DATABASE_DEV`, and the Today heading rendered at a 360px viewport. This is the native learning preview, not an authenticated preview.

The preserved development app runs with native PostgreSQL and `npm.cmd run dev -- --port 3015`; use LOCAL_DATABASE_DEV and the configured loopback origin as shown in README. It is separate from authenticated production.

After Docker is healthy, stop that Next dev instance, run `npm.cmd run auth:local:start`, then `npm.cmd run auth:local:preview`, and open [local Auth login](http://127.0.0.1:3015/login). The ignored `.local-postgres/sprint10/auth-local/owner-login.txt` holds a disposable local identity, never production credentials. Those Auth commands currently depend on resolving the Docker startup error.
