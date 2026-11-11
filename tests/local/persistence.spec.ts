import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("schedule -> PostgreSQL -> reload -> lost acknowledgement/retry -> resume -> confirmed progress", async ({
  page,
}, info) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto("/schedule");
  await expect(
    page.getByRole("button", { name: "LOCAL DATABASE", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  await expect(
    page.getByText("LOCAL DATABASE · PostgreSQL", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lưu lịch vào PostgreSQL" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "3 giờ / tuần", exact: true }).click();
  for (const [index, label] of [
    "Thứ hai",
    "Thứ ba",
    "Thứ tư",
    "Thứ năm",
    "Thứ sáu",
    "Thứ bảy",
    "Chủ nhật",
  ].entries())
    await page
      .getByRole("checkbox", { name: label, exact: true })
      .setChecked([0, 2, 4].includes(index));
  await page.getByLabel("Tối đa mỗi ngày").fill("90");
  await page.getByLabel("Mỗi buổi học").selectOption("15");
  await page.getByRole("button", { name: "Lưu lịch vào PostgreSQL" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.reload();
  await expect(
    page.getByText("3 giờ / tuần · 3 ngày · 15 phút / buổi.", { exact: false }),
  ).toBeVisible();
  await page.goto("/schedule");
  await expect(page.getByLabel("Hoặc nhập số giờ")).toHaveValue("3");
  await expect(page.getByLabel("Tối đa mỗi ngày")).toHaveValue("90");
  await expect(page.getByLabel("Mỗi buổi học")).toHaveValue("15");
  for (const [index, label] of [
    "Thứ hai",
    "Thứ ba",
    "Thứ tư",
    "Thứ năm",
    "Thứ sáu",
    "Thứ bảy",
    "Chủ nhật",
  ].entries())
    await expect(
      page.getByRole("checkbox", { name: label, exact: true }),
    ).toBeChecked({ checked: [0, 2, 4].includes(index) });
  await page.screenshot({
    path: `${process.env.CSH_LOCAL_EVIDENCE ?? "docs/local-persistence/evidence"}/${info.project.name}-schedule.png`,
    fullPage: true,
  });
  await page.goto("/today");
  await page.getByRole("link", { name: "Học tiếp · fixture local" }).click();
  await expect(
    page.getByRole("heading", { name: "Bài kiểm tra lưu kết quả local" }),
  ).toBeVisible();
  // Recover an interrupted prior test fixture without deleting acknowledged
  // data. These are local development fixtures, not real learning content.
  const interrupted = await (
    await page.request.get("/api/local/snapshot")
  ).json();
  if (
    interrupted.session?.state === "active" &&
    interrupted.session.answers.length
  ) {
    for (const [id, choice] of [
      ["local-token-v1-a", 0],
      ["local-token-v1-b", 2],
    ] as const) {
      if (
        !interrupted.session.answers.some(
          (a: { exerciseVersionId: string }) => a.exerciseVersionId === id,
        )
      ) {
        const r = await page.request.post(
          `/api/local/sessions/${interrupted.session.id}/answers`,
          {
            headers: {
              origin: new URL(page.url()).origin,
              "x-csh-local": "1",
              "idempotency-key": crypto.randomUUID(),
            },
            data: { exerciseVersionId: id, response: { choice } },
          },
        );
        expect(r.ok()).toBe(true);
      }
    }
    const r = await page.request.post(
      `/api/local/sessions/${interrupted.session.id}/complete`,
      {
        headers: {
          origin: new URL(page.url()).origin,
          "x-csh-local": "1",
          "idempotency-key": crypto.randomUUID(),
        },
        data: {},
      },
    );
    expect(r.ok()).toBe(true);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Bắt đầu lượt fixture mới" }),
    ).toBeVisible();
  }
  if (
    await page
      .getByRole("button", { name: "Bắt đầu lượt fixture mới" })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Bắt đầu lượt fixture mới" })
      .click();
  else if (
    await page.getByRole("button", { name: "Bắt đầu phiên local" }).isVisible()
  )
    await page.getByRole("button", { name: "Bắt đầu phiên local" }).click();
  await expect(
    page.getByRole("button", { name: "Gửi và lưu câu trả lời" }),
  ).toBeVisible();
  const before = await (await page.request.get("/api/local/snapshot")).json();
  const forged = await page.request.get("/api/local/snapshot", {
    headers: { "x-user-id": "20000000-0000-4000-8000-000000000002" },
  });
  expect(forged.status()).toBe(403);
  const keys: string[] = [];
  let intercepted = 0;
  await page.route("**/api/local/sessions/*/answers", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    if (intercepted++ === 0) {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await route.abort("failed");
    } else {
      const response = await route.fetch();
      await route.fulfill({ response });
    }
  });
  await page.getByRole("radio", { name: "am", exact: true }).check();
  await page.getByRole("button", { name: "Gửi và lưu câu trả lời" }).click();
  await expect(
    page.getByText("Chưa xác nhận thao tác:", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Đã lưu vào PostgreSQL", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Gửi và lưu câu trả lời" }).click();
  await expect(
    page.getByText("Đã lưu vào PostgreSQL · Chưa khớp đáp án fixture.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute("**/api/local/sessions/*/answers");
  await page.reload();
  await expect(page.getByText("1 câu đã lưu", { exact: false })).toBeVisible();
  await page.getByRole("radio", { name: "ni", exact: true }).check();
  await page.getByRole("button", { name: "Gửi và lưu câu trả lời" }).click();
  await expect(
    page.getByText("Đã lưu vào PostgreSQL · Khớp đáp án fixture.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hoàn tất và lưu phiên" }).click();
  await expect(
    page.getByRole("heading", { name: "Hoàn tất đã xác nhận từ PostgreSQL" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Xem tiến độ đã lưu" }).click();
  await expect(page).toHaveURL(/\/progress$/);
  await page.reload();
  await expect(page.getByTestId("db-attempts")).toHaveText(
    String(before.progress.attempts + 2),
  );
  await expect(page.getByTestId("db-correct")).toHaveText(
    String(before.progress.correct + 1),
  );
  await expect(page.getByTestId("db-completed")).toHaveText(
    String(before.progress.completedSessions + 1),
  );
  await expect(
    page.getByText("LOCAL DATABASE · PostgreSQL", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `${process.env.CSH_LOCAL_EVIDENCE ?? "docs/local-persistence/evidence"}/${info.project.name}-progress.png`,
    fullPage: true,
  });
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.getByRole("button", { name: "DEMO", exact: true }).click();
  await expect(
    page.getByText("DEMO · bộ nhớ trong tab", { exact: true }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("server refusal stays unsaved, no silent DEMO fallback; keyboard controls", async ({
  page,
}) => {
  await page.goto("/schedule");
  await expect(
    page.getByRole("button", { name: "LOCAL DATABASE", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lưu lịch vào PostgreSQL" }),
  ).toBeVisible();
  const previous = await page.getByLabel("Hoặc nhập số giờ").inputValue();
  await page.getByLabel("Hoặc nhập số giờ").fill("4");
  await page.route("**/api/local/preferences", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "TEST: server chưa xác nhận" },
      }),
    }),
  );
  await page.getByRole("button", { name: "Lưu lịch vào PostgreSQL" }).click();
  await expect(page.locator("#schedule-errors")).toContainText(
    "TEST: server chưa xác nhận",
  );
  await expect(
    page.getByText("LOCAL DATABASE · PostgreSQL", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Hoặc nhập số giờ")).toHaveValue("4");
  await page.unroute("**/api/local/preferences");
  await page.reload();
  await expect(page.getByLabel("Hoặc nhập số giờ")).toHaveValue(previous);
  await page.getByRole("button", { name: "DEMO", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("DEMO · bộ nhớ trong tab", { exact: true }),
  ).toBeVisible();
});

test("Expired development identity keeps LOCAL mode and requires explicit re-entry", async ({
  page,
  context,
}) => {
  await page.goto("/schedule");
  await expect(
    page.getByRole("button", { name: "LOCAL DATABASE", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lưu lịch vào PostgreSQL" }),
  ).toBeVisible();
  await context.clearCookies({ name: "csh_local_development" });
  await page.reload();
  await expect(
    page.getByText("LOCAL DATABASE · PostgreSQL", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dữ liệu chưa được xác nhận" }),
  ).toBeVisible();
  await expect(
    page.getByText("DEMO · bộ nhớ trong tab", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lưu lịch vào PostgreSQL" }),
  ).toBeVisible();
  await expect(page.getByLabel("Hoặc nhập số giờ")).toHaveValue("3");
});
