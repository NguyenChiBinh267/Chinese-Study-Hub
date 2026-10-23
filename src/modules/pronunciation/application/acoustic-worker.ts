import { analyzeSamples } from "../domain/acoustic-engine";
import { emptyAnalysis } from "../domain/acoustic-types";
type Work = {
  samples: Float32Array;
  sampleRate: number;
  targetVersion: string;
  singleSyllable: boolean;
  noiseReduction?: boolean;
};
// Dedicated worker: terminated on cancel, timeout, delete or page exit.
self.onmessage = (event: MessageEvent<Work>) => {
  const { samples, sampleRate, targetVersion, singleSyllable, noiseReduction } =
    event.data;
  try {
    self.postMessage(
      analyzeSamples(
        samples,
        sampleRate,
        targetVersion,
        singleSyllable,
        undefined,
        undefined,
        noiseReduction === true,
      ),
    );
  } catch {
    self.postMessage(
      emptyAnalysis(targetVersion, "ANALYSIS_FAILED", "ENGINE_FAILED"),
    );
  }
};
