# Consented local audio investigation — 2026-10-19

Status: **PARTIAL — real-audio tracking limitation reproduced**. The owner supplied a paired original recording and selected/filtered excerpt after explicitly consenting to local voice-file analysis. This supersedes earlier statements that no owner audio had been inspected. It does not complete the hardware protocol or validate Mandarin assessment.

## Input and privacy boundary

The latest original decodes to 2.76 seconds, mono at 24 kHz; its paired PCM16 excerpt is 1.30 seconds. The earlier 0.71-second excerpt was a separate preliminary input and is not the counterpart used below. Encoded inputs remain unchanged in the ignored `.local-postgres/microphone-pilot/` directory. No owner audio, PCM, complete pitch traces or voice download is included in Git or sent to a cloud service. Only scalar diagnostic results are summarized here.

Decoding used local Chromium `OfflineAudioContext` with network requests blocked, then the existing domain engine via `tsx`. No microphone was opened by this investigation. Browser/physical microphone identity and capture-time suppression cannot be independently established from an encoded file; the earlier NS-on report remains the owner's observation.

The selected excerpt aligns at 0.20–1.50 seconds of the original. Normalized correlation is approximately 0.99937 against that raw interval and 0.999999998 against the current locally filtered interval. This supports using these two files as the intended pair; correlation does not establish voice quality or pronunciation correctness. Local analysis still consumes the original, independently of excerpt playback.

## Fixed-policy reproduction

Policy remains `csh-pitch-observation-v3`, Gaussian conditioning plus McLeod Pitch Method / `pitchy@4.1.0`. Existing acceptance requires at least 300 ms of periodic-frame hops and 65% coverage among energetic frames. These are uncalibrated engineering heuristics. Each hop is 10 ms; overlapping 85 ms windows mean hop totals are not independent measurements or an exact voiced duration.

| Same original, 2.76 seconds  | Local spectral filter off    | Local spectral filter on     |
| ---------------------------- | ---------------------------- | ---------------------------- |
| Result                       | INSUFFICIENT_SIGNAL          | INSUFFICIENT_SIGNAL          |
| Primary reason               | INSUFFICIENT_PERIODIC_FRAMES | INSUFFICIENT_PERIODIC_FRAMES |
| Accepted frames / all frames | 18 / 268                     | 21 / 268                     |
| Energetic-frame coverage     | 16.5%                        | 20.2%                        |
| Periodic-frame hop total     | 180 ms                       | 210 ms                       |
| Longest consecutive hop run  | 140 ms                       | 140 ms                       |
| Additional warning           | None                         | AMBIGUOUS_SEGMENTATION       |

Excluded frames, respectively: reference 0/26, quiet 159/138, low periodicity 89/80, out of range 2/3, octave jump 0/0, invalid 0/0. Clipped sample fraction is zero; original peak is about 0.290 and RMS about 0.0296. Thus clipping is not reproduced in this file. These levels and owner-reported audible playback do not establish that the recording is noise-free or that every energetic frame contains periodic voice.

At the same selected bounds, raw input retains 18/122 frames; local filtering retains 20/122. The supplied excerpt also retains 20/122 when analyzed without applying a second reference filter. This reproduces the sparse graph and shows the current local filter does not resolve this sample's tracking failure.

The selected interval's RMS changes from approximately 0.0431 to 0.0427. RMS of the raw-minus-filtered difference is approximately 0.00161, or 3.7% relative to selected raw RMS. **This is signal change, not measured noise removal or SNR.** There is no separately labeled clean voice/noise reference, so the investigation cannot quantify remaining noise, reconstruct the owner's clean voice, or establish noise as the sole cause.

## Bounded diagnostic probes, not a production change

A predetermined local comparison on the supplied excerpt kept the 0.9 periodicity threshold and tested frame lengths 1024/2048/4096 with the existing 1000 Hz Gaussian setting, plus 700/1400 Hz at 2048. Energetic coverage ranged from approximately 12.7% to 35.3%; none reached the existing 65% criterion. This is a single-input sensitivity check, not a benchmark or a reason to select the best result as correct. No production DSP, detector, acceptance threshold or dependency was changed. No interpolation was added to hide gaps.

Remaining uncertainty includes nonperiodic speech regions, mixed noise, capture processing and detector suitability for this voice. The file alone does not distinguish these causes or justify blaming pronunciation or microphone hardware. A broader consented and independently annotated evaluation would be needed before replacing the engine or claiming a validated fix.

## Delivered app change

The playback now visibly identifies **Bản gốc · toàn bộ lần ghi**. Inside the pilot, an optional disclosure contains **Tải audio gốc về máy**, pointing to the exact existing encoded original Blob URL. It saves only after the user clicks; it neither records again nor uploads audio. Capture-time suppression, if enabled by the browser, is already baked into this original. The JSON pilot report remains metadata-only. The selected/filtered playback remains distinct.

The download is provided for explicitly consented local diagnosis, not a request for another owner recording. Files already supplied are sufficient to reproduce the current limitation. No new raw-voice collection is necessary to report these findings.

## Verification

Fresh checks: **81 unit groups and 52 targeted browser cases PASS**, with zero failures, skips or retries. The browser matrix is pilot 8, acoustic/playback 18, recorder cleanup/error subset 2 desktop + 2 at 360px, and production preview/lockout 22. Lint, typecheck, format and production build PASS. The 26-table preservation check retained every original row and exactly matched all eight content/catalog tables. The earlier 41-check PostgreSQL integration suite was not rerun for this UI-only change.

Fresh results and source/report hashes are recorded in [real-audio-investigation.json](real-audio-investigation.json). Earlier 78-browser/41-database results and the later 56-browser follow-up remain historical, separate cutoffs; they are not added to the current count. Browser input is generated audio, never the owner's voice, and desktop/360px checks do not establish a physical Android pass.

No canonical task status, content, database schema, grading, FSRS, mastery, planner, Engineering Loop, PR, remote deployment or paid service changes are part of this investigation. The real-audio tracking failure remains unresolved; **SPRINT9_COMPLETE and hardware/phonetic PASS are not claimed**.
