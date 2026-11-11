# Sprint 9 — microphone pilot and pronunciation UX

Current status: **SPRINT9_PARTIAL — real-audio tracking limitation reproduced**. On 2026-10-19 the owner separately consented to local voice-file analysis and supplied an original/processed pair. The original 2.76-second recording remains insufficient with the current detector, with local filtering both off and on. See the [latest investigation and bounded UI change](real-audio-investigation.md) and [separate verification evidence](real-audio-investigation.json). No hardware/phonetic PASS or SPRINT9_COMPLETE is claimed. Earlier pending statements below describe their original cutoff.

**After the original cutoff:** the owner reported heavy noise in both playback versions and a mismatching graph. The filter option and device/browser/microphone were unconfirmed. Outcome is owner-reported FAIL, platform unconfirmed; the earlier NOT_TESTED rows below do not mean this report was ignored. A new capture-noise option and its limited verification are described in [noise-followup.md](noise-followup.md), with [separate current evidence](noise-followup-evidence.json). Hardware resolution remains pending.

**Latest owner report after `a6d635a`:** capture NS requested/reported on; noise much improved but remains. Analysis still abstains with 33/166 frames, 330 ms periodic hops and 37% energetic coverage. The local reference-based filter also appears applied from its frame exclusions; its effect on this sample is not established. [Owner observations](owner-pilot-observations.json) preserve the reported values separately from source-derived interpretations. No hardware/phonetic PASS is inferred.

Requested base `9f32d8aa9ccde073031e8a63ac420f2dd96dfcd4`; actual starting base `71e59cb5e93d11de9fe9d355a5a2e0aaa9dce51f`, a descendant that includes the owner's intervening fixes. New branch `feat/v1-pronunciation-pilot`, clean tree at start. Fetched/pinned origin/main `0dc42253180ef38d1c43f1f87c9f0f675a851341`; canonical plan/status/manifest Git blobs match it. No canonical DONE/status edit, Engineering Loop, Reviewer/subagent, PR change, push, merge, deploy or paid/cloud service.

Implemented: optional short pilot for four isolated tones, device/source metadata, permission/capture status, live input meter, original listen-before-analysis gate, max three attempts/target, editable per-attempt observations, metadata-only JSON download, guarded neutral two-attempt prose and links to the existing correction/visual guidance. The earlier selected filtered playback remains available; no new engine or validated pronunciation score is claimed.

[Manual owner protocol](manual-pilot.md) · [Reliability audit and limits](reliability-audit.md) · [Machine-readable evidence](evidence.json).

## Evidence categories

| Category                                                            | Result                                                                                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Synthetic audio correctness regressions                             | Recorded separately in unit/browser reports                                                                                       |
| Real MediaRecorder/Opus/decode/worker pipeline with generated input | Automated app checks, never labeled hardware proof                                                                                |
| Owner-provided real recording                                       | Locally inspected after separate consent; tracking limitation reproduced, platform/browser/microphone not independently confirmed |
| Windows physical microphone                                         | Full platform-specific protocol still incomplete; owner reports and file analysis are not a hardware PASS                         |
| Android physical microphone                                         | NOT_TESTED; ADB binary found, zero devices at first check, no reverse run                                                         |
| Phonetic assessment accuracy                                        | UNVERIFIED; no consented annotated dataset or expert calibration                                                                  |

Earlier owner reports (clear playback with no F0, then a partial graph, then initial noise/volume change) remain historical observations, not a new Sprint 9 protocol PASS. Exact browser/microphone/root cause was not established from those reports. No owner audio had been collected or inspected at the original cutoff; the separately consented investigation linked above supersedes that limitation without uploading voice.

Fresh full app regression totals, source/report hashes, preservation checks and any failed/repaired runs are recorded in evidence.json. The preview suite's persistence-demo configuration exercises the same production preview files as the default configuration and adds the production lockout cases; these are counted once, not twice merely for a different port. Test owners are isolated by the existing configurations. No owner history is deleted to make tests pass.

## Original automated results at 69e1d8b

| Check                                                                                                 | Result                                                                             |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| All unit groups, including recording/worker/conditioning/weak signal/clipping/octave and pilot guards | 80/80 PASS                                                                         |
| Real PostgreSQL integration, RLS and transaction checks                                               | 41/41 PASS                                                                         |
| Production preview and lockout                                                                        | 22/22 PASS                                                                         |
| Local persistence / learning / content                                                                | 6 + 4 + 6 PASS                                                                     |
| Sprint 5 full journey, desktop + 360px                                                                | 2 + 2 PASS                                                                         |
| Sprint 6 HSK catalog, desktop + 360px                                                                 | 2 + 2 PASS                                                                         |
| Sprint 7 pronunciation notes/recorder, desktop + 360px                                                | 5 + 5 PASS                                                                         |
| Sprint 8 acoustic/selected playback, desktop + 360px                                                  | 18/18 PASS                                                                         |
| Sprint 9 pilot, desktop + 360px                                                                       | 4/4 PASS                                                                           |
| Distinct browser cases total                                                                          | 78/78 PASS, no retries/skips in the final matrix                                   |
| Final source lint / typecheck / format / production build                                             | PASS                                                                               |
| Final-build production revalidation                                                                   | 22/22 PASS on explicit rerun; first run 21 PASS / 1 browser-close failure retained |
| Original rows across 26 tables / eight content tables                                                 | Preserved / identical                                                              |

Browser checks include keyboard/focus, axe checks and zoom 200%; the source is generated audio through the real recorder/Opus/decode/worker pipeline, not a physical microphone or Android device. The new test's first development run failed on a wrapped-select label lookup. It was repaired to use the actual accessible combobox role; that failure is retained in a separate development log and does not count as hardware evidence.

After the final build, the first 22-case production revalidation had Chromium close during the mobile onboarding screenshot (21 PASS / 1 failed); the root cause is unknown. The same full suite passed 22/22 on one explicit rerun with no intervening app source change. Both reports and the failure context are retained privately and hashed in evidence.json. Production lockout cases passed in both runs. The successful revalidation does not add another 22 distinct cases to the 78-case total.

Concrete hardening: a throwing level-meter cleanup no longer prevents stopping physical tracks; long-nucleus and unstable-tracking feedback now describe their actual measurement limits instead of falling through to unrelated or generic guidance. No evidence establishes that the owner's historical noise/volume-ducking issue is resolved on hardware.

The pre-change 26-table snapshot is kept privately and verified after testing: every original owner row must remain, and all eight immutable content/catalog tables must match exactly. The pinned pronunciation release remains 31 notes/26 illustrations. Six existing lesson versions and the curriculum remain untouched. Local audio/pilot observations do not write grading, FSRS, mastery, planner or learning progress.

## Local entry

Run the existing `npm.cmd run dev -- --port 3015` with `CSH_APP_ORIGIN=http://127.0.0.1:3015`, then open `http://127.0.0.1:3015/learn/pronunciation?pilot=1&target=pron-tone-1-v1` and select LOCAL DATABASE. Full run instructions stay in the root README. Pilot forms reset on reload; export metadata before leaving if desired. Do not send raw audio for this pilot.

At the original `69e1d8b` evidence cutoff, the preview pilot route returned HTTP 200 and no new hardware result had yet been received. The subsequent failure report and follow-up supersede that pending observation as described above.

After this experimental pronunciation sprint, content review/audio rights, owner authentication and verified free provider/hosting eligibility remain separate v1 release gates; this work does not activate or complete them.
