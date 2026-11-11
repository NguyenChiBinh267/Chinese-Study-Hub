import { test, expect } from "@playwright/test";
import fs from "node:fs";
const read = (n: string) =>
    JSON.parse(
      fs
        .readFileSync(`.local-postgres/cloud-gates/${n}`, "utf8")
        .replace(/^\uFEFF/, ""),
    ),
  target = read("benchmark-target.json"),
  state = read("auth-test-accounts.json"),
  origin = new URL(target.url).origin;
if (
  target.provider !== "vercel-hobby" ||
  target.projectRef !== "yartjbdapoyqcxfagsrj" ||
  state.projectRef !== target.projectRef ||
  !/^https:\/\/csh-cloud-gate-[a-z0-9-]+\.vercel\.app$/.test(origin)
)
  throw Error("TEMPORARY_HTTPS_PROOF_REQUIRED");
test("Hosted owner UI, Secure HttpOnly cookie, SQL transaction and logout", async ({
  page,
  context,
}) => {
  await page.goto(origin);
  await expect(
    page.getByRole("heading", { name: "Kiểm chứng Cloud Gate", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Email thử nghiệm", { exact: true })
    .fill(state.owner.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(state.owner.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("status")).toContainText('"signedIn":true');
  const cookies = (await context.cookies()).filter((c) =>
    c.name.startsWith("__Host-csh-proof"),
  );
  expect(cookies.length).toBeGreaterThan(0);
  for (const c of cookies) {
    expect(c.secure).toBe(true);
    expect(c.httpOnly).toBe(true);
    expect(c.sameSite).toBe("Strict");
    expect(c.path).toBe("/");
  }
  await page
    .getByRole("button", { name: "Ghi giao dịch tổng hợp", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText('"tlsVerified":true');
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page.getByRole("status")).toContainText('"signedOut":true');
  const r = await page.request.get(origin + "/api/proof");
  expect(r.status()).toBe(401);
  expect(r.headers()["cache-control"]).toContain("no-store");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("Hosted real-learning routes stay absent", async ({ request }) => {
  for (const route of ["/learn", "/learn/draft/F01", "/api/local/content"]) {
    const r = await request.get(origin + route);
    expect(r.status()).toBe(404);
    expect(await r.text()).not.toContain('"privateKeys"');
  }
});
