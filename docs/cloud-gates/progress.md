# Cloud gate execution — PARTIAL, 2026-10-22

**2026-10-23 update:** Vercel Hobby benchmark completed (5 fresh-client + 20 warm requests, six HTTPS security groups, four hosted browser checks). The disposable host and synthetic nonowner/test records were removed. Current billing amounts remain unavailable from the provider interfaces accessible in this run; missing data is not zero. [Current report](verification-report.md) and [raw host results](hosting-results.json) supersede the historical pending-host notes below. ADR and canonical status remain unchanged.

**Latest checkpoint:** CLI access and exact-project key retrieval are now verified. Seven migrations, 12 cloud SQL groups using actual provider test-user IDs, eight real Auth lifecycle groups (including natural expiry), and eight desktop/360px browser checks passed. Client/server artifact secret scanning passed. See [updated T009 matrix](t009-matrix.md). The sections below retain the initial checkpoint and its failures; they are historical where superseded. Host benchmark and final account/cleanup evidence remain pending.

This is execution evidence, not a canonical task-status change or a T053 release. The clean proof branch has now been pushed and remotely read back. The current A–M handoff is [verification-report.md](verification-report.md); sections below retain the earlier checkpoint.

## Authorization and Git boundary

The owner authorized one isolated Supabase Free project, real cloud security verification, a safe dedicated development-branch push, and a temporary eligible free-host benchmark. Requested base `331997d` is an ancestor of the actual clean application base `58c85edc8ea112400ce6c070451ba5cc04294fdf`; its three later login UI/test commits were preserved. Verified main is `0dc42253180ef38d1c43f1f87c9f0f675a851341`.

The public repository cannot receive the complete local application history: an outgoing-history scan found ten JSON blobs containing private draft answer keys in 23 commits. The owner explicitly approved a separate clean proof branch from `origin/main`. Full application history stays local. Deleting keys only at HEAD would not solve the history disclosure. No push, merge, T053 deployment or learning-content activation has occurred at this checkpoint.

## Actual provider and account evidence

- Created by the owner: Supabase project `yartjbdapoyqcxfagsrj`, `chinese-study-hub`, organization `mcqypdwzlglhrosegrli`, Singapore (`ap-southeast-1`), Free/NANO. The pre-existing unrelated project was not modified. One new project was created, bringing the observed Free-project total to two.
- Directly observed: organization Free, spend cap enabled, four paid invoices each totaling $0, usage zero before this exercise. No-card/no-paid-add-on/no-unpaid-invoice statements came from the owner; the payment-method section did not render enough detail for independent verification.
- Vercel team `ngbnh2667`: directly observed Hobby Active, no payment methods added, add-ons off, AI Gateway auto-reload off, and displayed usage zero. The displayed usage interval was Sep 22–Oct 22; this does not prove a future reset or predict future charges.
- GitHub: public repository, Free, displayed metered usage $0, Actions 0/2,000 minutes and storage 0/0.5 GB. No workflows were added or invoked. No-card remains owner attestation.
- Render: only an unauthenticated login page was available. Eligibility/no-billing evidence is unavailable. No Render resource was created; exclude it from measurements until that evidence exists.

Official policy references: [Supabase Free/billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Render Free](https://render.com/docs/free). Account observations are separate from these general policies.

## Cloud database verified

Seven application migrations applied atomically to the new project, with source/executed checksums recorded in `public.csh_cloud_migrations`. No lesson packages or local personal history were imported. Managed `auth.uid()` definition hash stayed unchanged. SSL enforcement was enabled on this new project and read back as on.

The admin session uses the dashboard-observed session pooler on port 5432. The application uses the separate `csh_runtime` login through the transaction pooler on 6543. Both require the provider CA, certificate and hostname verification. The pinned public CA DER SHA-256 is `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`. `pg` connection options remove the URL SSL parameters only after validating `sslmode=verify-full`, preserving explicit `rejectUnauthorized: true` and the expected server name.

Hosted Supabase does not let `postgres` grant custom roles usage on the managed Auth schema. The first migration transaction failed with 42501 and rolled back. The working adaptation compiles the unchanged policy expressions as the migration administrator, then returns to the NOLOGIN schema owner. Tables remain owned by `csh_schema_owner`; runtime has no memberships, no ownership, no BYPASSRLS and no SECURITY DEFINER helper. Runtime invokes the precompiled managed `auth.uid()` references through RLS. Diagnostic queries inspect the transaction-local claim directly because runtime cannot resolve the Auth schema by name. [Provider explanation of managed Auth ACL restrictions](https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema).

**12 actual cloud SQL groups passed**: restricted runtime and 19 FORCE RLS tables; anonymous denial; A/B USING isolation; WITH CHECK rejection; failed-transaction rollback and pooled-context cleanup; idempotent receipt; append-only/proof privileges; private-key/API-role isolation; two-client concurrency; client-pool restart persistence; failed DDL rollback; unchanged managed Auth and seven migration receipts/no content. This run explicitly used synthetic SQL UUIDs, not provider Auth accounts. It does not prove the HTTP authentication boundary. Test rows were removed by exact cohort and endpoint.

**Cloud application-schema backup/restore passed**: 28 tables, one synthetic receipt, exact canonical-UTC row counts/digests after restore into a new disposable local database. The disposable database and cloud receipt were removed. Managed Auth rows were not exported; full-project disaster recovery is not proven. The initial digest comparison failed because cloud/local timestamp rendering used different timezones; UTC normalization fixed the comparison without altering stored values. Do not apply the original local Auth-shim rollback to hosted Supabase. Preserve managed Auth and prefer audited forward application migrations; the failed-DDL test verifies transaction rollback only.

## Verification and current limits

| Check                                                           | Result and scope                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Application production build                                    | PASS, isolated `.next/cloud-gate-verify`; existing preview process retained                       |
| Strict TypeScript                                               | PASS                                                                                              |
| Standard lint and new cloud/proof-source lint                   | PASS                                                                                              |
| Formatting                                                      | PASS                                                                                              |
| Unit tests                                                      | 112/112 PASS, including eight cloud policy/configuration groups                                   |
| Production startup refusal checks                               | 18/18 PASS, synthetic configuration, no cloud contact                                             |
| Native PostgreSQL regression                                    | 42/42 PASS; all original rows across 27 tables preserved; tests added a separate synthetic cohort |
| Isolated proof build                                            | PASS                                                                                              |
| Sanitized export build/security unit groups                     | PASS / 8/8                                                                                        |
| Local proof negative HTTP checks                                | 5/5 PASS; synthetic provider configuration, **not cloud Auth proof**                              |
| Actual cloud SQL                                                | 12/12 PASS, synthetic SQL identities                                                              |
| Actual cloud backup/isolated restore                            | PASS, 28 application tables; managed Auth excluded                                                |
| Cloud owner/nonowner login, expiry/refresh/logout, browser flow | PENDING official CLI access/bootstrap                                                             |
| Vercel/Render benchmark                                         | NOT RUN; no deployment URL or latency statistics                                                  |

The first application build collided with an active preview cache. A dedicated build directory now avoids modifying or stopping that preview. Earlier failures are retained in ignored local evidence; a later pass is not a claim that the earlier run passed.

The CLI reports `Access token not provided` even after the owner reported completing login. Database credentials have been verified independently. The official CLI login helper now checks project listing and exact-project key access immediately after login and writes a readiness marker only on success. No readiness marker exists at this checkpoint. No API keys or new synthetic provider users have been bootstrapped yet. Do not stamp `app_meta.runtime_proof` or label T009 complete from SQL-only results.

The technical proof source contains no learning content or private keys. Its owner identity is remotely verified before calling the same transaction/RLS helper as the application. Its actual cloud browser suite has been implemented but not run. The clean proof export is prepared, not pushed. Actual cloud Auth tests and natural expiry, verified cloud HTTP identity, a safe outgoing-history scan, then an eligible temporary host benchmark remain required. ADR-006 remains provisional; neither host is selected.

## Privacy and cleanup

No raw voice, answer-key JSON, reviewer packet, personal history, service credential or database credential is included in the export. Secrets and dump/log artifacts stay in ignored `.local-postgres/cloud-gates/`. A temporary CLI verification code appeared in an earlier browser observation; that flow was canceled and its tab closed. The supported login flow was handed back to the owner; no code or token is repeated in this report.

Retained task resources: one isolated Supabase Free project with application schemas and two restricted roles, one private local application backup, source/evidence and a pending official CLI login window. No Vercel/Render project, cron, paid add-on, card or real learning deployment was created. Temporary restore databases and SQL cohorts were removed. The existing local learner database/preview was retained.

Before a separately authorized T053: complete provider Auth/HTTP security evidence including real expiry and logout replay behavior; keep production gate closed until evidence matches project/roles/migrations/source; verify exact host/runtime/region with bounded 5 cold-like and 20 warm samples; record cleanup and quota observations; approve a host decision; separately resolve content review/rights/audio/mapping and final owner account. This checkpoint grants none of those approvals.
