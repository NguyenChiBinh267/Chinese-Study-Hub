import { test, expect } from "@playwright/test";

test.beforeAll(async ({ request }) => {
  // Compile development routes before measuring the functional refresh seam.
  // These unauthenticated GETs do not create owners, schedules or sessions.
  for (const path of [
    "mode",
    "snapshot",
    "preferences",
    "study/settings",
    "study/preview",
  ])
    await request.get(`/api/local/${path}`, { timeout: 60000 });
});

test("Saving a schedule retains the form while the acknowledged write refreshes its snapshot", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await page
    .getByRole("button", { name: "Bắt đầu học có lưu", exact: true })
    .click();
  await expect(page).toHaveURL(/\/schedule(?:\?|$)/);
  await page.goto("/schedule");
  const cap = page.getByLabel("Tối đa mỗi ngày", { exact: true });
  await expect(cap).toBeVisible();
  await cap.fill("90");
  let release!: () => void;
  let arrived!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const refreshing = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  await page.route("**/api/local/snapshot", async (route) => {
    arrived();
    await held;
    await route.continue();
  });
  try {
    await page
      .getByRole("button", { name: "Lưu lịch vào PostgreSQL", exact: true })
      .click();
    await refreshing;
    await expect(
      page.getByText("Đang chờ database xác nhận…", { exact: true }),
    ).toBeVisible();
    // The response has been acknowledged; the background refresh must not
    // destroy the submitting form or its entered values.
    expect(await cap.isVisible()).toBe(true);
    await expect(cap).toHaveValue("90");
    await expect(
      page.getByRole("button", {
        name: "Đang chờ server xác nhận…",
        exact: true,
      }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(page).toHaveURL(/\/today/);
});
