import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { weekdays } from "../../src/modules/planning/domain/preview-plan";
import { layout } from "../helpers/draft-journey";
import type { StudySnapshot } from "../../src/modules/planning/domain/study-types";

test.beforeAll(async ({ request }) => {
  // Separate development compilation from the unchanged 15s UI/API assertions.
  const id = process.env.CSH_HSK_TODAY_LESSON ?? "L274";
  for (const path of [
    "/onboarding",
    "/api/local/mode",
    "/schedule",
    "/today",
    `/learn/draft/${id}`,
    "/api/local/mode",
    "/api/local/snapshot",
    "/api/local/preferences",
    "/api/local/study/settings",
    "/api/local/study/preview",
    "/api/local/study/today",
  ])
    await request.get(path, { timeout: 60000 });
});

test("Today preserves pinned resume and prioritizes due FSRS reviews", async ({
  page,
}) => {
  const id = process.env.CSH_HSK_TODAY_LESSON ?? "L274";
  const catalog = JSON.parse(
    fs.readFileSync("content/hsk24/catalog.json", "utf8"),
  );
  const version = catalog.lessons
    .find((l: { key: string }) => l.key === id)
    .currentVersion.match(/-v(\d+)$/)[1];
  const p = JSON.parse(
    fs.readFileSync(`content/hsk24/${id}.v${version}.json`, "utf8"),
  );
  await page.goto("/onboarding");
  await page
    .getByRole("button", { name: "Bắt đầu học có lưu", exact: true })
    .click();
  await expect(page).toHaveURL(/\/schedule(?:\?|$)/);
  await page.goto("/schedule");
  await page.getByRole("button", { name: "3 giờ / tuần", exact: true }).click();
  for (const day of weekdays)
    await page.getByRole("checkbox", { name: day, exact: true }).check();
  await page.getByLabel("Tối đa mỗi ngày", { exact: true }).fill("90");
  await page
    .getByRole("button", { name: "Lưu lịch vào PostgreSQL", exact: true })
    .click();
  await expect(page).toHaveURL(/\/today/);
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
  await page
    .getByRole("button", { name: "Đã đọc · tiếp tục", exact: true })
    .click();
  await expect(page.locator(".exercise")).toHaveAttribute("aria-busy", "false");
  const beforeResponse = await page.request.get(
    `/api/local/content/${p.lesson.versionId}`,
  );
  expect(
    beforeResponse.ok(),
    `Before Today: HTTP ${beforeResponse.status()}`,
  ).toBe(true);
  const before = await beforeResponse.json();
  expect(
    before.session,
    "Before Today requires an acknowledged session",
  ).toBeTruthy();
  await page.goto("/today");
  const response = await page.request.get("/api/local/study/today");
  expect(response.ok()).toBe(true);
  const snapshot: StudySnapshot = await response.json();
  const plan = snapshot.plan!;
  expect(plan).toBeTruthy();
  expect(
    [...plan.blocks, ...plan.frozen].some(
      (b) =>
        b.kind === "resume" &&
        b.target === p.lesson.versionId &&
        b.sessionId === before.session.id &&
        b.localDate === plan.today,
    ),
  ).toBe(true);
  const pinned = `/learn/draft/${id}?version=${p.lesson.versionId}`;
  test.info().annotations.push({
    type: "today-priority-branch",
    description:
      plan.dueCount > 0 ? "DUE_FSRS_BEFORE_RESUME" : "NO_DEBT_PINNED_RESUME",
  });
  if (plan.dueCount > 0) {
    // Other journeys legitimately create due cards for this shared test owner.
    // Verify priority and saved resume rather than deleting history or forcing
    // resume to outrank FSRS. The no-debt branch still clicks Today's exact link.
    expect(plan.action?.kind).toBe("review");
    await expect(page.getByTestId("study-primary")).toContainText(
      "Ôn thẻ đến hạn",
    );
    await expect(page.getByTestId("study-primary")).toHaveAttribute(
      "href",
      "/review",
    );
    await page.goto(pinned);
  } else {
    expect(plan.action?.kind).toBe("resume");
    await expect(page.getByTestId("study-primary")).toContainText(
      `Tiếp tục ${id}`,
    );
    await expect(page.getByTestId("study-primary")).toHaveAttribute(
      "href",
      pinned,
    );
    await page.getByTestId("study-primary").click();
  }
  await expect(
    page.getByRole("heading", { name: p.lesson.title, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: p.lesson.title, exact: true }),
  ).toBeVisible();
  const afterResponse = await page.request.get(
    `/api/local/content/${p.lesson.versionId}`,
  );
  expect(
    afterResponse.ok(),
    `After Today: HTTP ${afterResponse.status()}`,
  ).toBe(true);
  const after = await afterResponse.json();
  expect(
    after.session,
    "After Today requires an acknowledged session",
  ).toBeTruthy();
  expect(after.session.cursor).toBe(before.session.cursor);
  await layout(page);
});
