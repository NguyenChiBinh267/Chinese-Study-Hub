# T009 evidence matrix — PARTIAL

Observed 2026-10-22 on project `yartjbdapoyqcxfagsrj`. SQL checks used synthetic UUIDs through the real custom runtime role and shared application transaction helper. They did not authenticate those UUIDs with cloud Auth. No runtime proof has been stamped.

| Requirement | Current evidence | Result |
| --- | --- | --- |
| 1. Runtime not superuser | Actual `pg_roles` + application `assertRuntime` | PASS |
| 2. Runtime not table owner | All 19 private tables + role separation | PASS |
| 3. Runtime no BYPASSRLS | Actual role flags, no memberships | PASS |
| 4. FORCE RLS | All 19 private tables | PASS |
| 5. Owner A eligible data only | Actual SQL owner A row visibility; remote owner login not yet tested | DB PASS / HTTP PENDING |
| 6. B cannot read/write A | Actual RLS USING + cross-owner WITH CHECK failure | DB PASS / HTTP PENDING |
| 7. Anonymous fails closed | Real cloud empty claim returns no private rows; local negative HTTP 401 | DB PASS / cloud HTTP PENDING |
| 8. Forged identity fails | SQL forged-owner insert denied; real provider signature tests not run | PARTIAL |
| 9. Headers/body cannot set owner | Implemented server rejection + local forged-header 403; authenticated cloud body case not run | PARTIAL |
| 10. Pool context does not leak | Actual failed A transaction, B reuse, anonymous context, two-client concurrency | PASS at DB layer |
| 11. USING and WITH CHECK | Actual A/B selection and 42501 rejection | PASS |
| 12. Sensitive tables/key isolation | Actual anon/authenticated schema and exercise-table privileges denied; no content uploaded | PASS for database privileges; cloud route test pending |
| 13. No admin credential exposure | Runtime configuration rejects admin/service/PAT variables; source-only export contains no credential files; outgoing clean history scan has zero findings | Source/config PASS; deployed artifact/runtime pending |
| 14. Revocation and expiration | Real cloud Auth suite implemented; no completed provider session yet | PENDING |
| 15. Validated TLS | Admin + transaction-pooler sockets encrypted and authorized; pinned provider CA, hostname verification, SSL enforcement on | PASS |
| 16. Private cache isolation | Local HTTP `no-store` checks pass; cloud authenticated HTTP not run | PARTIAL |

The combined T009 gate remains open. SQL groups are not a replacement for the actual application server → cloud Auth → verified identity → transaction/RLS path. Independent review/merge and canonical status updates are outside this execution checkpoint.
