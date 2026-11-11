import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function layout(page: Page) {
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
export async function lesson(page: Page, id: string) {
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
export async function reviews(page: Page) {
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
