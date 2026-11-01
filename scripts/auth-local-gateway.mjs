// Prefix-only gateway for the REAL local GoTrue process; never fabricates identity.
import http from "node:http";
import fs from "node:fs";
const events = ".local-postgres/sprint10/auth-local/gateway-events.jsonl";
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:54390");
  if (req.url === "/health") {
    res.end("local-gotrue-prefix-gateway");
    return;
  }
  if (
    !/^\/auth\/v1\/(token|user|logout|settings|signup|health)$/.test(
      url.pathname,
    )
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 8192) {
      res.writeHead(413);
      res.end();
      return;
    }
    chunks.push(chunk);
  }
  try {
    const headers = new Headers();
    for (const key of [
      "authorization",
      "apikey",
      "content-type",
      "x-client-info",
      "x-supabase-api-version",
    ])
      if (req.headers[key]) headers.set(key, req.headers[key]);
    const r = await fetch(
      "http://127.0.0.1:54391" +
        url.pathname.replace("/auth/v1", "") +
        url.search,
      {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : Buffer.concat(chunks),
        signal: AbortSignal.timeout(8000),
      },
    );
    fs.appendFileSync(
      events,
      JSON.stringify({
        at: new Date().toISOString(),
        method: req.method,
        path: url.pathname,
        grant: url.searchParams.get("grant_type"),
        status: r.status,
      }) + "\n",
    );
    res.writeHead(r.status, {
      "Content-Type": r.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    });
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch {
    res.writeHead(503);
    res.end('{"error":"LOCAL_AUTH_UNAVAILABLE"}');
  }
});
server.listen(54390, "127.0.0.1", () =>
  console.log(
    "Real local GoTrue prefix gateway ready on loopback; no mock identities.",
  ),
);
