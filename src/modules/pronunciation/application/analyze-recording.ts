import {
  ACOUSTIC_POLICY as P,
  emptyAnalysis,
  supportedTone,
  type AcousticResult,
} from "../domain/acoustic-types";

export type AnalysisJob = {
  result: Promise<AcousticResult>;
  cancel: () => void;
};
export function analyzeRecording(
  blob: Blob,
  targetVersion: string,
  singleSyllable: boolean,
  noiseReduction = false,
): AnalysisJob {
  let worker: Worker | null = null,
    context: OfflineAudioContext | null = null,
    done = false;
  let finish!: (value: AcousticResult) => void;
  const result = new Promise<AcousticResult>((resolve) => {
    finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker?.terminate();
      worker = null;
      context = null;
      resolve(value);
    };
  });
  const cancel = () =>
    finish(emptyAnalysis(targetVersion, "NOT_ANALYZED", "CANCELLED"));
  const timer = setTimeout(
    () => finish(emptyAnalysis(targetVersion, "ANALYSIS_FAILED", "TIME_LIMIT")),
    P.timeoutMs,
  );
  void (async () => {
    if (!supportedTone(targetVersion) || !singleSyllable)
      return finish(
        emptyAnalysis(
          targetVersion,
          "UNSUPPORTED_TARGET",
          "ISOLATED_TONE_1_TO_4_ONLY",
        ),
      );
    if (!blob.size || blob.size > P.maxEncodedBytes)
      return finish(
        emptyAnalysis(targetVersion, "ANALYSIS_FAILED", "ENCODED_SIZE"),
      );
    try {
      if (
        typeof OfflineAudioContext === "undefined" ||
        typeof Worker === "undefined"
      )
        return finish(
          emptyAnalysis(
            targetVersion,
            "ANALYSIS_FAILED",
            "BROWSER_UNSUPPORTED",
          ),
        );
      // Browser's decoder resamples; no network fetch or AudioContext microphone.
      context = new OfflineAudioContext(1, 1, P.sampleRate);
      const bytes = await blob.arrayBuffer();
      if (done) return;
      const audio = await context.decodeAudioData(bytes);
      if (done) return;
      if (
        audio.duration > P.maxAudioSeconds ||
        audio.numberOfChannels > 2 ||
        audio.length > 1200000
      )
        return finish(
          emptyAnalysis(targetVersion, "ANALYSIS_FAILED", "DECODED_SIZE"),
        );
      const mono = new Float32Array(audio.length);
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        const data = audio.getChannelData(ch);
        for (let i = 0; i < data.length; i++)
          mono[i] += data[i] / audio.numberOfChannels;
      }
      if (done) return;
      worker = new Worker(new URL("./acoustic-worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<AcousticResult>) =>
        finish(event.data);
      worker.onerror = (event) => {
        event.preventDefault();
        finish(
          emptyAnalysis(targetVersion, "ANALYSIS_FAILED", "WORKER_FAILED"),
        );
      };
      worker.postMessage(
        {
          samples: mono,
          sampleRate: audio.sampleRate,
          targetVersion,
          singleSyllable,
          noiseReduction,
        },
        [mono.buffer],
      );
    } catch {
      finish(emptyAnalysis(targetVersion, "ANALYSIS_FAILED", "DECODE_FAILED"));
    }
  })();
  return { result, cancel };
}
