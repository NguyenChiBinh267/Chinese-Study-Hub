import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSamples } from "../../src/modules/pronunciation/domain/acoustic-engine";
import { gaussianPitchSignal } from "../../src/modules/pronunciation/domain/pitch-conditioning";
import { ACOUSTIC_POLICY as P } from "../../src/modules/pronunciation/domain/acoustic-types";
import { syntheticVowel } from "../fixtures/synthetic-vowel";

test("Gaussian analysis copy attenuates high frequencies as specified, preserves input and supports cancellation", () => {
  function rms(a: Float32Array) {
    return Math.sqrt(
      a.slice(2048, -2048).reduce((s, x) => s + x * x, 0) / (a.length - 4096),
    );
  }
  for (const hz of [100, 500, 1000]) {
    const samples = Float32Array.from(
        { length: 24000 },
        (_, i) => 0.2 * Math.sin((2 * Math.PI * hz * i) / 24000),
      ),
      before = samples.slice();
    const output = gaussianPitchSignal(samples, 24000, 1000, 0.03)!;
    assert.deepEqual(samples, before);
    const expected = 0.03 ** ((hz / 1000) ** 2);
    assert.ok(Math.abs(rms(output) / rms(samples) - expected) < 0.002);
  }
  assert.equal(
    gaussianPitchSignal(new Float32Array(24000), 24000, 1000, 0.03, () => true),
    null,
  );
});
test("V2 recovers known F0 on original multi-harmonic modulated fixtures rejected by unconditioned MPM; no gate relaxation", () => {
  for (const slope of [0.4, 0.9, 1.4]) {
    const samples = syntheticVowel({ slope, jitter: 0.03 });
    const raw = analyzeSamples(
      samples,
      24000,
      "pron-tone-2-v1",
      true,
      () => false,
      "UNCONDITIONED_COMPARISON",
    );
    const filtered = analyzeSamples(samples, 24000, "pron-tone-2-v1", true);
    assert.equal(raw.status, "INSUFFICIENT_SIGNAL");
    assert.equal(filtered.status, "ANALYZED");
    assert.equal(filtered.observation, "RISING");
    const voiced = filtered.frames.filter((f) => f.f0Hz !== null);
    const meanError =
      voiced.reduce(
        (s, f) =>
          s +
          Math.abs(
            1200 * Math.log2(f.f0Hz! / (160 * 2 ** (slope * f.timeSeconds))),
          ),
        0,
      ) / voiced.length;
    assert.ok(meanError < 25, `synthetic cents error ${meanError}`);
    assert.equal(filtered.masteryEligible, false);
    assert.equal(filtered.pronunciationVerified, false);
  }
  assert.equal(P.minClarity, 0.9);
  assert.equal(P.minRms, 0.008);
  assert.equal(P.version, "csh-pitch-observation-v3");
});
test("V2 retains abstention for severe synthetic irregularity, original clipping, quiet input and several noise seeds", () => {
  assert.equal(
    analyzeSamples(
      syntheticVowel({ jitter: 0.15 }),
      24000,
      "pron-tone-2-v1",
      true,
    ).status,
    "INSUFFICIENT_SIGNAL",
  );
  for (let seed = 1; seed <= 8; seed++) {
    let state = seed;
    const noise = Float32Array.from({ length: 24000 }, () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return (state / 2 ** 32 - 0.5) * 0.4;
    });
    assert.equal(
      analyzeSamples(noise, 24000, "pron-tone-2-v1", true).status,
      "INSUFFICIENT_SIGNAL",
    );
  }
  const clipped = Float32Array.from({ length: 24000 }, (_, i) =>
    Math.sign(Math.sin((2 * Math.PI * 220 * i) / 24000)),
  );
  assert.ok(
    analyzeSamples(clipped, 24000, "pron-tone-2-v1", true).warnings.includes(
      "CLIPPED",
    ),
  );
  const quiet = Float32Array.from(
    { length: 24000 },
    (_, i) => 0.00001 * Math.sin((2 * Math.PI * 220 * i) / 24000),
  );
  assert.ok(
    analyzeSamples(quiet, 24000, "pron-tone-2-v1", true).frames.every(
      (f) => f.excluded === "QUIET",
    ),
  );
});
