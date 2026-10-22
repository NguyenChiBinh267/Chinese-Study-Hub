import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { Pool } from "pg";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { configuration, verifiedPgOptions } from "./config";
import { ownerTransaction } from "../src/shared/db/transaction";
const worker = randomUUID();
let pool: Pool | undefined;
export function session(req: NextRequest) {
  const cfg = configuration();
  if (
    req.headers.get("host") !== new URL(cfg.origin).host ||
    req.headers.get("sec-fetch-site") === "cross-site" ||
    ["authorization", "x-user-id", "x-owner-id"].some((k) => req.headers.has(k))
  )
    throw Error("FORGED_ORIGIN_OR_IDENTITY");
  if (
    req.method === "POST" &&
    (req.headers.get("origin") !== cfg.origin ||
      req.headers.get("x-csh-proof") !== "1" ||
      !req.headers.get("content-type")?.startsWith("application/json"))
  )
    throw Error("FORGED_ORIGIN_OR_IDENTITY");
  const pending = new Map<
    string,
    { name: string; value: string; options: CookieOptions }
  >();
  const client = createServerClient(cfg.provider, cfg.key, {
    cookieOptions: {
      name: cfg.secure ? "__Host-csh-proof" : "csh-proof-local",
      httpOnly: true,
      secure: cfg.secure,
      sameSite: "strict",
      path: "/",
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }),
    },
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (items) => {
        for (const c of items) {
          req.cookies.set(c.name, c.value);
          pending.set(c.name, c);
        }
      },
    },
  });
  return {
    cfg,
    client,
    async owner() {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) throw Error("SESSION_REQUIRED");
      if (
        data.user.id !== cfg.owner ||
        data.user.is_anonymous ||
        data.user.role !== "authenticated"
      )
        throw Error("OWNER_ONLY");
      return data.user.id;
    },
    finish(res: NextResponse) {
      for (const c of pending.values())
        res.cookies.set(c.name, c.value, {
          ...c.options,
          httpOnly: true,
          secure: cfg.secure,
          sameSite: "strict",
          path: "/",
          domain: undefined,
        });
      return privateResponse(res);
    },
  };
}
export function privateResponse(res: NextResponse) {
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  res.headers.set("Vary", "Cookie");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Frame-Options", "DENY");
  return res;
}
export async function proof(uid: string, key?: string) {
  const cfg = configuration();
  if (!pool) {
    pool = new Pool({
      ...verifiedPgOptions(cfg.database, process.env.CSH_DATABASE_CA_PEM ?? ""),
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
      statement_timeout: 5000,
      application_name: "csh-cloud-benchmark",
    });
    pool.on("error", () => {});
  }
  return ownerTransaction(pool, uid, async (c) => {
    const stream = (
      c as unknown as {
        connection: { stream: { encrypted?: boolean; authorized?: boolean } };
      }
    ).connection.stream;
    if (!stream.encrypted || !stream.authorized)
      throw Error("TLS_NOT_VERIFIED");
    if (key)
      await c.query(
        "INSERT INTO app_private.api_idempotency(user_id,endpoint,key,payload_hash,response_json) VALUES($1,'cloud-gate-proof-v1',$2,$3,'{\"stored\":true}') ON CONFLICT DO NOTHING",
        [uid, key, "0".repeat(64)],
      );
    const count = Number(
      (
        await c.query(
          "SELECT count(*) AS n FROM app_private.api_idempotency WHERE endpoint='cloud-gate-proof-v1'",
        )
      ).rows[0].n,
    );
    return {
      read: true,
      transaction: key !== undefined,
      count,
      tlsVerified: true,
      worker,
      runtime: process.version,
      region: process.env.VERCEL_REGION ?? process.env.RENDER_REGION ?? "local",
      version:
        process.env.CSH_PROOF_COMMIT ??
        process.env.VERCEL_GIT_COMMIT_SHA ??
        "UNSTAMPED",
    };
  });
}
export function denied(e: unknown) {
  const code = e instanceof Error ? e.message : "PROOF_UNAVAILABLE";
  return privateResponse(
    NextResponse.json(
      {
        error:
          code === "SESSION_REQUIRED"
            ? code
            : code === "OWNER_ONLY"
              ? code
              : code === "FORGED_ORIGIN_OR_IDENTITY"
                ? code
                : "PROOF_UNAVAILABLE",
      },
      {
        status:
          code === "SESSION_REQUIRED"
            ? 401
            : code === "OWNER_ONLY" || code === "FORGED_ORIGIN_OR_IDENTITY"
              ? 403
              : 503,
      },
    ),
  );
}
