import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { verifiedPgOptions } from "../../scripts/cloud-gates-policy";
import { ownerTransaction } from "../../src/shared/db/transaction";
const dir = ".local-postgres/cloud-gates",
  read = (n: string) =>
    JSON.parse(fs.readFileSync(`${dir}/${n}`, "utf8").replace(/^\uFEFF/, ""));
const state = read("auth-test-accounts.json"),
  db = read("runtime-connection.json");
if (
  state.projectRef !== "yartjbdapoyqcxfagsrj" ||
  db.projectRef !== state.projectRef
)
  throw Error("ACTUAL_CLOUD_PROJECT_REQUIRED");
const pool = new Pool({
  ...verifiedPgOptions(
    db.runtimeUrl,
    fs.readFileSync(`${dir}/supabase-ca.crt`, "utf8"),
  ),
  max: 1,
});
test.afterAll(async () => {
  await pool.end();
});
const headers = {
  "content-type": "application/json",
  "x-csh-proof": "1",
  origin: "http://127.0.0.1:3032",
};
async function login(page: Page) {
  await page.goto("/");
  await page
    .getByLabel("Email thử nghiệm", { exact: true })
    .fill(state.owner.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(state.owner.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("status")).toContainText('"signedIn":true');
}
test("Actual cloud owner → server verification → runtime SQL read/idempotent transaction; no cache or ownership spoof", async ({
  page,
}) => {
  await login(page);
  const key = randomUUID();
  for (let i = 0; i < 2; i++) {
    const r = await page.request.post("/api/proof", { headers, data: { key } });
    expect(r.status()).toBe(200);
    expect(r.headers()["cache-control"]).toContain("no-store");
    expect((await r.json()).tlsVerified).toBe(true);
  }
  await ownerTransaction(pool, state.owner.id, async (c) => {
    expect(
      (
        await c.query(
          "SELECT * FROM app_private.api_idempotency WHERE endpoint='cloud-gate-proof-v1' AND key=$1",
          [key],
        )
      ).rowCount,
    ).toBe(1);
  });
  await ownerTransaction(pool, state.nonowner.id, async (c) => {
    expect(
      (
        await c.query(
          "SELECT * FROM app_private.api_idempotency WHERE key=$1",
          [key],
        )
      ).rowCount,
    ).toBe(0);
  });
  const forged = randomUUID();
  expect(
    (
      await page.request.post("/api/proof", {
        headers,
        data: { key: forged, userId: state.nonowner.id, approved: true },
      })
    ).status(),
  ).toBe(400);
  await ownerTransaction(pool, state.owner.id, async (c) => {
    expect(
      (
        await c.query(
          "SELECT * FROM app_private.api_idempotency WHERE key=$1",
          [forged],
        )
      ).rowCount,
    ).toBe(0);
  });
  const r = await page.request.get("/api/proof");
  expect(r.status()).toBe(200);
  expect(r.headers()["vary"]).toContain("Cookie");
  expect(r.headers()["x-content-type-options"]).toBe("nosniff");
  await page.reload();
  expect((await page.request.get("/api/proof")).status()).toBe(200);
});
test("Actual non-owner, anonymous and forged identity are denied by server", async ({
  page,
}) => {
  await page.goto("/");
  expect((await page.request.get("/api/proof")).status()).toBe(401);
  const r = await page.request.post("/api/login", {
    headers,
    data: { email: state.nonowner.email, password: state.nonowner.password },
  });
  expect(r.status()).toBe(403);
  expect((await page.request.get("/api/proof")).status()).toBe(401);
  expect(
    (
      await page.request.get("/api/proof", {
        headers: { "x-owner-id": state.owner.id },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/proof", {
        headers: { ...headers, origin: "https://attacker.invalid" },
        data: { key: randomUUID() },
      })
    ).status(),
  ).toBe(403);
});
test("Actual logout revokes copied session and removes private access", async ({
  page,
  browser,
  context,
}) => {
  await login(page);
  const stored = await context.storageState();
  expect(
    (await page.request.post("/api/logout", { headers, data: {} })).status(),
  ).toBe(200);
  expect((await page.request.get("/api/proof")).status()).toBe(401);
  const copied = await browser.newContext({ storageState: stored });
  try {
    expect(
      (await copied.request.get("http://127.0.0.1:3032/api/proof")).status(),
    ).toBe(401);
  } finally {
    await copied.close();
  }
});
test("Only technical proof is served; no real learning routes or public draft adapter", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Kiểm chứng Cloud Gate", exact: true }),
  ).toBeVisible();
  for (const route of [
    "/learn",
    "/learn/draft/F01",
    "/api/local/content",
    "/api/v1/content",
  ]) {
    const r = await page.request.get(route);
    expect(r.status()).toBe(404);
    expect(await r.text()).not.toContain('"privateKeys"');
  }
  expect(await page.locator("body").innerText()).not.toContain("我叫");
  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport);
});
