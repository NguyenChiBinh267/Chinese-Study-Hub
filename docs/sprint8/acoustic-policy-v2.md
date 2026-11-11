# Acoustic observation policy v2 — Gaussian conditioning

Active policy: `csh-pitch-observation-v2`. Base before this change: `2be62a3b33df8531761189069e630751caa9b414`. This is an experimental signal-processing revision, not calibrated Mandarin pronunciation scoring or a human hardware PASS.

## Trigger and evidence

The owner reported intelligible playback but zero accepted pitch frames in a 1.74-second recording: 54 QUIET, 108 LOW_PERIODICITY and four OUT_OF_RANGE, with no octave-jump/invalid frames. This establishes an owner-reported tracking failure despite audible playback; it does not establish the exact signal spectrum, device, browser, input processing or root cause. No owner audio was collected or inspected.

The original deterministic tests favored clean/simple synthetic periodic signals. New original stress fixtures combine 20 harmonics, formant-like emphasis around 650/1300 Hz, a rising nominal fundamental, seeded cycle jitter and seeded noise. Unconditioned MPM rejects several of these for octave ambiguity or inadequate periodic frames; Gaussian conditioning recovers their nominal F0 trajectory with unchanged acceptance thresholds. These are mathematical test signals, not human speech, an approved Mandarin recording, measured real-speech accuracy or calibration data.

## Method and primary reference

Praat's primary [filtered-autocorrelation documentation](https://www.fon.hum.uva.nl/praat/manual/pitch_analysis_by_filtered_autocorrelation.html) describes low-pass Gaussian filtering before autocorrelation for intonation work. We adopt this **conditioning principle** while retaining the installed MIT `pitchy@4.1.0` McLeod detector. This is not an implementation of Praat's complete tracker, candidate/path optimizer or validated settings. No Praat source code, text, audio or dataset is copied.

The analysis filter's target frequency response is `A(f) = 0.03^((f / 1000)^2)`. Its time-domain Gaussian has `sigma_seconds = sqrt(-ln(0.03) / (2*pi^2*1000^2))`. Original code samples this kernel at the audio sample rate, truncates at ±4 sigma and normalizes its weights. At 24 kHz this uses an 83-tap centered FIR with zero padding at recording edges. Symmetric centering avoids shifting graph timestamps. Numerical attenuation is tested at 100/500/1000 Hz against the formula; finite truncation is an approximation.

The filter only creates an analysis copy. Original playback stays unchanged. Raw, mean-removed frame RMS still gates QUIET and original samples still gate clipping; filtering cannot conceal clipped input or turn raw silence/quiet frames into accepted frames. MPM clarity is now measured on conditioned frames and must still reach **0.9**. Minimum RMS **0.008**, duration/coverage, frame/hop size, Hz bounds, octave/gap/instability safeguards, memory/input/CPU limits, cancellation and no-mastery restrictions stay unchanged from [v1](acoustic-policy.md).

No automatic gain amplification, pitch interpolation, octave correction, curve alignment, learned phonetic score or confidence calibration was added. An explicitly named unconditioned comparison path exists only in the pure engine for reproducible tests; the app worker always uses the conditioned path. Comparison output labels itself `v2:unconditioned-comparison` and is not mislabeled as the original v1 artifact.

The technical panel identifies the active policy/filter and shows min/median/max available MPM periodicity. This is an algorithm measurement after filtering, not pronunciation confidence or a score. Reduced high-frequency energy can improve tracking of the fundamental but can also suppress high-pitched/breathy voices or reinforce periodic low-frequency background sound. White-noise, clipping, quiet, irregular and interrupted-signal cases remain in regression tests, but they cannot exclude every real-world false positive/negative. Hardware/consented human speech and qualified phonetic evaluation remain required.

## Checks and delivery limits

**PASS:** 65 unit groups, ten targeted acoustic browser cases on desktop/360px, lint, strict typecheck, formatting and production build. The browser suite includes a new multi-harmonic generated source going through actual MediaRecorder/Opus decode/worker and resulting in a measured graph. Pure tests verify the Gaussian attenuation formula, unchanged input/playback samples, cancellation, several noise seeds, original clipping/quiet gates and continued abstention for severe synthetic irregularity. The existing interrupted-voicing, octave, size/CPU, feedback and lifecycle tests also pass.

[Machine-readable v2 evidence](acoustic-v2-evidence.json) records report/source hashes and three deterministic A/B comparisons: unconditioned MPM abstains while conditioned MPM recovers the generated rising nominal trajectories. Mean absolute error against those **synthetic nominal** trajectories stays below 25 cents in these cases; this threshold is a regression bound, not a real-speech accuracy claim or a pronunciation release gate.

The original 64-browser / 41-PostgreSQL Sprint 8 evidence and the first rejection-diagnostics evidence remain historical baselines. They are not relabeled as v2 tests. This revision changes only local analysis/diagnostic presentation and relevant tests/docs; no learning content, schema, grading, FSRS, planner, auth, server scoring, production lockout or dependency is changed. Existing resource cleanup, recording caps and privacy behavior remain in the targeted browser suite.

Status: **SPRINT8_PARTIAL pending owner retest**. Successful synthetic extraction does not establish that v2 fixes the owner's actual microphone recording.
