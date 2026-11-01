import { test, expect } from "@playwright/test";

test("HSK1 catalog: first process request and warm navigation acknowledge real responses", async ({
  page,
  baseURL,
}, testInfo) => {
  const requests: Array<Record<string, unknown>> = [];
  const started = new Map<
    object,
    { time: number; row: Record<string, unknown> }
  >();
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/local/")) {
      const row: Record<string, unknown> = {
        path: new URL(r.url()).pathname,
        method: r.method(),
        status: "PENDING",
      };
      requests.push(row);
      started.set(r, { time: Date.now(), row });
    }
  });
  page.on("response", (r) => {
    const t = started.get(r.request());
    if (t !== undefined)
      Object.assign(t.row, {
        status: r.status(),
        ms: Date.now() - t.time,
        serverTiming: r.headers()["server-timing"] ?? null,
      });
  });
  page.on("requestfailed", (r) => {
    const t = started.get(r);
    if (t !== undefined)
      Object.assign(t.row, {
        status: null,
        failure: r.failure()?.errorText,
        ms: Date.now() - t.time,
      });
  });
  try {
    if (process.env.CSH_HSK1_STABILITY_UI_SETUP === "1") {
      await page.goto("/onboarding");
      await page
        .getByRole("button", { name: "Bắt đầu học có lưu", exact: true })
        .click();
      await expect(page).toHaveURL(/\/schedule(?:\?|$)/);
    } else {
      const setup = await page.request.post("/api/local/mode", {
        data: { local: true },
        headers: { Origin: new URL(baseURL!).origin, "x-csh-local": "1" },
        timeout: 20000,
      });
      expect(setup.status()).toBe(200);
    }
    await page.goto("/learn");
    await expect(page.getByTestId("course-HSK1")).toBeVisible({
      timeout: 17000,
    });
    expect(
      requests.some(
        (r) => r.path === "/api/local/curriculum" && r.status === 200,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Chưa đọc được danh mục khóa học" }),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("course-HSK1")).toBeVisible({
      timeout: 17000,
    });
    expect(
      requests.filter(
        (r) => r.path === "/api/local/curriculum" && r.status === 200,
      ).length,
    ).toBeGreaterThanOrEqual(2);
  } finally {
    await testInfo.attach("redacted-local-http-observations", {
      body: JSON.stringify(requests),
      contentType: "application/json",
    });
  }
});

for (const fault of ["network", "timeout"] as const)
  test(`Catalog ${fault}: explicit failure without automatic retry or false cards`, async ({
    page,
    baseURL,
  }, testInfo) => {
    const setup = await page.request.post("/api/local/mode", {
      data: { local: true },
      headers: { Origin: new URL(baseURL!).origin, "x-csh-local": "1" },
      timeout: 20000,
    });
    expect(setup.status()).toBe(200);
    let calls = 0;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/local/curriculum", async (route) => {
      calls++;
      if (fault === "network") await route.abort("connectionfailed");
      else {
        await pending;
        await route.abort().catch(() => {});
      }
    });
    try {
      await page.goto("/learn");
      const error = page.getByRole("alert").filter({
        hasText:
          fault === "timeout" ? "Đã hết thời gian chờ" : "Không kết nối được",
      });
      await expect(error).toBeVisible({ timeout: 17000 });
      await expect(page.getByTestId("course-HSK1")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Thử đọc khóa học lại" }),
      ).toBeVisible();
      expect(calls).toBe(1);
      await testInfo.attach("fault-scope", {
        body: JSON.stringify({
          fault,
          calls,
          simulatedAtBrowserBoundary: true,
          automaticRetry: false,
          deadlineMsUnchanged: 15000,
        }),
        contentType: "application/json",
      });
    } finally {
      release();
    }
  });

test("Catalog HTTP503 remains an error; manual retry shows loading then real server content", async ({
  page,
  baseURL,
}) => {
  const setup = await page.request.post("/api/local/mode", {
    data: { local: true },
    headers: { Origin: new URL(baseURL!).origin, "x-csh-local": "1" },
    timeout: 20000,
  });
  expect(setup.status()).toBe(200);
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/local/curriculum", async (route) => {
    calls++;
    if (calls === 1)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "LOCAL_DB_UNAVAILABLE",
            message: "Database chưa phản hồi.",
          },
        }),
      });
    else {
      await pending;
      await route.continue();
    }
  });
  try {
    await page.goto("/learn");
    await expect(
      page.getByRole("heading", { name: "Chưa đọc được danh mục khóa học" }),
    ).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: "HTTP 503" }),
    ).toBeVisible();
    await expect(page.getByTestId("course-HSK1")).toHaveCount(0);
    expect(calls).toBe(1);
    await page.getByRole("button", { name: "Thử đọc khóa học lại" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Đang đọc khóa học" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Chưa đọc được danh mục khóa học" }),
    ).toHaveCount(0);
    const response = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/local/curriculum" &&
        r.status() === 200,
    );
    release();
    expect((await response).ok()).toBe(true);
    await expect(page.getByTestId("course-HSK1")).toBeVisible();
    expect(calls).toBe(2);
  } finally {
    release();
  }
});
