import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("Graded fixture -> due queue -> lost rating acknowledgement/retry -> reload retains FSRS and excluded mastery", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/schedule");
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lưu lịch vào PostgreSQL" }),
  ).toBeVisible();
  await page.goto("/learn/local-foundation-v1");
  const start = page.getByRole("button", {
    name: "Bắt đầu phiên local",
    exact: true,
  });
  // The two projects share a temporary dev owner; desktop completes the first
  // session and mobile explicitly opens a new one. Never delete old evidence.
  const restart = page.getByRole("button", {
    name: "Bắt đầu lượt fixture mới",
  });
  await expect(start.or(restart)).toBeVisible();
  await ((await restart.isVisible()) ? restart : start).click();
  await page.getByRole("radio", { name: "ma", exact: true }).check();
  await page.getByRole("button", { name: "Gửi và lưu câu trả lời" }).click();
  await expect(
    page.getByText("Đáp án fixture: ma.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await page.getByRole("radio", { name: "in", exact: true }).check();
  await page.getByRole("button", { name: "Gửi và lưu câu trả lời" }).click();
  await expect(
    page.getByText("Chưa khớp đáp án fixture", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hoàn tất và lưu phiên" }).click();
  await expect(restart).toBeVisible();
  await page.goto("/review");
  await expect(
    page.getByRole("button", { name: "Lật thẻ từ server" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Good Nhớ đúng/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Lật thẻ từ server" }).click();
  await expect(
    page.getByRole("button", { name: /Good Nhớ đúng/ }),
  ).toBeEnabled();
  const before = await (await page.request.get("/api/local/snapshot")).json();
  let first = true;
  const keys: string[] = [];
  await page.route("**/api/local/cards/*/rating", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    if (first) {
      first = false;
      await route.abort("failed");
    } else await route.fulfill({ response });
  });
  await page.getByRole("button", { name: /Good Nhớ đúng/ }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Chưa xác nhận thao tác" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Good Nhớ đúng/ }).click();
  await expect(page.getByTestId("review-saved")).toBeVisible();
  expect(keys.length).toBe(2);
  expect(keys[0]).toBe(keys[1]);
  const after = await (await page.request.get("/api/local/snapshot")).json();
  expect(after.learning.reviews).toBe(before.learning.reviews + 1);
  expect(after.learning.mastery).toEqual(before.learning.mastery);
  expect(after.learning.nextDueAt).not.toBeNull();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ôn thẻ đến hạn" }),
  ).toBeVisible();
  if (after.learning.dueCount === 0)
    await expect(
      page.getByRole("heading", { name: "Không có thẻ đến hạn lúc này." }),
    ).toBeVisible();
  await page.screenshot({
    path: `docs/local-learning/evidence/${info.project.name}-review.png`,
    fullPage: true,
  });
  await page.goto("/progress");
  await expect(page.getByTestId("db-reviews")).toContainText(
    `${after.learning.reviews} lượt ôn FSRS`,
  );
  await expect(
    page.getByText("Chưa đủ dữ liệu hợp lệ:", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("db-reviews")).toContainText(
    `${after.learning.reviews} lượt ôn FSRS`,
  );
  await page.screenshot({
    path: `docs/local-learning/evidence/${info.project.name}-progress.png`,
    fullPage: true,
  });
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("Review server error stays LOCAL and unsaved; retry reload is explicit", async ({
  page,
}) => {
  await page.goto("/review");
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ôn thẻ đến hạn" }),
  ).toBeVisible();
  await page.route("**/api/local/snapshot", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "Database tạm mất kết nối (test)" },
      }),
    }),
  );
  await page.getByRole("button", { name: "Đọc lại hàng đợi" }).click();
  await expect(
    page.getByText("Dữ liệu chưa được xác nhận", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("LOCAL DATABASE · PostgreSQL", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("review-saved")).toHaveCount(0);
  await page.unroute("**/api/local/snapshot");
  await page
    .getByRole("button", { name: "Tải lại dữ liệu", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ôn thẻ đến hạn" }),
  ).toBeVisible();
});
