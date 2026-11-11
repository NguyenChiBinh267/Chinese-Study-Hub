// Zero-phase, finite Gaussian convolution for analysis only. Original playback
// and raw RMS/clipping gates are untouched. See acoustic-policy-v2.md for formula,
// primary reference, truncation and limitations; this is not Praat's tracker.
export function gaussianPitchSignal(
  samples: Float32Array,
  sampleRate: number,
  topHz: number,
  attenuationAtTop: number,
  cancelled = () => false,
): Float32Array | null {
  const sigma =
    sampleRate *
    Math.sqrt(-Math.log(attenuationAtTop) / (2 * Math.PI ** 2 * topHz ** 2));
  const radius = Math.ceil(4 * sigma),
    kernel = new Float64Array(2 * radius + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const weight = Math.exp(-0.5 * (i / sigma) ** 2);
    kernel[i + radius] = weight;
    sum += weight;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  const output = new Float32Array(samples.length);
  for (let n = 0; n < samples.length; n++) {
    if (n % 1024 === 0 && cancelled()) return null;
    let value = 0;
    for (let j = -radius; j <= radius; j++) {
      const k = n + j;
      if (k >= 0 && k < samples.length)
        value += samples[k] * kernel[j + radius];
    }
    output[n] = value;
  }
  return output;
}
