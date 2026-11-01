import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CommandError } from "@/modules/learning/domain/local-foundation";
import { authConfiguration } from "./config";

export function privateResponse(response: NextResponse) {
  if (/^[a-f0-9]{40}$/.test(process.env.CSH_DEPLOY_COMMIT ?? ""))
    response.headers.set("X-CSH-Source", process.env.CSH_DEPLOY_COMMIT!);
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, max-age=0, must-revalidate",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Vary", "Cookie");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}
export function validateAuthRequest(
  request: NextRequest,
  mutation = !["GET", "HEAD"].includes(request.method),
) {
  const cfg = authConfiguration();
  if (
    request.headers.get("host") !== new URL(cfg.origin).host ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new CommandError(
      403,
      "ORIGIN_REQUIRED",
      "Yêu cầu không thuộc địa chỉ ứng dụng đã cấu hình.",
    );
  if (
    ["x-user-id", "x-owner-id", "authorization"].some((h) =>
      request.headers.has(h),
    )
  )
    throw new CommandError(
      403,
      "FORGED_IDENTITY",
      "Không nhận danh tính từ header của client.",
    );
  if (
    mutation &&
    (request.headers.get("origin") !== cfg.origin ||
      request.headers.get("x-csh-auth") !== "1" ||
      !request.headers.get("content-type")?.startsWith("application/json"))
  )
    throw new CommandError(
      403,
      "ORIGIN_REQUIRED",
      "Thao tác cần yêu cầu JSON cùng origin.",
    );
  return cfg;
}
// Request-scoped SDK. No browser SDK, token props, global session client or SQL here.
export function authSession(request: NextRequest) {
  const cfg = authConfiguration();
  const writes = new Map<
    string,
    { name: string; value: string; options: CookieOptions }
  >();
  const cacheHeaders: Record<string, string> = {};
  const client = createServerClient(cfg.providerUrl, cfg.publishableKey, {
    cookieOptions: {
      name: cfg.secure ? "__Host-csh-owner-auth" : "csh-owner-auth",
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: cfg.secure,
      maxAge: 7 * 86400,
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
      getAll: () => request.cookies.getAll(),
      setAll: (cookies, headers) => {
        Object.assign(cacheHeaders, headers);
        for (const cookie of cookies) {
          request.cookies.set(cookie.name, cookie.value);
          writes.set(cookie.name, cookie);
        }
      },
    },
  });
  return {
    cfg,
    client,
    async owner() {
      // getUser verifies against Auth, rather than trusting the user cached in cookies.
      const { data, error } = await client.auth.getUser();
      if (
        error &&
        (error.status === 0 ||
          (error.status ?? 0) >= 500 ||
          error.name === "AuthRetryableFetchError")
      )
        throw new CommandError(
          503,
          "AUTH_UNAVAILABLE",
          "Dịch vụ đăng nhập chưa phản hồi. Giữ phiên hiện tại và thử lại.",
        );
      if (error || !data.user)
        throw new CommandError(
          401,
          "SESSION_REQUIRED",
          "Phiên đăng nhập đã hết hạn hoặc không còn hợp lệ.",
        );
      if (
        data.user.id !== cfg.ownerId ||
        data.user.is_anonymous ||
        data.user.role !== "authenticated"
      )
        throw new CommandError(
          403,
          "OWNER_ONLY",
          "Tài khoản này không được phép vào không gian học.",
        );
      return data.user.id;
    },
    clear() {
      for (const cookie of request.cookies.getAll())
        if (/^(?:__Host-)?csh-owner-auth(?:\.\d+)?$/.test(cookie.name))
          writes.set(cookie.name, {
            name: cookie.name,
            value: "",
            options: { maxAge: 0 },
          });
    },
    finish(response: NextResponse) {
      for (const { name, value, options } of writes.values())
        response.cookies.set(name, value, {
          ...options,
          path: "/",
          domain: undefined,
          httpOnly: true,
          sameSite: "strict",
          secure: cfg.secure,
        });
      Object.entries(cacheHeaders).forEach(([k, v]) =>
        response.headers.set(k, v),
      );
      return privateResponse(response);
    },
  };
}
