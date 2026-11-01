# Local acoustic observation policy v1

Historical baseline. The current implementation uses [policy v2 with Gaussian analysis conditioning](acoustic-policy-v2.md). Numeric acceptance thresholds are retained; these v1 descriptions record the original unconditioned pipeline.

This is an engineering experiment, not a validated Mandarin pronunciation model. Policy identifier: `csh-pitch-observation-v1`. Source: `src/modules/pronunciation/domain/acoustic-types.ts`; changing thresholds requires a new policy version and repeatable evidence. No numeric pronunciation score, good/bad verdict, verified speaking/listening mastery or content publication is produced.

## Algorithm and dependency decision

Use **pitchy 4.1.0**, an ESM implementation of the **McLeod Pitch Method (MPM)**: normalized square difference/autocorrelation, FFT through **fft.js 4.0.4**, key maxima and parabolic peak interpolation. The detector returns frequency and periodicity/clarity, not speech-recognition or phonetic correctness probabilities. YIN-family and direct autocorrelation were considered; MPM was selected for its small reusable detector buffers, typed browser-compatible ESM API and explicit clarity output. We did not write a new phonetic scoring model or add a speech service.

Reviewed the actual installed source/types and tagged [pitchy v4.1.0 source](https://github.com/ianprime0509/pitchy/blob/v4.1.0/index.js) and [license](https://github.com/ianprime0509/pitchy/blob/v4.1.0/LICENSE), then checked known frequencies, movements and failures deterministically. Both installed dependencies are MIT; retained license text is in [third-party notices](third-party-notices.txt). Current upstream main has different license prose (0BSD, with an unrelated project name); the installed/tagged **4.1.0** artifact and lockfile are the licensing evidence for this implementation. Neither package needs a paid account, network runtime or native/GPU install. Synthetic tests establish limited signal-processing behavior, not general implementation correctness on human speech.

Browser decoding uses [OfflineAudioContext/decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData), which needs a complete encoded file and resamples to the context rate. CPU pitch work uses a [dedicated worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) with transferable PCM, terminated on completion, cancellation or timeout. There is no remote model/CDN import. The original paper is linked from the tagged library source; direct retrieval of the paper was unavailable in this session, so no claim to have independently reviewed its full methodology is made.

## Supported experiment and thresholds

Only the exact pinned note IDs `pron-tone-1-v1` through `pron-tone-4-v1`, with an explicit learner declaration of one isolated syllable, are supported. This is self-declaration, not validated segmentation/recognition. Initials/finals, minimal pairs, neutral tone, contextual third tone and 你好 retain Sprint 7 guidance; no pitch rule is applied to them. Dictionary nǐ hǎo versus contextual ní hǎo remains unchanged. Two adjacent syllables without a detectable pause can still pass these scope heuristics: a known limitation, never a word-identity claim.

| Parameter                   | Version 1 heuristic                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Recorder                    | Existing 12 seconds / 2 MiB maximum                                                                                                          |
| Decode                      | 24,000 Hz, at most two decoded channels; averaged to mono                                                                                    |
| PCM limits                  | 12.5 seconds (codec padding tolerance), 1,200,000 samples maximum                                                                            |
| Frame / hop                 | 2,048 samples (~85 ms at 24 kHz) / 10 ms                                                                                                     |
| DC / quiet handling         | Subtract each frame's mean; RMS below 0.008 excluded                                                                                         |
| Frequency bounds            | 50–1,000 Hz, broad technical tracker support, not male/female correctness ranges                                                             |
| MPM                         | Internal clarity threshold 0.9; accept returned clarity ≥0.9                                                                                 |
| Clipping                    | Absolute amplitude ≥0.98 in >1% of samples → abstain                                                                                         |
| Minimum signal              | ≥300 ms accepted frame hops; ≥65% accepted among energy-qualified frames                                                                     |
| Long nucleus                | >2,500 ms accepted hops or first–last accepted span >2,800 ms → unsupported scope                                                            |
| Internal gap                | >140 ms between accepted frames → ambiguous segmentation / abstain                                                                           |
| Octave ambiguity            | Adjacent accepted candidates within 200 ms differing ≥9 semitones → exclude transition frames and abstain; do not automatically halve/double |
| Instability                 | Mean absolute adjacent accepted step >1.2 semitones → abstain                                                                                |
| Movement                    | Median final 20% minus median initial 20%; >2 semitones rise, <−2 fall; otherwise 10th–90th spread ≤2 level, else variable                   |
| CPU/decode wall-clock limit | 8 seconds; worker terminates, result cannot publish late                                                                                     |

Finite values, sample-rate bounds (8–96 kHz for the pure engine) and frame/input limits are enforced. Unsupported/invalid decode produces no F0. Silence and excluded frames have null F0/relative pitch; no interpolation across missing data. Narrow brief gaps remain gaps even when the whole recording has enough signal. Octave checks cannot detect a sustained wrong octave with no observable transition.

Within-speaker normalization is `12 × log2(F0 / median accepted F0)`. The graph uses actual recording timestamps/window centers, with each attempt independently centered on its own median. No curve warping, arbitrary time alignment, percentage similarity or improvement metric exists. The chart's sample slider exposes exact timestamps/Hz or an unknown state. Sprint 7's illustrative diagrams stay separate; there is no invented native reference audio.

`voiced` means a periodic candidate accepted by these engineering filters, not independently verified human voicing. Coverage is reported both over all frames and over energy-qualified frames. Voiced duration sums accepted hop durations, not a certified vowel boundary. MPM clarity is not calibrated confidence. There is no SNR estimate. Repetitive background sound/music can look periodic; breathy/creaky speech, vibrato, low amplitude, recording processing and device gain can cause false rejection, wrong F0 or misleading movement. Unknown signal type and complete syllable correctness remain unverified even when status is ANALYZED.

## Status, feedback and privacy

States: NOT_ANALYZED, PROCESSING, ANALYZED, INSUFFICIENT_SIGNAL, UNSUPPORTED_TARGET, ANALYSIS_FAILED. ANALYZED means sufficient numeric evidence under this policy for a pitch-only observation. It never means Mandarin pronunciation verified. Any warning disables a confident movement observation in learner feedback; insufficient signal uses the explicit Vietnamese retry wording. Successful output describes the measured segment (“cuối âm có cao độ cao hơn đầu âm”), followed by one target-specific practice action, a retry and expandable technical limitations. Static articulation advice is explicitly separate evidence.

No upload, network speech API, audio analytics, SQL audio, file export or browser persistent storage. One current recording/Blob URL plus at most two numeric analysis results live in tab RAM. Re-recording discards previous raw audio while keeping its numeric curve; delete clears recording and both curves. Target change/navigation/unmount/background clear resources and cancel analysis; worker messages from older generations cannot publish. OS/browser decoding is asynchronous and has no standard abort API: cancellation drops references/ignores results and prevents subsequent worker creation, but cannot guarantee immediate interruption of the browser's internal codec allocation. The UI has no file-upload path; encoded inputs come only from the bounded recorder. No physical microphone permission is requested before the explicit button.
