import { test, expect, type Page } from "@playwright/test";
import { layout, lesson } from "../helpers/draft-journey";
async function local(page: Page, url = "/learn/pronunciation") {
  await page.goto(url);
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  await expect(page.locator("[data-note-version]")).toBeVisible();
}
async function ready(page: Page) {
  await expect(page.locator(".pron-recorder")).toHaveAttribute(
    "data-recorder-state",
    "ready",
  );
}
test("Foundation entry → 31 pinned guides, distinct SVGs/tones, beginner copy, keyboard, focus, 200% and 360px", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/learn/courses/FOUNDATION");
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  await page
    .getByRole("link", {
      name: "Luyện khẩu hình và thanh điệu · draft",
      exact: true,
    })
    .click();
  await expect(page.locator("[data-note-version]")).toBeVisible();
  const select = page.getByLabel("Chọn âm hoặc thanh", { exact: true });
  await expect(select.locator("option")).toHaveCount(31);
  await expect(page.locator(".pron-advanced")).not.toHaveAttribute("open", "");
  await expect(page.locator(".pron-not-diagnosis")).toContainText(
    "chưa phải nhận xét",
  );
  const ids = await select
    .locator("option")
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value),
    );
  for (const id of ids) {
    await select.selectOption(id);
    await expect(page.locator(".pron-note")).toHaveAttribute(
      "data-note-version",
      id,
    );
    await expect(page.locator(".pron-quick")).not.toBeEmpty();
  }
  await select.selectOption("pron-p-v1");
  await expect(page.locator("[data-illustration='art-p-v1'] svg")).toHaveCount(
    3,
  );
  await layout(page);
  await page.screenshot({
    path: `docs/sprint7/evidence/${info.project.name}-p.png`,
    fullPage: true,
  });
  await select.focus();
  await expect(select).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".pron-instructions summary")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".pron-instructions details")).toHaveAttribute(
    "open",
    "",
  );
  await page
    .getByLabel("Tôi tự nhận thấy điều này và muốn thử mẹo sửa", {
      exact: true,
    })
    .check();
  await expect(page.locator(".pron-feedback")).toContainText("Bạn tự chọn");
  await select.selectOption("pron-u-ue-v1");
  await expect(page.locator(".pron-figure")).toHaveCount(2);
  await layout(page);
  await select.selectOption("pron-nihao-v1");
  await expect(page.locator(".pron-pinyin")).toContainText("nǐ hǎo");
  await expect(page.locator(".pron-pinyin")).toContainText("ní hǎo");
  await page.screenshot({
    path: `docs/sprint7/evidence/${info.project.name}-tones.png`,
    fullPage: true,
  });
  await page.evaluate(() => {
    document.body.style.zoom = "2";
  });
  await layout(page);
  const heights = await page
    .locator(".pronunciation button")
    .evaluateAll((elements) =>
      elements
        .filter((e) => e.getClientRects().length)
        .map((e) => e.getBoundingClientRect().height),
    );
  expect(heights.every((h) => h >= 44)).toBe(true);
  expect(errors).toEqual([]);
});

test("Explicit mic → real MediaRecorder synthetic stream → playback/delete/re-record, 12s cap, target/route/blur cleanup; no upload or mastery", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = {
      calls: 0,
      streams: [] as MediaStream[],
      revoked: [] as string[],
    };
    Object.assign(window, { __pronMic: state });
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      state.calls++;
      const s = await original(constraints);
      state.streams.push(s);
      return s;
    };
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      state.revoked.push(url);
      revoke(url);
    };
  });
  await local(page);
  const before = await (await page.request.get("/api/local/snapshot")).json();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __pronMic: { calls: number } }).__pronMic.calls,
    ),
  ).toBe(0);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await page
    .getByRole("button", { name: "Ghi âm · tối đa 12 giây", exact: true })
    .click();
  await expect(page.locator(".pron-recorder")).toHaveAttribute(
    "data-recorder-state",
    "recording",
  );
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Dừng ghi", exact: true }).click();
  await ready(page);
  expect(await page.locator("audio").getAttribute("src")).toMatch(/^blob:/);
  await page.getByRole("button", { name: "Nghe bản thu", exact: true }).click();
  await expect
    .poll(() =>
      page.locator("audio").evaluate((a: HTMLAudioElement) => a.paused),
    )
    .toBe(false);
  await page
    .getByRole("button", { name: "Tạm dừng nghe", exact: true })
    .click();
  await page.getByRole("button", { name: "Xóa bản thu", exact: true }).click();
  await expect(page.locator("audio")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __pronMic: { revoked: string[] } }).__pronMic
          .revoked.length,
    ),
  ).toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Ghi âm · tối đa 12 giây", exact: true })
    .click();
  await expect(page.locator(".pron-recorder")).toHaveAttribute(
    "data-recorder-state",
    "recording",
  );
  await page
    .getByLabel("Chọn âm hoặc thanh", { exact: true })
    .selectOption("pron-ue-v1");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { __pronMic: { streams: MediaStream[] } }
        ).__pronMic.streams.every((s) =>
          s.getTracks().every((t) => t.readyState === "ended"),
        ),
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Ghi âm · tối đa 12 giây", exact: true })
    .click();
  await ready(page);
  const after = await (await page.request.get("/api/local/snapshot")).json();
  expect(after.progress).toEqual(before.progress);
  expect(after.learning.reviews).toBe(before.learning.reviews);
  await page
    .getByRole("button", { name: "Ghi lại · bỏ bản cũ", exact: true })
    .click();
  await expect(page.locator(".pron-recorder")).toHaveAttribute(
    "data-recorder-state",
    "recording",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator(".pron-recorder")).toHaveAttribute(
    "data-recorder-state",
    "idle",
  );
  await page
    .getByRole("button", { name: "Ghi âm · tối đa 12 giây", exact: true })
    .click();
  await expect(page.locator(".pron-recorder")).toHaveAttribute(
    "data-recorder-state",
    "recording",
  );
  await page
    .getByRole("link", { name: "Về khóa Nền tảng", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { __pronMic: { streams: MediaStream[] } }
        ).__pronMic.streams.every((s) =>
          s.getTracks().every((t) => t.readyState === "ended"),
        ),
      ),
    )
    .toBe(true);
  expect(writes).toEqual([]);
});

test("F01/F02 inline pronunciation is optional, scoped, and existing server-graded completion still works", async ({
  page,
}) => {
  await page.goto("/learn/draft/F01");
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  const summary = page
    .locator("summary")
    .filter({ hasText: "Cách phát âm · luyện tùy chọn" });
  await summary.click();
  await expect(
    page.getByLabel("Chọn âm hoặc thanh", { exact: true }).locator("option"),
  ).toHaveCount(24);
  await summary.click();
  await expect(page.locator(".pron-note")).toHaveCount(0);
  await lesson(page, "F01");
  // Open optional guidance during a real active retry, not only before starting.
  await page
    .getByRole("button", { name: "Luyện lại bài nháp", exact: true })
    .click();
  await expect(page.locator(".exercise")).toHaveAttribute("aria-busy", "false");
  const beforeGuide = await (
    await page.request.get("/api/local/content/f01-draft-v1")
  ).json();
  await summary.click();
  await expect(page.locator(".pron-note")).toBeVisible();
  const durationWrites: string[] = [];
  const observe = (request: import("@playwright/test").Request) => {
    if (request.method() === "POST" && request.url().endsWith("/duration"))
      durationWrites.push(request.url());
  };
  page.on("request", observe);
  await page.waitForTimeout(5800);
  page.off("request", observe);
  expect(durationWrites).toEqual([]);
  const afterGuide = await (
    await page.request.get("/api/local/content/f01-draft-v1")
  ).json();
  expect(afterGuide.session.cursor).toBe(beforeGuide.session.cursor);
  expect(afterGuide.session.answers).toEqual(beforeGuide.session.answers);
  await summary.click();
  await page
    .getByRole("button", { name: "Đã đọc · tiếp tục", exact: true })
    .click();
  await expect(page.locator(".exercise")).toHaveAttribute("aria-busy", "false");
  const resumed = await (
    await page.request.get("/api/local/content/f01-draft-v1")
  ).json();
  expect(resumed.session.cursor).toBe(beforeGuide.session.cursor + 1);
  await page.goto("/learn/draft/F02");
  await summary.click();
  await expect(
    page.getByLabel("Chọn âm hoặc thanh", { exact: true }).locator("option"),
  ).toHaveCount(7);
  await page
    .getByLabel("Chọn âm hoặc thanh", { exact: true })
    .selectOption("pron-third-context-v1");
  await expect(page.locator(".pron-note")).toContainText("không ép nhấc lên");
  await summary.click();
  await lesson(page, "F02");
  const s = await (await page.request.get("/api/local/curriculum")).json();
  expect(s.courses[0].independentEvidence).toBe(0);
});

test("Loading/error/retry, forged identity, unknown target, escaped instructional text and no recording upload endpoint", async ({
  page,
}) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((r) => {
    release = r;
  });
  let fail = true;
  await page.route("**/api/local/pronunciation", async (route) => {
    if (fail) {
      await pending;
      await route.fulfill({
        status: 503,
        json: { error: { message: "Test pronunciation unavailable" } },
      });
    } else await route.continue();
  });
  await page.goto("/learn/pronunciation");
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đang đọc hướng dẫn" }),
  ).toBeVisible();
  release();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Test pronunciation unavailable" }),
  ).toBeVisible();
  fail = false;
  await page
    .getByRole("button", { name: "Thử tải hướng dẫn lại", exact: true })
    .click();
  await expect(page.locator(".pron-note")).toBeVisible();
  await page.unroute("**/api/local/pronunciation");
  expect(
    (
      await page.request.get("/api/local/pronunciation", {
        headers: { "x-owner-id": crypto.randomUUID() },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.get("/api/local/pronunciation", {
        headers: { origin: "https://invalid.example" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/local/pronunciation", {
        data: { audio: "no upload supported" },
      })
    ).status(),
  ).toBe(405);
  const anon = await page.context().browser()!.newContext();
  expect(
    (
      await anon.request.get("http://127.0.0.1:3018/api/local/pronunciation")
    ).status(),
  ).toBe(401);
  await anon.close();
  await page.goto("/learn/pronunciation?target=missing-v9");
  await expect(
    page.getByRole("heading", {
      name: "Chưa có hướng dẫn cho âm/phiên bản này",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mở hướng dẫn đầu tiên", exact: true })
    .click();
  const response = await page.request.get("/api/local/pronunciation"),
    data = await response.json();
  data.notes[0].quickTip = '<img src=x onerror="window.__badPron=true">';
  await page.route("**/api/local/pronunciation", (route) =>
    route.fulfill({ json: data }),
  );
  await page.goto("/learn/pronunciation?target=pron-b-v1");
  await expect(page.locator(".pron-quick")).toContainText("<img");
  expect(
    await page.evaluate(
      () => (window as unknown as { __badPron?: boolean }).__badPron,
    ),
  ).toBeUndefined();
});

test("Denied/absent/unsupported/insecure recording states leave diagrams and steps usable", async ({
  page,
}) => {
  for (const mode of ["denied", "missing", "unsupported", "insecure"]) {
    const probe = await page.context().newPage();
    await probe.addInitScript((mode) => {
      if (mode === "unsupported")
        Object.defineProperty(window, "MediaRecorder", {
          configurable: true,
          value: undefined,
        });
      else if (mode === "insecure")
        Object.defineProperty(window, "isSecureContext", {
          configurable: true,
          value: false,
        });
      else
        navigator.mediaDevices.getUserMedia = async () => {
          throw new DOMException(
            "Test permission/device",
            mode === "denied" ? "NotAllowedError" : "NotFoundError",
          );
        };
    }, mode);
    await local(probe);
    await probe
      .getByRole("button", { name: "Ghi âm · tối đa 12 giây", exact: true })
      .click();
    await expect(probe.locator(".pron-recorder")).toHaveAttribute(
      "data-recorder-state",
      "error",
    );
    const phrase = {
      denied: "Chưa được phép",
      missing: "Không tìm thấy micro",
      unsupported: "chưa hỗ trợ",
      insecure: "Micro cần HTTPS",
    }[mode];
    await expect(probe.locator(".pron-record-status")).toContainText(phrase!);
    await expect(probe.locator(".pron-visuals svg").first()).toBeVisible();
    await expect(
      probe.getByRole("heading", { name: "Thử từng bước", exact: true }),
    ).toBeVisible();
    await expect(probe.locator("audio")).toHaveCount(0);
    await probe.close();
  }
});
