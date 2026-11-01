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
const manifest = JSON.parse(
  fs.readFileSync("content/hsk24/manifest.json", "utf8"),
);
for (const id of (process.env.CSH_HSK4_NAV_LESSONS ?? "L405,L436").split(","))
  test(`${id}: course and unit links open the exact current immutable lesson`, async ({
    page,
  }) => {
    const lesson = catalog.lessons.find((l: { key: string }) => l.key === id);
    const unit = catalog.units.find(
      (u: { id: string }) => u.id === lesson.unitId,
    );
    const course = catalog.courses.find(
      (c: { id: string }) => c.id === unit.courseId,
    );
    const row = manifest.packages.find(
      (m: { versionId: string }) => m.versionId === lesson.currentVersion,
    );
    const p = JSON.parse(fs.readFileSync(`content/hsk24/${row.file}`, "utf8"));
    await page.goto("/onboarding");
    await page
      .getByRole("button", { name: "Bắt đầu học có lưu", exact: true })
      .click();
    await expect(page).toHaveURL(/\/schedule(?:\?|$)/);
    await page.goto("/learn");
    await page
      .getByTestId(`course-${course.code}`)
      .getByRole("link", { name: `Xem khóa ${course.code}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: course.title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: `Mở unit ${unit.title}`, exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/${course.code}/units/${unit.slug}$`),
    );
    await expect(
      page.getByRole("heading", { name: unit.title, exact: true }),
    ).toBeVisible();
    await layout(page);
    const card = page.getByTestId(`curriculum-lesson-${id}`);
    await expect(card).toContainText("Chưa đủ bằng chứng độc lập");
    const link = card.getByRole("link", {
      name: new RegExp(`^(Luyện(?: lại)? ${id} · draft|Tiếp tục ${id})$`),
    });
    await expect(link).toHaveAttribute(
      "href",
      `/learn/draft/${id}?version=${lesson.currentVersion}`,
    );
    await link.click();
    await expect(
      page.getByRole("heading", { name: p.lesson.title, exact: true }),
    ).toBeVisible();
    const response = await page.request.get(
      `/api/local/content/${lesson.currentVersion}`,
    );
    expect(response.ok(), `Lesson state: HTTP ${response.status()}`).toBe(true);
    const saved = await response.json();
    if (saved.session?.state === "active")
      await expect(page.locator(".exercise")).toHaveAttribute(
        "aria-busy",
        "false",
      );
    else
      await expect(
        page.getByRole("button", {
          name: new RegExp(`^(Bắt đầu học ${id}|Luyện lại bài nháp)$`),
        }),
      ).toBeVisible();
    await layout(page);
  });
