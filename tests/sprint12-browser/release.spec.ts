import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { Client } from "pg";
const auth = JSON.parse(
    fs.readFileSync(
      ".local-postgres/sprint10/auth-local/credentials.json",
      "utf8",
    ),
  ),
  s = JSON.parse(
    fs.readFileSync(".local-postgres/sprint12/database.json", "utf8"),
  );
const origin = "http://127.0.0.1:3024",
  headers = { origin, "content-type": "application/json", "x-csh-auth": "1" };
async function login(page: Page, who: "owner" | "other" = "owner") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(auth[who].email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(auth[who].password);
  async function submit() {
    const response = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/auth/login" &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    return response;
  }
  let r = await submit();
  if (r.status() === 429) {
    expect((await r.json()).error.code).toBe("LOGIN_RATE_LIMIT");
    await page.waitForTimeout(31000);
    await page.waitForTimeout(30000);
    r = await submit();
  }
  expect(r.status()).toBe(who === "owner" ? 200 : 403);
  if (who === "owner") {
    await expect(page).toHaveURL(/\/today$/);
    await expect(
      page.getByText("KIỂM THỬ TỔNG HỢP · CHỈ LOCAL", { exact: true }),
    ).toBeVisible();
  }
}
async function json(page: Page, path: string) {
  const r = await page.request.get("/api/v1/" + path);
  expect(r.ok()).toBe(true);
  return r.json();
}
async function isolatedAdmin() {
  expect(s.database).toMatch(/^csh_release_verify_[a-f0-9]{12}$/);
  const secret = JSON.parse(
    fs.readFileSync(".local-postgres/credentials.json", "utf8"),
  );
  const c = new Client({
    host: "127.0.0.1",
    port: 5447,
    user: "csh_migrator",
    password: secret.admin,
    database: s.database,
  });
  await c.connect();
  return c;
}
test("Real owner learns published synthetic immutable package, grades, reloads, reviews FSRS and restores history", async ({
  page,
}) => {
  await login(page);
  const before = await json(page, "progress");
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "3 giờ / tuần", exact: true }).click();
  await page
    .getByRole("button", { name: "Lưu lịch vào PostgreSQL", exact: true })
    .click();
  await expect(page).toHaveURL(/\/today$/);
  await page.goto("/learn");
  await page.getByRole("link", { name: "Mở FOUNDATION", exact: true }).click();
  const catalog = await json(page, "curriculum"),
    unit = catalog.units.find(
      (u: { id: string }) => u.id === catalog.lessons[0].unitId,
    );
  await page.getByRole("link", { name: unit.title, exact: true }).click();
  await page.getByRole("link", { name: "Học F01", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Kiểm thử phát hành · ký hiệu tổng hợp",
      exact: true,
    }),
  ).toBeVisible();
  const projection = await json(page, "content/" + s.versionId);
  await expect(
    page.getByText("Synthetic test signal, not reference speech", {
      exact: true,
    }),
  ).toBeVisible();
  expect(JSON.stringify(projection)).not.toMatch(
    /"(privateKeys|accepted|reviewer|qualification|keyRef)"/,
  );
  await page
    .getByRole("button", { name: /^(Bắt đầu học F01|Luyện lại bài)$/ })
    .click();
  await page
    .getByRole("button", { name: "Đã đọc · tiếp tục", exact: true })
    .click();
  for (const [i, token] of ["PIPELINE_TOKEN_A", "PIPELINE_TOKEN_B"].entries()) {
    await page.getByRole("radio", { name: token, exact: true }).check();
    await page
      .getByRole("button", { name: "Gửi và lưu câu trả lời", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Đã lưu PostgreSQL · Khớp đáp án" }),
    ).toBeVisible();
    if (i === 0) {
      await page.reload();
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "Đã lưu PostgreSQL · Khớp đáp án" }),
      ).toBeVisible();
    }
    await page
      .getByRole("button", { name: "Bước tiếp theo", exact: true })
      .click();
  }
  const completion = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      new URL(r.url()).pathname.endsWith("/complete"),
  );
  await page
    .getByRole("button", { name: "Hoàn tất luyện tập có lưu", exact: true })
    .click();
  expect((await completion).status()).toBe(200);
  await expect
    .poll(
      async () => (await json(page, "content/" + s.versionId)).session.state,
    )
    .toBe("completed");
  await expect
    .poll(async () => (await json(page, "progress")).attempts)
    .toBe(before.attempts + 2);
  await page.goto("/review");
  await page
    .getByRole("button", { name: "Lật thẻ từ server", exact: true })
    .click();
  await page.getByRole("button", { name: /Good/ }).click();
  await expect
    .poll(async () => (await json(page, "progress")).reviews)
    .toBe(before.reviews + 1);
  await page.goto("/progress");
  await expect(
    page.getByRole("heading", { name: "Tiến độ của bạn", exact: true }),
  ).toBeVisible();
  await page.goto("/account");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect((await page.request.get("/api/v1/progress")).status()).toBe(401);
  await login(page);
  expect((await json(page, "progress")).attempts).toBe(before.attempts + 2);
  expect((await json(page, "content/" + s.versionId)).session.state).toBe(
    "completed",
  );
});
test("Owner/non-owner, publication spoofing, DRAFT/private data and authenticated audio boundaries", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/v1/content")).status()).toBe(401);
  expect((await request.get("/api/v1/media/" + s.mediaId)).status()).toBe(401);
  await login(page, "other");
  await login(page);
  const draft = await page.request.get("/api/v1/content/f01-draft-v1");
  expect(draft.status()).toBe(404);
  expect(await draft.text()).not.toContain("privateKeys");
  const fake = await page.request.post(
    "/api/v1/content/" + s.versionId + "/start",
    {
      headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      data: {
        restart: true,
        packageHash: "0".repeat(64),
        published: true,
        approved: true,
      },
    },
  );
  expect(fake.status()).toBe(422);
  expect(
    (
      await page.request.get("/api/v1/content", {
        headers: { "x-user-id": auth.other.id },
      })
    ).status(),
  ).toBe(403);
  const media = await page.request.get("/api/v1/media/" + s.mediaId);
  expect(media.status()).toBe(200);
  expect(media.headers()["content-type"]).toContain("audio/wav");
  expect(media.headers()["cache-control"]).toContain("no-store");
  expect((await media.body()).subarray(0, 4).toString()).toBe("RIFF");
  for (const path of ["content", "curriculum", "snapshot", "release"]) {
    const r = await page.request.get("/api/v1/" + path);
    expect(r.headers()["cache-control"]).toContain("no-store");
    expect(await r.text()).not.toMatch(
      /"(privateKeys|accepted|reviewer|qualification|consentReceipt)"/,
    );
  }
});
test("Withdrawn or corrupt release fails closed; restore keeps SQL history", async ({
  page,
}) => {
  await login(page);
  const file = s.root + "/trusted.json",
    original = fs.readFileSync(file),
    before = await json(page, "progress");
  try {
    const reg = JSON.parse(original.toString());
    reg.releases.find((x: { id: string }) => x.id === s.releaseId).state =
      "WITHDRAWN";
    fs.writeFileSync(file, JSON.stringify(reg));
    const r = await page.request.get("/api/v1/content/" + s.versionId);
    expect(r.status()).toBe(503);
    expect((await r.json()).error.code).toBe("CONTENT_RELEASE_UNAVAILABLE");
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Dữ liệu chưa được xác nhận",
        exact: true,
      }),
    ).toBeVisible();
    await page.goto("/account");
    await expect(
      page.getByRole("button", { name: "Đăng xuất", exact: true }),
    ).toBeVisible();
    await page.goto("/today");
    await expect(
      page.getByRole("heading", {
        name: "Dữ liệu chưa được xác nhận",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    fs.writeFileSync(file, original);
  }
  await page
    .getByRole("button", { name: "Tải lại dữ liệu", exact: true })
    .click();
  await expect(
    page.getByText("KIỂM THỬ TỔNG HỢP · CHỈ LOCAL", { exact: true }),
  ).toBeVisible();
  expect((await json(page, "progress")).attempts).toBe(before.attempts);
  const db = await isolatedAdmin(),
    hash = (await json(page, "content/" + s.versionId)).lesson.packageHash;
  try {
    expect(
      (
        await db.query(
          "UPDATE app_content.packages SET state='RETIRED' WHERE version_id=$1 AND package_hash=$2",
          [s.versionId, hash],
        )
      ).rowCount,
    ).toBe(1);
    for (const path of [
      "media/" + s.mediaId,
      "content/" + s.versionId,
      "status",
    ]) {
      const response = await page.request.get("/api/v1/" + path);
      expect(response.status()).toBe(503);
      expect((await response.json()).error.code).toBe(
        "CONTENT_RELEASE_UNAVAILABLE",
      );
    }
  } finally {
    await db.query(
      "UPDATE app_content.packages SET state='PUBLISHED' WHERE version_id=$1 AND package_hash=$2",
      [s.versionId, hash],
    );
    await db.end();
  }
  expect((await json(page, "progress")).attempts).toBe(before.attempts);
});
test("Published scope, HSK2–4 unavailable, keyboard, 360px and 200% zoom", async ({
  page,
}) => {
  await login(page);
  await page.goto("/learn");
  const c = await json(page, "curriculum");
  expect(c.courses).toHaveLength(5);
  for (const code of ["HSK2", "HSK3", "HSK4"])
    expect(
      c.courses.find((x: { code: string }) => x.code === code).totalLessons,
    ).toBe(0);
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    "BODY",
  );
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    a11y.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const zoomImage = await page.screenshot({
    path: `.local-postgres/sprint12/published-${test.info().project.name}-zoom.png`,
    fullPage: true,
    scale: "css",
  });
  expect(zoomImage.readUInt32BE(16)).toBe(page.viewportSize()!.width);
  const credentials = JSON.parse(
    fs.readFileSync(".local-postgres/credentials.json", "utf8"),
  );
  const db = new Client({
    host: "127.0.0.1",
    port: 5447,
    user: "csh_migrator",
    password: credentials.admin,
    database: s.database,
  });
  await db.connect();
  try {
    const rows = (
      await db.query(
        "SELECT p.package_hash,b.package_hash AS bound,e.id,b.exercise_version_id FROM app_private.content_attempt_bindings b JOIN app_content.packages p ON p.version_id=b.package_id JOIN app_content.exercise_versions e ON e.id=b.exercise_version_id WHERE b.user_id=$1 AND b.package_id=$2",
        [auth.owner.id, s.versionId],
      )
    ).rows;
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(
      rows.every(
        (r) => r.package_hash === r.bound && r.id === r.exercise_version_id,
      ),
    ).toBe(true);
  } finally {
    await db.end();
  }
});
