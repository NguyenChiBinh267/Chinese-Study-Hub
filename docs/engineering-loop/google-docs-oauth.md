> Historical adapter/setup guide. Git-native SOURCE/SSOT no longer uses this path; OAuth/Picker/Cloud are not activation prerequisites. The migrated controller rejects Google SOURCE/status configuration. Preserve this guide as prior evidence, not current setup instructions.

# Google Docs SSOT — one-time owner access

Actual setup on 2026-10-14: the configured private store `%LOCALAPPDATA%\ChineseStudyHub\oauth` lacks client.json, tokens.json and zero-cost.json. Local SOURCE/SSOT is BLOCKED. The connected Google Drive tool can read v1.1; that does not authorize local OAuth. No local consent, direct Google API call, cloud resource or live SSOT write was performed in this upgrade.

Only `https://www.googleapis.com/auth/drive.file` is requested, Google's recommended per-file scope. The existing Master Plan must be selected/granted through this same app/project, for example its existing Google Picker integration. Consent alone is insufficient. This tooling does not create a Picker app or widen scopes automatically. If no existing client/per-file grant exists, remain BLOCKED; any resource setup needs separate owner authorization. Never paste secrets into chat, Git, prompts or logs.

## Owner steps when prerequisites exist

1. Use an existing owner-controlled Desktop OAuth client in an existing project with billing disabled and Docs API already available. This request does not authorize project/client creation or service enablement. Verify actual billing, current terms/quota, consent/test-user eligibility and sustained token access; a project ID/free-price webpage alone is insufficient evidence.
2. Place its downloaded installed-client JSON at `%LOCALAPPDATA%\ChineseStudyHub\oauth\client.json`. Run `node tools/engineering-loop/oauth.mjs protect` to protect the private local folder with the current Windows user ACL. No cloud resource is created.
3. Supply zero-cost.json in that private folder after verifying every assertion. Use actual timestamp and evidence; do not copy unverified true values:

```json
{
  "ownerConfirmed": true,
  "existingProject": true,
  "billingDisabled": true,
  "standardUseNoAdditionalCost": true,
  "noQuotaPurchase": true,
  "checkedAt": "ACTUAL UTC ISO TIMESTAMP",
  "evidence": "Actual project billing/terms/quota verification without secrets"
}
```

4. Explicitly run `node tools/engineering-loop/oauth.mjs authorize`. Approve consent yourself. PKCE, CSRF state and random 127.0.0.1 loopback port are used. Refresh token stays in the private store; access token stays in memory; token responses are never logged. Missing $0 proof blocks before consent/API requests.
5. Grant exactly the Master Plan through the same app's existing per-file selection. `loop.mjs ssot-status` checks file presence only; UNVERIFIED is not a successful gate. Run `node tools/engineering-loop/loop.mjs ssot-check T001` for read-only live revision/spec/dependency verification while keeping backlog disabled; it executes no task and cannot write. A subsequently authorized live task must prove scoped write and guarded readback. Do not enable backlog merely to test credentials or mark a real task done as a permissions test.

OAuth does not replace SSOT. No service accounts, broad Drive/Documents scopes, connector-cookie extraction or cache fallback. Missing permission/403/429 blocks without automatic retry/paid fallback. No billing-linked account is required by this implementation; the actual existing project still needs verification.

## Cost and limits

Google's [current Docs API pricing](https://developers.google.com/workspace/docs/api/limits) says standard use has no additional cost, but plans billing for quota overages later in 2026. Therefore a webpage alone cannot certify $0 throughout the lifecycle. The adapter requires fresh owner no-billing evidence (expires after 24 hours), caps itself at 24 reads/4 writes per UTC day, and blocks at cap/expiry. No quota increase, credits/trial or billing fallback. Proof expiry remains an operator dependency until safe automatic project/terms verification is separately implemented and proven.

Writes default disabled. Live SSOT_WAIT + matching authorized Task ID + ssotAllowStatusWrites + verified merge + exact-SHA PASS is required. batchUpdate changes one task status with requiredRevisionId and full paragraph-text readback. Mock tests cover conflicts, wrong tasks and unrelated changes; they are not live OAuth/write proof.

Sources: [Docs scopes](https://developers.google.com/workspace/docs/api/auth), [installed-app OAuth](https://developers.google.com/identity/protocols/oauth2/native-app), [batchUpdate](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/batchUpdate).
