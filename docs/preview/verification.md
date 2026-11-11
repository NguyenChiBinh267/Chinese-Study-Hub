# Local preview verification — 2026-10-17

Scope: owner-authorized interactive local preview. This is developer-run verification, **not independent Reviewer PASS**, real-device UAT, learning effectiveness evidence or completion of T006/any backlog task. No Engineering Loop/model smoke/Reviewer was called.

## Checks

| Check | Result and scope |
| --- | --- |
| `npm run lint` | PASS — app, tests and app configuration; no loop-tool execution |
| `npm run typecheck` | PASS — strict TypeScript |
| `npm run build` | PASS — Next.js production build; routes for all six screens and all four fixture lessons |
| `npm run format:check` | PASS — source, tests and app configuration |
| `npm test` | PASS — 18/18 cases across desktop 1440×1000 and mobile emulation 360×800 |
| axe core routes | No violations in selected WCAG A/AA tags on seven initial page states per viewport; not a full accessibility certification |
| Planner invariants | Target = active + buffer + shortfall, daily/session caps, invalid input, 360 target / 270 capacity → 243 active + 27 buffer + 90 shortfall |
| Interaction | Onboarding, explicit limited-capacity consent, schedule edit, answer validation/wrong response, all four lesson completions, back/resume within tab, four ratings, exhausted/restarted review, real empty vs demo progress, reload reset, 404 recovery |
| Keyboard/responsive | Skip link → main, visible focus, radio/form interactions, no horizontal overflow on seven routes at target viewports; schedule at 320/720 CSS px; reduced-motion emulation |
| Network/persistence | Exercised answer/pause flow: only same-origin GET/HEAD, no write/provider requests, no cookies/localStorage/sessionStorage. Context state also checked to reset on reload |
| `npm audit --omit=dev --audit-level=high` | 0 known production dependency vulnerabilities reported by npm at execution time; not a security audit |
| Repository boundaries | Canonical plan hash unchanged, no diff in AGENTS/master-plan/implementation/engineering-loop/source register against base; PR #5/#6 branch refs retained, no push/merge/deploy |

Earlier runs found low-contrast secondary text, a progress element with an invalid ARIA label, duplicate test selectors matching Next's internal route announcer, and ambiguous day labels. Contrast, roles, labels and scoped selectors were fixed and affected checks rerun. One initial test was interrupted by restarting the local server; final results are from the complete rerun. No earlier failures were recast as PASS.

## Rendered observations

Screenshots under `evidence/` were captured by Playwright from the local production build, then representative desktop/mobile screens were visually inspected. Mobile PNGs use emulated device scale factor, so physical image pixels exceed the CSS viewport. Full-page images also include content below the initial viewport; fixed navigation appears at the capture's viewport location.

- `desktop-onboarding.png`, `mobile-onboarding.png`: zero-level default, real form and primary next action, Hanzi study mark.
- `desktop-schedule.png`, `mobile-schedule.png`: capacity shortfall, validation error, unchecked explicit consent, no silent target/cap increase; narrow day controls wrap for touch targets.
- `desktop-today.png`, `mobile-today.png`: one primary next action, projected budget with actual-time limitation, path navigation and planned/rest days.
- `desktop-lesson.png`, `mobile-lesson.png`: Hanzi/ruby pinyin, wrong answer retained, fixture explanation and next action; no server-save claim.
- `desktop-review.png`, `mobile-review.png`: revealed card and four rating actions.
- `desktop-keyboard.png`, `mobile-keyboard.png`: keyboard skip-to-main state with reduced motion enabled.

## Limits still unverified or intentionally absent

- Static/local synchronous data has no fetch/save loading cycle. App Router `loading.tsx` and runtime `error.tsx` exist, but transient loading and injected runtime fault/retry were **not proven**. A throttled navigation probe did not capture the loading fallback. Tested errors are validation and 404 recovery.
- 720px is responsive layout equivalent to half a 1440px desktop CSS viewport; actual browser zoom 200% was not manually tested. No real Android, Windows Edge, TalkBack or NVDA run; Chromium automation is the available evidence.
- No live backend, owner authentication, RLS, server grading, immutable attempts, FSRS, mastery, unlocks, actual time measurement, audio, microphone, tutor, offline sync, deployment or real progress persistence.
- No competent language/answer/audio review or publication-rights attestation. Fixtures remain internal DEMO samples; T009/T068/T069 and all content gates remain open. No task-status edits.

## Reproduce

See root README. Build first; run `npm test` against the local production server, then inspect `playwright-report/index.html` and screenshots. The test server helper starts/stops its own server only if none is already running at the configured address. No external app/service account is needed.
