import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { layout } from "../helpers/draft-journey";

test.beforeAll(async ({ request }, testInfo) => {
  // Separate development compilation from the actual acknowledged UI submit.
  const observations = [];
  for (const path of ["/schedule", "/api/local/mode", "/api/local/snapshot"]) {
    const started = Date.now();
    const response = await request.get(path, { timeout: 60000 });
    observations.push({
      path,
      status: response.status(),
      milliseconds: Date.now() - started,
    });
  }
  await testInfo.attach("read-only-onboarding-route-initialization", {
    body: JSON.stringify(observations),
    contentType: "application/json",
  });
});
const catalog = JSON.parse(
  fs.readFileSync("content/hsk24/catalog.json", "utf8"),
);
const ids = (
  process.env.CSH_HSK24_BROWSER_LESSONS ?? "L201,L203,L207,L211"
).split(",");
for (const id of ids)
  test(`${id}: actual content, resume, grading, completion, progress and accessibility`, async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await page
      .getByRole("button", { name: "Bắt đầu học có lưu", exact: true })
      .click();
    await expect(page).toHaveURL(/\/schedule(?:\?|$)/);
    await page.goto(`/learn/courses/HSK${id[1]}`);
    await expect(
      page.getByRole("heading", { name: `HSK ${id[1]}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        catalog.courses.find(
          (c: { code: string; description: string }) =>
            c.code === `HSK${id[1]}`,
        ).description,
        { exact: true },
      ),
    ).toBeVisible();
    await layout(page);
    {
      const p = JSON.parse(
        fs.readFileSync(
          `content/hsk24/${id}.v${Number(catalog.lessons.find((l: { key: string }) => l.key === id).currentVersion.match(/-v(\d+)$/)[1])}.json`,
          "utf8",
        ),
      );
      await page.goto(`/learn/draft/${id}`);
      await expect(
        page.getByRole("heading", { name: p.lesson.title, exact: true }),
      ).toBeVisible();
      const start = page.getByRole("button", {
        name: new RegExp(`^(Bắt đầu học ${id}|Luyện lại bài nháp)$`),
      });
      const initialResponse = await page.request.get(
        `/api/local/content/${p.lesson.versionId}`,
      );
      expect(
        initialResponse.ok(),
        `Initial lesson state: HTTP ${initialResponse.status()}`,
      ).toBe(true);
      const initial = await initialResponse.json();
      if (initial.session?.state !== "active") await start.click();
      const firstRead = page.getByRole("button", {
        name: "Đã đọc · tiếp tục",
        exact: true,
      });
      await expect(page.locator(".exercise")).toHaveAttribute(
        "aria-busy",
        "false",
        { timeout: 35000 },
      );
      if (id === "L201") {
        let release!: () => void;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        let intercepted = 0;
        await page.route("**/api/local/snapshot", async (route) => {
          intercepted++;
          await held;
          await route.continue();
        });
        try {
          if (await firstRead.isVisible()) await firstRead.click();
          await expect.poll(() => intercepted).toBeGreaterThan(0);
          await expect(page.locator(".exercise")).toHaveAttribute(
            "aria-busy",
            "false",
            { timeout: 5000 },
          );
        } finally {
          release();
          await page.unrouteAll({ behavior: "wait" });
        }
      } else if (await firstRead.isVisible()) await firstRead.click();
      await expect(page.locator(".exercise")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      const beforeResponse = await page.request.get(
        `/api/local/content/${p.lesson.versionId}`,
      );
      expect(
        beforeResponse.ok(),
        `Before reload: HTTP ${beforeResponse.status()}`,
      ).toBe(true);
      const beforeReload = await beforeResponse.json();
      expect(
        beforeReload.session,
        "Before reload requires an acknowledged session",
      ).toBeTruthy();
      await page.reload();
      await expect(
        page.getByRole("heading", { name: p.lesson.title, exact: true }),
      ).toBeVisible();
      const afterResponse = await page.request.get(
        `/api/local/content/${p.lesson.versionId}`,
      );
      expect(
        afterResponse.ok(),
        `After reload: HTTP ${afterResponse.status()}`,
      ).toBe(true);
      const afterReload = await afterResponse.json();
      expect(
        afterReload.session,
        "After reload requires an acknowledged session",
      ).toBeTruthy();
      expect(afterReload.session.cursor).toBe(beforeReload.session.cursor);
      for (let n = 0; n < 40; n++) {
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
        await expect(page.locator(".exercise")).toHaveAttribute(
          "aria-busy",
          "false",
          { timeout: 35000 },
        );
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
          break;
        }
        const prompt = await page.locator(".exercise h2").innerText();
        const e = p.exercises.find(
          (e: { prompt: string }) => e.prompt === prompt,
        );
        expect(e).toBeTruthy();
        const answer = p.privateKeys.find(
          (k: { id: string }) => k.id === e.keyRef,
        ).accepted[0];
        if (e.type === "choice")
          await page.getByRole("radio", { name: answer, exact: true }).check();
        else if (e.type === "sequence")
          for (const i of answer.split(",").map(Number)) {
            await page
              .getByRole("button", {
                name: `Thêm mảnh ${e.choices[i]}`,
                exact: true,
              })
              .focus();
            await page.keyboard.press("Enter");
          }
        else
          await page
            .getByLabel(
              e.type === "pinyin"
                ? "Pinyin của bạn"
                : "Câu trả lời bằng chữ Hán",
              { exact: true },
            )
            .fill(answer);
        await page
          .getByRole("button", { name: "Gửi và lưu câu trả lời", exact: true })
          .click();
        await expect(
          page.getByRole("status").filter({ hasText: "Đã lưu PostgreSQL" }),
        ).toBeVisible();
      }
      await expect(
        page.getByRole("heading", { name: "Đã hoàn tất luyện tập có lưu." }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: `Về khóa HSK ${id[1]}`, exact: true }),
      ).toBeVisible();
      await layout(page);
    }
    await page.goto(`/learn/courses/HSK${id[1]}`);

    const snapshot = await (
      await page.request.get("/api/local/curriculum")
    ).json();
    expect(
      snapshot.courses.find((c: { code: string }) => c.code === `HSK${id[1]}`)
        .independentEvidence,
    ).toBe(0);
    expect(
      snapshot.lessons.find((l: { key: string }) => l.key === id).completed,
    ).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('"privateKeys"');
    if (id === "L274") {
      await page.goto("/today");
      await expect(
        page.getByRole("link", { name: /Ôn thẻ|Ôn tập|ôn thẻ/i }).first(),
      ).toBeVisible();
      await page.goto("/review");
      await expect(
        page.getByRole("heading", { name: "Ôn thẻ đến hạn", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Lật thẻ từ server", exact: true })
        .click();
      await page.getByRole("button", { name: /Good Nhớ đúng/ }).click();
      await expect(page.getByTestId("review-saved")).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Ôn thẻ đến hạn", exact: true }),
      ).toBeVisible();
      await layout(page);
    }
    await page.goto("/learn/courses/HSK4");
    if (catalog.lessons.some((l: { key: string }) => /^L4/.test(l.key))) {
      await expect(
        page.getByRole("heading", { name: "HSK 4", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Học liệu HSK4 nháp cục bộ", { exact: false }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", {
          name: "Chưa phát hành học liệu",
          exact: true,
        }),
      ).toBeVisible();
    }
  });
