# Follow-up: no accepted pitch frames

Later observation: the owner confirmed clear playback and reported 54 QUIET, 108 LOW_PERIODICITY and four OUT_OF_RANGE frames. [Policy v2](acoustic-policy-v2.md) documents the subsequent signal-conditioning revision; the presentation-only change below remains the earlier checkpoint.

Base: `9f32d8aa9ccde073031e8a63ac420f2dd96dfcd4`, branch `feat/v1-acoustic-tone-coach`. The owner reported `INSUFFICIENT_SIGNAL / INSUFFICIENT_PERIODIC_FRAMES`, 0.96 seconds decoded, 88 excluded frames, zero accepted frames and zero voiced coverage. Browser/device and intelligible playback have not been confirmed. This is an owner-reported attempted recording, not a hardware PASS or a validated speech sample. No audio was requested, uploaded or inspected.

The report indicates the decode/worker pipeline returned frame results. It does **not** establish silence, a broken microphone, incorrect pronunciation or an unsuitable pitch threshold. Previous UI hid the per-frame exclusion categories and gave the same retry advice for very different rejection paths.

## Change

The technical panel now counts the existing frame exclusions: QUIET, LOW_PERIODICITY, OUT_OF_RANGE, OCTAVE_JUMP and INVALID, with Vietnamese labels and accepted/total frames. These are detector criteria, not pronunciation-error categories. No new audio metrics or storage were added. When all frames are QUIET, advice asks the learner to check actual playback, selected microphone and input level. When non-quiet frames fail pitch tracking, advice explicitly avoids asking the learner to force a louder/different voice and asks for diagnostic counts instead. Clipping, short recordings, octave ambiguity and gaps have relevant, conditional retry advice.

Pitch extraction, `csh-pitch-observation-v1`, all numeric thresholds, recording/worker limits, abstention and mastery restrictions are unchanged. A synthetic 0.96-second silent input produces 88 QUIET frames in the regression test; this matches the reported shape only and **does not prove** that the owner's actual recording was silent.

## Validation

**PASS:** 62 unit groups, eight targeted acoustic browser cases (desktop and 360px), lint, strict typecheck, formatting and production build. XML reports have zero failures/skips. The added browser assertion exercises actual silent-recording decode/analysis and verifies that the UI shows QUIET counts and zero accepted frames. [Follow-up machine-readable evidence](microphone-diagnostics-evidence.json) records report/source hashes.

The original Sprint 8 aggregate evidence remains the baseline; the follow-up reruns targeted checks rather than claiming that all 64 historical browser cases were rerun. PostgreSQL, grading, planner, FSRS, notes, illustrations and dependencies were not changed. No push/merge/deploy.

## Next diagnostic observation

Open the local pronunciation preview, select a tone 1–4 and the one-syllable declaration, record one syllable, listen, then analyze. Send only the QUIET and LOW_PERIODICITY counts (and any other nonzero exclusion), plus whether playback contains clear voice. No audio is needed. If all frames are quiet but playback is clearly audible, investigate the capture/downmix path and input scale before changing gates. If sound has enough amplitude but periodicity tracking fails, investigate the detector on consented real speech; synthetic success alone does not justify lowering the threshold or declaring pronunciation correct.

Status remains **SPRINT8_PARTIAL**; successful F0 extraction on the owner's voice has not been demonstrated.
