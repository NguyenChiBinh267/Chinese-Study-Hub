import FFT from "fft.js";

export const NOISE_POLICY = Object.freeze({
  referenceMs: 300,
  frameSize: 1024,
  hopSize: 256,
  minGain: 0.25,
  subtraction: 1.5,
  maxReferenceToPeak: 0.45,
});
export type NoiseReduction = {
  status: "OFF" | "APPLIED" | "BYPASSED_NO_REFERENCE" | "BYPASSED_LOW_NOISE";
  referenceMs: number;
};
// Original bounded spectral subtraction. Only runs after the learner explicitly
// declares the first 300 ms to be background. It is not a voice activity detector.
export function reduceSteadyNoise(
  samples: Float32Array,
  sampleRate: number,
  cancelled = () => false,
): { samples: Float32Array; info: NoiseReduction } | null {
  const P = NOISE_POLICY,
    n = P.frameSize,
    hop = P.hopSize;
  const referenceEnd = Math.round((sampleRate * P.referenceMs) / 1000);
  const bypass = (status: NoiseReduction["status"]) => ({
    samples,
    info: { status, referenceMs: 0 },
  });
  if (cancelled()) return null;
  if (referenceEnd < n || samples.length < referenceEnd + sampleRate * 0.5)
    return bypass("BYPASSED_NO_REFERENCE");
  function rms(start: number, end: number) {
    let sum = 0,
      squares = 0;
    for (let i = start; i < end; i++) {
      sum += samples[i];
      squares += samples[i] ** 2;
    }
    const length = end - start;
    return Math.sqrt(Math.max(0, squares / length - (sum / length) ** 2));
  }
  const referenceRms = rms(0, referenceEnd);
  let peakRms = 0;
  for (let i = referenceEnd; i + n <= samples.length; i += hop)
    peakRms = Math.max(peakRms, rms(i, i + n));
  // No claim that the reference is truly speech-free: this is only a conservative
  // energy sanity check. If the learner speaks immediately, leave PCM untouched.
  if (referenceRms >= peakRms * P.maxReferenceToPeak)
    return bypass("BYPASSED_NO_REFERENCE");
  if (referenceRms < 0.00001) return bypass("BYPASSED_LOW_NOISE");
  const fft = new FFT(n),
    window = Float64Array.from({ length: n }, (_, i) =>
      Math.sin((Math.PI * (i + 0.5)) / n),
    );
  const input = new Float64Array(n),
    spectrum = fft.createComplexArray(),
    inverse = fft.createComplexArray(),
    noise = new Float64Array(n / 2 + 1);
  function transform(start: number) {
    for (let j = 0; j < n; j++)
      input[j] = (samples[start + j] ?? 0) * window[j];
    fft.realTransform(spectrum, input);
  }
  let references = 0;
  for (let i = 0; i + n <= referenceEnd; i += hop) {
    if (cancelled()) return null;
    transform(i);
    references++;
    for (let k = 0; k < noise.length; k++)
      noise[k] += spectrum[2 * k] ** 2 + spectrum[2 * k + 1] ** 2;
  }
  for (let k = 0; k < noise.length; k++) noise[k] /= references;
  const output = new Float32Array(samples.length),
    weight = new Float32Array(samples.length),
    gains = new Float64Array(noise.length).fill(1);
  // Centered overlap-add with zero padding, preserving original timestamps.
  for (let i = -n + hop; i < samples.length; i += hop) {
    if (cancelled()) return null;
    transform(i);
    for (let k = 0; k < noise.length; k++) {
      const power = spectrum[2 * k] ** 2 + spectrum[2 * k + 1] ** 2;
      const gain = Math.sqrt(
        Math.max(
          P.minGain ** 2,
          1 - (P.subtraction * noise[k]) / Math.max(power, 1e-20),
        ),
      );
      // Smooth attenuation over time; gain is never greater than one.
      gains[k] = 0.5 * gains[k] + 0.5 * gain;
      spectrum[2 * k] *= gains[k];
      spectrum[2 * k + 1] *= gains[k];
    }
    fft.completeSpectrum(spectrum);
    fft.inverseTransform(inverse, spectrum);
    for (let j = 0; j < n; j++) {
      const at = i + j;
      if (at >= 0 && at < output.length) {
        output[at] += inverse[2 * j] * window[j];
        weight[at] += window[j] ** 2;
      }
    }
  }
  for (let i = 0; i < output.length; i++) output[i] /= weight[i] || 1;
  return {
    samples: output,
    info: { status: "APPLIED", referenceMs: P.referenceMs },
  };
}
