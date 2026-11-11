# Owner preview: spacing and focus stability

2026-10-23. Scope: the existing private owner UI. No schema, content, scoring,
RLS, authentication provider, task status or publication policy changes.

## Cause and change

The old AuthRuntime added `csh-auth-pending` on every focus/pageshow/visible
event. That class hid `.app-shell` until `/api/v1/me` completed. This explains
the visible flash without demonstrating a full browser reload. A temporary
verification error also unmounted the form; its retry reloaded the document.

Ordinary focus now verifies in the background and coalesces concurrent checks.
Temporary verification failures hide and disable the retained interface;
retry checks the session without discarding the unsaved form. Expired sessions
and logout still unmount private UI. Persisted page transitions retain the
privacy shield until a fresh verification; generation checks reject stale
responses from before suspension. Server identity checks are unchanged.

Owner pages use 12px paragraph gaps, 20px semantic group spacing and 32px
section gaps (24px on narrow screens), with bounded reading measure and
unitless line height. The private-practice notice separates its heading and
copy. Profile inputs have visible borders. Existing color/type direction and
all DRAFT/approval warnings remain.

## Verification

- Root lint, explicit test-script lint, typecheck, format check and build PASS.
- Auth unit tests: 7/7; private-preview policy tests: 2/2.
- Isolated browser regression: 6/6 groups. Old deployed runtime reproduces a
  hidden shell after focus; updated focus/pageshow samples have zero hidden
  frames, retain the same input node and value, and preserve scroll position.
- Temporary 503 → retry retains unsaved profile text; persisted page restore
  waits behind its shield; 401 and cross-tab logout remove the private shell.
- Desktop 1440px and mobile 360px: Today, courses, progress, schedule, account
  and F01 entry inspected in one batch plus one confirmation. No horizontal
  overflow; measured paragraph gap 12px, section gap 32px/24px. Schedule input
  survives focus; keyboard Tab reaches an interactive control. Axe checks on
  progress at both sizes report no serious/critical findings.
- Impeccable detector on the four changed UI source files: no findings.

The browser regression renders real client components with a small Next
router adapter and intercepted UI responses. It does **not** prove provider
authentication, server grading or actual operating-system window switching.
It reads local curriculum for a synthetic UUID without writing learner data;
fixture counters are not real learning history. No recordings are used.
Docker-based local Auth could not start because the Docker daemon was absent;
this is not reported as a passing provider test.

Run from the full local development workspace after `npm run db:start` and
existing private-preview setup:

```powershell
node --import tsx scripts/test-owner-ui.mjs
```

The script obtains its old public-source baseline from commit
`054978d9cf795f2436692f8e1e9da3c4466723d6`. Local screenshots and machine-readable
results stay under ignored `.local-postgres/ui-refinement/`. No private package,
answer key, credential or local development history is exported for deployment.
