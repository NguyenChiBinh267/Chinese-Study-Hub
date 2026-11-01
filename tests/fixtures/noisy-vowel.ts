import { syntheticVowel } from "./synthetic-vowel";
// Original deterministic math signals only. No human recording or speech corpus.
export function noisyVowel(noiseLevel = 0.06, humLevel = 0.015, seed = 91) {
  const sampleRate = 24000,
    lead = 9600;
  const voice = syntheticVowel({ jitter: 0, noise: 0 });
  const clean = new Float32Array(lead + voice.length + 4800);
  clean.set(voice, lead);
  const samples = Float32Array.from(clean, (x, i) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (
      x +
      (seed / 2 ** 32 - 0.5) * noiseLevel +
      humLevel * Math.sin((2 * Math.PI * 100 * i) / sampleRate)
    );
  });
  return {
    samples,
    clean,
    sampleRate,
    voiceStart: lead,
    voiceEnd: lead + voice.length,
  };
}
