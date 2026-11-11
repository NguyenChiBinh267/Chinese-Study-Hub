# Sprint 8 — local acoustic tone practice

Delivery status: **SPRINT8_PARTIAL** until actual human microphone recording/decoding is verified. The implemented local signal-processing/recording UI is usable; generated browser input is not counted as human speech or hardware validation.

The owner subsequently reported a real-use attempt with zero accepted pitch frames. [Follow-up diagnostics](microphone-diagnostics.md) records the report, distinguishes what remains unknown and documents the targeted UI fix. The aggregate results below belong to the original implementation; they are not a claim that this follow-up passed a physical microphone trial.

After a second report (54 QUIET / 108 LOW_PERIODICITY / four OUT_OF_RANGE, with clear playback), [policy v2](acoustic-policy-v2.md) adds Gaussian analysis conditioning. The owner subsequently reported a graph with an insufficient-signal message, but the diagnostic panel then supplied was NOT_ANALYZED, so its exact rejection reason remains unknown. [Policy v3](acoustic-policy-v3.md) adds optional steady-background spectral subtraction and clarifies partial/previous graphs. Fresh targeted evidence is separate; no calibrated human-speech or completed hardware-protocol PASS is claimed.

The next owner report concerns playback: loud initial background followed by lower background and voice levels. [Selected utterance playback](utterance-playback.md) adds an editable excerpt with optional stationary-noise reduction, plus best-effort requests to disable browser AGC/NS/AEC for new recordings. The original audio remains available; exact root cause and real-device improvement remain unverified. Pitch policy v3 is unchanged. Its historical evidence is not relabelled as new playback evidence.

Base `3ce6413b11c5fc822f006a7d8f7a32800cee9af7`, retained branch `feat/v1-pronunciation-coach`. Working tree started clean. New branch `feat/v1-acoustic-tone-coach`. Fetched `origin/main` at `0dc42253180ef38d1c43f1f87c9f0f675a851341`; canonical plan/status/manifest match the pinned Sprint 7 source. Read AGENTS → brief/status, relevant Master Plan contracts, Sprint 7 evidence/source, installed Next client documentation and accessibility guidance. Explicit Sprint 8 authorization extends local optional practice; it does not activate or mark canonical backlog tasks DONE. No agents/Engineering Loop/PR changes/cloud/paid service/push/merge/deploy.

## Implemented

`/learn/pronunciation` and existing F01/F02 panels now offer explicit local analysis of the current recorder Blob for isolated thanh 1–4. Existing 31 pinned notes/26 SVG configurations and all lesson/content bytes are preserved. Non-tone notes, neutral/contextual tones and 你好 remain static guidance. Learners declare one isolated syllable; the app cannot verify word identity or segment connected speech reliably.

Flow: choose target → explicit mic/record → stop/listen → Phân tích cao độ → local decode → dedicated worker MPM → actual timestamped F0/relative-pitch plot → short observation, one practice action, retry → compare last two numeric curves in the same tab. Previous raw audio is discarded on retry. The chart has separate solid/dashed labels, gaps, an accessible description and keyboard sample slider. There is no reference voice or synthetic demonstration curve represented as measured data.

Six statuses, typed frame exclusions/periodicity, duration/coverage, policy/algorithm versions, signal warnings and immutable false pronunciationVerified/masteryEligible fields distinguish a successful measurement from a validated assessment. Technical details stay collapsed. No percentage score, speech/phoneme classification, anatomy inference, ASR, automatic mastery or server learning write. [Algorithm/threshold policy and limitations](acoustic-policy.md) documents all uncalibrated heuristics.

No upload, speech API, audio analytics or audio storage. One current Blob/URL and at most two numeric curves stay in tab RAM. Stop closes tracks; target change/delete/background/navigation/unmount cancel pending processing and clear resources. Worker termination and generation checks prevent late publication. Browser codec decoding has no standard abort operation: cancellation ignores its result, and its bounded recorder input is documented; do not promise instantaneous OS codec memory erasure.

## Verification evidence

Final successful runs: **64 browser checks, 61 unit groups and 41 native PostgreSQL checks**. Final browser reports have zero failures/skips/retries; the initial timeout described below remains part of the evidence. [Machine-readable evidence](evidence.json) retains timestamps, report hashes and unchanged content/renderer hashes.

| Browser suite                                 | Passed |
| --------------------------------------------- | -----: |
| New acoustic flow, desktop / 360px            |      8 |
| Sprint 7 pronunciation, desktop / 360px       |     10 |
| Sprint 6 catalog, desktop / 360px             |      4 |
| Sprint 5 learning experience, desktop / 360px |      4 |
| Local persistence                             |      6 |
| Learning / FSRS                               |      4 |
| Content / sessions                            |      6 |
| DEMO / production lockout                     |     22 |
| **Total, final successful runs**              | **64** |

Lint, strict typecheck, formatting and production build PASS. Deterministic acoustic tests cover known synthetic F0 (65–700 Hz), level/rise/fall, noise, interrupted voicing, clipping, octave ambiguity, short/quiet/silent input, invalid/bounded data, cancellation, worker termination and stale-result isolation. Browser tests use real MediaRecorder/Opus decoding and the actual worker engine, with generated source audio; they verify local analysis, two-attempt comparison, no upload or progress mutation, error/timeout/cancel, cleanup, keyboard, axe, 360px and 200% CSS zoom. Screenshot files in `evidence/` show generated signals, not a human/native-speaker reference. Thirty production JS files were scanned without private answer-key or draft-pronunciation content markers. Existing source verification passed 406 pages / 26 locators; it is not human language/rights review.

One initial Sprint 5 desktop journey failed waiting 15 seconds for a saved acknowledgment at F02 step 5. Its trace showed a pending duration request and no completed answer response before teardown. No source change was made to grading, learning writes or planner to conceal it. A fresh-owner rerun passed both Sprint 5 desktop cases; the original trace/report remain private under `.local-postgres/sprint8/initial-sprint5-failure/`. The underlying cause has not been established; final successful-run totals do not erase this intermittent timeout or establish that it cannot recur.

Before browser/database tests, a private custom-format backup captured **2,058,818 bytes**, SHA-256 `c3740ae1d9f8356efa22a5de1eb3727a9d78b648b12d8891782245723d074df6`. Restore into a generated disposable database matched every fingerprint across 18 owner and eight global tables. After all browser runs, an actual PostgreSQL stop/start preserved all current rows in those 26 tables exactly; four completed repository views/settings/progress matched after reconnect, an isolated unfinished checkpoint resumed and duplicate advance remained idempotent. The final baseline check retained every original learner row and all eight global tables exactly. Fresh installation and restoration/upgrade of the existing Sprint 5 backup also passed in disposable databases. All six immutable lesson versions, FORCE RLS, owner isolation, grading, planner and `ts-fsrs@5.4.2` are retained; no migration was added.

Backup provenance caveat: the first private helper copy inherited the previous Sprint 6 source label in `backup-meta.json`. The actual clean checkout was verified at the Sprint 7 base SHA above. Original dump, checksum and row fingerprints are retained unchanged; the committed Sprint 8 helper has the corrected source label for future captures. This label error is not treated as a different database snapshot or evidence of a Sprint 6-only restore.

Dependency audit: **zero production advisories; five existing high development advisories** remain in the ESLint chain. Added only exact `pitchy@4.1.0` and its lockfile-resolved `fft.js@4.0.4`; MIT notices retained. No unrelated dependency upgrade or install-time service was introduced.

## Human evidence and remaining gates

Hardware/real human speech: **NOT PERFORMED**. Browser E2E uses a generated Web Audio input through actual MediaRecorder, encoded Opus, browser decode and real worker pitch extraction; it does not mock analysis output. Silence/failure/timeout/permission conditions are simulations. Synthetic signals are not evidence of Mandarin phonetic accuracy, real Android compatibility or microphone quality. A physical Windows/secure Android [manual protocol](manual-microphone-protocol.md) and [future evaluation gate](evaluation-gate.md) are prepared. No consented dataset, native reference recording, qualified annotation/agreement, calibrated threshold or human approval exists. Known risks include periodic background noise, undetected sustained octave errors and unsegmented adjacent syllables (false acceptance), plus low/creaky/breathy speech and conservative gap/clarity rules (false rejection).

All original notes/SVGs remain DRAFT_UNREVIEWED/LOCAL_DEVELOPMENT_ONLY. No rights/review gate was weakened, no production content unlocked and no independent speaking/listening mastery awarded.

## Restart local preview

```powershell
cd D:\Chinese-Study-Hub
npm.cmd run db:start
$env:CSH_APP_ORIGIN = 'http://127.0.0.1:3015'
npm.cmd run dev -- --port 3015
```

Preview: `http://127.0.0.1:3015/learn/pronunciation`; select LOCAL DATABASE, choose thanh 1–4. Stop an existing preview on 3015 first. New checkout: follow README's `npm.cmd ci` and native PostgreSQL setup; Sprint 8 adds pitchy/fft.js and no migration. No full app redesign or cloud setup.
