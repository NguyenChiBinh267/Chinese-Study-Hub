// Isolated browser/component regression: real client components, intercepted
// fixture responses. This is NOT evidence of provider Auth or server grading.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { Pool } from "pg";
import { ownerTransaction } from "../src/shared/db/transaction.ts";
import { curriculumWithin } from "../src/modules/curriculum/infrastructure/postgres-curriculum.ts";
import { loadPrivatePackages } from "../src/modules/content/application/private-preview.ts";
import { publicProjection } from "../src/modules/content/domain/package.ts";
import { defaultPreferences } from "../src/modules/planning/domain/preview-plan.ts";
import { allocateWeek } from "../src/modules/planning/domain/weekly-plan.ts";
const root = process.cwd(),
  dir = path.resolve(".local-postgres/ui-refinement");
fs.mkdirSync(dir, { recursive: true });
// The public deployed source before this fix is the regression baseline.
const baselineCommit = "054978d9cf795f2436692f8e1e9da3c4466723d6";
for (const [source, file] of [
  ["src/modules/auth/ui/runtime.tsx", "baseline-runtime.tsx"],
  ["src/app/globals.css", "baseline-input.css"],
]) {
  fs.writeFileSync(
    path.join(dir, file),
    execFileSync("git", ["show", `${baselineCommit}:${source}`], { cwd: root }),
  );
}
const { all } = loadPrivatePackages(),
  uid = randomUUID();
const db = JSON.parse(
  fs.readFileSync(".local-postgres/private-preview/database.json", "utf8"),
);
const pool = new Pool({ connectionString: db.runtimeUrl, max: 1 });
let curriculum;
try {
  curriculum = await ownerTransaction(pool, uid, (c) =>
    curriculumWithin(c, uid, {
      id: "private-owner-preview-v1",
      all,
      current: all,
      privateOwnerPreview: true,
    }),
  );
} finally {
  await pool.end();
}
const preferences = {
  ...defaultPreferences,
  days: [...defaultPreferences.days],
};
const planning = {
  dayCaps: Array.from({ length: 7 }, (_, i) =>
    preferences.days.includes(i) ? 60 : 0,
  ),
  maxSessionMinutes: 30,
  paused: false,
  timezone: "Asia/Saigon",
  startingLevel: "zero",
};
const settings = {
  configured: true,
  expectedVersion: 0,
  preferences,
  planning,
};
function plan(input = { preferences, planning }) {
  return allocateWeek({
    asOf: new Date().toISOString(),
    settings: {
      weeklyMinutes: input.preferences.weeklyHours * 60,
      days: input.preferences.days,
      preferredMinutes: input.preferences.sessionMinutes,
      ...input.planning,
      version: 1,
    },
    lessons: [],
    cards: [],
    sessions: [],
    observedByDate: {},
    overrides: {},
    frozen: [],
  });
}
const snapshot = {
  settings: { preferences, version: 0, updatedAt: null },
  session: null,
  progress: { attempts: 0, correct: 0, completedSessions: 0 },
  learning: { due: [], dueCount: 0, nextDueAt: null, reviews: 0, mastery: [] },
  source: "UI_FIXTURE_NOT_LEARNING_HISTORY",
};
for (const version of ["baseline", "updated"]) {
  const runtime =
    version === "baseline"
      ? path.join(dir, "baseline-runtime.tsx")
      : path.join(root, "src/modules/auth/ui/runtime.tsx");
  const css =
    version === "baseline"
      ? path.join(dir, "baseline-input.css")
      : path.join(root, "src/app/globals.css");
  const entry = path.join(dir, version + ".tsx");
  fs.writeFileSync(
    entry,
    `import React from 'react';import{createRoot}from'react-dom/client';import{AuthRuntime}from ${JSON.stringify(runtime)};import{OwnerStudy}from ${JSON.stringify(path.join(root, "src/modules/auth/ui/study.tsx"))};import ${JSON.stringify(css)};createRoot(document.getElementById('root')!).render(<AuthRuntime mode="PRODUCTION_AUTHENTICATED"><OwnerStudy/></AuthRuntime>);`,
  );
  await build({
    entryPoints: [entry],
    outfile: path.join(dir, version + ".js"),
    bundle: true,
    format: "esm",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "isolated-next-router",
        setup(b) {
          b.onResolve({ filter: /^tailwindcss$/ }, () => ({
            path: path.join(root, "node_modules/tailwindcss/index.css"),
          }));
          b.onResolve({ filter: /^next\/(navigation|link)$/ }, (a) => ({
            path: a.path,
            namespace: "ui-router",
          }));
          b.onLoad({ filter: /.*/, namespace: "ui-router" }, (a) => ({
            contents: a.path.endsWith("link")
              ? `import React from 'react';export default function Link({href,children,...p}){return React.createElement('a',{href,...p},children)}`
              : `import{useSyncExternalStore}from'react';const subscribe=f=>{addEventListener('popstate',f);return()=>removeEventListener('popstate',f)};export function usePathname(){return useSyncExternalStore(subscribe,()=>location.pathname)};export function useRouter(){return{push:p=>{history.pushState({},'',p);dispatchEvent(new Event('popstate'))}}};export function useSearchParams(){return new URLSearchParams(location.search)}`,
            loader: "js",
            resolveDir: root,
          }));
          b.onResolve({ filter: /^\.{1,2}\// }, (a) =>
            a.importer === path.join(dir, "baseline-runtime.tsx")
              ? {
                  path:
                    path.resolve(root, "src/modules/auth/ui", a.path) +
                    (path.extname(a.path) ? "" : ".ts"),
                }
              : undefined,
          );
        },
      },
    ],
    logLevel: "silent",
  });
}
let version = "baseline";
const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    res.writeHead(404);
    res.end("UI fixture has no backend");
    return;
  }
  const asset = /^\/(baseline|updated)\.(js|css)$/.exec(req.url);
  if (asset) {
    res.setHeader(
      "Content-Type",
      asset[2] === "js" ? "text/javascript" : "text/css",
    );
    res.end(fs.readFileSync(path.join(dir, asset[0].slice(1))));
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    `<!doctype html><html lang="vi" data-app-mode="PRODUCTION_AUTHENTICATED" data-auth-environment="local"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated UI regression fixture</title><link rel="stylesheet" href="/${version}.css"></head><body><div id="root"></div><script type="module" src="/${version}.js"></script></body></html>`,
  );
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const origin = `http://127.0.0.1:${server.address().port}`,
  browser = await chromium.launch(),
  checks = [],
  metrics = {},
  errors = [];
let meStatus = 200,
  delay = 0;
async function pageFor(width = 1440) {
  const c = await browser.newContext({ viewport: { width, height: 900 } });
  await c.route("**/api/v1/**", async (route) => {
    const p = new URL(route.request().url()).pathname.slice(8);
    let data;
    if (p === "me") {
      if (delay) await new Promise((ok) => setTimeout(ok, delay));
      await route.fulfill({
        status: meStatus,
        json:
          meStatus === 200
            ? {
                userId: uid,
                displayName: "UI fixture",
                textSize: "normal",
                timezone: "Asia/Saigon",
                scheduleTimezone: "Asia/Saigon",
              }
            : {
                error: {
                  code:
                    meStatus === 401
                      ? "AUTH_REQUIRED"
                      : "TEMPORARY_UNAVAILABLE",
                },
              },
      });
      return;
    }
    if (p === "status")
      data = { enabled: false, active: true, privateOwnerPreview: true };
    else if (p === "snapshot") data = snapshot;
    else if (p === "curriculum") data = curriculum;
    else if (p === "release")
      data = { available: true, technical: false, privateOwnerPreview: true };
    else if (p === "study/settings") data = settings;
    else if (p === "study/today")
      data = { configured: true, settings, plan: plan() };
    else if (p === "study/preview") data = plan(route.request().postDataJSON());
    else if (p.startsWith("content/")) {
      const pack = all.find((x) => x.lesson.versionId === p.slice(8));
      data = pack ? { lesson: publicProjection(pack), session: null } : {};
    } else data = {};
    await route.fulfill({ json: data });
  });
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return { c, p };
}
async function run(name, f) {
  await f();
  checks.push(name);
  console.log("PASS " + name);
}
async function sample(p, event = "focus") {
  return p.evaluate(async (name) => {
    const input = document.querySelector("input"),
      shell = document.querySelector(".app-shell"),
      y = scrollY;
    let hidden = 0,
      frames = 0;
    const end = performance.now() + 650;
    window.dispatchEvent(new Event(name));
    while (performance.now() < end) {
      if (getComputedStyle(shell).visibility === "hidden" || !shell.isConnected)
        hidden++;
      frames++;
      await new Promise(requestAnimationFrame);
    }
    return {
      hiddenFrames: hidden,
      frames,
      sameInput: input === document.querySelector("input"),
      scrollDelta: scrollY - y,
    };
  }, event);
}
try {
  await run("baseline-reproduces-focus-blanking", async () => {
    const { c, p } = await pageFor();
    await p.goto(origin + "/account");
    await expect(p.getByLabel("Tên hiển thị", { exact: true })).toBeVisible();
    delay = 400;
    metrics.before = await sample(p);
    expect(metrics.before.hiddenFrames).toBeGreaterThan(0);
    await c.close();
    delay = 0;
  });
  version = "updated";
  await run(
    "focus-pageshow-and-visibility-keep-draft-DOM-and-scroll",
    async () => {
      const { c, p } = await pageFor();
      await p.goto(origin + "/account");
      const input = p.getByLabel("Tên hiển thị", { exact: true });
      await input.fill("Bản nháp chưa lưu");
      delay = 400;
      for (const event of ["focus", "pageshow"]) {
        const m = await sample(p, event);
        expect(m.hiddenFrames).toBe(0);
        expect(m.sameInput).toBe(true);
        expect(m.scrollDelta).toBe(0);
        await expect(input).toHaveValue("Bản nháp chưa lưu");
        metrics[event] = m;
      }
      await p.evaluate(() =>
        document.dispatchEvent(new Event("visibilitychange")),
      );
      await expect(input).toHaveValue("Bản nháp chưa lưu");
      await c.close();
      delay = 0;
    },
  );
  await run(
    "temporary-revalidation-error-retry-preserves-unsaved-form",
    async () => {
      const { c, p } = await pageFor();
      await p.goto(origin + "/account");
      const input = p.getByLabel("Tên hiển thị", { exact: true });
      await input.fill("Giữ bản nháp khi lỗi mạng");
      meStatus = 503;
      await p.evaluate(() => window.dispatchEvent(new Event("focus")));
      await expect(
        p.getByRole("button", { name: "Kiểm tra lại", exact: true }),
      ).toBeVisible();
      await expect(input).toBeHidden();
      meStatus = 200;
      await p
        .getByRole("button", { name: "Kiểm tra lại", exact: true })
        .click();
      await expect(input).toHaveValue("Giữ bản nháp khi lỗi mạng");
      await expect(input).toBeVisible();
      await c.close();
    },
  );
  await run(
    "bfcache-restoration-stays-shielded-until-fresh-verification",
    async () => {
      const { c, p } = await pageFor();
      await p.goto(origin + "/account");
      await expect(p.getByLabel("Tên hiển thị", { exact: true })).toBeVisible();
      delay = 400;
      await p.evaluate(() => {
        window.dispatchEvent(
          new PageTransitionEvent("pagehide", { persisted: true }),
        );
        window.dispatchEvent(
          new PageTransitionEvent("pageshow", { persisted: true }),
        );
      });
      await expect(p.locator(".app-shell")).toHaveCSS("visibility", "hidden");
      await expect(p.locator(".app-shell")).toHaveCSS("visibility", "visible");
      await c.close();
      delay = 0;
    },
  );
  await run(
    "expired-and-broadcast-logout-unmount-private-interface",
    async () => {
      for (const cause of ["expired", "broadcast"]) {
        const { c, p } = await pageFor();
        await p.goto(origin + "/account");
        await expect(
          p.getByLabel("Tên hiển thị", { exact: true }),
        ).toBeVisible();
        if (cause === "expired") {
          meStatus = 401;
          await p.evaluate(() => window.dispatchEvent(new Event("focus")));
        } else
          await p.evaluate(() => {
            const channel = new BroadcastChannel("csh-owner-session");
            channel.postMessage("logout");
            channel.close();
          });
        await expect(p).toHaveURL(/session-expired/);
        await expect(p.locator(".app-shell")).toHaveCount(0);
        meStatus = 200;
        await c.close();
      }
    },
  );
  await run(
    "desktop-and-360px-layout-spacing-keyboard-and-accessibility",
    async () => {
      for (const width of [1440, 360]) {
        const { c, p } = await pageFor(width);
        for (const route of [
          "/today",
          "/learn",
          "/progress",
          "/schedule",
          "/account",
          "/learn/released/f01-private-v2",
        ]) {
          await p.goto(origin + route);
          await expect(p.locator(".owner-study")).toBeVisible();
          await expect(p.locator(".owner-study h1").first()).toBeVisible();
          expect(
            await p.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          ).toBe(true);
          if (route === "/progress") {
            const measurements = await p
              .locator(".published-study")
              .evaluate((e) => ({
                gap: parseFloat(getComputedStyle(e).rowGap),
                paragraphGap: parseFloat(
                  getComputedStyle(e.querySelector(".panel p+p")).marginTop,
                ),
              }));
            expect(measurements.gap).toBeGreaterThanOrEqual(24);
            expect(measurements.paragraphGap).toBeGreaterThanOrEqual(12);
            metrics["spacing" + width] = measurements;
            const a = await new AxeBuilder({ page: p }).analyze();
            expect(
              a.violations.filter((v) =>
                ["serious", "critical"].includes(v.impact),
              ),
            ).toEqual([]);
          }
          await p.screenshot({
            path: path.join(dir, `${width}-${route.replaceAll("/", "_")}.png`),
            fullPage: true,
          });
        }
        await p.goto(origin + "/schedule");
        await p.getByLabel("Hoặc nhập số giờ").fill("4.5");
        await sample(p);
        await expect(p.getByLabel("Hoặc nhập số giờ")).toHaveValue("4.5");
        await p.keyboard.press("Tab");
        expect(
          await p.evaluate(() => document.activeElement !== document.body),
        ).toBe(true);
        await c.close();
      }
    },
  );
  expect(errors).toEqual([]);
} finally {
  fs.writeFileSync(
    path.join(dir, "results.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        kind: "ISOLATED_UI_RESPONSES_NOT_PROVIDER_AUTH_OR_GRADING",
        passed: checks.length,
        expected: 6,
        checks,
        metrics,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
  await new Promise((ok) => server.close(ok));
}
