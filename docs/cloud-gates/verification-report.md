# Cloud gate report — updated 2026-10-23

## A. Status

**CLOUD_GATES_PARTIAL.** Real backend security and the Vercel technical benchmark passed; the disposable project was deleted. Remaining gap: current quantitative billing/quota readback is unavailable (usage CLI reports unavailable; charges API returns Costs not found; prior Chrome surface is unavailable). Missing billing data is not zero cost. No real learning release exists. Canonical statuses and ADR-006 remain unchanged.

## B. Git

Full application history stays on local `feat/v1-cloud-gates-local`. Public `feat/v1-cloud-gates` starts from verified main `0dc42253180ef38d1c43f1f87c9f0f675a851341`; its first read-back pushed implementation HEAD was `1101ff65d1e15da2439f545b313269a50ee65afb`. Later report-only commits may follow; read back final HEADs at handoff. No merge/force push or private application history push occurred.

## C. Supabase

`yartjbdapoyqcxfagsrj` / `chinese-study-hub` / Singapore `ap-southeast-1` / Free NANO / ACTIVE_HEALTHY. Exactly one new project was created; the unrelated existing project was not modified. Runtime uses the custom role and verified-TLS transaction pooler.

## D. Free eligibility/cost

Post-test Supabase dashboard still shows Free, spend cap enabled, four PAID invoices each $0.00, organization database size 27/500 MB, egress 0/5 GB and storage 0/1 GB. Organization metrics may lag: displayed MAU remained zero despite actual synthetic Auth tests. A direct query measured the new database at 12,408,499 bytes; that is not total billable storage. No-card/no-paid-add-on state remains owner attestation where the payment section did not render independent evidence.

Vercel CLI and authenticated team API now confirm the same Hobby/active team, no trial and an empty billing invoice-items object. Exactly one disposable project was created and deleted; no paid options were requested. The usage CLI and FOCUS charges API could not provide current amounts; no fresh independent no-card/usage dashboard evidence was available this run. Render remains excluded for unverified eligibility. No upgrade, card, trial credit, paid IPv4 or paid backup was used.

## E. Cloud security

[All 16 technical properties](t009-matrix.md) have evidence: 12 actual cloud SQL groups, eight real Auth lifecycle groups including natural expiry, and eight desktop/360px browser checks. Requests passed through local Next.js → remote identity verification → shared transaction helper → actual cloud RLS. Hosted HTTPS remains a separate benchmark step. Global signup stays disabled; synthetic accounts were created through the supported Admin API without email invitations. This is technical evidence, not independent Reviewer approval or canonical completion.

The first configuration disabled the email provider and caused `email_provider_disabled`; the correction kept global signup blocked while restoring password login. A real denied-signup test then passed. PowerShell credential export now explicitly uses UTF-8. Earlier failures are retained privately.

## F. Migrations/recovery/isolation

Seven checksum-tracked migrations applied atomically; managed `auth.uid()` stayed unchanged. Unchanged policies were compiled by the migration administrator to accommodate managed Auth ACLs; runtime gained no membership, ownership, BYPASSRLS or definer helper. All 19 private tables retain FORCE RLS.

Application backup/isolated local restore passed for 28 tables and one synthetic receipt with exact UTC-normalized row digests. Restore DB and receipt were removed. Managed Auth data was excluded: neither full-project disaster recovery nor automatic managed backups are claimed. Never run the local Auth-shim rollback against hosted Supabase.

Zero lesson packages were uploaded. All original native learner rows across 27 tables remain preserved; native regressions added a separate synthetic cohort. No personal history or voice was uploaded.

## G. Measurements

The temporary proof ran on Vercel Singapore `sin1`, Node `v24.21.0`, exact source `cc5fb5cec2b159046542e13c93f0f8cc8cbe48d0`. Five fresh-client/TLS attempts: p50 516.4 ms, p95 1319.4 ms. Twenty warm requests: p50 169.1 ms, p95 409 ms. All 25 returned 200 with real owner verification, authorized SQL, TLS and the expected version/region; repeated writes produced one idempotency receipt. Percentiles use nearest rank. Six HTTPS negative/security groups and four hosted browser checks passed, including Secure/HttpOnly/SameSite Strict cookies, UI login/write/logout and absent learning routes.

All samples used one worker: these are cold-like client openings, not proven platform-cold invocations. The sample is small, from one Windows network/session; there is no physical Android, long-idle, concurrency-load or long-term reliability proof. Alias `https://csh-cloud-gate-20261023.vercel.app` and immutable URL `https://csh-cloud-gate-20261023-e3l142kq6-ngbnh2667.vercel.app` both returned 404 after cleanup. [Raw measurements and cleanup](hosting-results.json).

## H. Host/ADR

Recommendation: Vercel Hobby is supported as a measured candidate for one personal learner by the observed Auth/SQL/HTTPS behavior and sub-second warm p95. This does not establish superiority over Render, prove cold-start latency or guarantee future free capacity. Render has no eligible account evidence/measurements. ADR-006 remains PROPOSED/PENDING independent review and final billing/quota readback; no canonical specification was edited.

## I. Resources

Retained: one isolated Supabase Free project, seven migration receipts, restricted roles, one synthetic technical owner, private local credentials/backup. Runtime proof stamps remain zero. The synthetic nonowner and exact SQL/browser/benchmark test records were removed; the disposable Vercel project, deployment and environment secrets were deleted. Vercel project listing returned none, and both URLs returned 404. The CLI-generated local OIDC env file was removed. No Render resource, custom domain, cron or monitor was created. Native databases/preview were retained.

## J. Checks

| Check                                              | Result                                                         |
| -------------------------------------------------- | -------------------------------------------------------------- |
| Application build / TypeScript / lint / format     | PASS                                                           |
| Native PostgreSQL / unit groups / startup refusals | 42/42 / 112/112 / 18/18 PASS                                   |
| Local synthetic proof negative HTTP                | 5/5 PASS; not cloud Auth evidence                              |
| Actual cloud SQL / Auth / browser                  | 12/12 / 8/8 / 8/8 PASS                                         |
| Cloud application backup/restore                   | PASS, 28 tables; managed Auth excluded                         |
| Flattened export build / security groups           | PASS / 8/8                                                     |
| Flattened artifact secret/resource scan            | 10 client + 117 server files, zero findings                    |
| Public history scan at first push                  | Three commits, 46 text blobs, zero findings                    |
| Hosted HTTPS / benchmark / physical Android        | 4/4 browser + 6/6 security / 25/25 measurements PASS / NOT RUN |

[Sanitized machine-readable evidence](evidence.json) distinguishes actual provider tests from local/synthetic checks. Report-only fixes do not retroactively change failed runs into passes.

## K. Privacy

Ten historical draft-key JSON blobs in 23 unpushed application commits triggered the owner-approved clean proof history. Those blobs were not pushed. A transient CLI code appeared in an earlier browser observation; that flow was canceled and tab closed. No code/token/password is repeated here. No private packets, voice, keys or credential files are in the exported proof.

## L. Before separate T053 authorization

Obtain current independent account billing/quota readback, assess the measured recommendation and absent comparison/cold-start proof, and obtain independent review of the exact security/source evidence before locking ADR-006. Separately authorize a real deployment; resolve actual owner setup, content/answer/audio review, rights/mapping gaps and recovery limitations. Private DRAFT consent does not approve publication or mastery. Repeating the test requires explicitly recreating the cleaned synthetic nonowner through the supported bootstrap, then a new disposable deployment.

## M. Boundaries

No main merge, canonical status update, real learning deployment, draft publication, personal-history transfer, paid service/card/add-on, service-role runtime, RLS weakening or T053 authorization occurred. No Engineering Loop, Reviewer subagent, model smoke test, recurring monitor or Actions workflow was started.
