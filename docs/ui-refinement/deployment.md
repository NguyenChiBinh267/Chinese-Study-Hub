# UI refinement: deployed result

2026-10-23. Existing private owner preview:
https://chinese-study-hub-owner.vercel.app

- Deployed source: `6001c64d387c4e0efb4932219375c45c44dc8562`.
- Clean export branch: `fix/owner-ui-spacing-focus`, based on the previously
  deployed `054978d9cf795f2436692f8e1e9da3c4466723d6`.
- Deployment: `dpl_GGQYojixWR3Yy5c1uEScQnzBh2HD`, provider READY.
- Provider Git SHA and actual HTTPS `X-CSH-Source` match the deployed source.
- Full local implementation commit: `bf11231`, on
  `fix/ui-spacing-focus-local`. This local history was not uploaded.
- Both branches are committed locally. No Git push or main merge was performed.

Root and sanitized export both pass lint, build and typecheck. The local
regression described in `verification.md` passes all six groups. The confirmed
focus sample changed from 12 hidden frames out of 26 samples in the old runtime
to zero out of 40 samples in the new runtime. These are bounded automated event
samples, not a browser performance benchmark or physical window-switch test.

Nine live security groups PASS on the new source: HTTPS/version/no-cache,
anonymous page redirects, anonymous content/write denial, provider signup
disabled, real synthetic non-owner login denial, forged cached identity denial,
identity-header and cross-origin denial, development endpoint denial and
private source/package URL protection. These do not substitute for a fresh
authenticated human-owner browser test. No claim is made that all original
T053 acceptance gates have newly passed.

A fresh application-schema backup was saved locally before deployment. All
28 application table row counts and digests remain unchanged after deployment
and live checks. No migration, learner write, data reset, managed Auth export,
content release or local history import occurred. No raw voice was accessed.

Outgoing safe history: 3 commits / 186 text blobs, zero findings. Actual-secret
and artifact scan: 232 tracked source files, 32 client artifacts and 822 server
artifacts, zero findings. No private content package or credential was copied.

Vercel readback before and after confirms the existing active Hobby scope,
no trial and no Git-linked auto-deployment. The same Supabase project is reused;
its current-day Free evidence is retained locally. No paid setting changed.
Cost usage remains unmeasured; missing billing data is not measured zero.

Prior deployment remains available for code rollback. No database rollback was
performed or needed for this UI-only update. Local machine reports and backup
remain ignored under `.local-postgres/ui-refinement/`; no sensitive artifact is
included in this document.
