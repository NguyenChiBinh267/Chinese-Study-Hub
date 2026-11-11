# Acoustic observation v3 — optional steady-background reduction

Base: `554be9cf16248d81fa18b45a44b2382db3f327f4`. Active policy: `csh-pitch-observation-v3`. Status remains **SPRINT8_PARTIAL**. No pronunciation calibration or completed hardware protocol is claimed.

## Trigger and what is known

The owner reported that v2 now shows a graph but still gives an insufficient-signal message, and requested a noise-filtering step. The subsequent copied diagnostic panel reads `NOT_ANALYZED / NO_ANALYSIS`, 0 seconds and 0 frames. That panel is not the result of the reported failed analysis. No precise v2 rejection reason, audio, browser or device was supplied, so background noise is an unconfirmed hypothesis. The agent did not obtain or inspect the owner's recording.

A graph can contain accepted frames even when the full recording is rejected. Feedback now explicitly explains a partial graph. When only a previous recording's graph remains, a visible label distinguishes it from the unanalysed current recording. The technical panel no longer says that checks detected no warnings when no analysis has run.

## Optional processing and user flow

The new checkbox defaults **off**. Its label declares that the learner left silence at the beginning. When enabled, instruct the learner to wait about half a second after pressing Record, then read one isolated syllable. The first 300 ms of decoded PCM is used as an explicitly declared background reference. This is not automatic speech detection or proof that the segment contains no speech. The same retained Blob can be analysed with the option on/off; changing it cancels pending work and clears old comparisons. No new microphone request or network upload is made.

The reference is bypassed when fewer than 500 ms remain after it, when its mean-removed RMS is at least 45% of the maximum later 1024-sample-window RMS, or when reference RMS is below 0.00001. The first conditions produce `BYPASSED_NO_REFERENCE`; the last produces `BYPASSED_LOW_NOISE`. Bypass leaves the pre-Gaussian PCM unchanged and is disclosed to the learner. These checks do not guarantee a speech-free or stationary reference. Speaking quietly in the reference before louder speech can still contaminate it.

Original local code uses `fft.js@4.0.4` (MIT, already installed transitively through pitchy, now declared directly) for a 1024-sample STFT, hop 256, square-root Hann analysis/synthesis windows, zero padding, overlap-add with weight normalization and unchanged sample length/timestamps. The mean reference power spectrum estimates stationary additive background. Per-bin amplitude gain is `sqrt(max(0.25^2, 1 - 1.5 * referencePower / currentPower))`, smoothed as `0.5 * previousGain + 0.5 * gain`. Gains never exceed one. The reconstructed analysis copy then goes through the existing Gaussian conditioning and MPM. No gain amplification, learned model, cloud service, audio asset or new installed package/version is added.

This adopts the spectral-subtraction principle described in the primary [Gerrits et al. paper, section 2](https://www.commsp.ee.ic.ac.uk/~ndg/papers/Gerrits2013.pdf), which also discusses residual tonal artifacts and the tradeoff between attenuation and distortion. No paper text, implementation or dataset is copied. The [FFT library API](https://github.com/indutny/fft.js) supplies the numerical transforms. Parameters and reference checks here are our uncalibrated engineering choices, not the paper's validated configuration.

## Gates, privacy and limitations

Raw input still determines clipping and mean-removed per-frame RMS. MPM periodicity must remain at least 0.9; minimum 300 ms periodic frames and 65% active-frame coverage, octave/gap/instability/duration constraints remain. In **APPLIED** mode only, frames whose centers fall in the declared first 300 ms are marked `NOISE_REFERENCE`, excluded from voiced counts and from the active-frame denominator. This is an explicit segmentation change for the reference, not a relaxation of periodicity or an undisclosed removal of arbitrary failed frames. Original recording playback and all sample timestamps are preserved. No interpolation, octave correction, phonetic verdict, score, mastery or server learning write is introduced.

Background speech, music, changing noise, machinery, breathiness and incorrect reference declarations can still fail or mislead the tracker. Spectral subtraction can attenuate speech harmonics or create artifacts; even accurate generated-signal recovery does not prove accurate Mandarin measurement. No estimated SNR or measured real-world noise-reduction claim is displayed. Original capture constraints (`echoCancellation` and `noiseSuppression`) stay unchanged. All PCM/reference arrays remain ephemeral in the terminated worker; original Blob playback remains in the existing recorder lifecycle. Resource, timeout and cancellation bounds remain.

## Verification

Fresh results and source/report hashes are recorded in [v3 evidence](acoustic-v3-evidence.json). The additional original deterministic fixtures have 400 ms leading background, a generated multi-harmonic rising signal, stationary seeded white noise and optional 100 Hz hum. Three predeclared seeds are tested against their clean mathematical components for noise-plus-distortion error reduction and nominal F0 recovery. Noise-only, no-reference/immediate speech, zero reference, clipped, quiet and interrupted-signal cases cover bypass/abstention; changing the option tests cancellation and stale-result isolation. These are synthetic regressions, not a speech dataset or human F0 ground truth.

**PASS:** 69 unit groups, 12 distinct targeted acoustic browser cases across desktop/360px, lint with zero warnings, strict typecheck, formatting and production build. After the final no-analysis explanation was added, the two optional-filter browser cases were rerun and passed; these are a subset, not 14 distinct cases. One initial unit assertion expected the old generic fallback text for a partial graph; it was updated to assert the new distinction, with no engine change for that mismatch. The evidence also includes stronger-hum cases that still abstain despite reduced synthetic sample error; attenuation does not guarantee an analysable signal.

Browser tests exercise the optional path through actual MediaRecorder/Opus, decoder, worker and graph on desktop/360px. They verify the same playback URL, one microphone request across on/off reanalysis, no network writes, option reset, partial/previous-graph labels and existing keyboard/layout/axe/lifecycle cases. The full original 64-browser/41-PostgreSQL historical baseline is not rerun or relabelled as v3. No database, content, FSRS, grading, planner, migration, SSOT or Engineering Loop changes are made.

Owner retest of v3 and the formal Windows/Android/qualified phonetic protocols remain pending. Local implementation and synthetic tests do not close those gates.
