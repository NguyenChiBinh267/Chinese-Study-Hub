# T053 private owner deployment — live evidence

Date: 2026-10-23. Status: **T053_PARTIAL** until the second interactive owner login and history comparison finish. This document records technical evidence, not expert content approval or a canonical task-status transition.

Actual application: https://chinese-study-hub-owner.vercel.app

- Deployed commit: `054978d9cf795f2436692f8e1e9da3c4466723d6`.
- Public sanitized branch: `feat/t053-private-owner` in `NguyenChiBinh267/Chinese-Study-Hub`.
- Clean base/main: `0dc42253180ef38d1c43f1f87c9f0f675a851341`; main was not merged or changed.
- Vercel: `ngbnh2667/chinese-study-hub-owner`, Hobby, Node 24.x, basic build machine selected by plan default; configured function region `sin1`.
- Current deployment: `dpl_8wb7TQv269reencA2yUiGQwtvGMe`. Provider deployment metadata and the live `X-CSH-Source` header agree with the commit above.
- Supabase: `yartjbdapoyqcxfagsrj`, `chinese-study-hub`, Singapore, Free/NANO. No additional Supabase project was created; the unrelated paused project was not changed.
- The configured human owner was enrolled interactively and verified by the actual provider. The synthetic benchmark account is a non-owner and is denied by the application.

## Results

| Verification | Result |
| --- | --- |
| Hosted HTTPS/Auth/security groups | 9/9 PASS |
| Hosted application/browser/layout groups | 15/15 PASS |
| First human owner login and reload | PASS; server-verified identity and Secure/HttpOnly/Strict cookies |
| Logout and replay of copied cookie | PASS; both anonymous and copied-session requests denied |
| Second interactive owner login and history comparison | PENDING OWNER INTERACTION |
| Actual cloud SQL isolation groups | 12/12 PASS |
| Unit tests | 114/114 PASS |
| Actual production artifact refusing unsafe startup configurations | 18/18 PASS |
| Lint, strict typecheck, formatting, production build | PASS |
| Application backup and bounded restoration | PASS before and after deployment: 28 tables, matching row counts and digests |
| Actual code rollback and restoration of current deployment | PASS; anonymous denied in both versions; attempts/reviews/progress/preferences/settings digests unchanged |
| Public Git outgoing history | 2 clean commits, 180 text blobs scanned, zero findings; original local history was not pushed |
| Exported source and built artifacts | 231 source files, 32 client artifacts, 822 server artifacts checked against actual private credential/bundle bytes: zero findings |
| Actual hosted JavaScript and owner responses | 16 downloaded JavaScript files; no credential or private answer objects found; no browser page errors |
| Secondary deployment URL | Protected; no private content exposed |
| Runtime dependency audit | Zero runtime advisories; five high advisories remain in development dependencies |

The hosted tests exercised actual pages and server calls, not the previous synthetic benchmark. They covered the catalog, immutable selected versions, all four lesson players, answer submission and server feedback, PostgreSQL attempts/completions, FSRS reveal/Good rating, saved progress, weekly schedule/Today, reload, strict input validation, hash mismatch, forged approval, idempotency, anonymous/non-owner denial, forged cached user/header identity, cross-origin requests, development API lockout and private response projections. Desktop was 1440×900; mobile layouts were 360×800 across Today, catalog, schedule, progress, review and pronunciation. No physical Android test is claimed.

RLS has two distinct evidence paths: direct actual cloud SQL checks exercised A/B USING/WITH CHECK and pool-context isolation; hosted requests exercised the server-verified owner boundary and rejected forged ownership/unauthorized writes. The deployment still uses the non-owner, non-superuser, NOBYPASSRLS, no-membership runtime, verified TLS, seven immutable migrations and 19 FORCE RLS tables. Public signup and the Data API remain disabled. No service-role/admin credential is deployed to Vercel or sent in learner requests.

## Playable scope and test data

Foundation F01/F02 and HSK1 L001/L002 are playable only as optional private DRAFT practice. Exact selected package versions: `f01-private-v2`, `f02-private-v2`, `l001-private-v4`, `l002-private-v4`. The selected hashes are unchanged from the prior private audit. HSK2–4 show no released lessons or start action.

The test account is the real configured owner. **The 26 saved answers, four completions and one FSRS review are automated verification records, not evidence of the owner's Chinese ability.** They were created online with the owner's explicit consent to test using the authenticated session. No existing local personal learning history was uploaded. A new L001 practice session was opened to inspect TTS during a teaching block; it can be resumed. Existing owner records were not reset or deleted.

All four packages retain DRAFT, DRAFT_UNREVIEWED, BLOCKED publication, null human review and no publication receipt. These practice results and self-ratings do not establish verified mastery or prerequisite unlock. The two unresolved grammar mappings remain UNVERIFIED. No professionally approved HSK course, assessment or reference audio is claimed.

Pronunciation notes and original schematic illustrations loaded for the owner with their unreviewed labels. TTS labels/capability fallback passed on the real hosted UI. The test browser exposed the speech API but had **zero local zh-CN voices**: the playback control was correctly disabled. Audible TTS playback remains unverified; it depends on a suitable installed local voice. No paid TTS, calibrated phonetic assessment or physical microphone accuracy is claimed.

## Cost and data boundaries

Current authenticated Supabase dashboard: Free/NANO; spend cap enabled; database approximately 28/500 MB, 3/50,000 monthly active users, storage 0/1 GB. Four past monthly invoices visible in the dashboard were $0.00. These historical invoices do not measure this deployment's current cost.

Current Vercel account API: Hobby/active, created directly on Hobby, no trial. Both builds used the basic plan-default machine. No card, upgrade, paid add-on, paid API, additional database project, recurring traffic or custom-domain purchase was enabled. Vercel's current usage/cost query returned **UNAVAILABLE**, which is explicitly not measured zero usage. Free-tier quotas remain limits; exceeding them may interrupt service. No unmeasured platform cold-start or Render comparison is claimed; the owner accepted the existing bounded benchmark for this provisional private release.

Pre-deployment recovery point is preserved privately at `.local-postgres/t053/predeployment-application.dump`. The post-deployment application backup and restoration evidence are under `.local-postgres/cloud-gates/` and copied reports under `.local-postgres/t053/`. Both recoveries used disposable local databases and removed only those temporary databases. No production database restore/reset occurred. Supabase-managed Auth records were excluded; managed Auth disaster recovery and automatic backups are not proven.

## Rollback and operation

The test actually rolled back to the previous owner-protected deployment, checked its source and anonymous denial, then promoted the current deployment again. Alias propagation was allowed to settle before checking the final source. Learner result and schedule digests stayed unchanged. The current alias is back on `054978d9cf795f2436692f8e1e9da3c4466723d6`.

For a critical issue, remove/disable only the new Vercel application, preserving Supabase and all owner records. With the authenticated official CLI: `vercel project delete chinese-study-hub-owner --scope ngbnh2667 --yes`. Do not reset or restore the production database as a code rollback.

To promote the tested deployment again: `vercel promote https://chinese-study-hub-owner-ithzummod-ngbnh2667.vercel.app --scope ngbnh2667 --yes`. Keep production-only sensitive environment values bound to the human owner and exact private bundle. Git auto-deployment is disconnected/disabled, and no private production environment values are assigned to preview branches. See [deployment policy](private-deployment.md) for local/build commands and protected configuration.

All raw test state, recordings (none collected here), credentials, cookies, dumps and answer fixtures stay outside the public export. Canonical `task-status.json`, main and PR #5/#6 were not modified. This preview does not constitute a canonical T053 DONE claim or reviewed M0 release.
