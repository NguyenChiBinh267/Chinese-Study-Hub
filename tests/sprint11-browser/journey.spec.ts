import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { Client } from "pg";
const auth = JSON.parse(
  fs.readFileSync(
    ".local-postgres/sprint10/auth-local/credentials.json",
    "utf8",
  ),
);
const state: { database: string; ownerId: string; runtimeUrl: string } =
    JSON.parse(
      fs.readFileSync(
        (process.env.CSH_AUTH_FIXTURE_STATE_DIR ?? ".local-postgres/sprint11") +
          "/database.json",
        "utf8",
      ),
    ),
  origin = "http://127.0.0.1:3023";
function adminConfig(database: string) {
  if (
    database !== state.database ||
    !/^csh_auth_verify_[a-f0-9]{12}$/.test(database)
  )
    throw Error("Isolated test database required");
  const credentials = JSON.parse(
    fs.readFileSync(".local-postgres/credentials.json", "utf8"),
  );
  return {
    host: "127.0.0.1",
    port: 5447,
    user: "csh_migrator",
    password: credentials.admin,
    database,
  };
}
const headers = {
  origin,
  "content-type": "application/json",
  "x-csh-auth": "1",
};
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(auth.owner.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(auth.owner.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(
    page.getByRole("heading", {
      name: "Kiểm tra luồng học đã xác thực",
      exact: true,
    }),
  ).toBeVisible();
}
test.beforeEach(async () => {
  const c = new Client(adminConfig(state.database));
  await c.connect();
  try {
    // Only this generated, proof-bound, synthetic database. No native history.
    expect(state.database).toMatch(/^csh_auth_verify_[a-f0-9]{12}$/);
    const marker = (
      await c.query(
        "SELECT evidence FROM app_meta.runtime_proof WHERE singleton",
      )
    ).rows[0]?.evidence?.technicalFixture;
    expect(marker).toEqual({
      id: "csh-auth-technical-v1",
      ownerId: auth.owner.id,
    });
    const mixed = (
      await c.query(
        "SELECT EXISTS(SELECT 1 FROM app_private.lesson_sessions WHERE lesson_version_id<>'local-foundation-v1') OR EXISTS(SELECT 1 FROM app_private.cards WHERE template_version_id NOT IN ('local-recall-v1-0','local-recall-v1-1')) OR EXISTS(SELECT 1 FROM app_content.packages) AS mixed",
      )
    ).rows[0].mixed;
    expect(mixed).toBe(false);
    const tables = (
      await c.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='app_private'",
      )
    ).rows.map((r) => r.tablename as string);
    expect(tables).toHaveLength(19);
    expect(tables.every((t) => /^[a-z_]+$/.test(t))).toBe(true);
    if (process.env.CSH_PRESERVE_TEST_HISTORY === "1") return;
    await c.query(
      "TRUNCATE " +
        tables.map((t) => "app_private." + t).join(",") +
        " CASCADE",
    );
  } finally {
    await c.end();
  }
});
test("Real owner → profile → schedule → course/unit/lesson → grading → persisted FSRS → logout/re-login", async ({
  page,
}, info) => {
  await login(page);
  // Inject a transport outage only at the data-mode endpoint. Authentication
  // continues to use real GoTrue; retry must restore the technical content flag.
  let statusUnavailable = true;
  await page.route("**/api/v1/status", (route) =>
    statusUnavailable
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { message: "Dữ liệu thử tạm thời chưa sẵn sàng." },
          }),
        })
      : route.continue(),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Dữ liệu chưa được xác nhận",
      exact: true,
    }),
  ).toBeVisible();
  statusUnavailable = false;
  await page
    .getByRole("button", { name: "Tải lại dữ liệu", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Kiểm tra luồng học đã xác thực",
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute("**/api/v1/status");
  expect((await (await page.request.get("/api/v1/me")).json()).userId).toBe(
    auth.owner.id,
  );
  await page.goto("/account");
  await page
    .getByLabel("Tên hiển thị", { exact: true })
    .fill("Kiểm thử kỹ thuật");
  await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Đã lưu hồ sơ");
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "3 giờ / tuần", exact: true }).click();
  await page
    .getByRole("button", { name: "Lưu lịch vào PostgreSQL", exact: true })
    .click();
  await expect(page).toHaveURL(/\/today$/);
  await page
    .getByRole("link", { name: "Tiếp tục đến khóa kiểm thử", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Mở khóa kỹ thuật", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Mở unit lưu kết quả", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Mở bài kiểm tra chuỗi ký tự", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Bài kiểm tra lưu kết quả local",
      exact: true,
    }),
  ).toBeVisible();
  const pub = await (await page.request.get("/api/v1/fixture")).json();
  expect(JSON.stringify(pub)).not.toMatch(
    /"(expected|answerKey|acceptedAnswers)"/,
  );
  await page
    .getByRole("button", { name: "Bắt đầu phiên local", exact: true })
    .click();
  await page.getByRole("radio", { name: "ma", exact: true }).check();
  await page
    .getByRole("button", { name: "Gửi và lưu câu trả lời", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Khớp đáp án fixture");
  await page.reload();
  await expect(page.getByText(/Bước 2 \/ 2 · 1 câu đã lưu/)).toBeVisible();
  const resumed = await (await page.request.get("/api/v1/snapshot")).json();
  expect(resumed.session.answers).toHaveLength(1);
  expect(resumed.session.answers[0].correct).toBe(true);
  await page.getByRole("radio", { name: "ni", exact: true }).check();
  await page
    .getByRole("button", { name: "Gửi và lưu câu trả lời", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hoàn tất và lưu phiên", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Hoàn tất đã xác nhận từ PostgreSQL",
      exact: true,
    }),
  ).toBeVisible();
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  expect(snapshot.progress.attempts).toBe(2);
  expect(snapshot.session.state).toBe("completed");
  expect(snapshot.learning.dueCount).toBe(2);
  expect(snapshot.source).toBe("postgresql-authenticated-test");
  await page.goto("/review");
  await page
    .getByRole("button", { name: "Lật thẻ từ server", exact: true })
    .click();
  await page.getByRole("button", { name: /^Good/ }).click();
  await expect(page.getByTestId("review-saved")).toContainText(
    "Đã lưu lượt ôn vào PostgreSQL",
  );
  const after = await (await page.request.get("/api/v1/snapshot")).json();
  expect(after.learning.reviews).toBe(1);
  expect(after.learning.mastery).toHaveLength(2);
  expect(
    after.learning.mastery.every(
      (m: { projection: { status: string; evidenceCount: number } }) =>
        m.projection.status !== "secure" && m.projection.evidenceCount === 0,
    ),
  ).toBe(true);
  const c = new Client(adminConfig(state.database));
  await c.connect();
  try {
    const row = (
      await c.query(
        "SELECT count(*)::int AS n FROM app_private.attempts WHERE user_id=$1",
        [auth.owner.id],
      )
    ).rows[0];
    expect(row.n).toBe(2);
    const reviewed = (
      await c.query(
        "SELECT version,due_at,scheduler_card->>'reps' AS reps FROM app_private.cards WHERE user_id=$1 AND (scheduler_card->>'reps')::int>0",
        [auth.owner.id],
      )
    ).rows;
    expect(reviewed).toHaveLength(1);
    expect(reviewed[0].version).toBe(2);
    expect(new Date(reviewed[0].due_at).getTime()).toBeGreaterThan(Date.now());
  } finally {
    await c.end();
  }
  await page.goto("/progress");
  await expect(
    page.getByRole("heading", { name: "Lịch sử đã lưu", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/\S/);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.goto("/account");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?loggedOut=/);
  expect((await page.request.get("/api/v1/snapshot")).status()).toBe(401);
  await login(page);
  const restored = await (await page.request.get("/api/v1/snapshot")).json();
  expect(restored.progress.attempts).toBe(2);
  expect(restored.session.state).toBe("completed");
  expect(restored.learning.reviews).toBe(1);
  expect(restored.settings.preferences.weeklyHours).toBe(3);
  fs.writeFileSync(
    `.local-postgres/sprint11/${info.project.name}-journey.json`,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        kind: "REAL_GOTRUE_SYNTHETIC_TECHNICAL_ONLY",
        attempts: 2,
        reviews: 1,
        sessionRestored: true,
        databasePersisted: true,
        realDraftPublished: false,
        masteryAwarded: false,
      },
      null,
      2,
    ),
  );
});
test("Technical fixture cannot open DRAFT content or accept spoofed owners/private keys", async ({
  page,
}) => {
  expect((await page.request.get("/api/v1/fixture")).status()).toBe(401);
  await login(page);
  for (const path of [
    "/api/v1/content",
    "/api/v1/content/f01-draft-v1",
    "/api/v1/curriculum",
    "/api/v1/pronunciation",
    "/api/local/fixture",
  ]) {
    expect((await page.request.get(path)).status()).toBe(403);
  }
  expect(
    (
      await page.request.get("/api/v1/fixture", {
        headers: { "x-user-id": auth.other.id },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/v1/sessions", {
        headers: { ...headers, "idempotency-key": crypto.randomUUID() },
        data: { restart: false, userId: auth.other.id },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await page.request.post("/api/v1/sessions", {
        headers: {
          ...headers,
          origin: "https://evil.invalid",
          "idempotency-key": crypto.randomUUID(),
        },
        data: { restart: false },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(`/api/v1/cards/${crypto.randomUUID()}/reveal`, {
        headers: { ...headers, "idempotency-key": crypto.randomUUID() },
        data: { expectedVersion: 1 },
      })
    ).status(),
  ).toBe(404);
  const me = await page.request.get("/api/v1/me");
  expect(me.headers()["cache-control"]).toContain("no-store");
  expect(JSON.stringify(await me.json())).not.toMatch(
    /access_token|refresh_token|DATABASE_URL|answerKey/,
  );
  await page.goto("/learn/draft/F01");
  await expect(
    page.getByRole("heading", {
      name: "Chưa có bài được duyệt để học online.",
      exact: true,
    }),
  ).toBeVisible();
  // An accidental DRAFT row in the technical owner's database must stop the
  // fixture adapter, including snapshot reads, instead of exposing that row.
  const c = new Client(adminConfig(state.database)),
    draftSession = crypto.randomUUID();
  await c.connect();
  try {
    await c.query(
      "INSERT INTO app_private.lesson_sessions(id,user_id,lesson_version_id) VALUES($1,$2,'not-a-technical-draft')",
      [draftSession, auth.owner.id],
    );
    const blocked = await page.request.get("/api/v1/snapshot");
    expect(blocked.status()).toBe(503);
    expect((await blocked.json()).error.code).toBe(
      "TECHNICAL_FIXTURE_MIXED_DATA",
    );
  } finally {
    await c.query(
      "DELETE FROM app_private.lesson_sessions WHERE id=$1 AND user_id=$2",
      [draftSession, auth.owner.id],
    );
    await c.end();
  }
});
