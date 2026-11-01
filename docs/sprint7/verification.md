# Sprint 7 — local pronunciation teaching and self-practice

Base: `bb10cb4c7048d3079d7048dff211354908ffe111` on retained branch `feat/v1-hsk-course-catalog`. New branch: `feat/v1-pronunciation-coach`. Initial worktree was clean. `origin/main` was fetched and verified at `0dc42253180ef38d1c43f1f87c9f0f675a851341`; canonical Master Plan/status/manifest had no drift from the Sprint 6 pinned source. AGENTS, brief/status, relevant Master Plan contracts, installed Next docs, Sprint 6 verification, content schemas/F01/F02/player, schema/security and mastery/FSRS boundaries were read.

The explicit Sprint 7 request authorizes this local optional recording/teaching slice. It does not activate canonical T040/T057/T058, change release/specification/status, or grant production rights. No Engineering Loop/Reviewer agent, paid API, cloud project, push, merge or deploy was used.

## Implemented behavior

`/learn/courses/FOUNDATION` links to `/learn/pronunciation`. F01/F02 expose an inline, optional panel: 24 pinned Foundation sound notes in F01, seven tone/context notes in F02. A learner can close it and complete the original server-graded lesson. Lesson foreground-duration telemetry pauses while the panel is open; pronunciation has no saved-duration, attempt, review or mastery command. Today/planner/FSRS priorities remain unchanged.

The structured release contains 31 original Vietnamese draft notes: 16 initials, u/ü, four contrast pairs, one spelling note, four citation tones plus neutral tone, two contextual notes, and one spelling-risk note. All have stable IDs/versions, target/Pinyin/category, eight articulation fields, quick tip, 2–4 steps, conditional corrections/self-check, source/provenance, illustration references and draft/release state. Technical details/source notes are collapsed. No hypothetical Vietnamese error-frequency statistics or blanket Vietnamese phonetic equivalence is asserted.

The 26 original model configurations drive shared responsive SVG: side tract, external lips and relative tone contours. Place/manner/aspiration are explicit; stops show separate closure/release, fricatives have a different aperture, r has a more open approximant schematic, u/ü share lip rounding but use different tongue-body profiles. Shapes, labels, × and arrows carry meaning beyond color. SVG title/description and equivalent written instructions are supplied. A generic spelling caution uses text fallback rather than inventing one mouth position for many sounds. These are approximate, unreviewed teaching drawings, not medical imaging or an independently validated anatomical simulation.

Neutral tone has no fixed fifth lexical contour. Low connected third tone, isolated dip/rise and the specific 3+3 sandhi example are separate. Written nǐ hǎo and contextual ní hǎo are both labeled. Tone plots are idealized relative-pitch teaching aids, not waveform/F0 or measured learner output.

## Recording and evidence boundaries

Microphone permission is requested only by the recording button. One utterance is bounded at 12 seconds / 2 MB. Explicit stop closes physical tracks immediately, with a bounded codec-finalization timeout. Audio remains in tab RAM and a Blob URL; playback/delete/re-record work locally. Changing target, closing/unmounting the panel, route exit, hidden tab and window blur stop capture; pending late permissions are cleaned up. Playback URLs are revoked and playback pauses on element removal. Secure-context, denied/absent/busy mic, unsupported codec/API and playback errors have useful fallback text; notes/figures remain usable.

No recording is uploaded, saved to PostgreSQL/files/localStorage/IndexedDB, logged, transcribed, sent to an LLM or retained across reload. No reference recording is available or labeled approved, and TTS is not used. Comparison is currently self-listening against written/visual teaching guidance, not automatic model-audio alignment.

`AcousticAnalysisAdapter` defines distinct NOT_ANALYZED, INSUFFICIENT_AUDIO, UNSUPPORTED_TARGET, ACOUSTIC_OBSERVATION and REVIEW_REQUIRED states. Its default adapter is disabled. No ASR, F0 tracker, waveform/pitch estimator, acoustic classification, pronunciation score or authoritative speech/listening mastery was implemented. Unvalidated observations map to review-required wording; audio never becomes a claim about tongue/lip position. Self-selected corrections explicitly say the learner selected a teaching tip and the app did not diagnose the recording.

## Data, rights and security

No migrations or new persisted learner tables were necessary. All six original lesson packages, 18 owner tables/FORCE RLS, eight global content/catalog tables, grading, immutable attempts, FSRS 5.4.2, planner and historical bindings are retained. The new read-only API `/api/local/pronunciation` uses existing development, loopback, Host, cookie HMAC and owner/forgery gates; an explicitly foreign Origin is also rejected. Unsupported POST cannot upload audio. Production returns 403; production pages do not fetch/serve the draft note release. Errors expose no SQL, stack, file path or credentials.

The file repository validates strict schema, reference/figure/category/version consistency and release SHA-256, with no automatic highest-version selection. New notes are separate sidecar resources; original F01/F02 manifest bytes and mappings are not rewritten. All new content has HUMAN REVIEW = null and publication LOCAL_DEVELOPMENT_ONLY. [Review readiness and primary references](review-readiness.md) describe unresolved specialist work. Private reviewer packet/SVG frames are ignored and not served by the app.

Before tests, a private custom-format backup captured the Sprint 6 database: **1,617,225 bytes**, SHA-256 `b6ac6b15b8ee7392adda4bda22844d74047916b9178f84217de9fd59b184ba5a`. Baseline fingerprints cover all 18 owner and eight content/catalog tables. The verification helper only restores to a generated disposable database, never resets the real database, and refuses to overwrite its baseline.

Backup restore to a disposable database passed. After all browser writes, an actual PostgreSQL stop/start preserved every current row in all 26 tables exactly. Four completed repository views/settings/progress matched after reconnect; an isolated unfinished checkpoint resumed and duplicate advance remained idempotent. A final baseline comparison confirmed every original learner row retained and all eight global content/catalog tables identical. Fresh installation and restoration/upgrade of the Sprint 5 backup to the unchanged Sprint 6 schema also passed in disposable databases: five courses, four units/lessons, six immutable versions, 18 FORCE-RLS owner tables and eight SELECT-only global tables.

## Verification

Final successful runs: **49 unit groups, 41 native PostgreSQL checks and 56 browser checks**, with zero failed/skipped/flaky browser cases. [Machine-readable evidence](evidence.json) records report hashes, timestamps and release/renderer pins.

| Check                                        | Passed |
| -------------------------------------------- | -----: |
| New pronunciation: desktop Chromium          |      5 |
| New pronunciation: mobile Chromium 360px     |      5 |
| Sprint 6 catalog: desktop/mobile             |      4 |
| Sprint 5 learning experience: desktop/mobile |      4 |
| Local persistence                            |      6 |
| Local learning                               |      4 |
| Content packages                             |      6 |
| DEMO and production lockout                  |     22 |
| **Browser total**                            | **56** |

Lint, TypeScript strict check, formatting and the production build passed. The existing source verifier checked 406 PDF pages / 26 locators. A scan of 26 production JavaScript files found no private answer-key or draft-pronunciation content markers. New browser cases cover all 31 targets, SVG states, conditional correction copy, recording/playback/cleanup, no audio uploads, no pronunciation progress writes, F01/F02 completion, foreground-duration pause while the panel is open, error/retry/unknown target, XSS escaping, owner isolation, foreign-Origin rejection and microphone capability fallbacks.

Microphone E2E uses Chromium's synthetic device/permission flags and real MediaRecorder/Blob playback. Denied, missing, unsupported, insecure and lifecycle failures are deterministic simulations; unit tests additionally inject late permission promises, memory cap and codec failures. No test uses or records the owner's actual microphone. These checks do not prove physical Android, laptop microphone quality, browser-specific permission UI, native-speaker quality, human comprehension or phonetic correctness. Keyboard/focus, axe, 360px and 200% CSS zoom are browser checks, not physical-device or screen-reader UAT.

Initial repairs: SVG titles were converted to single text values after React warned about child arrays; low-contrast recorder hint text was darkened. A foreign-Origin GET initially inherited the existing read-route behavior; the new pronunciation route now rejects an explicitly foreign Origin. Capability probes now use fresh pages so injected failures cannot accumulate between cases. Final totals above refer to successful reruns, not the initial failing run.

Content inspection also corrected inherited example metadata before this first committed release: jū/qū/xū use tone 1 and yú tone 2; contextual examples describe the actual syllables rather than the sample vowel a; the spelling-risk note no longer assigns one q mouth position to several different targets. Earlier working reviewer packets were retained separately. The final private packet matches the committed note-release and SVG-renderer hashes; all human reviewer identity/decision/findings fields remain empty.

Dependency audit: **zero production advisories; five existing high-severity development advisories** in the ESLint dependency chain. Sprint 7 adds no dependency and changes no lockfile. These development advisories remain unresolved.

## Run locally and next step

```powershell
cd D:\Chinese-Study-Hub
npm.cmd run db:start
$env:CSH_APP_ORIGIN = 'http://127.0.0.1:3015'
npm.cmd run dev -- --port 3015
```

Run this after stopping an existing preview on 3015. Select LOCAL DATABASE, open Foundation or F01/F02. New checkout/install instructions and the full regression commands remain in [README](../../README.md). No new dependency or migration is required for Sprint 7.

The next small step toward actual acoustic assistance is qualified review/correction of these notes/SVGs and rights-cleared reference audio, then a narrowly scoped local measurement prototype with consented/labeled recordings, failure/UNKNOWN handling and a validated evaluation policy. Do not call transcription, pitch traces or self-rating pronunciation mastery. No full ASR/GPU service, production identity or cloud gate is activated here.
