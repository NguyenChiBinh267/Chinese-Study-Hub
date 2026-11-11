import test from "node:test";
import assert from "node:assert/strict";
import {
  PilotSession,
  hardwareStatus,
  pilotReport,
  measurementSummary,
  type PilotMeta,
} from "../../src/modules/pronunciation/domain/pilot";
import { compareAttempts } from "../../src/modules/pronunciation/domain/compare-attempts";
import { analyzeSamples } from "../../src/modules/pronunciation/domain/acoustic-engine";
import { emptyAnalysis } from "../../src/modules/pronunciation/domain/acoustic-types";
import { toneFeedback } from "../../src/modules/pronunciation/domain/tone-feedback";
import { monitorInput } from "../../src/modules/pronunciation/application/input-monitor";
function rise(slope = 0.6) {
  let phase = 0;
  return Float32Array.from({ length: 24000 }, (_, i) => {
    phase += (2 * Math.PI * 150 * 2 ** ((slope * i) / 24000)) / 24000;
    return 0.2 * Math.sin(phase);
  });
}
const valid = () => analyzeSamples(rise(), 24000, "pron-tone-2-v1", true);
const meta: PilotMeta = {
  platform: "WINDOWS",
  browser: "unit fixture",
  microphone: "generated source",
  source: "SYNTHETIC",
};
test("Pilot attempts cap at three per supported target; changing metadata cannot relabel existing synthetic evidence or reuse late result IDs", () => {
  const session = new PilotSession();
  session.setMeta(meta);
  const first = session.begin("pron-tone-2-v1")!;
  session.begin("pron-tone-2-v1");
  session.begin("pron-tone-2-v1");
  assert.equal(session.begin("pron-tone-2-v1"), null);
  assert.equal(session.begin("pron-p-v1"), null);
  assert.ok(session.begin("pron-tone-3-v1"));
  session.setMeta({ ...meta, source: "PHYSICAL_OWNER_DECLARED" });
  assert.equal(session.snapshot().attempts.length, 0);
  const next = session.begin("pron-tone-2-v1")!;
  assert.ok(next > first);
  session.update(first, { measurement: measurementSummary(valid()) });
  assert.equal(session.snapshot().attempts[0].measurement, null);
});
test("Synthetic/manual PASS never becomes hardware PASS; physical status is strictly owner reported with all required checks and no phonetic accuracy claim", () => {
  const session = new PilotSession();
  session.setMeta(meta);
  const id = session.begin("pron-tone-2-v1")!;
  session.update(id, {
    outcome: "PASS",
    permission: "GRANTED",
    recording: "ready",
    playedToEnd: true,
    clarity: "CLEAR",
    graph: "MATCHES",
    feedback: "CLEAR",
    measurement: measurementSummary(valid()),
  });
  const rows = session.snapshot().attempts;
  assert.equal(hardwareStatus(meta, rows, "WINDOWS"), "NOT_TESTED");
  const physical = { ...meta, source: "PHYSICAL_OWNER_DECLARED" as const };
  assert.equal(
    hardwareStatus(physical, rows, "WINDOWS"),
    "OWNER_REPORTED_PASS",
  );
  assert.equal(hardwareStatus(physical, rows, "ANDROID"), "NOT_TESTED");
  assert.equal(
    hardwareStatus(physical, [{ ...rows[0], playedToEnd: false }], "WINDOWS"),
    "NOT_TESTED",
  );
  assert.equal(
    hardwareStatus(
      physical,
      [
        {
          ...rows[0],
          measurement: measurementSummary(
            emptyAnalysis("pron-tone-2-v1", "INSUFFICIENT_SIGNAL"),
          ),
        },
      ],
      "WINDOWS",
    ),
    "NOT_TESTED",
  );
  const report = pilotReport(meta, rows);
  assert.equal(report.phoneticAccuracy, "UNVERIFIED");
  assert.equal(report.audioIncluded, false);
  assert.ok(!JSON.stringify(report).includes('"frames":'));
  assert.ok(!JSON.stringify(report).includes('"raw":'));
});
test("Two-attempt prose requires reliable comparable measurements; no progress percentage, anatomy or proficiency verdict", () => {
  const first = valid(),
    later = analyzeSamples(rise(0.9), 24000, "pron-tone-2-v1", true);
  assert.match(compareAttempts(later, first), /xu hướng lên lớn hơn/);
  for (const bad of [
    emptyAnalysis("pron-tone-2-v1"),
    { ...first, warnings: ["CLIPPED"] },
    { ...first, movementSemitones: NaN },
  ])
    assert.match(compareAttempts(bad, first), /Chưa đủ dữ liệu/);
  assert.match(
    compareAttempts({ ...later, targetVersion: "pron-tone-1-v1" }, first),
    /khác mục tiêu/,
  );
  assert.match(
    compareAttempts({ ...later, algorithm: "other" }, first),
    /khác mục tiêu/,
  );
  assert.match(
    compareAttempts({ ...first, observation: "FALLING" }, first),
    /khác nhau/,
  );
});
test("Every feedback state has three useful parts; long nucleus and unstable tracking do not become syllable/anatomy diagnoses", () => {
  for (const status of [
    "NOT_ANALYZED",
    "PROCESSING",
    "ANALYZED",
    "INSUFFICIENT_SIGNAL",
    "UNSUPPORTED_TARGET",
    "ANALYSIS_FAILED",
  ] as const) {
    const feedback = toneFeedback({ ...valid(), status });
    for (const value of Object.values(feedback)) assert.ok(value.length > 10);
  }
  const long = toneFeedback({
    ...valid(),
    status: "UNSUPPORTED_TARGET",
    reason: "POSSIBLE_MULTIPLE_SYLLABLES",
  });
  assert.match(long.summary, /vượt phạm vi/);
  const unstable = toneFeedback({
    ...valid(),
    status: "INSUFFICIENT_SIGNAL",
    warnings: ["UNSTABLE_TRACKING"],
  });
  assert.match(unstable.action, /dao động mạnh/);
});
test("Level meter owns no microphone, emits measured power without speaker connection and cleans contexts on stop and partial setup failure", () => {
  const originalContext = globalThis.AudioContext,
    raf = globalThis.requestAnimationFrame,
    caf = globalThis.cancelAnimationFrame;
  let callback: FrameRequestCallback = () => {},
    closed = 0,
    disconnected = 0,
    failed = false;
  const levels: { rms: number; peak: number }[] = [];
  class Context {
    createMediaStreamSource() {
      if (failed) throw Error("unsupported stream");
      return {
        connect: () => {},
        disconnect: () => {
          disconnected++;
        },
      };
    }
    createAnalyser() {
      return {
        fftSize: 1024,
        getFloatTimeDomainData: (samples: Float32Array) => samples.fill(0.2),
        disconnect: () => {
          disconnected++;
        },
      };
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      closed++;
      return Promise.resolve();
    }
  }
  try {
    globalThis.AudioContext = Context as unknown as typeof AudioContext;
    globalThis.requestAnimationFrame = (fn) => {
      callback = fn;
      return 1;
    };
    globalThis.cancelAnimationFrame = () => {};
    const stop = monitorInput({} as MediaStream, (level) => levels.push(level));
    callback(200);
    assert.ok(Math.abs(levels[0].rms - 0.2) < 1e-6);
    stop();
    stop();
    callback(400);
    assert.equal(levels.length, 1);
    assert.equal(closed, 1);
    assert.equal(disconnected, 2);
    failed = true;
    monitorInput({} as MediaStream, () => {});
    assert.equal(closed, 2);
  } finally {
    globalThis.AudioContext = originalContext;
    globalThis.requestAnimationFrame = raf;
    globalThis.cancelAnimationFrame = caf;
  }
});
