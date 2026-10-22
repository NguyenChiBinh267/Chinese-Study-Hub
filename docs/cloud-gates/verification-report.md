# Cloud gate report — 2026-10-22

## A. Status

**CLOUD_GATES_PARTIAL.** Real cloud backend security passed; the clean branch is pushed. Vercel CLI remains logged out at the last check. Its owner login flow is open. No host measurement or real learning release exists. Canonical statuses and ADR-006 remain unchanged.

## B. Git

Full application history stays on local `feat/v1-cloud-gates-local`. Public `feat/v1-cloud-gates` starts from verified main `0dc42253180ef38d1c43f1f87c9f0f675a851341`; its first read-back pushed implementation HEAD was `1101ff65d1e15da2439f545b313269a50ee65afb`. Later report-only commits may follow; read back final HEADs at handoff. No merge/force push or private application history push occurred.

## C. Supabase

`yartjbdapoyqcxfagsrj` / `chinese-study-hub` / Singapore `ap-southeast-1` / Free NANO / ACTIVE_HEALTHY. Exactly one new project was created; the unrelated existing project was not modified. Runtime uses the custom role and verified-TLS transaction pooler.

## D. Free eligibility/cost

Post-test Supabase dashboard still shows Free, spend cap enabled, four PAID invoices each $0.00, organization database size 27/500 MB, egress 0/5 GB and storage 0/1 GB. Organization metrics may lag: displayed MAU remained zero despite actual synthetic Auth tests. A direct query measured the new database at 12,408,499 bytes; that is not total billable storage. No-card/no-paid-add-on state remains owner attestation where the payment section did not render independent evidence.

Vercel Hobby/no payment method was observed earlier; no resource has been created. Render eligibility is unverified and it is excluded from provisioning. No upgrade, card, trial credit, paid IPv4 or paid backup was used.

## E. Cloud security

[All 16 technical properties](t009-matrix.md) have evidence: 12 actual cloud SQL groups, eight real Auth lifecycle groups including natural expiry, and eight desktop/360px browser checks. Requests passed through local Next.js → remote identity verification → shared transaction helper → actual cloud RLS. Hosted HTTPS remains a separate benchmark step. Global signup stays disabled; synthetic accounts were created through the supported Admin API without email invitations. This is technical evidence, not independent Reviewer approval or canonical completion.

The first configuration disabled the email provider and caused `email_provider_disabled`; the correction kept global signup blocked while restoring password login. A real denied-signup test then passed. PowerShell credential export now explicitly uses UTF-8. Earlier failures are retained privately.

## F. Migrations/recovery/isolation

Seven checksum-tracked migrations applied atomically; managed `auth.uid()` stayed unchanged. Unchanged policies were compiled by the migration administrator to accommodate managed Auth ACLs; runtime gained no membership, ownership, BYPASSRLS or definer helper. All 19 private tables retain FORCE RLS.

Application backup/isolated local restore passed for 28 tables and one synthetic receipt with exact UTC-normalized row digests. Restore DB and receipt were removed. Managed Auth data was excluded: neither full-project disaster recovery nor automatic managed backups are claimed. Never run the local Auth-shim rollback against hosted Supabase.

Zero lesson packages were uploaded. All original native learner rows across 27 tables remain preserved; native regressions added a separate synthetic cohort. No personal history or voice was uploaded.

## G. Measurements

No host URL, p50/p95, cold-like or warm samples exist yet. The committed runner is prepared for five fresh-client/TLS opening attempts and twenty warm requests, with real Auth/read/idempotency/TLS and six HTTPS security checks. It records worker reuse and does not equate fresh TLS with proven platform-cold invocation. No physical Android test occurred.

## H. Host/ADR

ADR-006 remains PROPOSED/PENDING. Vercel is prepared for measurement; CLI access and actual results are required. Render lacks authenticated no-billing evidence and has no measurements. No host has been selected from assumed performance.

## I. Resources

Retained: one isolated Supabase Free project, seven migration receipts, restricted roles, two synthetic Auth users for the pending owner/nonowner host tests, private local credentials/backup. Runtime proof stamps remain zero. SQL test profiles, disposable restore DBs, backup receipt and browser idempotency receipts were removed by exact task cohort/endpoint. No Vercel/Render project, domain, cron or monitor exists. Native databases/preview were retained.

## J. Checks

| Check                                              | Result                                      |
| -------------------------------------------------- | ------------------------------------------- |
| Application build / TypeScript / lint / format     | PASS                                        |
| Native PostgreSQL / unit groups / startup refusals | 42/42 / 112/112 / 18/18 PASS                |
| Local synthetic proof negative HTTP                | 5/5 PASS; not cloud Auth evidence           |
| Actual cloud SQL / Auth / browser                  | 12/12 / 8/8 / 8/8 PASS                      |
| Cloud application backup/restore                   | PASS, 28 tables; managed Auth excluded      |
| Flattened export build / security groups           | PASS / 8/8                                  |
| Flattened artifact secret/resource scan            | 10 client + 117 server files, zero findings |
| Public history scan at first push                  | Three commits, 46 text blobs, zero findings |
| Hosted HTTPS / benchmark / physical Android        | NOT RUN / NOT RUN / NOT RUN                 |

[Sanitized machine-readable evidence](evidence.json) distinguishes actual provider tests from local/synthetic checks. Report-only fixes do not retroactively change failed runs into passes.

## K. Privacy

Ten historical draft-key JSON blobs in 23 unpushed application commits triggered the owner-approved clean proof history. Those blobs were not pushed. A transient CLI code appeared in an earlier browser observation; that flow was canceled and tab closed. No code/token/password is repeated here. No private packets, voice, keys or credential files are in the exported proof.

## L. Before separate T053 authorization

Complete owner Vercel CLI login, confirm Hobby scope, deploy only the isolated proof, verify exact runtime/region/HTTPS/cookies/cache, collect bounded raw measurements, clean up and recheck quota/cost. Assess ADR-006 against those results and obtain independent review of the exact security/source evidence. Separately authorize a real deployment; resolve actual owner setup, content/answer/audio review, rights/mapping gaps and recovery limitations. Private DRAFT consent does not approve publication or mastery.

## M. Boundaries

No main merge, canonical status update, real learning deployment, draft publication, personal-history transfer, paid service/card/add-on, service-role runtime, RLS weakening or T053 authorization occurred. No Engineering Loop, Reviewer subagent, model smoke test, recurring monitor or Actions workflow was started.
