# Owner release runbook — implementation only, no deployment authorization

## Reproduce local Auth integration

Historical Sprint10 handoff (2026-10-20): **SPRINT10_PARTIAL** because Docker failed to rename `sailor-ingest.sock`, leaving final-source Auth integration unavailable. Sprint11 subsequently preserved/recreated the socket-only runtime directories and recovered the engine without deleting volumes, resetting settings or shutting down WSL. See [recovery evidence](../sprint11/docker-recovery.md) and [current verification](../sprint11/verification.md). Earlier Sprint10 tests remain historical evidence.

Node >=22, native project PostgreSQL and a running locally eligible Docker installation are needed. Commands below create only uniquely named Sprint10 test containers bound to loopback. They preserve other containers and the native learner database; they do not create a Supabase cloud project.

```powershell
cd D:\Chinese-Study-Hub
npm.cmd ci
npm.cmd run db:start
npm.cmd run db:migrate
npm.cmd run test:db
npm.cmd run auth:local:start
npm.cmd run test:auth:provider
npm.cmd run test:sprint10:browser
npm.cmd run auth:local:preview
```

Stop any existing Next development server for this checkout before preview/tests; the shared `.next/dev` lock permits one. Preview listens on `http://127.0.0.1:3015/login`. The generated **local test account only** is in ignored `.local-postgres/sprint10/auth-local/owner-login.txt`; do not reuse it for the future owner or put credentials in Git. The provider lifecycle test resets only that disposable account's password, updating this file. It does not reset any human account or send email. `credentials.json`, token traces, database dumps and user voice files stay private.

The prefix gateway forwards to real GoTrue; it does not issue JWTs or fabricate users. The app holds only the anon/public Auth key and runtime learner DB credential. Fixture administration uses a separate private service-role token exclusively in the local setup/test scripts, never ordinary learner requests. HS256 local Auth evidence is not proof of a managed Supabase project, asymmetric signing-key rotation or actual free account status.

Ctrl+C stops the preview and its prefix gateway. `npm.cmd run auth:local:stop` stops only the two labeled Sprint10-managed provider containers, retaining their data. Do not stop Docker itself or unrelated projects. The temporary short-expiry provider used by lifecycle checks is stopped by that test.

For the original development learning app, stop the Auth preview first, then:

```powershell
$env:CSH_APP_MODE = 'LOCAL_DATABASE_DEV'
$env:CSH_APP_ORIGIN = 'http://127.0.0.1:3015'
npm.cmd run dev -- --port 3015
```

That mode retains the existing development owner/history and DRAFT lessons. It does not use the Auth fixture owner. DEMO remains a separate preview. Never set LOCAL_DATABASE_DEV for a production build.

The delivered development command uses the installed Next CLI's `--no-server-fast-refresh` option. The native provider tree and fetch behavior remain separate from Auth session cancellation; the complete desktop/360px learning journeys passed with this configuration. Keep one Next dev instance per checkout.

## Production configuration and preflight

Server-only variables: `CSH_APP_MODE=PRODUCTION_AUTHENTICATED`, HTTPS `CSH_APP_ORIGIN`, HTTPS `CSH_AUTH_URL`, `CSH_AUTH_PUBLISHABLE_KEY`, exact UUID `OWNER_USER_ID`, and runtime `DATABASE_URL`. Do not mark server credentials or owner allowlist as NEXT_PUBLIC. The SDK public/anon key is not a service-role/secret key. This app requires no browser Supabase configuration.

Production rejects development owner/session variables and `CSH_LOCAL_DATABASE=1`, server secrets marked public, unexpected service-role/paid-provider credentials, HTTP or loopback Auth origins and admin database login. Runtime DB must use `csh_runtime` (pooler may use `csh_runtime.<project-ref>`) with verified TLS `sslmode=verify-full`. Certificate validation must remain enabled. Do not add a certificate-verification bypass to get a connection working.

`npm.cmd run security:preflight -- --config-only` checks syntax/policy against supplied server environment, prints codes only and makes no live verification claim. Without `--config-only`, preflight checks database role/FORCE RLS/migration-bound production proof and provider signup-disabled settings. The production instrumentation hook runs those live gates before the server is ready. Missing proof/provider availability is a startup failure; no local identity fallback exists. Do not copy a native-development proof or insert a fake attestation to pass it.

Ordinary production build compilation needs no cloud provision or credentials. For intentional DEMO artifact testing, set `CSH_APP_MODE=DEMO` in that test process; it remains unsuitable for an owner release and release preflight rejects it. There is no production test-password or test-JWT switch.

## Future provision checklist — gated, not executed

1. Complete authenticated account/no-billing evidence in the [free register](free-service-register.md); obtain explicit permission before any cloud resource exists. T069 host choice and T053 deployment remain separate.
2. With authorized admin/dashboard access, create one owner identity once and record its UUID. Disable public signup, anonymous/phone/social sign-ins and any public invitation path. Keep administration outside the learner app; never put the admin key in its environment. Verify allowed URL/origin settings, password policy, provider rate limits, active sessions and no paid SMTP/SMS dependency. Do not infer settings from an environment checklist alone.
3. Existing migrations bootstrap **native local PostgreSQL**, including a minimal `auth` schema/function. Managed Supabase already owns its auth schema. Do **not** blindly execute the native bootstrap on cloud, drop/replace managed auth objects, or alter already-applied migration checksums. Prepare and review a separate idempotent production baseline/bootstrap plan preserving equivalent private schema, owners, grants, existing managed `auth.uid()` compatibility and migration provenance. This sprint does not execute that plan or attest hosted role/pooler feasibility.
4. Run actual T009 tests on the chosen free topology: least-privilege custom role, no owner/BYPASSRLS/membership, all private FORCE RLS policies, real verified A/B subjects, missing/forged claims, USING/WITH CHECK, failure→B/reused connection cleanup, idempotency concurrency, no answer-key Data API exposure, TLS and pool limits. Only reviewed evidence may establish the matching production runtime proof. Cloud T009 remains UNVERIFIED here.
5. Exercise owner login/restore/refresh/logout and revoked tokens on actual HTTPS host and actual Auth account. No Cloud project, deployment or native-to-cloud data transfer is authorized by this runbook.
6. Content/answer/audio review and rights must approve each immutable release before production learning endpoints can be enabled. Current authenticated UI deliberately cannot complete learning/grading/FSRS on DRAFT content; the existing local E2E is not substituted for that production acceptance.

## Existing data association — no transfer in this sprint

Keep the pre-auth dump and row fingerprints in ignored `.local-postgres/sprint10/`. Verified Auth UID and the historical development UID may differ; logging in must not claim the old history. No ownership UPDATE or automatic backfill is present.

A future import requires explicit owner approval, verified target Auth UID, a fresh complete backup, content/version manifest, and a reviewed plan across all owner-scoped tables/composite foreign keys. First restore into a disposable database and produce a dry-run count/conflict report. Preserve immutable attempt/event timestamps, source IDs, FSRS algorithm/config and eligibility classifications; never turn practice into independent mastery. Use one transaction, conflict rejection and an import receipt keyed by source snapshot + source UID + target UID, so replay is idempotent. Existing target data must not be overwritten. Review/verify target row counts, RLS isolation and restored backup before any real run. **There is no executable transfer command in this sprint.**

## Reset and recovery

For a future real owner password reset, use the authorized Supabase Auth admin/dashboard procedure, set a new strong password out of band, revoke relevant sessions and test that the old password/session fails. Do not add public signup or paid email/SMS as recovery. Record the admin action without passwords/tokens and preserve learning ownership. Changing an allowlist UUID is an identity change requiring review, not a password reset or implicit data migration.

Local pre-auth backup restoration was tested in an isolated disposable database. That verifies recoverability of this local snapshot, not a cloud backup service, an RPO promise or permission to overwrite the live native database.
