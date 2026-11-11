import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  body,
  response,
  failure,
} from "@/modules/learning/server/local-service";
import {
  authSession,
  validateAuthRequest,
} from "@/modules/auth/server/session";
import { appMode, AuthConfigurationError } from "@/modules/auth/server/config";
import { safeRedirect } from "@/modules/auth/domain/mode";
import { CommandError } from "@/modules/learning/domain/local-foundation";

export const dynamic = "force-dynamic";
const login = z.strictObject({
  email: z.email().max(254),
  password: z.string().min(1).max(1024),
  next: z.string().max(1024).optional(),
});
const attempts: number[] = [];
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  let session: ReturnType<typeof authSession> | undefined;
  try {
    if (appMode() !== "PRODUCTION_AUTHENTICATED")
      throw new CommandError(
        403,
        "AUTH_MODE_REQUIRED",
        "Đăng nhập owner chưa được cấu hình trong chế độ này.",
      );
    validateAuthRequest(request);
    const { action } = await params;
    if (!["login", "logout"].includes(action))
      return response({ error: { code: "NOT_FOUND" } }, 404);
    session = authSession(request);
    if (action === "login") {
      const now = Date.now();
      while (attempts[0] < now - 60000) attempts.shift();
      if (attempts.length >= 10)
        throw new CommandError(
          429,
          "LOGIN_RATE_LIMIT",
          "Đã thử đăng nhập nhiều lần. Chờ một phút rồi thử lại.",
        );
      attempts.push(now);
      const value = await body(request, login);
      const result = await session.client.auth.signInWithPassword({
        email: value.email,
        password: value.password,
      });
      if (result.error) {
        session.clear();
        throw new CommandError(
          401,
          "INVALID_CREDENTIALS",
          "Không đăng nhập được. Kiểm tra thông tin hoặc thử lại sau.",
        );
      }
      try {
        await session.owner();
      } catch (e) {
        await session.client.auth.signOut({ scope: "local" });
        session.clear();
        throw e;
      }
      return session.finish(
        response({ redirect: safeRedirect(value.next), authenticated: true }),
      );
    }
    await body(request, z.strictObject({}));
    const result = await session.client.auth.signOut({ scope: "local" });
    session.clear();
    return session.finish(
      response({ signedOut: true, revocationConfirmed: !result.error }),
    );
  } catch (e) {
    const error =
      e instanceof AuthConfigurationError
        ? response(
            {
              error: {
                code: "AUTH_CONFIG",
                message: "Chưa cấu hình đăng nhập an toàn. Liên hệ chủ máy.",
              },
            },
            503,
          )
        : failure(e);
    return session ? session.finish(error) : error;
  }
}
