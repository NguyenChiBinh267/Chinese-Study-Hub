// Bounded local HTTP acceptance. Does not stop/change the populated database.
import fs from "node:fs";
import net from "node:net";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const [tag, mode = "valid"] = process.argv.slice(2);
assert(/^hsk1-stability-[a-z0-9-]{1,60}$/.test(tag ?? ""));
assert(["valid", "absent"].includes(mode));
const prefix = `.local-postgres/hsk24/${tag}`;
assert(!fs.existsSync(`${prefix}.json`));
await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(3039, "127.0.0.1", () => server.close(resolve));
});
const pointer = JSON.parse(
  fs.readFileSync(".local-postgres/hsk24/current.json", "utf8"),
);
const state = JSON.parse(fs.readFileSync(pointer.stateFile, "utf8"));
assert.equal(state.database, "csh_hsk24_bf294b6506c1");
const database = new URL(state.runtimeUrl);
assert.equal(database.hostname, "127.0.0.1");
assert.equal(database.port, "5447");
assert.equal(database.username, "csh_runtime");
if (mode === "absent")
  database.pathname = `/csh_hsk24_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const log = fs.openSync(`${prefix}-server.log`, "wx");
const origin = "http://127.0.0.1:3039";
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "--no-server-fast-refresh",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3039",
  ],
  {
    windowsHide: true,
    stdio: ["ignore", log, log],
    env: {
      ...process.env,
      CSH_APP_MODE: "LOCAL_DATABASE_DEV",
      CSH_LOCAL_CURRICULUM: "hsk24-batch1",
      CSH_LOCAL_DATABASE: "1",
      CSH_APP_ORIGIN: origin,
      CSH_HSK3_CHECK_BUILD: "1",
      CSH_HSK2_CHECK_BUILD: "0",
      CSH_LOCAL_OWNER_ID: randomUUID(),
      DATABASE_URL: database.toString(),
    },
  },
);
const observations = [];
let cookies = "";
let failure = null;
const began = performance.now();
try {
  let ready = false;
  while (performance.now() - began < 60000) {
    assert.equal(child.exitCode, null);
    try {
      if (
        (
          await fetch(`${origin}/api/local/status`, {
            signal: AbortSignal.timeout(3000),
          })
        ).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(ready, "STARTUP_NOT_READY");
  for (const phase of ["MODE", "FIRST_AUTHORIZED_CATALOG", "WARM_CATALOG"]) {
    const started = performance.now();
    const setup = phase === "MODE";
    const response = await fetch(
      origin + (setup ? "/api/local/mode" : "/api/local/curriculum"),
      {
        method: setup ? "POST" : "GET",
        headers: {
          Origin: origin,
          ...(cookies ? { Cookie: cookies } : {}),
          ...(setup
            ? { "Content-Type": "application/json", "x-csh-local": "1" }
            : {}),
        },
        ...(setup ? { body: JSON.stringify({ local: true }) } : {}),
        signal: AbortSignal.timeout(setup ? 20000 : 15000),
      },
    );
    const body = await response.json();
    if (setup)
      cookies = response.headers
        .getSetCookie()
        .map((v) => v.split(";")[0])
        .join("; ");
    observations.push({
      phase,
      ms: performance.now() - started,
      status: response.status,
      serverTiming: response.headers.get("server-timing"),
      errorCode: body.error?.code ?? null,
      hsk1Lessons:
        body.courses?.find((c) => c.code === "HSK1")?.totalLessons ?? null,
    });
    assert.equal(response.status, setup || mode === "valid" ? 200 : 503);
    if (!setup) {
      assert.match(
        response.headers.get("server-timing") ?? "",
        /^app;dur=\d+(\.\d+)?$/,
      );
      if (mode === "valid")
        assert.equal(
          body.courses.find((c) => c.code === "HSK1").totalLessons,
          129,
        );
      else {
        assert.equal(body.error.code, "LOCAL_DB_UNAVAILABLE");
        assert.equal(body.courses, undefined);
      }
    }
  }
} catch (error) {
  failure = { name: error.name, code: error.code ?? null };
  process.exitCode = 1;
} finally {
  if (child.exitCode === null) {
    try {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } catch {}
  }
  fs.closeSync(log);
  const result = {
    mode,
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    scope:
      "Fresh development server process; existing disk compilation cache. New synthetic owner. Absent mode targets a random nonexistent database on the same local server, without creating it or stopping the populated cluster. Startup health polling and two labeled samples are diagnostics, not automatic product retries.",
    observations,
    failure,
    passed: failure === null,
    historicalCold503RootCauseClosed: false,
  };
  fs.writeFileSync(`${prefix}.json`, JSON.stringify(result, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(JSON.stringify(result));
}
