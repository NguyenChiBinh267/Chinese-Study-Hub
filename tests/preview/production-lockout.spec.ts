import { test, expect } from "@playwright/test";

test("Production artifact refuses local auth/data even with local env flags present", async ({
  request,
}) => {
  const status = await request.get("/api/local/status");
  expect(status.ok()).toBe(true);
  expect(await status.json()).toEqual({ enabled: false, active: false });
  for (const path of [
    "/api/local/mode",
    "/api/local/sessions",
    "/api/local/preferences",
  ]) {
    const r = await request.post(path, {
      headers: { origin: "http://127.0.0.1:3011", "x-csh-local": "1" },
      data: { local: true },
    });
    // Preferences supports PATCH only; no write via POST can sneak through.
    if (path.endsWith("preferences")) expect(r.status()).toBe(405);
    else {
      expect(r.status()).toBe(403);
      expect((await r.json()).error.code).toBe("DEV_ONLY");
    }
    expect(r.headers()["set-cookie"]).toBeUndefined();
  }
  const write = await request.patch("/api/local/preferences", { data: {} });
  expect(write.status()).toBe(403);
  const read = await request.get("/api/local/snapshot");
  expect(read.status()).toBe(403);
});

test("Production cannot expose new draft catalog, private package, summary or duration APIs", async ({
  request,
}) => {
  for (const path of [
    "/.local-postgres/review-packets/sprint6/F01.1.json",
    "/review-packets/sprint6/F01.1.json",
    "/.local-postgres/review-packets/sprint7/pronunciation-foundation-v1.json",
    "/review-packets/sprint7/pronunciation-foundation-v1.json",
    "/.local-postgres/review-packets/sprint7/final/pronunciation-foundation-v1.json",
    "/.local-postgres/sprint8/unit.xml",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain('"answerKey"');
  }
  for (const path of [
    "/api/local/content",
    "/api/local/content/f01-draft-v1",
    "/api/local/content/summary",
    "/api/local/content/l001-draft-v2",
    "/api/local/study/settings",
    "/api/local/study/today",
    "/api/local/curriculum",
    "/api/local/pronunciation",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe("DEV_ONLY");
  }
  for (const path of [
    "/api/local/content/f01-draft-v1/start",
    "/api/local/content/sessions/00000000-0000-4000-8000-000000000001/answers",
    "/api/local/content/sessions/00000000-0000-4000-8000-000000000001/lease",
    "/api/local/content/sessions/00000000-0000-4000-8000-000000000001/duration",
    "/api/local/study/preview",
    "/api/local/study/replan",
    "/api/local/study/review-activity",
    "/api/local/study/review-activity/00000000-0000-4000-8000-000000000001/close",
  ]) {
    const response = await request.post(path, { data: {} });
    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe("DEV_ONLY");
  }
});
