import { PitchDetector } from "pitchy";
import { gaussianPitchSignal } from "./pitch-conditioning";
import { reduceSteadyNoise } from "./noise-reduction";
import {
  ACOUSTIC_POLICY as P,
  emptyAnalysis,
  supportedTone,
  type AcousticResult,
  type PitchFrame,
} from "./acoustic-types";

function quantile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[
      Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))
    ] ?? 0
  );
}
// Runs in a dedicated worker in the app. No recognition, phonetic classifier,
// time warping, gap interpolation or automatic octave correction.
export function analyzeSamples(
  samples: Float32Array,
  sampleRate: number,
  targetVersion: string,
  singleSyllable: boolean,
  cancelled = () => false,
  // Explicit unconditioned comparison for deterministic regression evidence.
  // The app worker always uses the default Gaussian path.
  conditioning: "GAUSSIAN" | "UNCONDITIONED_COMPARISON" = "GAUSSIAN",
  noiseReduction = false,
): AcousticResult {
  const result = emptyAnalysis(targetVersion);
  if (conditioning === "UNCONDITIONED_COMPARISON") {
    result.policyVersion += ":unconditioned-comparison";
    result.algorithm = "Unconditioned MPM comparison / pitchy@4.1.0";
  }
  if (!supportedTone(targetVersion) || !singleSyllable)
    return {
      ...result,
      status: "UNSUPPORTED_TARGET",
      reason: "ISOLATED_TONE_1_TO_4_ONLY",
    };
  if (
    !Number.isFinite(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 96000 ||
    samples.length > sampleRate * P.maxAudioSeconds ||
    samples.length > 1200000
  )
    return { ...result, status: "ANALYSIS_FAILED", reason: "SAMPLE_LIMIT" };
  result.durationSeconds = samples.length / sampleRate;
  if (samples.length < P.frameSize)
    return { ...result, status: "INSUFFICIENT_SIGNAL", reason: "TOO_SHORT" };
  const hop = Math.round((sampleRate * P.hopMs) / 1000),
    detector = PitchDetector.forFloat32Array(P.frameSize),
    frame = new Float32Array(P.frameSize);
  detector.clarityThreshold = 0.9;
  let clipped = 0,
    invalid = 0;
  for (const x of samples) {
    if (!Number.isFinite(x)) invalid++;
    else if (Math.abs(x) >= 0.98) clipped++;
  }
  if (invalid)
    return { ...result, status: "ANALYSIS_FAILED", reason: "NONFINITE_AUDIO" };
  const reduced = noiseReduction
    ? reduceSteadyNoise(samples, sampleRate, cancelled)
    : { samples, info: result.noiseReduction };
  if (reduced === null)
    return { ...emptyAnalysis(targetVersion), reason: "CANCELLED" };
  result.noiseReduction = reduced.info;
  if (reduced.info.status === "APPLIED")
    result.algorithm = "Spectral subtraction + " + result.algorithm;
  const analysisSamples =
    conditioning === "GAUSSIAN"
      ? gaussianPitchSignal(
          reduced.samples,
          sampleRate,
          P.conditioningTopHz,
          P.conditioningAttenuationAtTop,
          cancelled,
        )
      : reduced.samples;
  if (analysisSamples === null)
    return { ...emptyAnalysis(targetVersion), reason: "CANCELLED" };
  const frames: PitchFrame[] = [];
  let energetic = 0;
  for (let offset = 0; offset + P.frameSize <= samples.length; offset += hop) {
    if (cancelled())
      return { ...emptyAnalysis(targetVersion), reason: "CANCELLED" };
    let mean = 0,
      conditionedMean = 0;
    for (let i = 0; i < P.frameSize; i++) {
      mean += samples[offset + i];
      conditionedMean += analysisSamples[offset + i];
    }
    mean /= P.frameSize;
    conditionedMean /= P.frameSize;
    let squares = 0;
    for (let i = 0; i < P.frameSize; i++) {
      frame[i] = analysisSamples[offset + i] - conditionedMean;
      squares += (samples[offset + i] - mean) ** 2;
    }
    const row: PitchFrame = {
      timeSeconds: (offset + P.frameSize / 2) / sampleRate,
      f0Hz: null,
      relativeSemitones: null,
      periodicity: null,
      voiced: false,
      excluded: "QUIET",
    };
    if (
      (offset + P.frameSize / 2) / sampleRate <
      reduced.info.referenceMs / 1000
    ) {
      row.excluded = "NOISE_REFERENCE";
    } else if (Math.sqrt(squares / P.frameSize) >= P.minRms) {
      energetic++;
      const [hz, clarity] = detector.findPitch(frame, sampleRate);
      row.periodicity = Number.isFinite(clarity)
        ? Math.max(0, Math.min(1, clarity))
        : null;
      if (!Number.isFinite(hz) || !Number.isFinite(clarity))
        row.excluded = "INVALID";
      else if (clarity < P.minClarity) row.excluded = "LOW_PERIODICITY";
      else if (hz < P.minHz || hz > P.maxHz) row.excluded = "OUT_OF_RANGE";
      else {
        row.f0Hz = hz;
        row.voiced = true;
        row.excluded = null;
      }
    }
    frames.push(row);
  }
  let octave = false,
    previous: number | null = null,
    previousIndex = -1;
  for (let i = 0; i < frames.length; i++) {
    const hz = frames[i].f0Hz;
    if (
      hz !== null &&
      previous !== null &&
      frames[i].timeSeconds - frames[previousIndex].timeSeconds < 0.2 &&
      Math.abs(12 * Math.log2(hz / previous)) >= P.octaveJumpSemitones
    ) {
      octave = true;
      // Mark the transition's two frames unknown; do not guess which octave is right.
      for (const row of [frames[previousIndex], frames[i]]) {
        row.f0Hz = null;
        row.voiced = false;
        row.excluded = "OCTAVE_JUMP";
      }
    }
    if (hz !== null) {
      previous = hz;
      previousIndex = i;
    }
  }
  const voiced = frames.filter((f) => f.f0Hz !== null),
    hz = voiced.map((f) => f.f0Hz!);
  result.frames = frames;
  result.voicedDurationMs = voiced.length * P.hopMs;
  result.voicedCoverage = frames.length ? voiced.length / frames.length : 0;
  result.activeVoicedCoverage = energetic ? voiced.length / energetic : 0;
  result.excludedFrames = frames.length - voiced.length;
  if (hz.length) {
    result.baselineHz = quantile(hz, 0.5);
    for (const row of voiced)
      row.relativeSemitones = 12 * Math.log2(row.f0Hz! / result.baselineHz);
  }
  const warnings = result.warnings;
  if (clipped / samples.length > P.maxClipFraction) warnings.push("CLIPPED");
  if (octave) warnings.push("OCTAVE_AMBIGUITY");
  if (
    result.voicedDurationMs < P.minVoicedMs ||
    result.activeVoicedCoverage < P.minCoverage
  )
    warnings.push("INSUFFICIENT_PERIODIC_FRAMES");
  if (voiced.length) {
    if (
      result.voicedDurationMs > P.maxNucleusMs ||
      (voiced.at(-1)!.timeSeconds - voiced[0].timeSeconds) * 1000 >
        P.maxNucleusMs + 300
    )
      warnings.push("POSSIBLE_MULTIPLE_SYLLABLES");
    let totalStep = 0,
      adjacent = 0;
    for (let i = 1; i < voiced.length; i++) {
      const dt = (voiced[i].timeSeconds - voiced[i - 1].timeSeconds) * 1000;
      if (dt > P.maxInternalGapMs) {
        if (!warnings.includes("AMBIGUOUS_SEGMENTATION"))
          warnings.push("AMBIGUOUS_SEGMENTATION");
      }
      if (dt < P.hopMs * 1.5) {
        totalStep += Math.abs(
          voiced[i].relativeSemitones! - voiced[i - 1].relativeSemitones!,
        );
        adjacent++;
      }
    }
    if (adjacent && totalStep / adjacent > P.maxMeanStepSemitones)
      warnings.push("UNSTABLE_TRACKING");
  }
  if (warnings.length)
    return {
      ...result,
      status: warnings.includes("POSSIBLE_MULTIPLE_SYLLABLES")
        ? "UNSUPPORTED_TARGET"
        : "INSUFFICIENT_SIGNAL",
      reason: warnings[0],
    };
  const contour = voiced.map((f) => f.relativeSemitones!),
    edge = Math.max(1, Math.floor(contour.length * 0.2));
  const delta =
    quantile(contour.slice(-edge), 0.5) - quantile(contour.slice(0, edge), 0.5);
  result.movementSemitones = delta;
  result.observation =
    delta > P.movementSemitones
      ? "RISING"
      : delta < -P.movementSemitones
        ? "FALLING"
        : quantile(contour, 0.9) - quantile(contour, 0.1) <= P.movementSemitones
          ? "LEVEL"
          : "VARIABLE";
  result.status = "ANALYZED";
  result.reason = "EXPERIMENTAL_PITCH_ONLY";
  return result;
}
