import test from "node:test";
import assert from "node:assert/strict";
import { reduceSteadyNoise } from "../../src/modules/pronunciation/domain/noise-reduction";
import { analyzeSamples } from "../../src/modules/pronunciation/domain/acoustic-engine";
import { toneFeedback } from "../../src/modules/pronunciation/domain/tone-feedback";
import { noisyVowel } from "../fixtures/noisy-vowel";
import { syntheticVowel } from "../fixtures/synthetic-vowel";
import { AcousticSession } from "../../src/modules/pronunciation/application/acoustic-session";
import {
  emptyAnalysis,
  type AcousticResult,
} from "../../src/modules/pronunciation/domain/acoustic-types";

const analyze = (samples: Float32Array, enabled = true) =>
  analyzeSamples(
    samples,
    24000,
    "pron-tone-2-v1",
    true,
    undefined,
    undefined,
    enabled,
  );

test("Optional spectral subtraction reduces known synthetic additive noise without mutating PCM or shifting length; tracks nominal F0", () => {
  for (const seed of [91, 92, 93]) {
    const fixture = noisyVowel(0.12, 0.015, seed),
      before = fixture.samples.slice();
    const reduced = reduceSteadyNoise(fixture.samples, 24000)!;
    assert.equal(reduced.info.status, "APPLIED");
    assert.equal(reduced.samples.length, fixture.samples.length);
    assert.deepEqual(fixture.samples, before);
    const error = (samples: Float32Array) => {
      let sum = 0;
      for (let i = fixture.voiceStart + 2048; i < fixture.voiceEnd - 2048; i++)
        sum += (samples[i] - fixture.clean[i]) ** 2;
      return sum;
    };
    const improvement =
      10 * Math.log10(error(fixture.samples) / error(reduced.samples));
    assert.ok(
      improvement > 4,
      `generated signal error reduction ${improvement} dB`,
    );
    const raw = analyze(fixture.samples, false),
      filtered = analyze(fixture.samples);
    assert.equal(raw.status, "INSUFFICIENT_SIGNAL");
    assert.equal(filtered.status, "ANALYZED");
    assert.equal(filtered.observation, "RISING");
    const frames = filtered.frames.filter(
      (f) => f.voiced && f.timeSeconds > 0.5 && f.timeSeconds < 1.3,
    );
    const cents =
      frames.reduce(
        (sum, f) =>
          sum +
          Math.abs(
            1200 *
              Math.log2(f.f0Hz! / (160 * 2 ** (0.9 * (f.timeSeconds - 0.4)))),
          ),
        0,
      ) / frames.length;
    assert.ok(cents < 30, `synthetic nominal cents error ${cents}`);
    assert.ok(
      filtered.frames
        .filter((f) => f.timeSeconds < 0.3)
        .every((f) => f.excluded === "NOISE_REFERENCE" && !f.voiced),
    );
    assert.equal(filtered.pronunciationVerified, false);
    assert.equal(filtered.masteryEligible, false);
  }
});

test("No usable noise reference bypasses unchanged PCM; silence, constant noise, cancellation and immediate speech are handled", () => {
  const immediate = syntheticVowel({ slope: 0, jitter: 0, noise: 0 });
  const bypass = reduceSteadyNoise(immediate, 24000)!;
  assert.equal(bypass.info.status, "BYPASSED_NO_REFERENCE");
  assert.equal(bypass.samples, immediate);
  assert.equal(
    reduceSteadyNoise(immediate, 24000, () => true),
    null,
  );
  let checks = 0;
  assert.equal(
    reduceSteadyNoise(noisyVowel().samples, 24000, () => ++checks > 8),
    null,
  );
  assert.equal(
    reduceSteadyNoise(new Float32Array(1200), 24000)!.info.status,
    "BYPASSED_NO_REFERENCE",
  );
  const noNoise = noisyVowel(0, 0).samples;
  assert.equal(
    reduceSteadyNoise(noNoise, 24000)!.info.status,
    "BYPASSED_LOW_NOISE",
  );
  for (const level of [0, 0.05, 0.2]) {
    let seed = 17;
    const noise = Float32Array.from({ length: 38400 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed / 2 ** 32 - 0.5) * level;
    });
    assert.equal(analyze(noise).status, "INSUFFICIENT_SIGNAL");
    assert.equal(analyze(noise).observation, null);
  }
  // Exercise APPLIED mode on unvoiced noise too, not just the bypass branch.
  for (let seed = 1; seed <= 8; seed++) {
    let state = seed;
    const noise = Float32Array.from({ length: 38400 }, (_, i) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return (state / 2 ** 32 - 0.5) * (i < 9600 ? 0.015 : 0.2);
    });
    const result = analyze(noise);
    assert.equal(result.noiseReduction.status, "APPLIED");
    assert.equal(result.status, "INSUFFICIENT_SIGNAL");
    assert.equal(result.observation, null);
  }
});

test("Noise reduction preserves original clipping, quiet and interrupted-signal abstention, and explains partial graph honestly", () => {
  const fixture = noisyVowel(0.04, 0);
  const clipped = fixture.samples.slice();
  for (let i = 12000; i < 13500; i++) clipped[i] = 1;
  assert.ok(analyze(clipped).warnings.includes("CLIPPED"));
  const quiet = Float32Array.from(fixture.samples, (x) => x * 0.0001);
  assert.equal(analyze(quiet).status, "INSUFFICIENT_SIGNAL");
  assert.equal(analyze(quiet).observation, null);
  const interrupted = fixture.samples.slice();
  interrupted.fill(0, 19000, 25000);
  const result = analyze(interrupted);
  assert.equal(result.status, "INSUFFICIENT_SIGNAL");
  assert.ok(result.warnings.includes("AMBIGUOUS_SEGMENTATION"));
  assert.match(toneFeedback(result).summary, /đo được một phần cao độ/);
  assert.doesNotMatch(toneFeedback(result).summary, /phòng yên tĩnh/);
});

test("Changing noise option cancels stale work, clears comparison, forwards option and reuses the same blob without opening a microphone", async () => {
  const jobs: {
    finish: (r: AcousticResult) => void;
    cancelled: boolean;
    enabled: boolean;
    blob: Blob;
  }[] = [];
  const session = new AcousticSession(
    "pron-tone-2-v1",
    (blob, _target, _single, enabled = false) => {
      const job: {
        finish: (r: AcousticResult) => void;
        cancelled: boolean;
        enabled: boolean;
        blob: Blob;
      } = {
        finish: () => {},
        cancelled: false,
        enabled,
        blob,
      };
      jobs.push(job);
      return {
        result: new Promise((resolve) => {
          job.finish = resolve;
        }),
        cancel: () => {
          job.cancelled = true;
        },
      };
    },
  );
  const blob = new Blob(["same recording"]);
  session.setBlob(blob);
  session.setSingle(true);
  session.run();
  assert.equal(jobs[0].enabled, false);
  session.setNoiseReduction(true);
  assert.equal(jobs[0].cancelled, true);
  jobs[0].finish(analyze(noisyVowel().samples));
  await Promise.resolve();
  assert.equal(session.snapshot().result.status, "NOT_ANALYZED");
  session.run();
  assert.equal(jobs[1].enabled, true);
  assert.equal(jobs[1].blob, blob);
  jobs[1].finish(emptyAnalysis("pron-tone-2-v1", "ANALYZED"));
  await Promise.resolve();
  session.setNoiseReduction(false);
  assert.equal(session.snapshot().previous, null);
  session.clear();
  assert.equal(session.snapshot().noiseReduction, false);
});
