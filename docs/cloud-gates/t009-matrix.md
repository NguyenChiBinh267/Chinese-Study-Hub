# T009 technical verification — PASS on isolated cloud backend

**2026-10-23 hosted extension:** Six HTTPS security groups and four hosted desktop/360px browser checks passed on the exact proof commit. Secure/HttpOnly/SameSite Strict cookies, owner SQL, idempotency, private caching and logout replay denial were verified on Vercel. The disposable deployment was then removed. [Measurements and cleanup](hosting-results.json) supersede pending-host statements below; no learning release or independent review is implied.

Observed 2026-10-22 on project `yartjbdapoyqcxfagsrj`. The final SQL suite used actual synthetic owner/nonowner identities created through the supported provider Admin API. Browser requests ran through the local Next.js technical proof server to real Supabase Auth/PostgreSQL. Hosting HTTPS verification remains a separate benchmark step. No canonical task status, independent review or release approval is implied.

| Requirement                        | Current evidence                                                                                                                         | Result               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1. Runtime not superuser           | Actual `pg_roles` + application `assertRuntime`                                                                                          | PASS                 |
| 2. Runtime not table owner         | All 19 private tables + role separation                                                                                                  | PASS                 |
| 3. Runtime no BYPASSRLS            | Actual role flags, no memberships                                                                                                        | PASS                 |
| 4. FORCE RLS                       | All 19 private tables                                                                                                                    | PASS                 |
| 5. Owner A eligible data only      | Real owner login → remote getUser → shared transaction helper → authorized SQL read/write                                                | PASS                 |
| 6. B cannot read/write A           | Distinct provider identity; HTTP 403; actual RLS USING/WITH CHECK rejection                                                              | PASS                 |
| 7. Anonymous fails closed          | Cloud empty claim returns no private rows; server HTTP 401                                                                               | PASS                 |
| 8. Forged identity fails           | Provider rejects modified JWT signature; SQL spoof denied                                                                                | PASS                 |
| 9. Headers/body cannot set owner   | Forged identity headers 403; extra owner/approval JSON fields 400 and no inserted receipt                                                | PASS                 |
| 10. Pool context does not leak     | Actual failed A transaction, B reuse, anonymous context, two-client concurrency                                                          | PASS at DB layer     |
| 11. USING and WITH CHECK           | Actual A/B selection and 42501 rejection                                                                                                 | PASS                 |
| 12. Sensitive tables/key isolation | API-role schema/table privileges denied; real learning routes 404; no packages uploaded                                                  | PASS                 |
| 13. No admin credential exposure   | Runtime rejects admin/service/PAT variables; 10 client + 122 server artifact files scanned against actual ignored secrets, zero findings | PASS for built proof |
| 14. Revocation and expiration      | Natural five-minute expiry rejected; actual refresh; refresh denial after logout; copied browser session replay 401                      | PASS                 |
| 15. Validated TLS                  | Admin + transaction-pooler sockets encrypted and authorized; pinned provider CA, hostname verification, SSL enforcement on               | PASS                 |
| 16. Private cache isolation        | Authenticated/anonymous server responses private, no-store, Vary Cookie; browser reload and denied replay                                | PASS                 |

Counts: cloud SQL 12/12, provider Auth lifecycle 8/8, desktop/mobile browser 8/8 (360px mobile). Neither local PostgreSQL nor mocked GoTrue supplies this cloud evidence. No real Android hardware test or complete project disaster recovery is claimed. No runtime proof has been stamped yet; hosting HTTPS behavior and final cleanup are recorded separately.

Global public signup remains disabled; the email/password provider is enabled for Admin-created synthetic accounts. The first configuration disabled the email provider and produced `email_provider_disabled`; correction retained the global signup restriction. No email invitations were sent. Windows PowerShell 5 credential export now explicitly uses UTF-8. These failed attempts are retained privately, separately from the successful results.
