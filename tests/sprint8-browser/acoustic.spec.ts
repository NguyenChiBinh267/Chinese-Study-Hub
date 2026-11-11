import { test, expect, type Page } from "@playwright/test";
import { layout } from "../helpers/draft-journey";
import { syntheticVowel } from "../fixtures/synthetic-vowel";
import { noisyVowel } from "../fixtures/noisy-vowel";

async function local(page: Page, target = "pron-tone-2-v1") {
  await page.goto(`/learn/pronunciation?target=${target}`);
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  await expect(page.locator("[data-note-version]")).toBeVisible();
}
// This replaces the microphone SOURCE only. Actual MediaRecorder, Opus decoding,
// browser worker, pitchy engine and production UI remain unmocked.
async function syntheticMicrophone(
  page: Page,
  mode: "rise" | "level" | "silence" | "formants" | "noisy" = "rise",
) {
  await page.addInitScript(
    ({ mode, voiceSamples }) => {
      const traces = {
        calls: 0,
        constraints: [] as MediaStreamConstraints[],
        streams: [] as MediaStream[],
        contexts: [] as AudioContext[],
        urls: [] as string[],
        revoked: [] as string[],
      };
      Object.assign(window, { __acoustic: traces });
      const make = URL.createObjectURL.bind(URL),
        revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        const url = make(blob);
        traces.urls.push(url);
        return url;
      };
      URL.revokeObjectURL = (url) => {
        traces.revoked.push(url);
        revoke(url);
      };
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        traces.calls++;
        traces.constraints.push(constraints ?? {});
        const context = new AudioContext(),
          destination = context.createMediaStreamDestination(),
          gain = context.createGain();
        await context.resume();
        let source: OscillatorNode | AudioBufferSourceNode;
        if (mode === "formants" || mode === "noisy") {
          const buffer = context.createBuffer(1, voiceSamples.length, 24000);
          buffer.copyToChannel(Float32Array.from(voiceSamples), 0);
          const player = context.createBufferSource();
          player.buffer = buffer;
          source = player;
        } else {
          const oscillator = context.createOscillator();
          oscillator.frequency.setValueAtTime(150, context.currentTime);
          if (mode === "rise")
            oscillator.frequency.exponentialRampToValueAtTime(
              300,
              context.currentTime + 1.4,
            );
          source = oscillator;
        }
        gain.gain.value =
          mode === "silence"
            ? 0
            : mode === "formants" || mode === "noisy"
              ? 1
              : 0.22;
        source.connect(gain).connect(destination);
        source.start();
        const stream = destination.stream;
        traces.streams.push(stream);
        traces.contexts.push(context);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => {
            stop();
            source.stop();
            void context.close();
          };
        }
        return stream;
      };
    },
    {
      mode,
      voiceSamples:
        mode === "noisy"
          ? Array.from(noisyVowel(0.12, 0.015).samples)
          : mode === "formants"
            ? Array.from(syntheticVowel())
            : [],
    },
  );
}
async function record(page: Page, ms = 1300) {
  const name = (await page
    .getByRole("button", { name: "Ghi lại · bỏ bản cũ", exact: true })
    .count())
    ? "Ghi lại · bỏ bản cũ"
    : "Ghi âm · tối đa 12 giây";
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.locator(".pron-recorder")).toHaveAttribute(
    "data-recorder-state",
    "recording",
  );
  await page.waitForTimeout(ms);
  await page.getByRole("button", { name: "Dừng ghi", exact: true }).click();
  await expect(page.locator(".pron-recorder")).toHaveAttribute(
    "data-recorder-state",
    "ready",
  );
}
const scopeLabel = "Tôi chỉ đọc một âm tiết riêng, không đọc câu hoặc nhiều âm";
const referenceLabel = "Tôi đã im lặng nửa giây đầu để lấy mẫu tiếng nền";

test("Excerpt playback uses the selected utterance, real WAV/audio, original comparison and stable capture requests, with no upload", async ({
  page,
}) => {
  await syntheticMicrophone(page, "noisy");
  await local(page);
  const writes: string[] = [],
    errors: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(r.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await record(page, 1700);
  const original = page.getByLabel("Bản thu tạm của bạn", { exact: true });
  const originalUrl = await original.getAttribute("src");
  await page.getByLabel(referenceLabel, { exact: true }).check();
  await page
    .getByRole("button", { name: "Tách đoạn đọc", exact: true })
    .click();
  await expect(page.locator("[data-utterance-phase]")).toHaveAttribute(
    "data-utterance-phase",
    "ready",
  );
  await expect(page.locator(".utterance-editor")).toHaveAttribute(
    "data-playback-noise",
    "APPLIED",
  );
  const excerpt = page.getByLabel("Đoạn đọc đã chọn", { exact: true });
  await expect(excerpt).toBeVisible();
  await expect(original).toHaveAttribute("src", originalUrl!);
  await original.evaluate((audio: HTMLAudioElement) => audio.play());
  await excerpt.evaluate((audio: HTMLAudioElement) => audio.play());
  await expect
    .poll(() => original.evaluate((audio: HTMLAudioElement) => audio.paused))
    .toBe(true);
  await expect
    .poll(() => excerpt.evaluate((audio: HTMLAudioElement) => audio.paused))
    .toBe(false);
  await excerpt.evaluate((audio: HTMLAudioElement) => audio.pause());
  const firstUrl = await excerpt.getAttribute("src");
  await page.getByLabel("Đầu đoạn (giây)", { exact: true }).fill("0.50");
  await page.getByLabel("Cuối đoạn (giây)", { exact: true }).fill("1.20");
  await expect(excerpt).toHaveCount(0);
  await page
    .getByRole("button", { name: "Tạo lại đoạn nghe", exact: true })
    .click();
  await expect(excerpt).toBeVisible();
  await expect
    .poll(() => excerpt.evaluate((audio: HTMLAudioElement) => audio.duration))
    .toBeCloseTo(0.7, 2);
  expect(await excerpt.getAttribute("src")).not.toBe(firstUrl);
  await page
    .getByLabel("Giảm tiếng nền trong đoạn chọn", { exact: true })
    .uncheck();
  await page
    .getByRole("button", { name: "Tạo lại đoạn nghe", exact: true })
    .click();
  await expect(page.locator(".utterance-editor")).toContainText(
    "Đoạn đã cắt, giữ âm thanh gốc",
  );
  await page.getByLabel("Cuối đoạn (giây)", { exact: true }).fill("0.10");
  await page
    .getByRole("button", { name: "Tạo lại đoạn nghe", exact: true })
    .click();
  await expect(excerpt).toHaveCount(0);
  await expect(page.locator(".utterance-preview")).toContainText(
    "Chọn đoạn dài từ 0,15 đến 3,5 giây",
  );
  await page.getByLabel("Cuối đoạn (giây)", { exact: true }).fill("");
  await layout(page);
  const capture = await page.evaluate(() => {
    const state = (
      window as unknown as {
        __acoustic: { calls: number; constraints: MediaStreamConstraints[] };
      }
    ).__acoustic;
    return { calls: state.calls, constraints: state.constraints };
  });
  expect(capture).toEqual({
    calls: 1,
    constraints: [
      {
        audio: {
          autoGainControl: false,
          noiseSuppression: false,
          echoCancellation: false,
          channelCount: 1,
        },
        video: false,
      },
    ],
  });
  await page.getByRole("button", { name: "Xóa bản thu", exact: true }).click();
  await expect(page.locator("audio")).toHaveCount(0);
  const revoked = await page.evaluate(() => {
    const state = (
      window as unknown as { __acoustic: { urls: string[]; revoked: string[] } }
    ).__acoustic;
    return state.urls.every((url) => state.revoked.includes(url));
  });
  expect(revoked).toBe(true);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("Silence has no automatic utterance claim; manual selection works and background cleanup discards both playback versions", async ({
  page,
}) => {
  await syntheticMicrophone(page, "silence");
  await local(page);
  await record(page);
  await page
    .getByRole("button", { name: "Tách đoạn đọc", exact: true })
    .click();
  await expect(page.locator("[data-utterance-phase]")).toHaveAttribute(
    "data-utterance-phase",
    "ready",
  );
  await expect(page.locator(".utterance-preview")).toContainText(
    "Chưa có đoạn đề xuất đủ rõ",
  );
  await expect(
    page.getByLabel("Đoạn đọc đã chọn", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Đầu đoạn (giây)", { exact: true }).fill("0.20");
  await page.getByLabel("Cuối đoạn (giây)", { exact: true }).fill("0.80");
  await page
    .getByRole("button", { name: "Tạo lại đoạn nghe", exact: true })
    .click();
  await expect(
    page.getByLabel("Đoạn đọc đã chọn", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("audio")).toHaveCount(0);
  await expect(page.locator(".utterance-preview")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = (
          window as unknown as {
            __acoustic: {
              contexts: AudioContext[];
              urls: string[];
              revoked: string[];
            };
          }
        ).__acoustic;
        return (
          state.contexts.every((context) => context.state === "closed") &&
          state.urls.every((url) => state.revoked.includes(url))
        );
      }),
    )
    .toBe(true);
});

test("Excerpt decode failure, cancellation and target switch cannot publish stale playback", async ({
  page,
}) => {
  await syntheticMicrophone(page, "level");
  await local(page);
  await record(page);
  await page.evaluate(() => {
    OfflineAudioContext.prototype.decodeAudioData = () =>
      Promise.reject(new DOMException("codec", "EncodingError"));
  });
  await page
    .getByRole("button", { name: "Tách đoạn đọc", exact: true })
    .click();
  await expect(page.locator("[data-utterance-phase]")).toHaveAttribute(
    "data-utterance-phase",
    "error",
  );
  await expect(
    page.getByLabel("Bản thu tạm của bạn", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    OfflineAudioContext.prototype.decodeAudioData = () => new Promise(() => {});
  });
  await page
    .getByRole("button", { name: "Tách đoạn đọc", exact: true })
    .click();
  await expect(page.locator("[data-utterance-phase]")).toHaveAttribute(
    "data-utterance-phase",
    "processing",
  );
  await page
    .getByRole("button", { name: "Hủy tách đoạn", exact: true })
    .click();
  await expect(page.locator("[data-utterance-phase]")).toHaveAttribute(
    "data-utterance-phase",
    "idle",
  );
  await page
    .getByRole("button", { name: "Tách đoạn đọc", exact: true })
    .click();
  await expect(page.locator("[data-utterance-phase]")).toHaveAttribute(
    "data-utterance-phase",
    "error",
    { timeout: 12000 },
  );
  await expect(page.locator(".utterance-preview")).toContainText(
    "Xử lý quá thời gian",
  );
  await page
    .getByRole("button", { name: "Tách đoạn đọc", exact: true })
    .click();
  await page
    .getByLabel("Chọn âm hoặc thanh", { exact: true })
    .selectOption("pron-tone-3-v1");
  await expect(page.locator("audio")).toHaveCount(0);
  await expect(page.locator(".utterance-preview")).toHaveCount(0);
});
const noiseLabel =
  "Lọc tiếng nền đều · thử nghiệm (tôi để im lặng đầu bản thu)";

test("Optional noise reduction runs through Opus/worker, reanalyzes the same original recording and clears on deletion", async ({
  page,
}) => {
  await syntheticMicrophone(page, "noisy");
  await local(page);
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(r.url());
  });
  await page.getByLabel(scopeLabel, { exact: true }).check();
  await expect(page.getByLabel(noiseLabel, { exact: true })).not.toBeChecked();
  await record(page, 1700);
  const originalUrl = await page.locator("audio").getAttribute("src");
  await expect(page.locator(".pitch-technical")).toContainText(
    "Chưa có phép đo cho bản hiện tại",
  );
  await page.getByLabel(noiseLabel, { exact: true }).focus();
  await page.keyboard.press("Space");
  await page
    .getByRole("button", { name: "Phân tích cao độ", exact: true })
    .click();
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "ANALYZED",
  );
  await expect(page.locator("[data-pitch=current]")).toHaveAttribute(
    "d",
    /^M.+L/,
  );
  await page.locator(".pitch-technical summary").click();
  await expect(page.locator("[data-noise-status]")).toHaveAttribute(
    "data-noise-status",
    "APPLIED",
  );
  await expect(page.locator(".pitch-technical")).toContainText(
    "csh-pitch-observation-v3",
  );
  await expect(page.locator(".pitch-exclusions")).toContainText(
    "NOISE_REFERENCE",
  );
  await expect(page.locator("audio")).toHaveAttribute("src", originalUrl!);
  await layout(page);
  await page.getByLabel(noiseLabel, { exact: true }).uncheck();
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "NOT_ANALYZED",
  );
  await page
    .getByRole("button", { name: "Phân tích cao độ", exact: true })
    .click();
  await expect(page.locator(".acoustic-practice")).not.toHaveAttribute(
    "data-analysis-status",
    "PROCESSING",
  );
  await expect(page.locator("[data-noise-status]")).toHaveAttribute(
    "data-noise-status",
    "OFF",
  );
  await expect(page.locator("audio")).toHaveAttribute("src", originalUrl!);
  const calls = await page.evaluate(
    () =>
      (window as unknown as { __acoustic: { calls: number } }).__acoustic.calls,
  );
  expect(calls).toBe(1);
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "Xóa bản thu", exact: true }).click();
  await expect(page.getByLabel(noiseLabel, { exact: true })).not.toBeChecked();
  await expect(page.locator(".pitch-chart")).toHaveCount(0);
});

test("V2 processes a generated multi-harmonic modulated vowel through real MediaRecorder/Opus/worker, with no pronunciation verdict", async ({
  page,
}) => {
  await syntheticMicrophone(page, "formants");
  await local(page);
  await page.getByLabel(scopeLabel, { exact: true }).check();
  await record(page);
  await page
    .getByRole("button", { name: "Phân tích cao độ", exact: true })
    .click();
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "ANALYZED",
  );
  await expect(page.locator("[data-pitch=current]")).toHaveAttribute(
    "d",
    /^M.+L/,
  );
  await expect(page.locator(".pitch-feedback")).toContainText("cao hơn đầu âm");
  await page.locator(".pitch-technical summary").click();
  await expect(page.locator(".pitch-technical")).toContainText(
    "csh-pitch-observation-v3",
  );
  await expect(page.locator(".pitch-technical")).toContainText(
    "Độ tuần hoàn sau lọc",
  );
  await expect(page.locator(".pitch-boundary")).toContainText(
    "chưa được hiệu chuẩn",
  );
  await expect(page.locator(".pitch-feedback")).not.toContainText(
    "phát âm đúng",
  );
  await layout(page);
});

test("Recorded Opus → real decode → worker F0 graph; retry/two-attempt comparison, keyboard/zoom/axe/privacy", async ({
  page,
}, info) => {
  await syntheticMicrophone(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await local(page);
  const before = await (await page.request.get("/api/local/snapshot")).json();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __acoustic: { calls: number } }).__acoustic
          .calls,
    ),
  ).toBe(0);
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(r.url());
  });
  await page.getByLabel(scopeLabel, { exact: true }).check();
  await record(page);
  await page.getByRole("button", { name: "Nghe bản thu", exact: true }).click();
  await expect
    .poll(() =>
      page.locator("audio").evaluate((a: HTMLAudioElement) => a.paused),
    )
    .toBe(false);
  await page
    .getByRole("button", { name: "Tạm dừng nghe", exact: true })
    .click();
  const analysis = page.getByRole("button", {
    name: "Phân tích cao độ",
    exact: true,
  });
  await analysis.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "ANALYZED",
  );
  await expect(page.locator("[data-pitch=current]")).toHaveAttribute(
    "d",
    /^M.+L/,
  );
  await expect(page.locator(".pitch-feedback")).toContainText("cao hơn đầu âm");
  await expect(page.locator(".pitch-boundary")).toContainText(
    "chưa được hiệu chuẩn",
  );
  await page.getByRole("slider", { name: "Xem từng mốc đo" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".pitch-readout")).toContainText("Hz");
  await page
    .getByRole("button", {
      name: "Ghi lần tiếp · giữ đường để so",
      exact: true,
    })
    .click();
  await expect(page.locator(".pron-recorder")).toHaveAttribute(
    "data-recorder-state",
    "recording",
  );
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Dừng ghi", exact: true }).click();
  await expect(page.locator(".pron-recorder")).toHaveAttribute(
    "data-recorder-state",
    "ready",
  );
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "NOT_ANALYZED",
  );
  await expect(page.locator(".pitch-scope")).toContainText(
    "Đường nét đứt bên dưới thuộc lần trước",
  );
  await analysis.click();
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "ANALYZED",
  );
  await expect(page.locator("[data-pitch=previous]")).toHaveAttribute(
    "d",
    /^M.+L/,
  );
  expect(
    Number(
      await page.locator(".pitch-chart").getAttribute("data-previous-frames"),
    ),
  ).toBeGreaterThan(40);
  await layout(page);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await layout(page);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  await page.screenshot({
    path: `docs/sprint8/evidence/${info.project.name}-comparison.png`,
    fullPage: true,
  });
  await page.locator(".pitch-chart").screenshot({
    path: `docs/sprint8/evidence/${info.project.name}-chart.png`,
  });
  await page
    .getByRole("button", { name: "Bỏ đường của lần trước", exact: true })
    .click();
  await expect(page.locator("[data-pitch=previous]")).toHaveCount(0);
  await page.getByRole("button", { name: "Xóa bản thu", exact: true }).click();
  await expect(page.locator("audio")).toHaveCount(0);
  await expect(page.locator(".pitch-chart")).toHaveCount(0);
  const tracked = await page.evaluate(() => {
    const s = (
      window as unknown as {
        __acoustic: {
          streams: MediaStream[];
          urls: string[];
          revoked: string[];
        };
      }
    ).__acoustic;
    return {
      ended: s.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
      revoked: s.urls.every((u) => s.revoked.includes(u)),
    };
  });
  expect(tracked).toEqual({ ended: true, revoked: true });
  const after = await (await page.request.get("/api/local/snapshot")).json();
  expect(after.progress).toEqual(before.progress);
  expect(after.learning.reviews).toEqual(before.learning.reviews);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});
test("Silence and absent declaration abstain; static notes/neutral/context never claim one-syllable diagnosis", async ({
  page,
}) => {
  await syntheticMicrophone(page, "silence");
  await local(page);
  await record(page);
  await page
    .getByRole("button", { name: "Phân tích cao độ", exact: true })
    .click();
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "UNSUPPORTED_TARGET",
  );
  await page.getByLabel(scopeLabel, { exact: true }).check();
  await page
    .getByRole("button", { name: "Phân tích cao độ", exact: true })
    .click();
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "INSUFFICIENT_SIGNAL",
  );
  await expect(page.locator(".pitch-feedback")).toContainText(
    "chưa nghe đủ rõ",
  );
  await expect(page.locator(".pitch-feedback")).toContainText(
    "dưới ngưỡng âm lượng",
  );
  await page.locator(".pitch-technical summary").click();
  await expect(page.locator(".pitch-exclusions")).toContainText("QUIET");
  await expect(page.locator(".pitch-exclusions")).toContainText(
    "Được giữ lại: 0/",
  );
  await expect(page.locator("[data-pitch=current]")).toHaveAttribute("d", "");
  const select = page.getByLabel("Chọn âm hoặc thanh", { exact: true });
  for (const id of ["pron-p-v1", "pron-tone-neutral-v1", "pron-nihao-v1"]) {
    // Exact note IDs come from the existing pinned release, not new content.
    const option = select.locator(`option[value="${id}"]`);
    await expect(option).toHaveCount(1);
    await select.selectOption(id);
    await expect(page.locator(".pitch-scope")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Phân tích cao độ", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".pron-quick")).not.toBeEmpty();
  }
});
test("Decode failure, unsupported Web Audio and cancellation have recoverable states without fabricated curves", async ({
  page,
}) => {
  await syntheticMicrophone(page, "level");
  await local(page);
  await page.getByLabel(scopeLabel, { exact: true }).check();
  await record(page);
  await page.evaluate(() => {
    OfflineAudioContext.prototype.decodeAudioData = () =>
      Promise.reject(new DOMException("test codec", "EncodingError"));
  });
  await page
    .getByRole("button", { name: "Phân tích cao độ", exact: true })
    .click();
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "ANALYSIS_FAILED",
  );
  await expect(page.locator(".pitch-chart")).toHaveCount(0);
  await expect(page.locator("audio")).toBeVisible();
  await page.evaluate(() => {
    OfflineAudioContext.prototype.decodeAudioData = () => new Promise(() => {});
  });
  await page
    .getByRole("button", { name: "Phân tích cao độ", exact: true })
    .click();
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "PROCESSING",
  );
  await page
    .getByRole("button", { name: "Hủy phân tích", exact: true })
    .click();
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "NOT_ANALYZED",
  );
  await page.evaluate(() => {
    Object.defineProperty(window, "OfflineAudioContext", {
      value: undefined,
      configurable: true,
    });
  });
  await page
    .getByRole("button", { name: "Phân tích cao độ", exact: true })
    .click();
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "ANALYSIS_FAILED",
  );
  await page.getByRole("button", { name: "Xóa bản thu", exact: true }).click();
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "NOT_ANALYZED",
  );
});
test("Analysis timeout and navigation/target cleanup stop pending publication and release recording resources", async ({
  page,
}) => {
  await syntheticMicrophone(page, "level");
  await local(page);
  await page.getByLabel(scopeLabel, { exact: true }).check();
  await record(page);
  await page.evaluate(() => {
    OfflineAudioContext.prototype.decodeAudioData = () => new Promise(() => {});
  });
  await page
    .getByRole("button", { name: "Phân tích cao độ", exact: true })
    .click();
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "ANALYSIS_FAILED",
    { timeout: 12000 },
  );
  await expect(page.locator(".pitch-chart")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Phân tích cao độ", exact: true })
    .click();
  await page
    .getByLabel("Chọn âm hoặc thanh", { exact: true })
    .selectOption("pron-tone-3-v1");
  await expect(page.locator("audio")).toHaveCount(0);
  await expect(page.locator(".pitch-chart")).toHaveCount(0);
  await page
    .getByRole("link", { name: "Về khóa Nền tảng", exact: true })
    .click();
  await expect(page).toHaveURL(/FOUNDATION/);
  const ended = await page.evaluate(() =>
    (
      window as unknown as { __acoustic: { streams: MediaStream[] } }
    ).__acoustic.streams.every((s) =>
      s.getTracks().every((t) => t.readyState === "ended"),
    ),
  );
  expect(ended).toBe(true);
});
