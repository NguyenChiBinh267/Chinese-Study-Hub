import test from "node:test";
import assert from "node:assert/strict";
import { localRequest } from "../../src/modules/content/ui/api";

test("Content requests preserve HTTP503, distinguish transport/timeout, and never retry", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(
      JSON.stringify({
        error: {
          code: "LOCAL_DB_UNAVAILABLE",
          message: "Database chưa phản hồi.",
        },
      }),
      { status: 503 },
    );
  });
  await assert.rejects(localRequest("/curriculum"), (e: unknown) => {
    const failure = e as Error & { kind: string; status: number; code: string };
    assert.equal(failure.kind, "http");
    assert.equal(failure.status, 503);
    assert.equal(failure.code, "LOCAL_DB_UNAVAILABLE");
    assert.match(failure.message, /HTTP 503/);
    return true;
  });
  assert.equal(calls, 1);
  for (const [reason, kind] of [
    [new TypeError("Failed to fetch"), "network"],
    [new DOMException("deadline", "TimeoutError"), "timeout"],
  ] as const) {
    t.mock.method(globalThis, "fetch", async () => {
      calls++;
      throw reason;
    });
    const before: number = calls;
    await assert.rejects(localRequest("/curriculum"), (e: unknown) => {
      assert.equal((e as { kind: string }).kind, kind);
      assert.equal((e as { status: number | null }).status, null);
      return true;
    });
    assert.equal(calls, before + 1);
  }
});

test("An HTTP503 HTML error cannot become a JSON-success or lose its status", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response("<html>upstream unavailable</html>", { status: 503 }),
  );
  await assert.rejects(localRequest("/curriculum"), (e: unknown) => {
    assert.equal((e as { kind: string }).kind, "http");
    assert.equal((e as { status: number }).status, 503);
    assert.doesNotMatch((e as Error).message, /<html>/);
    return true;
  });
});

test("Caller cancellation reaches fetch and application errors are not relabeled as network errors", async (t) => {
  const controller = new AbortController();
  controller.abort();
  t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, options?: RequestInit) => {
      assert.equal(options?.signal?.aborted, true);
      throw options!.signal!.reason;
    },
  );
  await assert.rejects(
    localRequest("/curriculum", undefined, undefined, controller.signal),
    (e: unknown) => {
      assert.equal((e as { kind: string }).kind, "aborted");
      return true;
    },
  );
  const authError = new Error("Phiên đăng nhập không còn hợp lệ.");
  t.mock.method(globalThis, "fetch", async () => {
    throw authError;
  });
  await assert.rejects(localRequest("/curriculum"), (e) => e === authError);
});

test("Known HTTP503 survives a truncated or timed-out response body", async (t) => {
  for (const reason of [
    new TypeError("terminated"),
    new DOMException("deadline", "TimeoutError"),
  ]) {
    t.mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(reason);
            },
          }),
          { status: 503 },
        ),
    );
    await assert.rejects(localRequest("/curriculum"), (e: unknown) => {
      assert.equal((e as { kind: string }).kind, "http");
      assert.equal((e as { status: number }).status, 503);
      assert.match((e as Error).message, /HTTP 503/);
      return true;
    });
  }
});
