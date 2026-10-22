// Bounded manual run against one approved temporary HTTPS proof. Never a monitor.
import fs from "node:fs";
import https from "node:https";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createServerClient } from "@supabase/ssr";
const dir = ".local-postgres/cloud-gates",
  read = (n) =>
    JSON.parse(fs.readFileSync(`${dir}/${n}`, "utf8").replace(/^\uFEFF/, ""));
const target = read("benchmark-target.json"),
  cfg = read("auth-config.json"),
  accounts = read("auth-test-accounts.json"),
  url = new URL(target.url);
if (
  process.argv[2] !== "--measure" ||
  target.provider !== "vercel-hobby" ||
  target.projectRef !== "yartjbdapoyqcxfagsrj" ||
  [cfg, accounts].some((x) => x.projectRef !== target.projectRef) ||
  url.protocol !== "https:" ||
  !/^csh-cloud-gate-[a-z0-9-]+\.vercel\.app$/.test(url.hostname) ||
  url.pathname !== "/" ||
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  !/^[a-f0-9]{40}$/.test(target.commit)
)
  throw Error("PINNED_TEMPORARY_PROOF_REQUIRED");
const report = {
  at: new Date().toISOString(),
  provider: target.provider,
  url: url.origin,
  projectRef: target.projectRef,
  commit: target.commit,
  clientRuntime: process.version,
  coldLikeDefinition:
    "Five sequential opening attempts, each a fresh HTTPS agent/TLS connection. Owner cookies obtained directly from cloud Auth before contacting the host. No idle/sleep manipulation. These are not proven platform-cold invocations; worker IDs identify reuse.",
  platformColdProven: false,
  samples: [],
  security: [],
  rawCookiesOrTokensIncluded: false,
};
const save = () =>
  fs.writeFileSync(
    `${dir}/hosting-benchmark.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
async function cookie(label) {
  const jar = new Map();
  const c = createServerClient(cfg.providerUrl, cfg.publishableKey, {
    cookieOptions: {
      name: "__Host-csh-proof",
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "strict",
    },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items) => {
        for (const item of items) jar.set(item.name, item.value);
      },
    },
  });
  const a = accounts[label],
    r = await c.auth.signInWithPassword({
      email: a.email,
      password: a.password,
    });
  assert.equal(r.error, null);
  assert.equal((await c.auth.getUser()).data.user?.id, a.id);
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}
function request(
  route,
  { cookie = "", method = "GET", body, headers = {}, agent } = {},
) {
  return new Promise((resolve, reject) => {
    const start = performance.now(),
      payload = body === undefined ? undefined : JSON.stringify(body);
    const req = https.request(
      new URL(route, url),
      {
        method,
        agent,
        rejectUnauthorized: true,
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(payload
            ? {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(payload),
                origin: url.origin,
                "x-csh-proof": "1",
              }
            : {}),
          ...headers,
        },
        timeout: 15000,
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          text += chunk;
          if (text.length > 100000) req.destroy(Error("RESPONSE_TOO_LARGE"));
        });
        res.on("end", () => {
          let result;
          try {
            result = JSON.parse(text);
          } catch {
            result = { nonJson: true };
          }
          resolve({
            status: res.statusCode,
            ms: Number((performance.now() - start).toFixed(1)),
            cacheControl: res.headers["cache-control"],
            vary: res.headers.vary,
            setCookie: res.headers["set-cookie"] ?? [],
            result,
          });
        });
      },
    );
    req.on("timeout", () => req.destroy(Error("REQUEST_TIMEOUT")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
function authorized(r) {
  assert.equal(r.status, 200);
  assert.equal(r.result.read, true);
  assert.equal(r.result.tlsVerified, true);
  assert.equal(r.result.version, target.commit);
  assert.equal(r.result.region, "sin1");
  assert.match(r.cacheControl, /no-store/);
  assert.match(r.vary, /Cookie/);
}
async function main() {
  const owner = await cookie("owner"),
    key = randomUUID();
  let baseline;
  for (let i = 0; i < 5; i++) {
    const agent = new https.Agent({ keepAlive: false, maxSockets: 1 });
    try {
      const r = await request("/api/proof", { cookie: owner, agent });
      report.samples.push({
        kind: "cold-like-fresh-client",
        index: i + 1,
        status: r.status,
        ms: r.ms,
        ...r.result,
      });
      save();
      authorized(r);
      baseline = r.result.count;
    } finally {
      agent.destroy();
    }
  }
  const warm = new https.Agent({ keepAlive: true, maxSockets: 1 });
  try {
    for (let i = 0; i < 20; i++) {
      const write = i % 2 === 1,
        r = await request("/api/proof", {
          cookie: owner,
          agent: warm,
          ...(write ? { method: "POST", body: { key } } : {}),
        });
      report.samples.push({
        kind: "warm",
        index: i + 1,
        method: write ? "POST" : "GET",
        status: r.status,
        ms: r.ms,
        ...r.result,
      });
      save();
      authorized(r);
      assert.equal(r.result.transaction, write);
      assert.equal(r.result.count, baseline + (i >= 1 ? 1 : 0));
    }
  } finally {
    warm.destroy();
  }
  async function check(name, fn) {
    await fn();
    report.security.push(name);
    save();
  }
  await check("anonymous-denied-no-store", async () => {
    const r = await request("/api/proof");
    assert.equal(r.status, 401);
    assert.match(r.cacheControl, /no-store/);
  });
  const other = await cookie("nonowner");
  await check("nonowner-denied", async () => {
    assert.equal((await request("/api/proof", { cookie: other })).status, 403);
  });
  await check("forged-header-denied", async () => {
    assert.equal(
      (
        await request("/api/proof", {
          cookie: owner,
          headers: { "x-owner-id": accounts.nonowner.id },
        })
      ).status,
      403,
    );
  });
  await check("cross-origin-post-denied", async () => {
    assert.equal(
      (
        await request("/api/proof", {
          cookie: owner,
          method: "POST",
          body: { key: randomUUID() },
          headers: { origin: "https://attacker.invalid" },
        })
      ).status,
      403,
    );
  });
  await check("forged-body-rejected", async () => {
    assert.equal(
      (
        await request("/api/proof", {
          cookie: owner,
          method: "POST",
          body: { key: randomUUID(), userId: accounts.nonowner.id },
        })
      ).status,
      400,
    );
  });
  await check("logout-and-copied-session-replay-denied", async () => {
    assert.equal(
      (
        await request("/api/logout", {
          cookie: owner,
          method: "POST",
          body: {},
        })
      ).status,
      200,
    );
    assert.equal((await request("/api/proof", { cookie: owner })).status, 401);
  });
  const stats = (kind) => {
    const a = report.samples
      .filter((r) => r.kind === kind)
      .map((r) => r.ms)
      .sort((a, b) => a - b);
    return {
      n: a.length,
      min: a[0],
      p50: a[Math.ceil(a.length * 0.5) - 1],
      p95: a[Math.ceil(a.length * 0.95) - 1],
      max: a.at(-1),
      percentileMethod: "nearest rank",
    };
  };
  report.coldLike = stats("cold-like-fresh-client");
  report.warm = stats("warm");
  report.distinctWorkers = new Set(report.samples.map((s) => s.worker)).size;
  report.failures = report.samples.filter((s) => s.status !== 200).length;
  report.completed = true;
  report.finishedAt = new Date().toISOString();
  save();
  console.log(
    "PASS bounded HTTPS benchmark: 5 cold-like, 20 warm, 6 security groups; no platform-cold claim.",
  );
}
main().catch((e) => {
  report.completed = false;
  report.failureCode =
    e instanceof assert.AssertionError
      ? "ASSERTION_FAILED"
      : /^[A-Z_]+$/.test(e.message)
        ? e.message
        : "BENCHMARK_FAILED";
  save();
  console.error(report.failureCode);
  process.exitCode = 1;
});
