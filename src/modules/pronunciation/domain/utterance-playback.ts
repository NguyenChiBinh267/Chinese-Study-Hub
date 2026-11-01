import { reduceSteadyNoise, type NoiseReduction } from "./noise-reduction";

export const UTTERANCE_POLICY = "csh-utterance-playback-v1";
export type UtteranceRange = { start: number; end: number };
export type PreparedUtterance = {
  raw: Float32Array;
  filtered: Float32Array;
  sampleRate: number;
  noise: NoiseReduction;
  suggested: UtteranceRange | null;
};
// Amplitude segmentation only; it cannot identify a person, speech or syllables.
export function prepareUtterance(
  samples: Float32Array,
  sampleRate: number,
  referenceConfirmed: boolean,
  cancelled = () => false,
): PreparedUtterance | null {
  if (
    !Number.isFinite(sampleRate) ||
    sampleRate < 8000 ||
    sampleRate > 96000 ||
    samples.length < sampleRate * 0.15 ||
    samples.length > 1200000 ||
    samples.length / sampleRate > 12.5 ||
    !samples.every(Number.isFinite)
  )
    throw new Error("INVALID_AUDIO");
  if (cancelled()) return null;
  const reduced = referenceConfirmed
    ? reduceSteadyNoise(samples, sampleRate, cancelled)
    : { samples, info: { status: "OFF", referenceMs: 0 } as NoiseReduction };
  if (!reduced) return null;
  const hop = Math.round(sampleRate * 0.02),
    levels: number[] = [];
  for (let at = 0; at + hop <= samples.length; at += hop) {
    if (cancelled()) return null;
    let sum = 0,
      square = 0;
    for (let j = at; j < at + hop; j++) {
      sum += samples[j];
      square += samples[j] ** 2;
    }
    levels.push(Math.sqrt(Math.max(0, square / hop - (sum / hop) ** 2)));
  }
  const searchStart = referenceConfirmed ? Math.ceil(0.3 / 0.02) : 0;
  const background = referenceConfirmed
    ? levels.slice(0, searchStart)
    : [...levels]
        .sort((a, b) => a - b)
        .slice(0, Math.max(1, Math.floor(levels.length * 0.2)));
  const sorted = background.sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const threshold = Math.max(0.008, floor * 3);
  const groups: { start: number; end: number; active: number }[] = [];
  for (let i = searchStart; i < levels.length; i++) {
    if (levels[i] <= threshold) continue;
    const last = groups.at(-1);
    if (last && i - last.end <= 6) {
      last.end = i;
      last.active++;
    } else groups.push({ start: i, end: i, active: 1 });
  }
  const candidates = groups.filter(
    (group) => group.active >= 8 && (group.end - group.start + 1) * 0.02 <= 3,
  );
  const candidate = candidates.length === 1 ? candidates[0] : null;
  return {
    raw: samples,
    filtered: reduced.samples,
    sampleRate,
    noise: reduced.info,
    suggested: candidate
      ? {
          start: Math.max(
            referenceConfirmed ? 0.3 : 0,
            candidate.start * 0.02 - 0.08,
          ),
          end: Math.min(
            samples.length / sampleRate,
            (candidate.end + 1) * 0.02 + 0.1,
          ),
        }
      : null,
  };
}
// PCM16 WAV for a learner-selected excerpt. No normalization or changing gain
// over time: only a 5 ms edge fade to avoid cut clicks. Original PCM is immutable.
export function excerptWav(
  prepared: PreparedUtterance,
  range: UtteranceRange,
  filtered: boolean,
): ArrayBuffer {
  const { sampleRate } = prepared,
    source = filtered ? prepared.filtered : prepared.raw;
  if (
    !Number.isFinite(range.start) ||
    !Number.isFinite(range.end) ||
    range.start < 0 ||
    range.end > source.length / sampleRate ||
    range.end - range.start < 0.15 ||
    range.end - range.start > 3.5
  )
    throw new Error("Chọn đoạn dài từ 0,15 đến 3,5 giây, nằm trong bản thu.");
  const start = Math.floor(range.start * sampleRate),
    end = Math.floor(range.end * sampleRate);
  const count = end - start,
    buffer = new ArrayBuffer(44 + count * 2),
    view = new DataView(buffer);
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(at + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + count * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, count * 2, true);
  const fade = Math.round(sampleRate * 0.005);
  for (let i = 0; i < count; i++) {
    const envelope = Math.min(1, i / fade, (count - 1 - i) / fade);
    const value = Math.max(-1, Math.min(1, source[start + i] * envelope));
    view.setInt16(
      44 + i * 2,
      Math.round(value * (value < 0 ? 32768 : 32767)),
      true,
    );
  }
  return buffer;
}
