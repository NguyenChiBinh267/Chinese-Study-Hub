import { PostgresStudyRepository } from "@/modules/planning/infrastructure/postgres-study";
import { PostgresCurriculumRepository } from "@/modules/curriculum/infrastructure/postgres-curriculum";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { CommandError, uuid } from "../domain/local-foundation";
import { createRuntimePool } from "@/shared/db/transaction";
import { PostgresLocalRepository } from "../infrastructure/postgres-local-repository";
import { PostgresReviewRepository } from "../../review/infrastructure/postgres-review-repository";
import { PostgresContentRepository } from "../../content/infrastructure/postgres-content";

const cookieName = "csh_local_development";
const modeCookieName = "csh_local_selected";
export function developmentEnabled(
  env: NodeJS.ProcessEnv = process.env,
  buildEnvironment = process.env.NODE_ENV,
) {
  // Next replaces the direct NODE_ENV default at build time. Runtime env
  // overrides cannot enable this adapter in an already-built production app.
  return (
    buildEnvironment === "development" &&
    env.NODE_ENV === "development" &&
    (!env.CSH_APP_MODE || env.CSH_APP_MODE === "LOCAL_DATABASE_DEV") &&
    env.CSH_LOCAL_DATABASE === "1"
  );
}
function configuration(request: NextRequest) {
  if (!developmentEnabled())
    throw new CommandError(
      403,
      "DEV_ONLY",
      "LOCAL DATABASE chỉ mở trong development, không phải đăng nhập production.",
    );
  const origin = new URL(process.env.CSH_APP_ORIGIN ?? "http://127.0.0.1:3000");
  // NextURL canonicalizes 127.0.0.1 to localhost. Check the original Host and
  // explicit loopback/protocol/port instead of trusting that normalization.
  const loopback = ["127.0.0.1", "localhost", "[::1]"];
  if (
    origin.protocol !== "http:" ||
    !loopback.includes(origin.hostname) ||
    !loopback.includes(request.nextUrl.hostname) ||
    request.nextUrl.protocol !== origin.protocol ||
    request.nextUrl.port !== origin.port ||
    request.headers.get("host") !== origin.host
  )
    throw new CommandError(
      403,
      "LOOPBACK_ONLY",
      "Chỉ cho phép origin local đã cấu hình.",
    );
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    request.headers.has("x-user-id") ||
    request.headers.has("x-owner-id") ||
    request.headers.has("authorization")
  )
    throw new CommandError(
      403,
      "FORGED_IDENTITY",
      "Danh tính không được nhận từ client.",
    );
  if (
    request.method !== "GET" &&
    (request.headers.get("origin") !== origin.origin ||
      request.headers.get("x-csh-local") !== "1" ||
      !request.headers.get("content-type")?.startsWith("application/json"))
  )
    throw new CommandError(
      403,
      "ORIGIN_REQUIRED",
      "Yêu cầu xác nhận cùng origin.",
    );
  const owner = uuid.safeParse(process.env.CSH_LOCAL_OWNER_ID),
    secret = process.env.CSH_LOCAL_SESSION_SECRET;
  if (!owner.success || !secret || secret.length < 32)
    throw new CommandError(
      503,
      "LOCAL_AUTH_CONFIG",
      "Chưa cấu hình development identity.",
    );
  return { uid: owner.data, secret };
}
function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
function validCookie(
  request: NextRequest,
  cfg: { uid: string; secret: string },
) {
  const value = request.cookies.get(cookieName)?.value;
  if (!value) return false;
  const [uid, expires, mac, extra] = value.split(".");
  if (
    extra ||
    uid !== cfg.uid ||
    !/^\d{13}$/.test(expires ?? "") ||
    Number(expires) <= Date.now() ||
    !/^[\w-]{43}$/.test(mac ?? "")
  )
    return false;
  const expected = signature(`${uid}.${expires}`, cfg.secret);
  return timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
}
export async function body<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<T> {
  const reader = request.body?.getReader();
  if (!reader)
    throw new CommandError(422, "INVALID_BODY", "Thiếu dữ liệu gửi.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      length += r.value.length;
      if (length > 4096) {
        await reader.cancel();
        throw new CommandError(413, "BODY_TOO_LARGE", "Dữ liệu gửi quá lớn.");
      }
      chunks.push(r.value);
    }
    let json: unknown;
    try {
      json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new CommandError(422, "INVALID_JSON", "Dữ liệu JSON không hợp lệ.");
    }
    const result = schema.safeParse(json);
    if (!result.success)
      throw new CommandError(
        422,
        "INVALID_INPUT",
        "Dữ liệu chưa hợp lệ hoặc chứa trường không được phép.",
      );
    return result.data;
  } finally {
    reader.releaseLock();
  }
}
export function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function failure(error: unknown) {
  if (error instanceof CommandError)
    return response(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  if (error instanceof z.ZodError)
    return response(
      {
        error: {
          code: "INVALID_INPUT",
          message: "Định danh hoặc dữ liệu gửi không hợp lệ.",
        },
      },
      422,
    );
  // Never serialize SQL, stack, credentials, server keys or raw pg diagnostics.
  return response(
    {
      error: {
        code: "LOCAL_DB_UNAVAILABLE",
        message:
          "Chưa xác nhận từ database. Giữ dữ liệu trong tab và thử lại; không chuyển sang DEMO.",
      },
    },
    503,
  );
}
export function identity(request: NextRequest) {
  const cfg = configuration(request);
  if (!validCookie(request, cfg))
    throw new CommandError(
      401,
      "LOCAL_SESSION_REQUIRED",
      "Chọn LOCAL DATABASE để mở phiên development (8 giờ). Không phải đăng nhập thật.",
    );
  return cfg.uid;
}
export function idempotencyKey(request: NextRequest) {
  const key = uuid.safeParse(request.headers.get("idempotency-key"));
  if (!key.success)
    throw new CommandError(
      422,
      "IDEMPOTENCY_REQUIRED",
      "Thiếu khóa idempotency hợp lệ.",
    );
  return key.data;
}
export async function status(request: NextRequest) {
  if (!developmentEnabled()) return response({ enabled: false, active: false });
  const cfg = configuration(request);
  // Mode selection outlives auth. An expired local session must show an explicit
  // LOCAL/401 recovery state, never silently fall back to DEMO after reload.
  return response({
    enabled: true,
    active:
      request.cookies.get(modeCookieName)?.value === "1" ||
      validCookie(request, cfg),
  });
}
export async function mode(request: NextRequest) {
  const cfg = configuration(request),
    value = await body(request, z.strictObject({ local: z.boolean() }));
  const result = response({ active: value.local });
  const payload = `${cfg.uid}.${Date.now() + 8 * 60 * 60 * 1000}`;
  result.cookies.set(
    cookieName,
    value.local ? `${payload}.${signature(payload, cfg.secret)}` : "",
    {
      httpOnly: true,
      sameSite: "strict",
      path: "/api/local",
      maxAge: value.local ? 8 * 3600 : 0,
    },
  );
  result.cookies.set(modeCookieName, value.local ? "1" : "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/api/local",
    maxAge: value.local ? 365 * 86400 : 0,
  });
  return result;
}
const globalDb = globalThis as typeof globalThis & {
  cshLocalRepository?: PostgresLocalRepository;
  cshReviewRepository?: PostgresReviewRepository;
  cshContentRepository?: PostgresContentRepository;
  cshStudyRepository?: PostgresStudyRepository;
  cshCurriculumRepository?: PostgresCurriculumRepository;
};
export function repository() {
  if (!developmentEnabled())
    throw new CommandError(
      403,
      "DEV_ONLY",
      "Database local bị khóa ngoài development.",
    );
  if (!process.env.DATABASE_URL)
    throw new CommandError(
      503,
      "MISSING_DATABASE",
      "Chưa khởi tạo PostgreSQL local.",
    );
  return (globalDb.cshLocalRepository ??= new PostgresLocalRepository(
    createRuntimePool(process.env.DATABASE_URL),
  ));
}
export function reviewRepository() {
  repository(); // Enforce the same development/config gates before pool creation.
  return (globalDb.cshReviewRepository ??= new PostgresReviewRepository(
    createRuntimePool(process.env.DATABASE_URL!),
  ));
}
export function contentRepository() {
  repository();
  return (globalDb.cshContentRepository ??= new PostgresContentRepository(
    createRuntimePool(process.env.DATABASE_URL!),
  ));
}

export function studyRepository() {
  repository();
  return (globalDb.cshStudyRepository ??= new PostgresStudyRepository(
    createRuntimePool(process.env.DATABASE_URL!),
  ));
}
export function curriculumRepository() {
  repository();
  return (globalDb.cshCurriculumRepository ??= new PostgresCurriculumRepository(
    createRuntimePool(process.env.DATABASE_URL!),
  ));
}
