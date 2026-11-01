import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function enter(page: Page) {
  await page.goto("/learn");
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bài nháp hiện có", exact: true }),
  ).toBeVisible();
}
async function begin(page: Page, id: string) {
  await page.goto(`/learn/draft/${id}?version=${id.toLowerCase()}-draft-v1`);
  await expect(page.locator(".foundation-player")).toBeVisible();
  const current = await (
    await page.request.get(`/api/local/content/${id.toLowerCase()}-draft-v1`)
  ).json();
  // The two viewport projects share a temporary server owner. Finish interrupted
  // practice through the UI before starting a new run; never delete history.
  if (current.session?.state === "active" && current.session.cursor > 0)
    await finish(page, id);
  const start = page.getByRole("button", {
      name: `Bắt đầu học ${id}`,
      exact: true,
    }),
    restart = page.getByRole("button", {
      name: "Luyện lại bài nháp",
      exact: true,
    });
  await expect(
    start
      .or(restart)
      .or(page.getByRole("button", { name: "Đã đọc · tiếp tục" })),
  ).toBeVisible();
  let started = false;
  if (await start.isVisible()) {
    await start.click();
    started = true;
  } else if (await restart.isVisible()) {
    await restart.click();
    started = true;
  }
  await expect(
    page.getByRole("button", { name: "Đã đọc · tiếp tục" }),
  ).toBeVisible();
  await expect(page.locator(".exercise")).toHaveAttribute("aria-busy", "false");
  if (started)
    await expect(page.locator(".player-heading h2").first()).toBeFocused();
}
async function finish(page: Page, id: string) {
  let reloadChecked = false,
    lostAckChecked = false;
  for (let n = 0; n < 45; n++) {
    if (
      await page
        .getByRole("heading", { name: "Đã hoàn tất luyện tập có lưu." })
        .isVisible()
    )
      return;
    // Wait for the acknowledged UI update before selecting the next control.
    // Consecutive teaching steps deliberately reuse the same button label.
    await expect(page.locator(".exercise")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    const read = page.getByRole("button", { name: "Đã đọc · tiếp tục" }),
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
      if (!reloadChecked) {
        await page.reload();
        await expect(
          page.getByRole("status").filter({ hasText: "Đã lưu PostgreSQL" }),
        ).toBeVisible();
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
    const submit = page.getByRole("button", {
      name: "Gửi và lưu câu trả lời",
      exact: true,
    });
    await expect(submit).toBeVisible();
    const input = page.getByLabel("Pinyin của bạn");
    if (await input.isVisible()) {
      const question = await page.locator(".exercise h2").innerText();
      await input.fill(
        question.includes("你")
          ? "ni3"
          : question.includes("马")
            ? "ma3"
            : "nv3",
      );
    } else await page.getByRole("radio").first().check();
    if (!lostAckChecked) {
      let first = true;
      const keys: string[] = [];
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
      await expect(
        page.getByRole("status").filter({ hasText: "Đã lưu PostgreSQL" }),
      ).toBeVisible();
      expect(keys.length).toBe(2);
      expect(keys[0]).toBe(keys[1]);
      await page.unroute("**/api/local/content/sessions/*/answers");
      lostAckChecked = true;
    } else await submit.click();
  }
  throw new Error(`Did not finish ${id}`);
}
test("Foundation library → original teaching → real grading → lost ack/reload resume → F01/F02 completion → draft FSRS/progress", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await expect(
    page.getByRole("link", { name: "Mở bài nháp L001" }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/phase4/evidence/${info.project.name}-library.png`,
    fullPage: true,
  });
  await begin(page, "F01");
  await page.getByRole("button", { name: "Ẩn pinyin", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Hiện pinyin", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hiện pinyin", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.locator('.foundation-player [lang="zh-Hans"]').first(),
  ).toBeVisible();
  const publicResponse = await (
    await page.request.get("/api/local/content/f01-draft-v1")
  ).json();
  for (const name of ["privateKeys", "keyRef", "accepted", "feedback"])
    expect(JSON.stringify(publicResponse.lesson)).not.toContain(`"${name}"`);
  await expect(
    page.getByText("Pinyin là chiếc cầu để đọc chữ", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/phase4/evidence/${info.project.name}-F01.png`,
    fullPage: true,
  });
  const violations = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze()
  ).violations;
  expect(
    violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await finish(page, "F01");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Đã hoàn tất luyện tập có lưu." }),
  ).toBeVisible();
  await begin(page, "F02");
  await page.screenshot({
    path: `docs/phase4/evidence/${info.project.name}-F02.png`,
    fullPage: true,
  });
  await finish(page, "F02");
  await page.goto("/learn/draft/L001");
  await expect(
    page.getByText("HSK 1 · mapping PARTIAL.", { exact: false }),
  ).toBeVisible();
  await page.getByText("Phạm vi & nguồn đối chiếu", { exact: true }).click();
  await expect(page.getByText("SUPPLEMENTARY", { exact: false })).toBeVisible();
  await page.goto("/learn/draft/L002");
  await expect(
    page.getByText("HSK 1 · mapping PARTIAL.", { exact: false }),
  ).toBeVisible();
  await page.goto("/review");
  await expect(
    page.getByRole("button", { name: "Lật thẻ từ server" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lật thẻ từ server" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "draft chưa duyệt" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Good Nhớ đúng/ }).click();
  await expect(page.getByTestId("review-saved")).toContainText(
    "Đã lưu lượt ôn",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ôn thẻ đến hạn" }),
  ).toBeVisible();
  await page.goto("/progress");
  await expect(
    page.getByRole("heading", { name: "Bài nháp & thời gian quan sát" }),
  ).toBeVisible();
  await expect(
    page.getByText("Nghe: CHƯA ĐÁNH GIÁ", { exact: false }),
  ).toBeVisible();
  const snapshot = await (await page.request.get("/api/local/snapshot")).json();
  expect(
    snapshot.learning.mastery.every(
      (m: { projection: { evidenceCount: number; status: string } }) =>
        m.projection.evidenceCount === 0 && m.projection.status !== "secure",
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/phase4/evidence/${info.project.name}-progress.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const width of [320, 720]) {
    await page.setViewportSize({ width, height: 800 });
    for (const route of ["/learn", "/learn/draft/L001"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/learn/draft/F01");
  await page.evaluate(() => {
    document.body.style.zoom = "2";
  });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.body.style.zoom = "";
  });
  expect(errors).toEqual([]);
});
test("Foreground intervals persist, a second tab takes lease, duplicates cannot increase duration and publisher mutations unavailable", async ({
  page,
  context,
}) => {
  await enter(page);
  await begin(page, "L002");
  await page.getByRole("button", { name: "Đã đọc · tiếp tục" }).click();
  await expect
    .poll(
      async () =>
        Number(
          (await (await page.request.get("/api/local/content/summary")).json())
            .observedActiveMs,
        ),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
  const view = await (
    await page.request.get("/api/local/content/l002-draft-v1")
  ).json();
  const second = await context.newPage();
  await second.goto("/learn/draft/L002?version=l002-draft-v1");
  await second.getByRole("button", { name: "Tiếp tục đo ở tab này" }).click();
  await page.bringToFront();
  await page.getByRole("button", { name: "Ẩn pinyin" }).click();
  await page.getByRole("radio").first().check();
  await page
    .getByRole("button", { name: "Gửi và lưu câu trả lời", exact: true })
    .click();
  await expect(
    page.getByText("Chưa xác nhận thời gian:", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("radio").first()).toBeVisible();
  const mutate = await page.request.patch("/api/local/content/l002-draft-v1", {
    data: { state: "PUBLISHED" },
  });
  expect(mutate.status()).toBe(405);
  const forged = await page.request.post(
    `/api/local/content/sessions/${view.session.id}/answers`,
    {
      headers: {
        origin: "http://127.0.0.1:3014",
        "x-csh-local": "1",
        "idempotency-key": crypto.randomUUID(),
      },
      data: {
        exerciseVersionId: "x",
        response: { choice: 0 },
        score: 100,
        owner: "forged",
      },
    },
  );
  expect(forged.status()).toBe(422);
  await second.close();
});

test("Library renders loading, empty and error states and retries actual server reads", async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let phase = "loading";
  await page.route("**/api/local/content", async (route) => {
    if (phase === "loading") {
      await gate;
      await route.fulfill({ json: [] });
    } else if (phase === "error")
      await route.fulfill({
        status: 503,
        json: { error: { message: "Test transport unavailable" } },
      });
    else await route.continue();
  });
  await page.goto("/learn");
  await page
    .getByRole("button", { name: "LOCAL DATABASE", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Đang đọc thư viện foundation" }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole("heading", { name: "Chưa có package nháp trong thư viện" }),
  ).toBeVisible();
  phase = "error";
  await page
    .getByRole("button", { name: "Đọc lại thư viện", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Chưa đọc được thư viện nháp" }),
  ).toBeVisible();
  phase = "server";
  await page.getByRole("button", { name: "Thử tải thư viện lại" }).click();
  await expect(
    page.getByRole("heading", { name: "Bài nháp hiện có", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/local/content");
});
