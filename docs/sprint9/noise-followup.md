# Pilot noise follow-up

**Historical cutoff:** this page records the capture-NS follow-up at `a6d635a` and the subsequent owner text report. The later separately consented real-file analysis is in [real-audio-investigation.md](real-audio-investigation.md); it reproduces the tracking failure and supersedes the earlier absence-of-audio statements below. Noise is still not established as the sole cause.

Status: **SPRINT9_PARTIAL_HARDWARE_PENDING**. The owner reported a failed trial after `69e1d8b`: both original and selected playback remained heavily noisy, and the graph did not match. Device/browser/microphone and the analysis filter option were not confirmed. This is owner-reported failure, not a hardware PASS or proof that noise is the only cause. No voice recording was requested, obtained or inspected.

## Owner result after a6d635a

The owner subsequently reported requested NS **on**, browser-reported NS **on**, and noise **much improved but still present**. Analysis remained `INSUFFICIENT_SIGNAL / INSUFFICIENT_PERIODIC_FRAMES`: 33/166 frames retained, 330 ms of periodic-frame hops, 20% whole-recording coverage and 37% energetic coverage. The excluded-frame counts were reference 26, quiet 50, low periodicity 52, out of range 5, octave jump 0, invalid 0; these sum to the reported 133 exclusions. No audio or independent noise measurement was obtained. The device/browser/microphone and current contour match remain unconfirmed.

The current source accepts at least 300 ms of periodic-frame hops **and** at least 65% energetic coverage; the reported duration exceeds the first threshold but 37% fails the second. These are existing engineering heuristics, not Mandarin proficiency criteria, and have not been relaxed. `NOISE_REFERENCE` frames in the current engine imply that the local reference-based filter was applied too. This does not establish that filtering twice caused the rejected signal. The controlled next step is to reanalyze the same retained recording with capture NS unchanged and the local spectral filter off, comparing status/frame count/energetic coverage. If the tab already discarded audio, a newly recorded sample would not be the same controlled comparison. See [literal metrics and interpretation](owner-pilot-observations.json).

This is evidence of owner-reported improvement, not a completed hardware pilot or calibrated phonetic assessment. The automated results below are the unchanged-code results at `a6d635a`; this update changes documentation only.

## Confirmed behavior and bounded change

At the previous cutoff, every capture explicitly requested `noiseSuppression: false`, alongside AGC/AEC off. The local spectral filter is optional and its playback/analysis switches are separate. That behavior is confirmed from source; the acoustic cause of the owner's noise remains unknown. A reference-based spectral filter is not speaker separation, and cutting an excerpt cannot remove noise mixed into the same time interval.

The recorder now offers **Giảm ồn khi thu · trình duyệt xử lý**, enabled initially in the pilot. Normal practice retains its earlier initial setting; the same visible control is available there. It requests browser noise suppression for the actual stream recorded by MediaRecorder, so original playback and pitch decoding both consume that same capture. The request remains best effort; AGC/AEC remain requested off, with no silent fallback or retry in another mode.

The UI distinguishes requested NS from the track's reported NS. Unknown/off is never relabeled as applied denoising. JSON includes two scalar flags per attempt (`noiseSuppressionRequested`, `noiseSuppressionReported`); unknown is null. No device IDs or raw voice are added. Changing mode discards current audio and both curves, then requires a fresh explicit recording; it does not reopen the microphone automatically or relabel earlier attempts.

The [browser constraint documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/noiseSuppression) explains that a simple boolean is attempted if possible and unsupported constraints may be ignored. [getSettings](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings) provides the reported current track settings. These flags do not measure noise reduction or independently verify driver behavior. Browser suppression can alter speech as well as noise. No claim is made that it preserves all phonetic detail or isolates the owner's voice from another person.

No pitch engine, thresholds, Gaussian/spectral-filter implementation, dependency, lesson, server API, schema, grading, FSRS, mastery or planner is changed. The pitch system still abstains on weak/unreliable observations and remains uncalibrated.

## Verification boundary

The new deterministic regression first failed because an explicit NS-on request still reached getUserMedia as false, and passed after the option was forwarded. It verifies capture configuration, **not reproduction or removal of the owner's actual noise**. The exact hardware failure cannot be reproduced from text alone, so no DSP tuning or hardware-resolution claim is justified.

Reproduction command for that configuration seam: `npx.cmd tsx --test tests/unit/practice-recorder.test.ts` (before: 10 PASS / 1 FAIL; after: 11 PASS / 0 FAIL). This is a deliberately narrow configuration regression, not a recreation of the owner's microphone or a noise-removal benchmark.

Browser tests use generated input with a deliberately mismatching reported NS-off setting. They verify honest status, mode changes, audio/curve cleanup, per-attempt flags and no hidden microphone activation. They do not simulate an effective noise-suppression algorithm. Follow-up automated reports are in [noise-followup-evidence.json](noise-followup-evidence.json); the original full matrix remains the historical evidence at `69e1d8b`, not a fresh full regression result for the follow-up.

Fresh follow-up results: lint/typecheck/format/build PASS; all **81 unit groups PASS**; **56 targeted browser cases PASS** (pilot 6, Sprint 7 desktop/360px 5+5, Sprint 8 18, production preview/lockout 22), no retries/skips. These counts overlap the earlier full matrix and must not be added to it as distinct coverage. The current 26-table fingerprint check retained every original row and exactly matched all eight content/catalog tables. PostgreSQL schema/permissions are unchanged; the earlier 41-check integration report remains baseline evidence, not a new run here.

## Next owner check

1. Reload `http://127.0.0.1:3015/learn/pronunciation?pilot=1&target=pron-tone-2-v1`, select LOCAL DATABASE and fill the actual device/browser/microphone.
2. Leave **Giảm ồn khi thu** checked. Record a new isolated syllable, stop and listen to the original. Existing recordings cannot receive capture-time suppression retroactively.
3. Read the visible line **đã yêu cầu / trình duyệt báo**. Report Bật/Tắt/Không có thông tin and whether heavy noise/voice ducking remains. Do not send audio.
4. Only if the recording is usable, listen through and analyze. A cleaner recording or nicer graph still does not establish phonetic correctness. If the original remains noisy with NS reported on, record this as a failed follow-up; do not repeatedly adjust pitch thresholds to force a verdict.
