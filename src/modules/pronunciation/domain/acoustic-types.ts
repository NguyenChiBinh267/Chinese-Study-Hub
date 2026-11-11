// Engineering heuristics, not calibrated Mandarin assessment thresholds.
export const ACOUSTIC_POLICY = Object.freeze({
  version: "csh-pitch-observation-v3",
  algorithm: "Gaussian low-pass + McLeod Pitch Method / pitchy@4.1.0",
  conditioningTopHz: 1000,
  conditioningAttenuationAtTop: 0.03,
  sampleRate: 24000,
  frameSize: 2048,
  hopMs: 10,
  minHz: 50,
  maxHz: 1000,
  minRms: 0.008,
  minClarity: 0.9,
  maxClipFraction: 0.01,
  minVoicedMs: 300,
  minCoverage: 0.65,
  maxNucleusMs: 2500,
  maxInternalGapMs: 140,
  octaveJumpSemitones: 9,
  maxMeanStepSemitones: 1.2,
  movementSemitones: 2,
  maxAudioSeconds: 12.5,
  maxEncodedBytes: 2097152,
  timeoutMs: 8000,
});
export type AnalysisStatus =
  | "NOT_ANALYZED"
  | "PROCESSING"
  | "ANALYZED"
  | "INSUFFICIENT_SIGNAL"
  | "UNSUPPORTED_TARGET"
  | "ANALYSIS_FAILED";
export type Exclusion =
  | "NOISE_REFERENCE"
  | "QUIET"
  | "LOW_PERIODICITY"
  | "OUT_OF_RANGE"
  | "OCTAVE_JUMP"
  | "INVALID";
export type PitchFrame = {
  timeSeconds: number;
  f0Hz: number | null;
  relativeSemitones: number | null;
  periodicity: number | null; // MPM clarity is not probability of correct speech.
  voiced: boolean; // Periodic candidate, not verified human voicing/word identity.
  excluded: Exclusion | null;
};
export type ToneTarget = 1 | 2 | 3 | 4;
export function supportedTone(targetVersion: string): ToneTarget | null {
  const match = /^pron-tone-([1-4])-v1$/.exec(targetVersion);
  return match ? (Number(match[1]) as ToneTarget) : null;
}
export type AcousticResult = {
  status: AnalysisStatus;
  targetVersion: string;
  policyVersion: string;
  algorithm: string;
  noiseReduction: import("./noise-reduction").NoiseReduction;
  durationSeconds: number;
  frames: PitchFrame[];
  voicedCoverage: number;
  activeVoicedCoverage: number;
  voicedDurationMs: number;
  excludedFrames: number;
  baselineHz: number | null;
  warnings: string[];
  reason: string;
  observation: "RISING" | "FALLING" | "LEVEL" | "VARIABLE" | null;
  movementSemitones: number | null;
  pronunciationVerified: false;
  masteryEligible: false;
};
export function emptyAnalysis(
  targetVersion: string,
  status: AnalysisStatus = "NOT_ANALYZED",
  reason = "NO_ANALYSIS",
): AcousticResult {
  return {
    status,
    targetVersion,
    reason,
    policyVersion: ACOUSTIC_POLICY.version,
    algorithm: ACOUSTIC_POLICY.algorithm,
    noiseReduction: { status: "OFF", referenceMs: 0 },
    durationSeconds: 0,
    frames: [],
    voicedCoverage: 0,
    activeVoicedCoverage: 0,
    voicedDurationMs: 0,
    excludedFrames: 0,
    baselineHz: null,
    warnings: [],
    observation: null,
    movementSemitones: null,
    pronunciationVerified: false,
    masteryEligible: false,
  };
}
