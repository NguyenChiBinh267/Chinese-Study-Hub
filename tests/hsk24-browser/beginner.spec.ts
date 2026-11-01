import { test, expect } from "@playwright/test";
import { layout } from "../helpers/draft-journey";
test.beforeAll(async ({ request }, testInfo) => {
  // Report compilation separately; keep the actual browser/API limits at 15s.
  const observations = [];
  for (const path of [
    "/onboarding",
    "/api/local/mode",
    "/api/local/snapshot",
    "/learn/courses/FOUNDATION",
    "/learn/courses/HSK1",
    "/learn/draft/F03",
    "/api/local/content/f03-draft-v1",
    "/api/local/content/f03-draft-v1/start",
    "/api/local/content/sessions/00000000-0000-4000-8000-000000000001/advance",
  ]) {
    const started = Date.now(),
      r = await request.get(path, { timeout: 60000 });
    observations.push({
      path,
      status: r.status(),
      milliseconds: Date.now() - started,
    });
  }
  await testInfo.attach("read-only-route-initialization", {
    body: JSON.stringify(observations),
    contentType: "application/json",
  });
});

test("Beginner bridge resumes from the saved current version and readable shell works at either width", async ({
  page,
}, testInfo) => {
  await page.goto("/onboarding");
  await page
    .getByRole("button", { name: "Bắt đầu học có lưu", exact: true })
    .click();
  await expect(page).toHaveURL(/\/schedule(?:\?|$)/);
  await page.goto("/learn/courses/FOUNDATION");
  await expect(
    page.getByRole("heading", { name: "Bắt đầu từ nền tảng", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("F03–F05 bổ sung", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("mục tiêu tương lai, chưa có bài", { exact: false }),
  ).toHaveCount(0);
  await page.goto("/learn/draft/F03");
  const start = page.getByRole("button", {
    name: /^(Bắt đầu học F03|Luyện lại bài nháp)$/,
  });
  await expect(start.or(page.locator(".exercise"))).toBeVisible();
  if (await start.isVisible()) await start.click();
  await expect(page.locator(".exercise")).toHaveAttribute("aria-busy", "false");
  const progress = page.getByRole("progressbar", { name: "Các bước bài nháp" });
  const cursor = Number(await progress.getAttribute("aria-valuenow"));
  await page
    .getByRole("button", { name: "Đã đọc · tiếp tục", exact: true })
    .click();
  await expect(progress).toHaveAttribute("aria-valuenow", String(cursor + 1));
  await page.reload();
  await expect(page.locator(".exercise")).toHaveAttribute("aria-busy", "false");
  await expect(progress).toHaveAttribute("aria-valuenow", String(cursor + 1));
  await page.goto("/learn/courses/HSK1");
  const guide = page.getByRole("region", { name: "Lộ trình cho người mới" });
  await expect(
    guide.getByRole("link", { name: /Tiếp tục: F03/ }),
  ).toHaveAttribute("href", /version=f03-draft-v1/);
  await layout(page);
  const metrics = await page.evaluate(() => ({
    breadcrumb: getComputedStyle(document.querySelector(".breadcrumb")!)
      .fontSize,
    badge: getComputedStyle(document.querySelector(".preview-indicator")!)
      .fontSize,
    body: getComputedStyle(document.querySelector(".data-mode p")!).fontSize,
    current: document
      .querySelector(".breadcrumb strong")!
      .getBoundingClientRect().width,
    space: document.querySelector(".breadcrumb")!.getBoundingClientRect().width,
    context: getComputedStyle(document.querySelector(".breadcrumb-context")!)
      .display,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  expect(metrics.breadcrumb).toBe("14px");
  expect(metrics.badge).toBe("14px");
  expect(metrics.body).toBe("16px");
  expect(metrics.overflow).toBe(false);
  if (testInfo.project.name === "mobile360") {
    expect(metrics.context).toBe("none");
    expect(metrics.current).toBeLessThanOrEqual(metrics.space);
  }
  await testInfo.attach("typography", {
    body: JSON.stringify(metrics),
    contentType: "application/json",
  });
  const screenshot = testInfo.outputPath("readable-shell.png");
  await page.screenshot({ path: screenshot });
  await testInfo.attach("readable-shell", {
    path: screenshot,
    contentType: "image/png",
  });
});
