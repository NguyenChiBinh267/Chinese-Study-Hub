import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expectedKeys } from "../fixtures/private-preview";
const auth = JSON.parse(
  fs.readFileSync(
    ".local-postgres/sprint10/auth-local/credentials.json",
    "utf8",
  ),
);
const headers = {
  origin: "http://127.0.0.1:3025",
  "content-type": "application/json",
  "x-csh-auth": "1",
};
async function login(page: Page, who: "owner" | "other" = "owner") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(auth[who].email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(auth[who].password);
  const submit = async () => {
    const r = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/auth/login") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    return r;
  };
  let r = await submit();
  if (r.status() === 429) {
    await page.waitForTimeout(31000);
    await page.waitForTimeout(30000);
    r = await submit();
  }
  expect(r.status()).toBe(who === "owner" ? 200 : 403);
  if (who === "owner") {
    await expect(page).toHaveURL(/\/today$/);
    await expect(
      page.getByText("PRIVATE_OWNER_PREVIEW · DRAFT · AI-reviewed", {
        exact: true,
      }),
    ).toBeVisible();
  }
}
async function get(page: Page, path: string) {
  const r = await page.request.get("/api/v1/" + path);
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function post(
  page: Page,
  path: string,
  data: unknown,
  key = crypto.randomUUID(),
) {
  return page.request.post("/api/v1/" + path, {
    headers: { ...headers, "Idempotency-Key": key },
    data,
  });
}
test("Owner completes all four DRAFT lessons, persists FSRS/progress across logout/login; absent TTS stays optional", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", {
      value: undefined,
      configurable: true,
    });
  });
  await login(page);
  const before = await get(page, "snapshot");
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "3 giờ / tuần", exact: true }).click();
  await page
    .getByRole("button", { name: "Lưu lịch vào PostgreSQL", exact: true })
    .click();
  await expect(page).toHaveURL(/\/today$/);
  const catalog = await get(page, "curriculum");
  expect(catalog.lessons).toHaveLength(4);
  for (const lesson of catalog.lessons) {
    expect(lesson.access.mayPractice).toBe(true);
    expect(lesson.access.verifiedEligible).toBe(false);
    await page.goto("/learn/released/" + lesson.currentVersion);
    await expect(
      page.getByRole("heading", { name: lesson.title, exact: true }),
    ).toBeVisible();
    const existing = await get(page, "content/" + lesson.currentVersion);
    if (existing.session?.state !== "active")
      await page
        .getByRole("button", {
          name: /^(Bắt đầu học (F01|F02|L001|L002)|Luyện lại bài)$/,
        })
        .click();
    await expect(
      page.getByRole("button", { name: "Đã đọc · tiếp tục", exact: true }),
    ).toBeVisible();
    const view = await get(page, "content/" + lesson.currentVersion);
    const p = view.lesson;
    await expect(
      page.getByRole("button", { name: "Nghe TTS tùy chọn", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText(/Chưa có giọng zh-CN trên thiết bị/),
    ).toBeVisible();
    if (lesson.key === "L002")
      await page.screenshot({
        path: `.local-postgres/private-preview/lesson-${test.info().project.name}.png`,
        fullPage: true,
      });
    while (true) {
      const current = await get(page, "content/" + lesson.currentVersion),
        session = current.session,
        block = p.blocks[session.cursor];
      if (!block) break;
      if (block.type === "exercise") {
        const i = p.exercises.findIndex(
            (e: { id: string }) => e.id === block.exerciseVersionId,
          ),
          e = p.exercises[i],
          answer = expectedKeys[lesson.key][i];
        await expect(
          page.getByRole("heading", { name: e.prompt, exact: true }),
        ).toBeVisible();
        if (e.type === "choice")
          await page.getByRole("radio", { name: answer, exact: true }).check();
        else if (e.type === "sequence")
          for (const index of answer.split(",").map(Number))
            await page
              .getByRole("button", {
                name: "Thêm mảnh " + e.choices[index],
                exact: true,
              })
              .click();
        else
          await page
            .getByLabel(
              e.type === "pinyin"
                ? "Pinyin của bạn"
                : "Câu trả lời bằng chữ Hán",
              { exact: true },
            )
            .fill(answer);
        const saved = page.waitForResponse(
          (r) =>
            r.request().method() === "POST" && r.url().endsWith("/answers"),
        );
        await page
          .getByRole("button", { name: "Gửi và lưu câu trả lời", exact: true })
          .click();
        expect((await saved).status()).toBe(200);
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
      }
      const advance = page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().endsWith("/advance"),
      );
      await page
        .getByRole("button", {
          name:
            block.type === "teaching" ? "Đã đọc · tiếp tục" : "Bước tiếp theo",
          exact: true,
        })
        .click();
      expect((await advance).status()).toBe(200);
    }
    const complete = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().endsWith("/complete"),
    );
    await page
      .getByRole("button", { name: "Hoàn tất luyện tập có lưu", exact: true })
      .click();
    expect((await complete).status()).toBe(200);
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Đã hoàn tất luyện tập có lưu.",
        exact: true,
      }),
    ).toBeVisible();
  }
  const after = await get(page, "snapshot");
  expect(after.progress.attempts).toBe(before.progress.attempts + 26);
  expect(after.progress.completedSessions).toBe(
    before.progress.completedSessions + 4,
  );
  expect(
    after.learning.mastery.every(
      (m: { projection: { evidenceCount: number } }) =>
        m.projection.evidenceCount === 0,
    ),
  ).toBe(true);
  await page.goto("/review");
  await page
    .getByRole("button", { name: "Lật thẻ từ server", exact: true })
    .click();
  await page.getByRole("button", { name: /Good/ }).click();
  await expect
    .poll(async () => (await get(page, "snapshot")).learning.reviews)
    .toBe(before.learning.reviews + 1);
  await page.goto("/progress");
  await expect(
    page.getByRole("heading", { name: "Tiến độ của bạn", exact: true }),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: `.local-postgres/private-preview/progress-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto("/account");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect((await page.request.get("/api/v1/content")).status()).toBe(401);
  await login(page);
  expect((await get(page, "snapshot")).progress.attempts).toBe(
    after.progress.attempts,
  );
  expect((await get(page, "snapshot")).learning.reviews).toBe(
    before.learning.reviews + 1,
  );
});
test("Public/nonowner, selected-version isolation, private keys, forged approval and idempotent writes", async ({
  page,
  request,
}) => {
  for (const path of [
    "content",
    "snapshot",
    "curriculum",
    "release",
    "cards/00000000-0000-4000-8000-000000000001/reveal",
  ]) {
    expect((await request.get("/api/v1/" + path)).status()).toBe(401);
  }
  await login(page, "other");
  const nonOwnerResponse = await request.post(
    "http://127.0.0.1:54390/auth/v1/token?grant_type=password",
    {
      headers: { apikey: auth.anonKey },
      data: { email: auth.other.email, password: auth.other.password },
    },
  );
  expect(nonOwnerResponse.status()).toBe(200);
  const nonOwnerSession = await nonOwnerResponse.json();
  nonOwnerSession.user.id = auth.owner.id; // Cached user forgery must lose to GoTrue verification.
  const cookie =
    "csh-owner-auth=base64-" +
    Buffer.from(JSON.stringify(nonOwnerSession)).toString("base64url");
  for (const path of ["content", "curriculum", "snapshot", "release"]) {
    const denied = await request.get("/api/v1/" + path, {
      headers: { cookie },
    });
    expect(denied.status()).toBe(403);
    expect((await denied.json()).error.code).toBe("OWNER_ONLY");
  }
  await login(page);
  for (const version of [
    "f01-draft-v1",
    "l001-draft-v1",
    "l001-draft-v2",
    "l002-draft-v2",
    "unselected",
  ]) {
    expect(
      (await page.request.get("/api/v1/content/" + version)).status(),
    ).toBe(404);
    expect(
      (
        await post(page, "content/" + version + "/start", {
          restart: true,
          packageHash: "0".repeat(64),
        })
      ).status(),
    ).toBe(404);
  }
  for (const path of ["content", "curriculum", "snapshot", "release"]) {
    const r = await page.request.get("/api/v1/" + path);
    expect(r.headers()["cache-control"]).toContain("no-store");
    expect(await r.text()).not.toMatch(
      /"(privateKeys|accepted|keyRef|qualification|consentReceipt)"/,
    );
  }
  const p = (await get(page, "content/f01-private-v2")).lesson;
  expect(
    (
      await post(page, "content/f01-private-v2/start", {
        restart: true,
        packageHash: p.packageHash,
        approved: true,
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await page.request.get("/api/v1/content", {
        headers: { "x-user-id": auth.other.id },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await post(page, "content/f01-private-v2/start", {
        restart: true,
        packageHash: "0".repeat(64),
      })
    ).status(),
  ).toBe(409);
  const key = crypto.randomUUID(),
    data = { restart: true, packageHash: p.packageHash };
  const [a, b] = await Promise.all([
    post(page, "content/f01-private-v2/start", data, key),
    post(page, "content/f01-private-v2/start", data, key),
  ]);
  expect(a.status()).toBe(200);
  expect(b.status()).toBe(200);
  expect(await a.json()).toEqual(await b.json());
  const progress = await get(page, "progress");
  expect(progress.approvedContentAvailable).toBe(false);
});
test("Optional device zh-CN TTS uses Chinese and cancels on navigation; no audio fetch", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = {
      spoken: [] as { text: string; lang: string }[],
      cancelled: 0,
      fail: false,
    };
    Object.assign(window, { __tts: state });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class {
        constructor(public text: string) {}
        lang = "";
      },
      configurable: true,
    });
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: () => [
          {
            lang: "zh-CN",
            localService: false,
            name: "remote voice must be skipped",
          },
          {
            lang: "en-US",
            localService: true,
            name: "English must be skipped",
          },
          { lang: "zh-CN", localService: true, name: "test device voice" },
        ],
        addEventListener: () => {},
        removeEventListener: () => {},
        cancel: () => state.cancelled++,
        speak: (u: { text: string; lang: string; voice: { name: string } }) => {
          if (state.fail) throw Error("Synthetic device failure");
          if (u.voice.name !== "test device voice")
            throw Error("Wrong voice selection");
          state.spoken.push({ text: u.text, lang: u.lang });
        },
      },
      configurable: true,
    });
  });
  await login(page);
  const media: string[] = [];
  page.on("request", (r) => {
    if (/\/media\/|\.mp3|\.wav/.test(r.url())) media.push(r.url());
  });
  await page.goto("/learn/released/f01-private-v2");
  if ((await get(page, "content/f01-private-v2")).session?.state !== "active")
    await page
      .getByRole("button", { name: /^(Bắt đầu học F01|Luyện lại bài)$/ })
      .click();
  await page
    .getByRole("button", { name: "Nghe TTS tùy chọn", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __tts: { spoken: unknown[] } }).__tts.spoken,
    ),
  ).toEqual([{ text: "妈", lang: "zh-CN" }]);
  await page.getByRole("button", { name: "Dừng TTS", exact: true }).click();
  await page.evaluate(() => {
    (window as unknown as { __tts: { fail: boolean } }).__tts.fail = true;
  });
  await page
    .getByRole("button", { name: "Nghe TTS tùy chọn", exact: true })
    .click();
  await expect(
    page.getByText("Không phát được giọng tổng hợp. Tiếp tục bằng bài chữ.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Đã đọc · tiếp tục", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __tts: { cancelled: number } }).__tts.cancelled,
    ),
  ).toBeGreaterThan(1);
  expect(media).toEqual([]);
});
