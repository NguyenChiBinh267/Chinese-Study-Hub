import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";

test("Login fields are visibly bounded, keyboard usable, responsive, and still authenticate the local owner", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
  const email = page.getByLabel("Email", { exact: true });
  const password = page.getByLabel("Mật khẩu", { exact: true });
  for (const field of [email, password]) {
    await expect(field).toBeVisible();
    const paint = await field.evaluate((el) => {
      const s = getComputedStyle(el),
        r = el.getBoundingClientRect();
      return {
        border: parseFloat(s.borderTopWidth),
        borderStyle: s.borderTopStyle,
        borderColor: s.borderTopColor,
        background: s.backgroundColor,
        padding: parseFloat(s.paddingLeft),
        height: r.height,
        width: r.width,
      };
    });
    // Visibility alone passes for the original transparent, borderless inputs.
    expect(paint.border).toBeGreaterThanOrEqual(1);
    expect(paint.borderStyle).toBe("solid");
    expect(paint.borderColor).not.toBe(paint.background);
    expect(paint.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(paint.padding).toBeGreaterThanOrEqual(10);
    expect(paint.height).toBeGreaterThanOrEqual(44);
    expect(paint.height).toBeLessThanOrEqual(60);
    expect(paint.width).toBeGreaterThan(200);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await email.focus();
  await expect(email).toBeFocused();
  expect(
    await email.evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth)),
  ).toBeGreaterThanOrEqual(2);
  await page.keyboard.type("owner@example.invalid");
  await page.keyboard.press("Tab");
  await expect(password).toBeFocused();
  await page.keyboard.type("example-only");
  await expect(password).toHaveAttribute("type", "password");
  await page.keyboard.press("Tab");
  const reveal = page.getByRole("button", {
    name: "Hiện mật khẩu",
    exact: true,
  });
  await expect(reveal).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("example-only");
  await page.getByRole("button", { name: "Ẩn mật khẩu", exact: true }).click();
  await expect(password).toHaveAttribute("type", "password");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Đăng nhập", exact: true }),
  ).toBeFocused();
  await email.fill("");
  await password.fill("");
  await email.focus();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `.local-postgres/private-preview/login-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByText("Cần trợ giúp đăng nhập?", { exact: true }).click();
  await expect(page.getByText(/chưa có email khôi phục tự động/)).toBeVisible();
  await page.getByText("Cần trợ giúp đăng nhập?", { exact: true }).click();
  // UI-only simulation covers busy/error/retry without sending bad credentials to GoTrue.
  let releaseLogin: (() => void) | undefined;
  await page.route("**/api/auth/login", async (route) => {
    await new Promise<void>((resolve) => {
      releaseLogin = resolve;
    });
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          message: "Không đăng nhập được. Kiểm tra thông tin hoặc thử lại sau.",
        },
      }),
    });
  });
  await email.fill("owner@example.invalid");
  await password.fill("example-only");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Đang xác nhận…", exact: true }),
  ).toBeDisabled();
  await expect(email).toBeDisabled();
  await expect(password).toBeDisabled();
  await expect(reveal).toBeDisabled();
  await expect.poll(() => Boolean(releaseLogin)).toBe(true);
  releaseLogin!();
  await expect(page.locator(".login-card").getByRole("alert")).toContainText(
    "Không đăng nhập được.",
  );
  await expect(email).toBeEnabled();
  await expect(password).toBeEnabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `.local-postgres/private-preview/login-error-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.unroute("**/api/auth/login");
  // Real GoTrue login/logout; no profile or learning writes.
  const { owner } = JSON.parse(
    fs.readFileSync(
      ".local-postgres/sprint10/auth-local/credentials.json",
      "utf8",
    ),
  );
  await email.fill(owner.email);
  await password.fill(owner.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.goto("/account");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(email).toHaveValue("");
  await expect(password).toHaveValue("");
  expect((await page.request.get("/api/v1/content")).status()).toBe(401);
});
