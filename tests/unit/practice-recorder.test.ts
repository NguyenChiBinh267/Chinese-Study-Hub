import test from "node:test";
import assert from "node:assert/strict";
import {
  PracticeRecorder,
  MAX_RECORDING_MS,
  MAX_RECORDING_BYTES,
  type RecorderEnvironment,
  type RecorderState,
  browserRecorderEnvironment,
  CAPTURE_CONSTRAINTS,
} from "../../src/modules/pronunciation/application/practice-recorder";

test("Browser capture requests AGC/NS/AEC off as best effort and never re-enables them as a hidden fallback", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const received: MediaStreamConstraints[] = [];
  try {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: async (constraints: MediaStreamConstraints) => {
            received.push(constraints);
            return {} as MediaStream;
          },
        },
      },
    });
    await browserRecorderEnvironment().getStream();
    assert.deepEqual(received, [
      {
        audio: {
          autoGainControl: false,
          noiseSuppression: false,
          echoCancellation: false,
          channelCount: 1,
        },
        video: false,
      },
    ]);
    assert.ok(Object.isFrozen(CAPTURE_CONSTRAINTS));
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});

test("Explicit capture noise suppression is requested for the recorded stream without enabling AGC/AEC or silently retrying another mode", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const requests: MediaStreamConstraints[] = [];
  try {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: async (constraints: MediaStreamConstraints) => {
            requests.push(constraints);
            return {} as MediaStream;
          },
        },
      },
    });
    await browserRecorderEnvironment(true).getStream();
    await browserRecorderEnvironment(false).getStream();
    assert.deepEqual(
      requests,
      [true, false].map((noiseSuppression) => ({
        audio: { ...CAPTURE_CONSTRAINTS, noiseSuppression },
        video: false,
      })),
    );
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});

function harness() {
  const states: RecorderState[] = [],
    urls: string[] = [],
    revoked: string[] = [];
  const timers: { fn: () => void; ms: number; cleared: boolean }[] = [];
  let allowed = true,
    secure = true,
    foreground = true,
    calls = 0;
  const track = {
    readyState: "live",
    stop() {
      this.readyState = "ended";
    },
  };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  class FakeMediaRecorder {
    state = "inactive";
    mimeType = "audio/webm";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["synthetic unit-test bytes"]) });
      this.onstop?.();
    }
  }
  let media = new FakeMediaRecorder();
  const env: RecorderEnvironment = {
    secure: () => secure,
    foreground: () => foreground,
    supported: () => allowed,
    getStream: async () => {
      calls++;
      return stream;
    },
    create: () => {
      media = new FakeMediaRecorder();
      return media as unknown as MediaRecorder;
    },
    objectUrl: () => {
      const url = `blob:unit-${urls.length}`;
      urls.push(url);
      return url;
    },
    revoke: (url) => revoked.push(url),
    later: (fn, ms) => {
      const timer = { fn, ms, cleared: false };
      timers.push(timer);
      return timer as unknown as ReturnType<typeof setTimeout>;
    },
    clear: (timer) => {
      (timer as unknown as { cleared: boolean }).cleared = true;
    },
  };
  return {
    env,
    states,
    track,
    stream,
    timers,
    urls,
    revoked,
    get media() {
      return media;
    },
    get calls() {
      return calls;
    },
    setSupported(v: boolean) {
      allowed = v;
    },
    setSecure(v: boolean) {
      secure = v;
    },
    setForeground(v: boolean) {
      foreground = v;
    },
    recorder() {
      return new PracticeRecorder(env, (state) => states.push(state));
    },
  };
}
test("No permission on construction; explicit recording → stop → temporary playback URL → delete", async () => {
  const h = harness(),
    r = h.recorder();
  assert.equal(h.calls, 0);
  assert.equal(r.snapshot().status, "idle");
  await r.start();
  assert.equal(h.calls, 1);
  assert.equal(r.snapshot().status, "recording");
  await r.start();
  assert.equal(h.calls, 1);
  r.stop();
  assert.equal(h.track.readyState, "ended");
  assert.equal(r.snapshot().status, "ready");
  assert.equal(h.urls.length, 1);
  r.cancel();
  assert.deepEqual(h.revoked, h.urls);
  assert.equal(r.snapshot().status, "idle");
  assert.ok(h.timers.every((t) => t.cleared));
});

test("A failing level-meter cleanup cannot keep physical tracks alive or prevent recording completion", async () => {
  const h = harness();
  h.env.monitor = () => () => {
    throw new Error("meter disconnect failed");
  };
  const recorder = h.recorder();
  await recorder.start();
  recorder.stop();
  assert.equal(h.track.readyState, "ended");
  assert.equal(recorder.snapshot().status, "ready");
  assert.ok(h.timers.every((timer) => timer.cleared));
  recorder.dispose();
});
test("Conservative 12-second limit stops actual tracks; no codec callback cannot keep the mic alive", async () => {
  const h = harness(),
    r = h.recorder();
  await r.start();
  const limit = h.timers.find((t) => t.ms === MAX_RECORDING_MS)!;
  assert.equal(limit.ms, 12000);
  limit.fn();
  assert.equal(h.track.readyState, "ended");
  assert.equal(r.snapshot().status, "ready");
  const h2 = harness(),
    r2 = h2.recorder();
  await r2.start();
  h2.media.stop = () => {
    h2.media.state = "inactive";
  };
  r2.stop();
  assert.equal(h2.track.readyState, "ended");
  assert.equal(r2.snapshot().status, "stopping");
  h2.timers.find((t) => t.ms === 3000)!.fn();
  assert.equal(r2.snapshot().status, "error");
  assert.equal(h2.urls.length, 0);
});
test("Insecure, unsupported, hidden, denied and absent microphones keep guidance independent", async () => {
  for (const option of ["secure", "supported", "foreground"]) {
    const h = harness();
    if (option === "secure") h.setSecure(false);
    if (option === "supported") h.setSupported(false);
    if (option === "foreground") h.setForeground(false);
    const r = h.recorder();
    await r.start();
    assert.equal(h.calls, 0);
    assert.equal(r.snapshot().status, "error");
  }
  for (const name of ["NotAllowedError", "NotFoundError", "NotReadableError"]) {
    const h = harness();
    h.env.getStream = async () => {
      throw new DOMException("unit failure", name);
    };
    const r = h.recorder();
    await r.start();
    assert.equal(r.snapshot().status, "error");
    assert.equal(h.urls.length, 0);
  }
});
test("Cancel while permission pending stops a late granted stream without starting recording", async () => {
  const h = harness();
  let grant: (stream: MediaStream) => void = () => {};
  h.env.getStream = () =>
    new Promise((resolve) => {
      grant = resolve;
    });
  const r = h.recorder(),
    starting = r.start();
  assert.equal(r.snapshot().status, "requesting");
  r.cancel();
  grant(h.stream);
  await starting;
  assert.equal(h.track.readyState, "ended");
  assert.equal(r.snapshot().status, "idle");
  assert.equal(h.urls.length, 0);
});
test("Unmount while requesting or recording cleans tracks and prevents late UI callbacks", async () => {
  const h = harness();
  let grant: (stream: MediaStream) => void = () => {};
  h.env.getStream = () =>
    new Promise((resolve) => {
      grant = resolve;
    });
  const r = h.recorder(),
    starting = r.start();
  r.dispose();
  const n = h.states.length;
  grant(h.stream);
  await starting;
  assert.equal(h.track.readyState, "ended");
  assert.equal(h.states.length, n);
  const h2 = harness(),
    r2 = h2.recorder();
  await r2.start();
  r2.dispose();
  assert.equal(h2.track.readyState, "ended");
  assert.ok(h2.timers.every((t) => t.cleared));
  assert.equal(h2.urls.length, 0);
});
test("Byte cap and recorder failures discard audio and stop tracks rather than uploading/logging", async () => {
  const h = harness(),
    r = h.recorder();
  await r.start();
  h.media.ondataavailable?.({
    data: new Blob([new Uint8Array(MAX_RECORDING_BYTES + 1)]),
  });
  assert.equal(r.snapshot().status, "error");
  assert.equal(h.track.readyState, "ended");
  assert.equal(h.urls.length, 0);
  const h2 = harness(),
    r2 = h2.recorder();
  await r2.start();
  h2.media.onerror?.();
  assert.equal(r2.snapshot().status, "error");
  assert.equal(h2.track.readyState, "ended");
});
test("Re-record revokes the old URL; disposing ready playback also revokes it", async () => {
  const h = harness(),
    r = h.recorder();
  await r.start();
  r.stop();
  await r.start();
  assert.deepEqual(h.revoked, [h.urls[0]]);
  r.stop();
  r.dispose();
  assert.deepEqual(h.revoked, h.urls);
});
test("Hidden while permission pending cannot silently begin background capture", async () => {
  const h = harness();
  let grant: (stream: MediaStream) => void = () => {};
  h.env.getStream = () =>
    new Promise((resolve) => {
      grant = resolve;
    });
  const r = h.recorder(),
    starting = r.start();
  h.setForeground(false);
  grant(h.stream);
  await starting;
  assert.equal(h.track.readyState, "ended");
  assert.equal(r.snapshot().status, "idle");
  assert.equal(h.urls.length, 0);
});
