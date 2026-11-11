import { test, expect } from "@playwright/test";
import { layout, lesson, reviews } from "../helpers/draft-journey";
import { weekdays } from "../../src/modules/planning/domain/preview-plan";
test("Five-course hierarchy → real units → all four saved lessons → review → course progress; keyboard, reload, private gates", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/onboarding");
  await page
    .getByRole("button", { name: "Bắt đầu học có lưu", exact: true })
    .click();
  await page.getByRole("button", { name: "3 giờ / tuần", exact: true }).click();
  for (const day of weekdays)
    await page.getByRole("checkbox", { name: day, exact: true }).check();
  await page.getByLabel("Tối đa mỗi ngày", { exact: true }).fill("90");
  await page
    .getByRole("button", { name: "Lưu lịch vào PostgreSQL", exact: true })
    .click();
  await expect(page.getByTestId("study-primary")).toContainText("F01");
  await expect(page.locator(".course-context")).toContainText(
    "Nền tảng tiếng Trung",
  );
  const targets = [
    { id: "F01", course: "FOUNDATION", unit: "Pinyin: cách đọc ký hiệu" },
    { id: "F02", course: "FOUNDATION", unit: "Thanh điệu" },
    { id: "L001", course: "HSK1", unit: "Chào hỏi và giới thiệu" },
    { id: "L002", course: "HSK1", unit: "Sở thích và câu hỏi đơn giản" },
  ];
  for (const t of targets) {
    await page
      .getByRole("link", { name: "Học tiếng Trung", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Danh mục khóa học" }),
    ).toBeVisible();
    await expect(page.locator('[data-testid^="course-"]')).toHaveCount(5);
    const link = page
      .getByTestId(`course-${t.course}`)
      .getByRole("link", { name: `Xem khóa ${t.course}`, exact: true });
    await link.focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("link", { name: `Mở unit ${t.unit}`, exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.unit);
    const card = page.getByTestId(`curriculum-lesson-${t.id}`);
    await expect(card).toContainText("Chỉ luyện draft local");
    await card
      .getByText("Điều kiện tiên quyết và bằng chứng", { exact: true })
      .click();
    if (t.id !== "F01")
      await expect(card).toContainText("Thiếu bằng chứng độc lập");
    await card
      .getByRole("link", { name: `Luyện ${t.id} · draft`, exact: true })
      .click();
    // Check a real unfinished cursor before completing the teaching/practice flow.
    if (t.id === "F01") {
      await page
        .getByRole("button", { name: "Bắt đầu học F01", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Đã đọc · tiếp tục", exact: true })
        .click();
      await expect(page.locator(".exercise")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Đã đọc · tiếp tục", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("link", {
          name: "Về khóa Nền tảng tiếng Trung",
          exact: true,
        })
        .click();
      await expect(page.getByTestId("curriculum-lesson-F01")).toContainText(
        "Đang học có lưu",
      );
      await page
        .getByRole("link", { name: "Tiếp tục F01", exact: true })
        .click();
    }
    // Driver starts a fresh lesson when needed; F01 has already resumed.
    if (t.id === "F01") {
      await finishActive(page, t.id);
    } else await lesson(page, t.id);
    await expect(
      page.getByRole("link", { name: `Về unit ${t.unit}`, exact: true }),
    ).toBeVisible();
    const snap = await (await page.request.get("/api/local/curriculum")).json();
    for (const f of [
      "privateKeys",
      "keyRef",
      "answerKey",
      "accepted",
      "feedback",
    ])
      expect(JSON.stringify(snap)).not.toContain(`"${f}"`);
    const queue = (await (await page.request.get("/api/local/snapshot")).json())
      .learning;
    if (queue.dueCount > 0) await reviews(page);
  }
  await page
    .getByRole("link", { name: "Học tiếng Trung", exact: true })
    .click();
  const hsk = page.getByTestId("course-HSK1");
  await expect(hsk).toContainText("Đã luyện 2/2 bài hiện có");
  await expect(hsk).toContainText("hoàn tất luyện 2/2");
  await expect(hsk).not.toContainText("100%");
  const snap = await (await page.request.get("/api/local/curriculum")).json();
  expect(snap.courses[1].independentEvidence).toBe(0);
  expect(snap.courses[1].activityState).not.toBe("COMPLETED");
  expect(
    snap.lessons.every(
      (l: { access: { verifiedEligible: boolean } }) =>
        !l.access.verifiedEligible,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/sprint6/evidence/${info.project.name}-catalog.png`,
    fullPage: true,
  });
  await layout(page);
  for (const code of ["HSK2", "HSK3", "HSK4"]) {
    await page
      .getByTestId(`course-${code}`)
      .getByRole("link", { name: `Xem khóa ${code}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Chưa phát hành học liệu",
        exact: true,
      }),
    ).toBeVisible();
    expect(await page.getByTestId(/^curriculum-lesson/).count()).toBe(0);
    await expect(page.locator(".course-explorer")).not.toContainText("100%");
    await page.getByRole("link", { name: "Khóa học", exact: true }).click();
  }
  await page
    .getByTestId("course-HSK1")
    .getByRole("link", { name: "Xem khóa HSK1", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Mở unit Chào hỏi và giới thiệu", exact: true })
    .click();
  await expect(page).toHaveURL(/\/learn\/courses\/HSK1\/units\/greetings$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Chào hỏi và giới thiệu",
  );
  await expect(page.locator(".course-lesson")).toHaveCount(1);
  await expect(page.locator(".course-explorer")).toContainText(
    "hoàn tất luyện 1/1",
  );
  await page.screenshot({
    path: `docs/sprint6/evidence/${info.project.name}-unit.png`,
    fullPage: true,
  });
  await layout(page);
  await page.getByRole("link", { name: "Tiến độ", exact: true }).click();
  await expect(page).toHaveURL(/\/progress$/);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Tiến độ theo khóa" }),
  ).toBeVisible();
  await expect(page.getByTestId("course-HSK1")).toContainText(
    "hoàn tất luyện 2/2",
  );
  if (info.project.name === "desktop") {
    await page.evaluate(() => {
      document.body.style.zoom = "2";
    });
    await layout(page);
    await page.evaluate(() => {
      document.body.style.zoom = "";
    });
  }
  expect(errors).toEqual([]);
});

// F01 already has an active persisted cursor. Finish through visible controls.
async function finishActive(page: import("@playwright/test").Page, id: string) {
  for (let i = 0; i < 35; i++) {
    await expect(page.locator(".exercise")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    const read = page.getByRole("button", {
        name: "Đã đọc · tiếp tục",
        exact: true,
      }),
      next = page.getByRole("button", { name: "Bước tiếp theo", exact: true }),
      complete = page.getByRole("button", {
        name: "Hoàn tất luyện tập có lưu",
        exact: true,
      });
    if (await read.isVisible()) {
      await read.click();
      continue;
    }
    if (await next.isVisible()) {
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
    const input = page.getByLabel("Pinyin của bạn", { exact: true });
    if (await input.isVisible()) {
      const p = await page.locator(".exercise h2").innerText();
      await input.fill(p.includes("你") ? "ni3" : "nv3");
    } else await page.getByRole("radio").first().check();
    await page
      .getByRole("button", { name: "Gửi và lưu câu trả lời", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Đã lưu PostgreSQL" }),
    ).toBeVisible();
  }
  throw new Error(`Unfinished ${id}`);
}

test("Catalog loading/error/retry, forged owner, unknown course/unit and 200% course view recover safely", async ({
  page,
}, info) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let phase = "loading";
  await page.route("**/api/local/curriculum", async (route) => {
    if (phase === "loading") {
      await gate;
      await route.fulfill({
        status: 503,
        json: { error: { message: "Test catalog unavailable" } },
      });
    } else await route.continue();
  });
  await page.goto("/learn");
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Đang đọc khóa học" }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole("alert").filter({ hasText: "Test catalog unavailable" }),
  ).toBeVisible();
  phase = "ready";
  await page
    .getByRole("button", { name: "Thử đọc khóa học lại", exact: true })
    .click();
  await expect(page.getByTestId("course-FOUNDATION")).toBeVisible();
  await page.unroute("**/api/local/curriculum");
  const forged = await page.request.get("/api/local/curriculum", {
    headers: { "x-owner-id": crypto.randomUUID() },
  });
  expect(forged.status()).toBe(403);
  await page.goto("/learn/courses/HSK9");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy khóa học", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Về danh mục khóa học", exact: true })
    .click();
  await page.goto("/learn/courses/HSK1/units/pinyin");
  await expect(
    page.getByRole("heading", {
      name: "Không tìm thấy unit trong khóa này",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Về khóa HSK1", exact: true }).click();
  await expect(page).toHaveURL(/\/learn\/courses\/HSK1$/);
  await expect(
    page.getByRole("heading", { name: "HSK 1", exact: true }),
  ).toBeVisible();
  // Next streams metadata independently; audit the settled destination page.
  await expect(page).toHaveTitle(/\S/);
  if (info.project.name === "desktop")
    await page.evaluate(() => {
      document.body.style.zoom = "2";
    });
  await layout(page);
  const targets = await page
    .locator(".course-explorer a.button")
    .evaluateAll((elements) =>
      elements.map((e) => e.getBoundingClientRect().height),
    );
  expect(targets.every((n) => n >= 44)).toBe(true);
});
