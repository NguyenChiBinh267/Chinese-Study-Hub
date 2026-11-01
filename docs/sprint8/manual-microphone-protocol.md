# Manual hardware protocol — NOT PERFORMED

Owner-reported spot checks initially reached decoded/worker results but retained no F0 frames; playback was reported clear. After v2 the owner reported a graph but an insufficient-signal message; the next supplied panel was NOT_ANALYZED with no current result. [Policy v3](acoustic-policy-v3.md) records this and the optional background filter. For its enabled mode leave half a second of silence after Record before reading one syllable; record the actual APPLIED/bypass status and compare off/on on the same recording. This does not complete the formal protocol below or validate human F0 accuracy. The agent has not recorded or inspected the owner's audio.

No actual Windows/Android microphone, human Mandarin speech, listener rating or calibrated phonetic evaluation has been performed by the agent. Automated browser tests replace the input source with generated sound; actual MediaRecorder/Opus decode/worker/F0/chart are exercised, but these are not hardware PASS. Do not change this heading without actual dated evidence.

## Windows

1. Start the documented local preview on `http://127.0.0.1:3015`. Choose LOCAL DATABASE → Foundation → pronunciation. Use Chrome/Edge, record exact browser/OS version and microphone model without personal identifiers.
2. Select thanh 2 (má), check the one-syllable declaration. Confirm that no microphone permission was requested before pressing Ghi âm. Grant permission yourself, read one syllable at a comfortable volume, stop, listen, then Phân tích cao độ.
3. Record whether real playback is intelligible; numeric result/graph or clear abstention is shown; browser remains responsive. A graph is not a correctness judgment. Inspect axes, gaps, explanation and the sample slider using keyboard.
4. Repeat each isolated target mā/má/mǎ/mà five times, leaving silence at both ends; include varied comfortable pitch registers without forcing the voice. Try a quiet room and ordinary room noise. No app instruction should assert measured tongue/lip/aspiration or certified tone accuracy.
5. Use Ghi lần tiếp to compare two curves. Delete and confirm both curves/playback disappear. Change target, leave the page and switch tabs during recording/analysis; confirm the browser microphone indicator stops and no late result appears. Reload must not restore audio or curves.
6. Deny/revoke permission, remove/busy the microphone, try silence/soft speech, longer connected speech, several syllables and clipping. Record useful fallback/abstention; do not interpret “no warnings” as proof that all noise was detected.
7. Inspect network requests for no audio upload; no raw audio or user speech needs to be saved or sent to the developer. Record only expected/observed behavior and bugs unless separately consented research is authorized.

## Android

Repeat on an actual Android phone/Chrome in a valid **secure context**. HTTP to the Windows LAN address is generally not sufficient for microphone access. The default server listens only on 127.0.0.1; do not expose it publicly or weaken Host/Origin/owner checks to pass this test. A possible local-only setup is USB/ADB reverse of port 3015 to the phone, using `http://127.0.0.1:3015` on-device; ADB availability/device authorization and secure-context behavior must be verified rather than assumed. No device connection, ADB setup or public tunnel has been performed in this sprint.

Check 360px, 200% zoom, rotation, focus, touch controls, interrupted permission, backgrounding and repeated recording/analysis. At least two actual devices/voice pitches are useful; this is still usability/capability evidence, not model calibration.

## Evidence record template

Date/timezone; tester consent; OS/browser/device/microphone; secure-context URL/setup; chosen note/version; repetition count; room condition; observed state/latency/playback/graph; cleanup/privacy checks; expected vs actual; PASS/FAIL/NOT TESTED with reason. Never invent reviewer identity, speech accuracy or an acoustic ground-truth label.
