import test from "node:test";
import assert from "node:assert/strict";
import {
  prepareUtterance,
  excerptWav,
  type PreparedUtterance,
} from "../../src/modules/pronunciation/domain/utterance-playback";
import { noisyVowel } from "../fixtures/noisy-vowel";
import { UtteranceSession } from "../../src/modules/pronunciation/application/utterance-session";
import {
  preparePlayback,
  type PlaybackPreparation,
} from "../../src/modules/pronunciation/application/prepare-playback";

test("One known generated event gets a padded editable proposal; background and ambiguous separate events never become verified user speech", () => {
  const fixture = noisyVowel(0.04, 0),
    before = fixture.samples.slice();
  const prepared = prepareUtterance(fixture.samples, 24000, true)!;
  assert.equal(prepared.noise.status, "APPLIED");
  assert.ok(prepared.suggested);
  assert.ok(prepared.suggested.start >= 0.3 && prepared.suggested.start <= 0.4);
  assert.ok(prepared.suggested.end >= 1.4 && prepared.suggested.end <= 1.6);
  assert.deepEqual(fixture.samples, before);
  const two = new Float32Array(72000);
  two.set(fixture.clean.slice(9600, 33600), 9600);
  two.set(fixture.clean.slice(9600, 33600), 43200);
  assert.equal(prepareUtterance(two, 24000, true)!.suggested, null);
  assert.equal(
    prepareUtterance(new Float32Array(24000), 24000, true)!.suggested,
    null,
  );
  assert.equal(
    prepareUtterance(fixture.samples, 24000, false)!.noise.status,
    "OFF",
  );
  const transient = fixture.samples.slice();
  transient.fill(0.6, 0, 1200);
  assert.equal(
    prepareUtterance(transient, 24000, true)!.noise.status,
    "BYPASSED_NO_REFERENCE",
  );
});

test("PCM16 excerpt preserves time/sample amplitude in the interior, excludes leading noise and uses only a short edge fade", () => {
  const fixture = noisyVowel(),
    prepared = prepareUtterance(fixture.samples, 24000, true)!;
  const before = prepared.raw.slice(),
    filteredBefore = prepared.filtered.slice();
  const wav = new DataView(
    excerptWav(prepared, { start: 0.5, end: 1.3 }, false),
  );
  assert.equal(wav.getUint32(24, true), 24000);
  assert.equal(wav.getUint32(40, true), 19200 * 2);
  assert.equal(wav.byteLength, 44 + 19200 * 2);
  for (const i of [240, 2400, 10000, 18000]) {
    const actual = wav.getInt16(44 + i * 2, true) / 32768;
    assert.ok(Math.abs(actual - prepared.raw[12000 + i]) < 0.00007);
  }
  assert.equal(wav.getInt16(44, true), 0);
  assert.equal(wav.getInt16(wav.byteLength - 2, true), 0);
  const cleanWav = new DataView(
    excerptWav(prepared, { start: 0.5, end: 1.3 }, true),
  );
  assert.notEqual(cleanWav.getInt16(524, true), wav.getInt16(524, true));
  assert.deepEqual(prepared.raw, before);
  assert.deepEqual(prepared.filtered, filteredBefore);
  for (const range of [
    { start: NaN, end: 1 },
    { start: 0, end: Infinity },
    { start: -1, end: 1 },
    { start: 1, end: 0.5 },
    { start: 0, end: 0.01 },
    { start: 0, end: 4 },
  ])
    assert.throws(() => excerptWav(prepared, range, true));
  assert.throws(() => prepareUtterance(new Float32Array(0), 24000, true));
  assert.throws(() =>
    prepareUtterance(new Float32Array(24000).fill(NaN), 24000, true),
  );
  assert.throws(() => prepareUtterance(new Float32Array(1200001), 24000, true));
  assert.throws(() => prepareUtterance(fixture.samples, NaN, true));
  assert.equal(
    prepareUtterance(fixture.samples, 24000, true, () => true),
    null,
  );
});

test("Excerpt session ignores cancelled preparation, revokes replaced/invalidated URLs and drops all decoded PCM on dispose", async () => {
  const jobs: {
    finish: (r: PlaybackPreparation) => void;
    cancelled: boolean;
  }[] = [];
  const revoked: string[] = [],
    blobs: Blob[] = [];
  const session = new UtteranceSession(
    () => {
      const job: (typeof jobs)[number] = { finish: () => {}, cancelled: false };
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
    {
      create: (blob) => {
        blobs.push(blob);
        return `blob:excerpt-${blobs.length}`;
      },
      revoke: (url) => revoked.push(url),
    },
  );
  const fixture = prepareUtterance(noisyVowel().samples, 24000, true)!;
  session.run(new Blob(["recording"]), true);
  session.clear();
  assert.equal(jobs[0].cancelled, true);
  jobs[0].finish({ ok: true, data: fixture });
  await Promise.resolve();
  assert.equal(session.snapshot().data, null);
  session.run(new Blob(["recording"]), true);
  jobs[1].finish({ ok: true, data: fixture });
  await Promise.resolve();
  assert.equal(session.snapshot().url, "blob:excerpt-1");
  assert.equal(blobs[0].type, "audio/wav");
  session.discardExcerpt();
  assert.deepEqual(revoked, ["blob:excerpt-1"]);
  session.build({ start: 0.5, end: 1 }, true);
  session.build({ start: 1, end: 0.5 }, true);
  assert.equal(session.snapshot().url, null);
  assert.match(session.snapshot().message, /Chọn đoạn/);
  assert.deepEqual(revoked, ["blob:excerpt-1", "blob:excerpt-2"]);
  session.dispose();
  assert.equal(session.snapshot().data, null);
});

test("Playback preparation bounds and cancellation prevent late decode/worker output from publishing", async () => {
  const originalContext = globalThis.OfflineAudioContext,
    originalWorker = globalThis.Worker;
  let resolveDecode: (data: unknown) => void = () => {},
    created = 0,
    terminated = 0;
  class Context {
    decodeAudioData() {
      return new Promise((resolve) => {
        resolveDecode = resolve;
      });
    }
  }
  class Port {
    onmessage: ((e: { data: PlaybackPreparation }) => void) | null = null;
    onerror: ((e: { preventDefault: () => void }) => void) | null = null;
    static last: Port;
    constructor() {
      created++;
      Port.last = this;
    }
    postMessage() {}
    terminate() {
      terminated++;
    }
  }
  const decoded = {
    duration: 1,
    numberOfChannels: 1,
    length: 24000,
    sampleRate: 24000,
    getChannelData: () => new Float32Array(24000),
  };
  try {
    globalThis.OfflineAudioContext =
      Context as unknown as typeof OfflineAudioContext;
    globalThis.Worker = Port as unknown as typeof Worker;
    const job = preparePlayback(new Blob(["test"]), true);
    await new Promise((resolve) => setImmediate(resolve));
    job.cancel();
    resolveDecode(decoded);
    await job.result;
    await Promise.resolve();
    assert.equal(created, 0);
    const next = preparePlayback(new Blob(["test"]), false);
    await new Promise((resolve) => setImmediate(resolve));
    resolveDecode(decoded);
    await Promise.resolve();
    assert.equal(created, 1);
    next.cancel();
    assert.equal(terminated, 1);
    Port.last.onmessage?.({
      data: { ok: true, data: {} as PreparedUtterance },
    });
    assert.equal((await next.result).ok, false);
    const invalid = await preparePlayback(new Blob([]), true).result;
    assert.equal(invalid.ok, false);
    const oversized = await preparePlayback(
      new Blob([new Uint8Array(2097153)]),
      true,
    ).result;
    assert.equal(oversized.ok, false);
  } finally {
    globalThis.OfflineAudioContext = originalContext;
    globalThis.Worker = originalWorker;
  }
});
