# Real Auth acceptance boundary

The application continues to use the Sprint10 Supabase SSR BFF: remote `getUser()` on the server, exact configured owner UUID, request-scoped SDK client, HttpOnly cookies, origin checks and transaction-local identity. No test user ID or email from a browser request becomes an authorization claim. No development identity adapter is enabled in Auth mode.

Sprint11 adds only an eligible **technical content fixture**, reusing the existing token lesson/player, PostgreSQL command repositories, server grading and FSRS 5.4.2. The original two string questions are not Mandarin teaching, an HSK course or an approved human-reviewed release. The small course/unit index makes the entire navigation/persistence journey testable without changing four real lesson packages.

The fixture requires all of:

- `PRODUCTION_AUTHENTICATED`, a development build/runtime, and the exact server-only fixture tag;
- a loopback runtime URL named `csh_auth_verify_<12 hex>` with the existing least-privilege `csh_runtime` role;
- actual local SQL role/FORCE RLS tests, proof bound to database OID, runtime OID and migration digest;
- a technical fixture marker bound to the remotely authenticated owner UUID;
- no non-technical lesson session or card for that owner in the test database.

Every request still verifies the owner with real GoTrue before reading the marker or dispatching a command. Session commands are constrained by the existing repository to the fixed token lesson. Card reveal/rating additionally accepts only the two token template versions. DRAFT content/curriculum/pronunciation APIs remain blocked even with the fixture active. Missing/mismatched proof or mixed real/DRAFT data fails closed, including snapshot reads.

Production compilation cannot activate the fixture by spoofing runtime NODE_ENV. Production startup refuses the tag. The local proof kind is explicitly not the hosted production T009 proof; no native attestation is rewritten to look like a Supabase Free production attestation. The technical flag is content eligibility for an isolated acceptance test, not a password/JWT/authentication bypass or a release option.

The fixture review uses the real FSRS reveal/rating transaction and persists logs/card versions/due dates. It omits optional active-duration observation; native planner/duration regressions cover that existing path separately. Synthetic attempts and self-rating retain zero independent mastery evidence. The full four DRAFT lesson journeys remain native-development regressions, not a completed published-content/Auth production E2E.

The code repair preserves a mounted player while its acknowledged mutation reloads the snapshot. Previously the Auth parent replaced the whole subtree with a loading view, losing cursor/feedback. Initial loading and errors still have explicit states; AuthRuntime still unmounts private data on logout/session invalidation. Reload resumes the next unanswered question using the server snapshot, rather than replaying a fabricated local result.

The final retry repair also propagates the optional technical-content flag after an initial status failure, just as the first-load path does. A browser transport fault is injected only into `/api/v1/status`, then the real endpoint is retried; GoTrue identity verification remains real throughout. Native status has no technical flag. The native local persistence suite and all Auth tests are rerun after this bounded repair; this is not an Auth-provider outage test.

The first old Auth suite run updated three mutable rows belonging to its existing disposable `owner@csh.invalid` identity in native PostgreSQL. Those exact profile/preferences/settings values were restored from the pre-Sprint11 dump after checking that no other original row differed. Immutable history and ownership were not rewritten. Subsequent release verification selects the isolated database, and its destructive fixture reset refuses native names, mismatched runtime URLs and non-technical history/content.

The hosted published-content adapter is still absent. Auth without the local fixture remains explicitly locked to unpublished content. Human approval alone will not switch it on: an approved immutable release and controlled adapter implementation/tests are still required, followed by hosted security/hosting/deploy gates in the release checklist.

The resumed acceptance run hit the real ten-login-attempts/minute guard during the final mobile case (7 passed, 1 failed). The guard remains unchanged. The browser login helper now asserts the specific 429 rejection and visible explanation, waits one complete rate window, and retries once; a second failure still fails the test. The original failure log/XML and private trace are retained. This is a diagnosed test-pacing failure, not a waived Auth failure or a provider mock.
