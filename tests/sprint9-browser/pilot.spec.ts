import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { layout } from "../helpers/draft-journey";
async function setup(page: Page, denied = false) {
  await page.addInitScript(
    ({ denied }) => {
      Object.assign(window, { __pilotCalls: 0, __pilotConstraints: [] });
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        (
          window as unknown as { __pilotConstraints: MediaStreamConstraints[] }
        ).__pilotConstraints.push(constraints ?? {});
        (window as unknown as { __pilotCalls: number }).__pilotCalls++;
        if (denied)
          throw new DOMException(
            "simulated permission denial",
            "NotAllowedError",
          );
        const context = new AudioContext(),
          osc = context.createOscillator(),
          gain = context.createGain(),
          destination = context.createMediaStreamDestination();
        await context.resume();
        osc.frequency.setValueAtTime(150, context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
          280,
          context.currentTime + 1.2,
        );
        gain.gain.value = 0.22;
        osc.connect(gain).connect(destination);
        osc.start();
        for (const track of destination.stream.getTracks()) {
          // Deliberately report NS off: requested constraints are not proof of
          // actual denoising. Generated audio here receives no browser NS.
          track.getSettings = () => ({ noiseSuppression: false });
          const stop = track.stop.bind(track);
          track.stop = () => {
            stop();
            osc.stop();
            void context.close();
          };
        }
        return destination.stream;
      };
    },
    { denied },
  );
  await page.goto("/learn/pronunciation?pilot=1&target=pron-tone-2-v1");
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  await expect(page.locator(".pilot-panel")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Thiết bị", exact: true })
    .selectOption("WINDOWS");
  await page
    .getByLabel("Trình duyệt / phiên bản", { exact: true })
    .fill("Chromium synthetic test");
  await page
    .getByLabel("Micro đang dùng", { exact: true })
    .fill("Generated oscillator, not hardware");
  await page
    .getByRole("combobox", { name: "Nguồn âm thanh", exact: true })
    .selectOption("SYNTHETIC");
  await page
    .getByRole("button", { name: "Lưu thiết lập pilot trong tab", exact: true })
    .click();
}
async function recordAndAnalyze(page: Page) {
  const again = await page
    .getByRole("button", { name: "Ghi lại · bỏ bản cũ", exact: true })
    .count();
  await page
    .getByRole("button", {
      name: again ? "Ghi lại · bỏ bản cũ" : "Ghi âm · tối đa 12 giây",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Mức tín hiệu micro · không phải điểm phát âm", {
      exact: true,
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("meter")
        .evaluate((element: HTMLMeterElement) => element.value),
    )
    .toBeGreaterThan(0.01);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Dừng ghi", exact: true }).click();
  const analysis = page.getByRole("button", {
    name: "Phân tích cao độ",
    exact: true,
  });
  await expect(analysis).toBeDisabled();
  await page.getByRole("button", { name: "Nghe lại", exact: true }).click();
  await expect(analysis).toBeEnabled();
  await page
    .getByLabel("Tôi chỉ đọc một âm tiết riêng, không đọc câu hoặc nhiều âm", {
      exact: true,
    })
    .check();
  await analysis.click();
  await expect(page.locator(".acoustic-practice")).toHaveAttribute(
    "data-analysis-status",
    "ANALYZED",
  );
}
test("Synthetic pilot through real recorder/worker: listen gate, input meter, notes/actions, two curves, metadata export and no hardware/mastery claim", async ({
  page,
}, info) => {
  await setup(page);
  const before = await (await page.request.get("/api/local/snapshot")).json();
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(r.url());
  });
  await recordAndAnalyze(page);
  await expect(
    page.getByRole("heading", { name: "App nghe thấy gì?", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xem cách sửa", exact: true }).click();
  await expect(
    page
      .getByText("Xem một động tác để thử sửa", { exact: true })
      .locator(".."),
  ).toHaveAttribute("open", "");
  await page
    .getByRole("button", { name: "Xem khẩu hình", exact: true })
    .click();
  await expect(page.locator(".pron-visuals")).toBeInViewport();
  await recordAndAnalyze(page);
  await expect(page.locator("[data-pitch=previous]")).toHaveAttribute(
    "d",
    /^M.+L/,
  );
  await expect(page.locator(".pitch-comparison")).not.toContainText(
    "Chưa đủ dữ liệu",
  );
  await page
    .getByRole("combobox", { name: "Nghe lại có rõ giọng không?", exact: true })
    .selectOption("CLEAR");
  await page
    .getByRole("combobox", {
      name: "Đồ thị khớp hướng giọng bạn nghe?",
      exact: true,
    })
    .selectOption("MATCHES");
  await page
    .getByRole("combobox", { name: "Nhận xét có dễ hiểu?", exact: true })
    .selectOption("CLEAR");
  await page
    .getByRole("combobox", { name: "Kết luận lượt thử", exact: true })
    .selectOption("PASS");
  await layout(page);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await layout(page);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Tải báo cáo pilot JSON · không có audio",
      exact: true,
    })
    .click();
  const download = await downloadPromise;
  const path = info.outputPath("pilot-synthetic.json");
  await download.saveAs(path);
  const report = JSON.parse(await readFile(path, "utf8"));
  expect(report.windowsMicrophone).toBe("NOT_TESTED");
  expect(report.phoneticAccuracy).toBe("UNVERIFIED");
  expect(report.audioIncluded).toBe(false);
  expect(report.attempts).toHaveLength(2);
  expect(report.attempts[1].noiseSuppressionRequested).toBe(true);
  expect(report.attempts[1].noiseSuppressionReported).toBe(false);
  expect(JSON.stringify(report)).not.toContain('"frames":');
  expect(writes).toEqual([]);
  const after = await (await page.request.get("/api/local/snapshot")).json();
  expect(after.progress).toEqual(before.progress);
  expect(after.learning.reviews).toEqual(before.learning.reviews);
});

test("Pilot requests browser noise suppression for the shared recording, reports an ignored setting honestly and clears old audio/curves when mode changes", async ({
  page,
}) => {
  await setup(page);
  const mode = page.getByRole("checkbox", {
    name: "Giảm ồn khi thu · trình duyệt xử lý",
    exact: true,
  });
  await expect(mode).toBeChecked();
  await recordAndAnalyze(page);
  await expect(page.locator(".capture-noise-status")).toContainText(
    "đã yêu cầu: Bật. Trình duyệt báo: Tắt.",
  );
  await expect(page.locator(".capture-noise-status")).toContainText(
    "Chưa xác nhận khử nhiễu",
  );
  const calls = () =>
    page.evaluate(
      () => (window as unknown as { __pilotCalls: number }).__pilotCalls,
    );
  expect(await calls()).toBe(1);
  await mode.uncheck();
  await expect(page.locator(".pron-recorder")).toHaveAttribute(
    "data-recorder-state",
    "idle",
  );
  await expect(
    page.getByLabel("Bản thu tạm của bạn", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator("[data-pitch=current], [data-pitch=previous]"),
  ).toHaveCount(0);
  expect(await calls()).toBe(1);
  await recordAndAnalyze(page);
  const requests = await page.evaluate(
    () =>
      (window as unknown as { __pilotConstraints: MediaStreamConstraints[] })
        .__pilotConstraints,
  );
  expect(requests.map((request) => request.audio)).toEqual(
    [true, false].map((noiseSuppression) => ({
      noiseSuppression,
      autoGainControl: false,
      echoCancellation: false,
      channelCount: 1,
    })),
  );
  await expect(page.locator("[data-pitch=previous]")).toHaveCount(0);
  await layout(page);
});
test("Pilot counts denied attempts, caps each target at three, preserves report across targets and never opens mic on entry", async ({
  page,
}) => {
  await setup(page, true);
  expect(
    await page.evaluate(
      () => (window as unknown as { __pilotCalls: number }).__pilotCalls,
    ),
  ).toBe(0);
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Ghi âm · tối đa 12 giây", exact: true })
      .click();
    await expect(page.locator(".pron-recorder")).toHaveAttribute(
      "data-recorder-state",
      "error",
    );
  }
  await expect(
    page.getByRole("button", { name: "Ghi âm · tối đa 12 giây", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".pilot-observation")).toContainText(
    "DENIED_OR_FAILED",
  );
  await page
    .getByRole("button", { name: "Thanh 1 · 0/3", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ghi âm · tối đa 12 giây", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".pilot-panel")).toContainText("3/12 lượt");
  await layout(page);
});

test("Optional pilot audio download saves the exact original encoded recording only on click, with no audio upload or new microphone request", async ({
  page,
}, info) => {
  await setup(page);
  const downloads: string[] = [],
    writes: string[] = [];
  page.on("download", (d) => downloads.push(d.suggestedFilename()));
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(r.url());
  });
  const link = page.getByRole("link", {
    name: "Tải audio gốc về máy",
    exact: true,
  });
  await expect(link).toHaveCount(0);
  await recordAndAnalyze(page);
  const original = await page
    .getByLabel("Bản thu tạm của bạn", { exact: true })
    .getAttribute("src");
  const before = await page.evaluate(async (url) => {
    const bytes = await (await fetch(url!)).arrayBuffer();
    return {
      hash: Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join(""),
      calls: (window as unknown as { __pilotCalls: number }).__pilotCalls,
    };
  }, original);
  expect(downloads).toEqual([]);
  await page
    .getByText("Lưu bản gốc để chẩn đoán cục bộ · tùy chọn", { exact: true })
    .click();
  await expect(link).toHaveAttribute("href", original!);
  const pending = page.waitForEvent("download");
  await link.click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(
    /^csh-pilot-original\.(webm|ogg|m4a|bin)$/,
  );
  const file = info.outputPath("synthetic-original-audio.bin");
  await download.saveAs(file);
  expect(
    createHash("sha256")
      .update(await readFile(file))
      .digest("hex"),
  ).toBe(before.hash);
  expect(writes).toEqual([]);
  expect(
    await page.evaluate(
      () => (window as unknown as { __pilotCalls: number }).__pilotCalls,
    ),
  ).toBe(before.calls);
  await layout(page);
  await page.getByRole("button", { name: "Xóa bản thu", exact: true }).click();
  await expect(link).toHaveCount(0);
});
