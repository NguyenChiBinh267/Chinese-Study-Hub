import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const fixture = JSON.parse(
  fs.readFileSync(
    ".local-postgres/sprint10/auth-local/credentials.json",
    "utf8",
  ),
);
const origin = "http://127.0.0.1:3021",
  headers = { origin, "Content-Type": "application/json", "x-csh-auth": "1" };
async function login(
  page: Page,
  who: "owner" | "other" = "owner",
  next = "/today",
) {
  await page.goto("/login?next=" + encodeURIComponent(next));
  await page.getByLabel("Email", { exact: true }).fill(fixture[who].email);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(fixture[who].password);
  const submit = async () => {
    const response = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/auth/login" &&
        r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    return response;
  };
  const result = await submit();
  if (result.status() === 429) {
    // The real ten-attempt/minute guard also covers the sequential mobile suite.
    // Assert the rejection, then wait its actual window; never disable the guard.
    expect((await result.json()).error.code).toBe("LOGIN_RATE_LIMIT");
    await expect(
      page.getByRole("alert").filter({ hasText: "Chờ một phút" }),
    ).toBeVisible();
    test.info().setTimeout(test.info().timeout + 65000);
    await page.waitForTimeout(31000);
    await page.waitForTimeout(30000);
    expect((await submit()).status()).toBe(who === "owner" ? 200 : 403);
  }
  if (who === "owner") {
    await expect(page).toHaveURL(
      new RegExp(next === "/today" ? "/today$" : "/account$"),
    );
    await expect(
      page.getByText("PRODUCTION_AUTHENTICATED · OWNER", { exact: true }),
    ).toBeVisible();
  }
}
async function accessibility(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}
async function sessionData(context: BrowserContext) {
  const cookies = (await context.cookies())
    .filter((c) => /^csh-owner-auth(?:\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const raw = cookies.map((c) => c.value).join("");
  expect(raw.startsWith("base64-")).toBe(true);
  return {
    data: JSON.parse(Buffer.from(raw.slice(7), "base64url").toString()),
    cookie: cookies[0],
  };
}
async function replaceSession(
  context: BrowserContext,
  data: unknown,
  cookie: Awaited<ReturnType<typeof sessionData>>["cookie"],
) {
  await context.clearCookies({ name: /^csh-owner-auth(?:\.\d+)?$/ });
  await context.addCookies([
    {
      ...cookie,
      name: "csh-owner-auth",
      value:
        "base64-" + Buffer.from(JSON.stringify(data)).toString("base64url"),
    },
  ]);
}
function refreshCount() {
  return fs
    .readFileSync(
      ".local-postgres/sprint10/auth-local/gateway-events.jsonl",
      "utf8",
    )
    .split("\n")
    .filter(
      (l) =>
        l &&
        JSON.parse(l).grant === "refresh_token" &&
        JSON.parse(l).status === 200,
    ).length;
}

test("Real GoTrue: unauthenticated routes/APIs, forged identity headers, CSRF, invalid password and authenticated non-owner are denied", async ({
  page,
  request,
}) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login\?next=/);
  await accessibility(page);
  for (const path of [
    "/api/v1/me",
    "/api/v1/snapshot",
    "/api/v1/content",
    "/api/v1/progress",
  ]) {
    const r = await request.get(path);
    expect(r.status()).toBe(401);
    expect(r.headers()["cache-control"]).toContain("no-store");
  }
  expect(
    (
      await request.get("/api/v1/me", {
        headers: { "x-user-id": fixture.owner.id },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/auth/login", {
        data: { email: fixture.owner.email, password: "invalid" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { ...headers, origin: "https://evil.invalid" },
        data: { email: fixture.owner.email, password: "invalid" },
      })
    ).status(),
  ).toBe(403);
  const bad = await request.post("/api/auth/login", {
    headers,
    data: { email: fixture.owner.email, password: "invalid" },
  });
  expect(bad.status()).toBe(401);
  await login(page, "other");
  await expect(page.locator("form [role=alert]")).toContainText(
    "không được phép",
  );
  expect(
    (await page.context().cookies()).filter((c) =>
      c.name.startsWith("csh-owner-auth"),
    ),
  ).toHaveLength(0);
  const signup = await request.post("http://127.0.0.1:54390/auth/v1/signup", {
    headers: { apikey: fixture.anonKey },
    data: {
      email: "not-created@csh.invalid",
      password: "synthetic-not-created-123456",
    },
  });
  expect(signup.status()).toBe(422);
  expect((await signup.json()).error_code).toBe("signup_disabled");
  const nonOwnerResponse = await request.post(
    "http://127.0.0.1:54390/auth/v1/token?grant_type=password",
    {
      headers: { apikey: fixture.anonKey },
      data: { email: fixture.other.email, password: fixture.other.password },
    },
  );
  expect(nonOwnerResponse.status()).toBe(200);
  const nonOwnerSession = await nonOwnerResponse.json();
  nonOwnerSession.user.id = fixture.owner.id;
  const denied = await request.get("/api/v1/me", {
    headers: {
      cookie:
        "csh-owner-auth=base64-" +
        Buffer.from(JSON.stringify(nonOwnerSession)).toString("base64url"),
    },
  });
  expect(denied.status()).toBe(403);
  expect((await denied.json()).error.code).toBe("OWNER_ONLY");
});

test("Real owner login → saved profile/schedule → reload/progress; DRAFT data, local adapter and forged body ownership stay blocked", async ({
  page,
}) => {
  await login(page, "owner", "/account");
  const cookies = await page.context().cookies();
  expect(
    cookies
      .filter((c) => c.name.startsWith("csh-owner-auth"))
      .every((c) => c.httpOnly && c.sameSite === "Strict" && !c.secure),
  ).toBe(true);
  await page
    .getByLabel("Tên hiển thị", { exact: true })
    .fill("Chủ máy thử cục bộ");
  await page
    .getByRole("combobox", { name: "Cỡ chữ", exact: true })
    .selectOption("large");
  await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu hồ sơ");
  await page.reload();
  await expect(page.getByLabel("Tên hiển thị", { exact: true })).toHaveValue(
    "Chủ máy thử cục bộ",
  );
  await accessibility(page);
  for (const payload of [
    {
      displayName: "Forged",
      textSize: "normal",
      timezone: "Asia/Saigon",
      userId: fixture.other.id,
    },
    { displayName: "Owner", textSize: "normal", timezone: "Invalid/Moon" },
  ])
    expect(
      (
        await page.request.patch("/api/v1/me", { headers, data: payload })
      ).status(),
    ).toBe(422);
  const local = await page.request.post("/api/local/mode", {
    headers: { origin, "x-csh-local": "1" },
    data: { local: true },
  });
  expect(local.status()).toBe(403);
  for (const path of [
    "content",
    "content/f01-draft-v1",
    "curriculum",
    "pronunciation",
    "fixture",
    "cards/00000000-0000-4000-8000-000000000001/reveal",
  ]) {
    const r = await page.request.get("/api/v1/" + path);
    expect(r.status()).toBe(403);
    expect((await r.json()).error.code).toBe("DRAFT_CONTENT_LOCKED");
  }
  await page.goto("/schedule");
  await page
    .getByRole("button", { name: "Lưu lịch vào PostgreSQL", exact: true })
    .click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(
    page.getByRole("heading", {
      name: "Lịch học của bạn đã được lưu",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Lịch học của bạn đã được lưu",
      exact: true,
    }),
  ).toBeVisible();
  const actualIdentity = await page.request.get(
    "/api/v1/me?userId=" + fixture.other.id,
  );
  expect((await actualIdentity.json()).userId).toBe(fixture.owner.id);
  const currentSettings = await (
      await page.request.get("/api/v1/study/settings")
    ).json(),
    key = crypto.randomUUID();
  const command = {
    preferences: currentSettings.preferences,
    planning: currentSettings.planning,
    expectedVersion: currentSettings.expectedVersion,
    acceptLimited: true,
  };
  const replayOptions = {
    headers: { ...headers, "Idempotency-Key": key },
    data: command,
  };
  const simultaneous = await Promise.all([
    page.request.patch("/api/v1/preferences", replayOptions),
    page.request.patch("/api/v1/preferences", replayOptions),
  ]);
  expect(simultaneous.every((r) => r.status() === 200)).toBe(true);
  const acknowledged = await Promise.all(simultaneous.map((r) => r.json()));
  expect(acknowledged[0]).toEqual(acknowledged[1]);
  expect(acknowledged[0].saved.version).toBe(
    currentSettings.expectedVersion + 1,
  );
  await page.goto("/learn/pronunciation?pilot=1");
  await expect(
    page.getByRole("heading", {
      name: "Chưa có bài được duyệt để học online.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  await page.goto("/progress");
  await expect(
    page.getByRole("heading", {
      name: "Chưa có kết quả học đã lưu",
      exact: true,
    }),
  ).toBeVisible();
  await accessibility(page);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
});

test("Real provider refresh works; cached user fields do not authorize; forged token fails closed", async ({
  page,
}) => {
  await login(page);
  const stored = await sessionData(page.context()),
    before = refreshCount();
  stored.data.expires_at = 1;
  stored.data.user = { ...stored.data.user, id: fixture.other.id };
  await replaceSession(page.context(), stored.data, stored.cookie);
  const refreshed = await page.request.get("/api/v1/me");
  expect(refreshed.status()).toBe(200);
  expect((await refreshed.json()).userId).toBe(fixture.owner.id);
  expect(refreshCount()).toBeGreaterThan(before);
  const current = await sessionData(page.context());
  current.data.user = { ...current.data.user, id: fixture.other.id };
  await replaceSession(page.context(), current.data, current.cookie);
  const checked = await page.request.get("/api/v1/me");
  expect(checked.status()).toBe(200);
  expect((await checked.json()).userId).toBe(fixture.owner.id);
  current.data.access_token = current.data.access_token.slice(0, -5) + "abcde";
  current.data.expires_at = Math.floor(Date.now() / 1000) + 3600;
  await replaceSession(page.context(), current.data, current.cookie);
  expect((await page.request.get("/api/v1/me")).status()).toBe(401);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/login/);
});

test("Real logout revokes copied session, clears two tabs without retaining private UI, and login restores saved data", async ({
  page,
  context,
  browser,
}) => {
  await login(page, "owner", "/account");
  const stolen = await context.storageState();
  const otherTab = await context.newPage();
  await otherTab.goto("/today");
  await expect(
    otherTab.getByText("PRODUCTION_AUTHENTICATED · OWNER", { exact: true }),
  ).toBeVisible();
  const aborted: string[] = [];
  page.on("requestfailed", (r) => {
    if (r.url().endsWith("/api/v1/progress")) aborted.push(r.url());
  });
  await page.route("**/api/v1/progress", () => {});
  const pendingProgress = page.waitForRequest("**/api/v1/progress");
  await page.goto("/progress");
  await pendingProgress;
  if (test.info().project.name === "mobile")
    await page
      .getByRole("link", { name: "学 · Thiết lập hồ sơ", exact: true })
      .click();
  else await page.locator("a.profile").click();
  await expect(
    page.getByRole("button", { name: "Đăng xuất", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?loggedOut=/);
  await expect(otherTab).toHaveURL(/\/session-expired/);
  await expect.poll(() => aborted.length).toBeGreaterThan(0);
  await expect(
    otherTab.getByText("PRODUCTION_AUTHENTICATED · OWNER", { exact: true }),
  ).toHaveCount(0);
  const replay = await browser.newContext({ storageState: stolen });
  try {
    expect((await replay.request.get(origin + "/api/v1/me")).status()).toBe(
      401,
    );
  } finally {
    await replay.close();
  }
  expect((await page.request.get("/api/v1/me")).status()).toBe(401);
  await login(page, "owner", "/account");
  await expect(page.getByLabel("Tên hiển thị", { exact: true })).toHaveValue(
    "Chủ máy thử cục bộ",
  );
  await page.goto("/today");
  await expect(
    page.getByRole("heading", {
      name: "Lịch học của bạn đã được lưu",
      exact: true,
    }),
  ).toBeVisible();
});
