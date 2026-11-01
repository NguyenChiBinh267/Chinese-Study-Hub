import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { weekdays } from "../../src/modules/planning/domain/preview-plan";

async function layout(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const violations = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations;
  expect(
    violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}
async function saved(page: Page) {
  await expect(
    page.getByRole("status").filter({ hasText: "Đã lưu PostgreSQL" }),
  ).toBeVisible();
}
async function lesson(page: Page, id: string) {
  await expect(page).toHaveURL(new RegExp(`/learn/draft/${id}`));
  await page
    .getByRole("button", { name: `Bắt đầu học ${id}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Đã đọc · tiếp tục" }),
  ).toBeVisible();
  let retryChecked = false,
    reloadChecked = false;
  for (let step = 0; step < 45; step++) {
    await expect(page.locator(".exercise")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    const read = page.getByRole("button", {
      name: "Đã đọc · tiếp tục",
      exact: true,
    });
    const next = page.getByRole("button", {
      name: "Bước tiếp theo",
      exact: true,
    });
    const complete = page.getByRole("button", {
      name: "Hoàn tất luyện tập có lưu",
      exact: true,
    });
    if (await read.isVisible()) {
      await read.click();
      continue;
    }
    if (await next.isVisible()) {
      if (!reloadChecked) {
        await page.reload();
        await saved(page);
        reloadChecked = true;
      }
      await next.click();
      continue;
    }
    if (await complete.isVisible()) {
      await complete.click();
      await expect(
        page.getByRole("heading", { name: "Đã hoàn tất luyện tập có lưu." }),
      ).toBeVisible();
      return;
    }
    const prompt = await page.locator(".exercise h2").innerText();
    const sequence = page.getByRole("group", {
      name: "Sắp xếp câu",
      exact: true,
    });
    const pinyin = page.getByLabel("Pinyin của bạn", { exact: true });
    const short = page.getByLabel("Câu trả lời bằng chữ Hán", { exact: true });
    if (await sequence.isVisible()) {
      const tokens = prompt.includes("tên")
        ? ["我", "叫", "安"]
        : prompt.includes("uống")
          ? ["我", "喜欢", "喝", "茶"]
          : prompt.includes("thích")
            ? ["我", "喜欢", "茶"]
            : ["你", "呢"];
      // Real keyboard correction, then complete the intended answer.
      await sequence
        .getByRole("button", { name: `Thêm mảnh ${tokens[0]}`, exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await sequence
        .getByRole("button", { name: "Bỏ mảnh cuối", exact: true })
        .click();
      for (const token of tokens)
        await sequence
          .getByRole("button", { name: `Thêm mảnh ${token}`, exact: true })
          .click();
      await expect(
        page.getByTestId("sequence-order").locator("li"),
      ).toHaveCount(tokens.length);
    } else if (await pinyin.isVisible()) {
      await pinyin.fill(
        prompt.includes("我")
          ? "wo3"
          : prompt.includes("茶")
            ? "cha2"
            : prompt.includes("你")
              ? "ni3"
              : prompt.includes("马")
                ? "ma3"
                : "nv3",
      );
    } else if (await short.isVisible()) {
      // L002 deliberately incorrect: server persists provisional feedback, no mastery.
      await short.fill(
        id === "L001"
          ? "我 叫 安。"
          : prompt.includes("喜欢") || prompt.includes("thích")
            ? "我不喜欢茶"
            : "你呢？",
      );
    } else await page.getByRole("radio").first().check();
    const submit = page.getByRole("button", {
      name: "Gửi và lưu câu trả lời",
      exact: true,
    });
    if (id === "L001" && !retryChecked) {
      const keys: string[] = [];
      let first = true;
      await page.route(
        "**/api/local/content/sessions/*/answers",
        async (route) => {
          keys.push(route.request().headers()["idempotency-key"]);
          const response = await route.fetch();
          expect(response.ok()).toBe(true);
          if (first) {
            first = false;
            await route.abort("failed");
          } else await route.fulfill({ response });
        },
      );
      await submit.click();
      await expect(
        page.getByRole("alert").filter({ hasText: "Chưa xác nhận thao tác" }),
      ).toBeVisible();
      await submit.click();
      await saved(page);
      expect(keys).toHaveLength(2);
      expect(keys[0]).toBe(keys[1]);
      await page.unroute("**/api/local/content/sessions/*/answers");
      retryChecked = true;
    } else {
      await submit.click();
      await saved(page);
    }
    if (id === "L002" && (await short.isVisible()) && prompt.includes("thích"))
      await expect(
        page.getByText("Chưa khớp đáp án nháp", { exact: false }),
      ).toBeVisible();
  }
  throw new Error(`Lesson did not finish: ${id}`);
}
async function reviews(page: Page) {
  await page.getByTestId("study-primary").click();
  await expect(page).toHaveURL(/\/review/);
  for (let i = 0; i < 15; i++) {
    await expect(page.locator(".local-panel").first()).toHaveAttribute(
      "aria-busy",
      "false",
    );
    if (
      await page
        .getByRole("heading", { name: "Không có thẻ đến hạn lúc này." })
        .isVisible()
    )
      break;
    await page
      .getByRole("button", { name: "Lật thẻ từ server", exact: true })
      .click();
    await page.getByRole("button", { name: /Easy Nhớ ngay/ }).click();
    await expect(page.getByTestId("review-saved")).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "Không có thẻ đến hạn lúc này." }),
  ).toBeVisible();
  await expect(
    page.getByText("Đang chốt khoảng thời gian ôn đã quan sát…"),
  ).not.toBeVisible();
}

test("New owner: onboarding → saved weekly schedule → Today → all four drafts → real FSRS → progress; reload, wrong answer and lost ACK", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding/);
  await page
    .getByRole("button", { name: "Bắt đầu học có lưu", exact: true })
    .click();
  await expect(page).toHaveURL(/\/schedule/);
  await page.getByRole("button", { name: "3 giờ / tuần", exact: true }).click();
  for (const day of weekdays)
    await page.getByRole("checkbox", { name: day, exact: true }).check();
  await page.getByLabel("Tối đa mỗi ngày", { exact: true }).fill("90");
  await page
    .getByRole("button", { name: "Lưu lịch vào PostgreSQL", exact: true })
    .click();
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByTestId("study-primary")).toContainText("F01");
  await page
    .getByRole("button", { name: "Hôm nay chỉ có 10 phút", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/local/study/today")).json()).plan
          .todayCapacityMinutes,
    )
    .toBeLessThanOrEqual(10);
  await expect(page.getByTestId("study-primary")).toContainText("F01");
  await layout(page);
  await page.screenshot({
    path: `docs/sprint5/evidence/${info.project.name}-today.png`,
    fullPage: true,
  });
  for (const id of ["F01", "F02", "L001", "L002"]) {
    await expect(page.getByTestId("study-primary")).toHaveAttribute(
      "href",
      new RegExp(`/learn/draft/${id}`),
    );
    await page.getByTestId("study-primary").click();
    await lesson(page, id);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Đã hoàn tất luyện tập có lưu." }),
    ).toBeVisible();
    if (id === "L001") {
      await layout(page);
      await page.screenshot({
        path: `docs/sprint5/evidence/${info.project.name}-L001-complete.png`,
        fullPage: true,
      });
    }
    const queue = (await (await page.request.get("/api/local/snapshot")).json())
      .learning;
    if (queue.dueCount > 0) {
      await expect(page.getByTestId("study-primary")).toHaveAttribute(
        "href",
        "/review",
      );
      await reviews(page);
    }
  }
  await page.goto("/progress");
  await expect(
    page.getByRole("heading", { name: "Bài nháp & thời gian quan sát" }),
  ).toBeVisible();
  const summary = await (
    await page.request.get("/api/local/content/summary")
  ).json();
  expect(
    summary.lessons.filter((l: { completed: number }) => l.completed > 0),
  ).toHaveLength(4);
  expect(summary.independentEvidence).toBe(0);
  const snapshot = await (await page.request.get("/api/local/snapshot")).json();
  expect(snapshot.learning.reviews).toBeGreaterThan(0);
  expect(
    snapshot.learning.mastery.every(
      (m: { projection: { evidenceCount: number; status: string } }) =>
        m.projection.evidenceCount === 0 && m.projection.status !== "secure",
    ),
  ).toBe(true);
  await layout(page);
  await page.screenshot({
    path: `docs/sprint5/evidence/${info.project.name}-progress.png`,
    fullPage: true,
  });
  await page.goto("/");
  await expect(page).toHaveURL(/\/today/);
  expect(errors).toEqual([]);
});

test("Saved settings 3/6/9 hours, explicit shortfall, pause/rest, optimistic replan lost ACK, read error and keyboard recovery", async ({
  page,
}, info) => {
  await page.goto("/schedule");
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  for (const hours of [3, 6, 9]) {
    await page
      .getByRole("button", { name: `${hours} giờ / tuần`, exact: true })
      .click();
    await expect
      .poll(async () => {
        const result = await page.request.post("/api/local/study/preview", {
          headers: { origin: "http://127.0.0.1:3016", "x-csh-local": "1" },
          data: {
            preferences: {
              weeklyHours: hours,
              days: [0, 1, 2, 3, 4, 5, 6],
              dailyCap: 90,
              sessionMinutes: 20,
            },
            planning: {
              dayCaps: [90, 90, 90, 90, 90, 90, 90],
              maxSessionMinutes: 25,
              paused: false,
              timezone: "Asia/Saigon",
              startingLevel: "zero",
            },
          },
        });
        return result.ok() ? (await result.json()).requestedMinutes : 0;
      })
      .toBe(hours * 60);
  }
  await page.getByLabel("Tối đa mỗi ngày", { exact: true }).fill("10");
  await page
    .getByRole("combobox", { name: "Mỗi buổi học", exact: true })
    .selectOption("10");
  await page
    .getByRole("button", { name: "Lưu lịch vào PostgreSQL", exact: true })
    .click();
  await expect(page.locator("#schedule-errors")).toBeFocused();
  await page
    .getByRole("checkbox", { name: /Tôi chấp nhận lịch tối đa/ })
    .check();
  await page
    .getByRole("checkbox", { name: "Tạm dừng lịch học", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Lưu lịch vào PostgreSQL", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Lịch học đang tạm dừng" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Lịch học của tôi", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "3 giờ / tuần", exact: true }).click();
  await page.getByLabel("Tối đa mỗi ngày", { exact: true }).fill("90");
  await page
    .getByRole("checkbox", { name: "Tạm dừng lịch học", exact: true })
    .uncheck();
  await page
    .getByRole("button", { name: "Lưu lịch vào PostgreSQL", exact: true })
    .click();
  await expect(page).toHaveURL(/\/today/);
  const keys: string[] = [];
  let first = true;
  await page.route("**/api/local/study/replan", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    if (first) {
      first = false;
      await route.abort("failed");
    } else await route.fulfill({ response });
  });
  await page
    .getByRole("button", { name: "Hôm nay nghỉ · xếp lại", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Chưa xác nhận thay đổi" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Hôm nay nghỉ · xếp lại", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Hôm nay là ngày nghỉ hoặc đã hết thời gian",
    }),
  ).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute("**/api/local/study/replan");
  await page.screenshot({
    path: `docs/sprint5/evidence/${info.project.name}-rest.png`,
    fullPage: true,
  });
  await page.route("**/api/local/study/today", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: "Test transport unavailable" } },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: "Test transport unavailable" }),
  ).toBeVisible();
  await page.unroute("**/api/local/study/today");
  await page
    .getByRole("button", { name: "Đọc lại lịch đã lưu", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "Hôm nay là ngày nghỉ hoặc đã hết thời gian",
    }),
  ).toBeVisible();
  await layout(page);
});
