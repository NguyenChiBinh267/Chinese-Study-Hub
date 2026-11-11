import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSamples } from "../../src/modules/pronunciation/domain/acoustic-engine";
import {
  ACOUSTIC_POLICY as P,
  emptyAnalysis,
  supportedTone,
  type AcousticResult,
} from "../../src/modules/pronunciation/domain/acoustic-types";
import {
  toneFeedback,
  frameExclusions,
} from "../../src/modules/pronunciation/domain/tone-feedback";
import {
  analyzeRecording,
  type AnalysisJob,
} from "../../src/modules/pronunciation/application/analyze-recording";
import { AcousticSession } from "../../src/modules/pronunciation/application/acoustic-session";
import { contourPath } from "../../src/modules/pronunciation/ui/pitch-chart";

export function signal(
  frequency: (t: number) => number = () => 220,
  seconds = 1,
  amplitude = 0.2,
) {
  let phase = 0;
  return Float32Array.from({ length: Math.round(24000 * seconds) }, (_, i) => {
    phase += (2 * Math.PI * frequency(i / 24000)) / 24000;
    return amplitude * (Math.sin(phase) + 0.15 * Math.sin(phase * 2));
  });
}
const analyze = (data: Float32Array) =>
  analyzeSamples(data, 24000, "pron-tone-2-v1", true);
test("MPM estimates known F0 across broad voice pitches; within-speaker normalization is zero-centered", () => {
  for (const hz of [65, 110, 220, 440, 700]) {
    const r = analyze(signal(() => hz));
    assert.equal(r.status, "ANALYZED");
    assert.ok(
      Math.abs(r.baselineHz! - hz) < hz * 0.015,
      `${hz}: ${r.baselineHz}`,
    );
    assert.equal(r.observation, "LEVEL");
    assert.ok(
      r.frames.every(
        (f) => f.f0Hz === null || Math.abs(f.relativeSemitones!) < 0.1,
      ),
    );
    assert.ok(r.voicedCoverage > 0.95);
    assert.equal(r.pronunciationVerified, false);
    assert.equal(r.masteryEligible, false);
  }
});
test("Actual synthetic rising/falling samples produce correct movement, timestamps and bounded periodicity", () => {
  for (const [direction, f] of [
    ["RISING", (t: number) => 150 * 2 ** (t * 0.6)],
    ["FALLING", (t: number) => 300 * 2 ** (-t * 0.6)],
  ] as const) {
    const r = analyze(signal(f));
    assert.equal(r.status, "ANALYZED");
    assert.equal(r.observation, direction);
    assert.ok(Math.abs(r.movementSemitones!) > 4);
    assert.ok(
      r.frames.every(
        (f, i) =>
          f.timeSeconds > 0 &&
          (!i || f.timeSeconds > r.frames[i - 1].timeSeconds),
      ),
    );
    assert.ok(
      r.frames.every(
        (f) =>
          f.periodicity === null || (f.periodicity >= 0 && f.periodicity <= 1),
      ),
    );
  }
});
test("Silence, quiet audio, short utterance and insufficient voiced duration abstain without invented F0", () => {
  for (const data of [
    new Float32Array(24000),
    signal(() => 220, 1, 0.00001),
    signal(() => 220, 0.02),
    signal(() => 220, 0.18),
  ]) {
    const r = analyze(data);
    assert.equal(r.status, "INSUFFICIENT_SIGNAL");
    assert.equal(r.observation, null);
    assert.match(
      toneFeedback(r).summary,
      r.frames.some((f) => f.voiced)
        ? /đo được một phần cao độ/
        : /chưa nghe đủ rõ/,
    );
  }
  assert.ok(
    analyze(new Float32Array(24000)).frames.every(
      (f) => f.f0Hz === null && f.relativeSemitones === null,
    ),
  );
});

test("Frame rejection diagnostics distinguish quiet from failed pitch tracking without relaxing thresholds or diagnosing pronunciation", () => {
  const silence = analyze(new Float32Array(23040));
  const counts = frameExclusions(silence);
  assert.equal(silence.frames.length, 88);
  assert.equal(counts.QUIET, 88);
  assert.equal(counts.LOW_PERIODICITY, 0);
  assert.equal(
    Object.values(counts).reduce((a, b) => a + b, 0),
    88,
  );
  assert.match(toneFeedback(silence).action, /dưới ngưỡng âm lượng/);
  const tracking = {
    ...silence,
    frames: silence.frames.map((f) => ({
      ...f,
      excluded: "LOW_PERIODICITY" as const,
      periodicity: 0.7,
    })),
  };
  assert.equal(frameExclusions(tracking).QUIET, 0);
  assert.equal(frameExclusions(tracking).LOW_PERIODICITY, 88);
  assert.match(toneFeedback(tracking).action, /chưa chứng minh bạn đọc sai/);
  assert.match(toneFeedback(tracking).retry, /không cần cố đọc lớn hơn/);
  assert.match(
    toneFeedback({ ...silence, warnings: ["CLIPPED"] }).action,
    /biên độ/,
  );
  assert.match(
    toneFeedback({ ...silence, reason: "TOO_SHORT" }).action,
    /quá ngắn/,
  );
  assert.equal(P.minRms, 0.008);
  assert.equal(P.minClarity, 0.9);
  assert.equal(tracking.masteryEligible, false);
});
test("Seeded noise abstains; noisy but periodic input is measured without inventing SNR", () => {
  let seed = 92731;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32 - 0.5;
  };
  assert.equal(
    analyze(Float32Array.from({ length: 24000 }, () => random() * 0.4)).status,
    "INSUFFICIENT_SIGNAL",
  );
  const noisy = signal();
  for (let i = 0; i < noisy.length; i++) noisy[i] += random() * 0.015;
  const r = analyze(noisy);
  assert.equal(r.status, "ANALYZED");
  assert.ok(Math.abs(r.baselineHz! - 220) < 3);
  assert.ok(!("snr" in r));
});
test("Clipping and octave ambiguity abstain rather than automatically repairing pitch", () => {
  const clipped = signal(() => 220, 1, 2);
  for (let i = 0; i < clipped.length; i++)
    clipped[i] = Math.max(-1, Math.min(1, clipped[i]));
  const c = analyze(clipped);
  assert.equal(c.status, "INSUFFICIENT_SIGNAL");
  assert.ok(c.warnings.includes("CLIPPED"));
  const r = analyze(signal((t) => (t < 0.5 ? 220 : 440)));
  assert.equal(r.status, "INSUFFICIENT_SIGNAL");
  assert.ok(r.warnings.includes("OCTAVE_AMBIGUITY"));
  assert.ok(
    r.frames.some((f) => f.excluded === "OCTAVE_JUMP" && f.f0Hz === null),
  );
});
test("Interrupted voicing retains chart gaps and ambiguous segmentation abstains", () => {
  const data = signal(() => 220, 1.3);
  data.fill(0, 12000, 19200);
  const r = analyze(data);
  assert.equal(r.status, "INSUFFICIENT_SIGNAL");
  assert.ok(r.warnings.includes("AMBIGUOUS_SEGMENTATION"));
  assert.ok(r.frames.some((f) => f.f0Hz === null));
  const path = contourPath(
    r.frames,
    (n) => n,
    (n) => n,
  );
  assert.ok((path.match(/M/g) ?? []).length >= 2);
  assert.ok(!/NaN|Infinity/.test(path));
});
test("Unsupported neutral/context/initial targets, missing single-syllable declaration and long nuclei never receive single-tone rules", () => {
  for (const target of [
    "pron-neutral-v1",
    "pron-nihao-v1",
    "pron-p-v1",
    "pron-tone-5-v1",
    "pron-tone-2-v2",
  ]) {
    assert.equal(supportedTone(target), null);
    assert.equal(
      analyzeSamples(signal(), 24000, target, true).status,
      "UNSUPPORTED_TARGET",
    );
  }
  assert.equal(
    analyzeSamples(signal(), 24000, "pron-tone-2-v1", false).status,
    "UNSUPPORTED_TARGET",
  );
  assert.equal(analyze(signal(() => 220, 3)).status, "UNSUPPORTED_TARGET");
});
test("Invalid/oversize PCM, cooperative cancellation and time bounds", () => {
  assert.equal(
    analyzeSamples(signal(), NaN, "pron-tone-2-v1", true).status,
    "ANALYSIS_FAILED",
  );
  const invalid = signal();
  invalid[100] = NaN;
  assert.equal(analyze(invalid).status, "ANALYSIS_FAILED");
  assert.equal(analyze(signal(() => 220, 12.6)).reason, "SAMPLE_LIMIT");
  assert.equal(
    analyzeSamples(signal(), 24000, "pron-tone-2-v1", true, () => true).reason,
    "CANCELLED",
  );
  const start = performance.now();
  analyze(signal(() => 220, 12));
  assert.ok(performance.now() - start < P.timeoutMs);
});
test("Feedback remains an experimental observation; no score, anatomy diagnosis, mastery or connected-third-tone requirement", () => {
  const r = analyze(signal());
  const copy = toneFeedback(r);
  assert.match(copy.summary, /thay đổi ít/);
  assert.match(copy.action, /nhấc giọng/);
  const unknown = toneFeedback({ ...r, warnings: ["CLIPPED"] });
  assert.match(unknown.summary, /chưa nghe đủ rõ/);
  assert.ok(!/đúng|sai|lưỡi|môi|bật hơi|%/.test(copy.summary));
  assert.ok(!("score" in r));
  assert.equal(r.masteryEligible, false);
  for (const status of [
    "NOT_ANALYZED",
    "PROCESSING",
    "INSUFFICIENT_SIGNAL",
    "UNSUPPORTED_TARGET",
    "ANALYSIS_FAILED",
  ] as const) {
    const f = toneFeedback(emptyAnalysis("pron-tone-3-v1", status));
    assert.ok(
      f.summary.length > 15 && f.action.length > 15 && f.retry.length > 15,
    );
  }
  assert.match(
    toneFeedback({ ...r, targetVersion: "pron-tone-3-v1" }).action,
    /không.*bắt buộc/,
  );
});
test("Decoder rejects unsupported capability, empty/oversize audio; cancelled work produces no late result", async () => {
  assert.equal(
    (await analyzeRecording(new Blob(), "pron-tone-2-v1", true).result).reason,
    "ENCODED_SIZE",
  );
  assert.equal(
    (
      await analyzeRecording(
        new Blob([new Uint8Array(P.maxEncodedBytes + 1)]),
        "pron-tone-2-v1",
        true,
      ).result
    ).reason,
    "ENCODED_SIZE",
  );
  assert.equal(
    (await analyzeRecording(new Blob(["audio"]), "pron-tone-2-v1", true).result)
      .reason,
    "BROWSER_UNSUPPORTED",
  );
  assert.equal(
    (await analyzeRecording(new Blob(["audio"]), "pron-p-v1", true).result)
      .status,
    "UNSUPPORTED_TARGET",
  );
});
test("Session isolates cancelled decoder results, compares only two numeric observations and clears on deletion/dispose", async () => {
  const work: {
    finish: (result: AcousticResult) => void;
    cancelled: boolean;
  }[] = [];
  const adapter = (): AnalysisJob => {
    const row: {
      finish: (result: AcousticResult) => void;
      cancelled: boolean;
    } = { finish: () => {}, cancelled: false };
    work.push(row);
    return {
      result: new Promise((resolve) => {
        row.finish = resolve;
      }),
      cancel: () => {
        row.cancelled = true;
      },
    };
  };
  const session = new AcousticSession("pron-tone-2-v1", adapter),
    blob = new Blob(["test"]);
  session.setBlob(blob);
  session.setSingle(true);
  session.run();
  assert.equal(session.snapshot().result.status, "PROCESSING");
  session.cancel();
  work[0].finish(analyze(signal()));
  await Promise.resolve();
  assert.equal(session.snapshot().result.status, "NOT_ANALYZED");
  assert.ok(work[0].cancelled);
  session.run();
  work[1].finish(analyze(signal()));
  await Promise.resolve();
  assert.equal(session.snapshot().result.status, "ANALYZED");
  session.setBlob(null);
  assert.ok(session.snapshot().previous?.frames.length);
  assert.equal(session.snapshot().result.frames.length, 0);
  session.setBlob(new Blob(["new"]));
  session.run();
  work[2].finish(analyze(signal((t) => 150 * 2 ** (t * 0.6))));
  await Promise.resolve();
  assert.ok(session.snapshot().previous);
  session.forgetPrevious();
  assert.equal(session.snapshot().previous, null);
  session.clear();
  assert.equal(session.snapshot().result.frames.length, 0);
  assert.equal(session.snapshot().single, false);
  session.dispose();
});

test("Decode bounds/failure and worker termination: cancel invalidates late messages and avoids creating a worker after cancelled decode", async () => {
  const originalContext = globalThis.OfflineAudioContext,
    originalWorker = globalThis.Worker;
  let mode = "normal",
    terminated = 0,
    created = 0;
  const workers: {
    onmessage: ((event: { data: AcousticResult }) => void) | null;
    onerror: ((event: { preventDefault: () => void }) => void) | null;
  }[] = [];
  class Context {
    async decodeAudioData() {
      if (mode === "broken") throw new Error("test unsupported codec");
      return {
        duration: mode === "long" ? 30 : 1,
        numberOfChannels: 1,
        length: 24000,
        sampleRate: 24000,
        getChannelData: () => signal(),
      };
    }
  }
  class WorkerPort {
    onmessage: ((event: { data: AcousticResult }) => void) | null = null;
    onerror: ((event: { preventDefault: () => void }) => void) | null = null;
    constructor() {
      created++;
      workers.push(this);
    }
    postMessage() {}
    terminate() {
      terminated++;
    }
  }
  try {
    globalThis.OfflineAudioContext =
      Context as unknown as typeof OfflineAudioContext;
    globalThis.Worker = WorkerPort as unknown as typeof Worker;
    const blob = new Blob(["encoded test"]);
    mode = "broken";
    assert.equal(
      (await analyzeRecording(blob, "pron-tone-2-v1", true).result).reason,
      "DECODE_FAILED",
    );
    mode = "long";
    assert.equal(
      (await analyzeRecording(blob, "pron-tone-2-v1", true).result).reason,
      "DECODED_SIZE",
    );
    mode = "normal";
    const work = analyzeRecording(blob, "pron-tone-2-v1", true);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(created, 1);
    work.cancel();
    assert.equal((await work.result).reason, "CANCELLED");
    assert.equal(terminated, 1);
    workers[0].onmessage?.({ data: analyze(signal()) });
    assert.equal((await work.result).reason, "CANCELLED");
    const late = analyzeRecording(blob, "pron-tone-2-v1", true);
    late.cancel();
    await late.result;
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(created, 1);
    const error = analyzeRecording(blob, "pron-tone-2-v1", true);
    await new Promise((resolve) => setTimeout(resolve, 10));
    workers[1].onerror?.({ preventDefault: () => {} });
    assert.equal((await error.result).reason, "WORKER_FAILED");
    assert.equal(terminated, 2);
  } finally {
    globalThis.OfflineAudioContext = originalContext;
    globalThis.Worker = originalWorker;
  }
});
