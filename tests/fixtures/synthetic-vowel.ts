// Original generated stress signal; not a human voice, speech dataset, approved
// Mandarin example or phonetic ground truth. F0 is known by construction.
export function syntheticVowel({
  seconds = 1,
  sampleRate = 24000,
  slope = 0.9,
  jitter = 0.03,
  noise = 0.01,
} = {}) {
  let phase = 0,
    seed = 12345,
    cycleJitter = 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32 - 0.5;
  };
  return Float32Array.from(
    { length: Math.round(seconds * sampleRate) },
    (_, i) => {
      const t = i / sampleRate,
        base = 160 * 2 ** (slope * t),
        oldCycle = Math.floor(phase / (2 * Math.PI));
      phase += (base * (1 + cycleJitter) * 2 * Math.PI) / sampleRate;
      if (Math.floor(phase / (2 * Math.PI)) !== oldCycle)
        cycleJitter = random() * jitter;
      let value = 0;
      for (let h = 1; h <= 20; h++) {
        const f = h * base;
        const emphasis =
          1 +
          18 * Math.exp(-(((f - 650) / 100) ** 2)) +
          12 * Math.exp(-(((f - 1300) / 140) ** 2));
        value += (Math.sin(h * phase) * emphasis) / h ** 1.2;
      }
      return 0.045 * value + noise * random();
    },
  );
}
