import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  defaultPreferences,
  previewPlan,
  validatePreferences,
} from "../../src/modules/planning/domain/preview-plan";

const evidence = process.env.CSH_PREVIEW_EVIDENCE ?? "docs/preview/evidence";
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
test("planner preview: capacity, buffer, validation, per-day and session caps", () => {
  for (const hours of [0.5, 3, 6, 9, 12, 21]) {
    for (const days of [[0], [0, 2, 4], [0, 1, 2, 3, 4, 5, 6]]) {
      const plan = previewPlan({
        ...defaultPreferences,
        weeklyHours: hours,
        days,
      });
      expect(plan).not.toBeNull();
      expect(plan!.active + plan!.buffer + plan!.shortfall).toBe(plan!.target);
      expect(plan!.days.reduce((sum, day) => sum + day.minutes, 0)).toBe(
        plan!.active,
      );
      expect(
        plan!.days.every(
          (day) =>
            day.minutes <= 60 && day.blocks.every((block) => block <= 20),
        ),
      ).toBe(true);
    }
  }
  expect(
    validatePreferences({
      ...defaultPreferences,
      weeklyHours: NaN,
      days: [],
      dailyCap: 5,
    }).length,
  ).toBeGreaterThan(0);
  expect(
    previewPlan({
      ...defaultPreferences,
      weeklyHours: 6,
      days: [0, 2, 4],
      dailyCap: 90,
    }),
  ).toMatchObject({ feasible: 270, shortfall: 90, buffer: 27, active: 243 });
});

test("onboarding → impossible schedule → explicit consent → today → edit", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("radio", { name: "Tôi bắt đầu từ số 0" }),
  ).toBeChecked();
  await page.screenshot({
    path: `${evidence}/${info.project.name}-onboarding.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Thiết lập lịch học" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Dành một khoảng",
  );
  await page.getByLabel("Tối đa mỗi ngày").fill("90");
  for (const day of ["Thứ ba", "Thứ năm", "Thứ bảy"])
    await page.getByRole("checkbox", { name: day, exact: true }).uncheck();
  await expect(page.getByText("Còn 90 phút chưa xếp được")).toBeVisible();
  await page.getByRole("button", { name: "Áp dụng lịch demo" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Lịch rảnh chưa đủ",
  );
  await page.screenshot({
    path: `${evidence}/${info.project.name}-schedule.png`,
    fullPage: true,
  });
  await page
    .getByRole("checkbox", { name: "Tôi chấp nhận lịch tối đa 270 phút." })
    .check();
  await page.getByRole("button", { name: "Áp dụng lịch demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Hôm nay, mình học gì?" }),
  ).toBeVisible();
  await expect(page.getByText("270′", { exact: true })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `${evidence}/${info.project.name}-today.png`,
    fullPage: true,
  });
  await page
    .getByRole("main")
    .getByRole("link", { name: "Lịch học của tôi" })
    .click();
  await expect(page.getByLabel("Tối đa mỗi ngày")).toHaveValue("90");
  await page.getByRole("button", { name: "3 giờ / tuần" }).click();
  await page.getByRole("button", { name: "Áp dụng thay đổi demo" }).click();
  await expect(page.getByText("180′", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("schedule invalid inputs recover without silently changing preferences", async ({
  page,
}) => {
  await page.goto("/schedule");
  await page.getByLabel("Hoặc nhập số giờ").fill("0");
  await page.getByRole("button", { name: "Kiểm tra lựa chọn" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "0,5 đến 21",
  );
  await expect(page.locator("#schedule-errors")).toBeFocused();
  await page.getByLabel("Hoặc nhập số giờ").fill("3");
  for (const checkbox of await page.getByRole("checkbox").all())
    if (await checkbox.isChecked()) await checkbox.uncheck();
  await page.getByRole("button", { name: "Kiểm tra lựa chọn" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "ít nhất một ngày",
  );
  await page.getByRole("checkbox", { name: "Chủ nhật", exact: true }).check();
  await expect(page.getByText("Còn 120 phút chưa xếp được")).toBeVisible();
  await noOverflow(page);
});

test("lesson wrong answer, resume, previous step, completion, progress and reload reset", async ({
  page,
}, info) => {
  await page.goto("/learn/F01");
  await page.getByRole("button", { name: "Kiểm tra câu trả lời" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Chọn một câu trả lời",
  );
  await page.getByRole("radio", { name: "B má", exact: true }).check();
  await page.getByRole("button", { name: "Kiểm tra câu trả lời" }).click();
  await expect(page.getByRole("status")).toContainText("Chưa khớp");
  await page.screenshot({
    path: `${evidence}/${info.project.name}-lesson.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Bước tiếp theo" }).click();
  await page.getByRole("link", { name: "Tạm dừng" }).click();
  // Schedule is optional for opening the catalog. Return through actual navigation.
  const nav = page.getByRole("navigation", {
    name:
      info.project.name === "mobile"
        ? "Điều hướng di động"
        : "Điều hướng chính",
    exact: true,
  });
  await nav
    .getByRole("link", {
      name: "Học tiếng Trung",
      exact: true,
    })
    .click();
  await page
    .locator("article.lesson-card")
    .first()
    .getByRole("link", { name: "Tiếp tục thử" })
    .click();
  await expect(page.getByText("Bước 2 / 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bước trước" }).click();
  await expect(
    page.getByRole("radio", { name: "B má", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Bước tiếp theo" }).click();
  await page.getByRole("radio", { name: "B nǐ", exact: true }).check();
  await page.getByRole("button", { name: "Kiểm tra câu trả lời" }).click();
  await page.getByRole("button", { name: "Kết thúc lượt thử" }).click();
  await expect(
    page.getByRole("heading", { name: "Thêm một bước nhỏ." }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Tiến độ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chưa có kết quả học đã lưu." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hoạt động DEMO trong tab" }).click();
  await expect(page.getByText("Đã thử xong", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Hoạt động DEMO trong tab" }).click();
  await expect(
    page.getByText("Chưa có thao tác demo trong tab này."),
  ).toBeVisible();
});

test("all four lessons render and finish without claiming learning writes", async ({
  page,
}) => {
  await page.goto("/learn");
  for (const id of ["F01", "F02", "L001", "L002"]) {
    await page.locator(`a[href='/learn/${id}']`).first().click();
    for (let step = 0; step < 2; step++) {
      await page.getByRole("radio").first().check();
      await page.getByRole("button", { name: "Kiểm tra câu trả lời" }).click();
      await page
        .getByRole("button", {
          name: step === 0 ? "Bước tiếp theo" : "Kết thúc lượt thử",
        })
        .click();
    }
    await expect(
      page.getByText("khớp đáp án fixture · không phải điểm năng lực"),
    ).toBeVisible();
    await page.getByRole("link", { name: "Các bài mẫu", exact: true }).click();
  }
});

test("flashcard reveal and four ratings, empty queue and restart", async ({
  page,
}, info) => {
  await page.goto("/review");
  for (const rating of ["Again", "Hard", "Good", "Easy"]) {
    await expect(
      page.getByRole("button", { name: `${rating} `, exact: false }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Lật thẻ xem đáp án" }).click();
    await expect(page.getByRole("status")).toContainText("chưa kiểm duyệt");
    if (rating === "Again")
      await page.screenshot({
        path: `${evidence}/${info.project.name}-review.png`,
        fullPage: true,
      });
    await page
      .getByRole("button", { name: `${rating} `, exact: false })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Một vòng ôn nhỏ đã xong." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Thử lại 4 thẻ" }).click();
  await expect(page.getByText("Thẻ 1 / 4", { exact: true })).toBeVisible();
});

test("routes, accessibility, reduced motion, mobile overflow and keyboard", async ({
  page,
}, info) => {
  for (const route of [
    "/onboarding",
    "/schedule",
    "/today",
    "/learn",
    "/learn/L001",
    "/review",
    "/progress",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await noOverflow(page);
    const violations = (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations;
    expect(
      violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      route,
    ).toEqual([]);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Đi đến nội dung" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.screenshot({
    path: `${evidence}/${info.project.name}-keyboard.png`,
    fullPage: true,
  });
  // 200% equivalent responsive CSS viewport, plus 320px fallback.
  for (const width of [320, 720]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/schedule");
    await noOverflow(page);
  }
});

test("unknown lesson / route exposes a useful recovery", async ({ page }) => {
  const response = await page.goto("/learn/UNKNOWN");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Trang này chưa có" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Về Hôm nay", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hôm nay, mình học gì?" }),
  ).toBeVisible();
});

test("preview makes no external or write requests and uses no browser persistence", async ({
  page,
  baseURL,
}) => {
  const unexpected: string[] = [];
  page.on("request", (request) => {
    if (
      !["GET", "HEAD"].includes(request.method()) ||
      new URL(request.url()).origin !== new URL(baseURL!).origin
    )
      unexpected.push(`${request.method()} ${request.url()}`);
  });
  await page.goto("/learn/L001");
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Kiểm tra câu trả lời" }).click();
  await page.getByRole("link", { name: "Tạm dừng" }).click();
  expect(unexpected).toEqual([]);
  expect(await page.context().cookies()).toEqual([]);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
});
