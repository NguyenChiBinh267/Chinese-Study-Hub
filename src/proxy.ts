import { NextResponse, type NextRequest } from "next/server";
import { appMode } from "@/modules/auth/server/config";
import { safeRedirect } from "@/modules/auth/domain/mode";
import {
  authSession,
  privateResponse,
  validateAuthRequest,
} from "@/modules/auth/server/session";
import { CommandError } from "@/modules/learning/domain/local-foundation";
import { demoLessons } from "@/modules/content/fixtures/demo";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (appMode() !== "PRODUCTION_AUTHENTICATED") {
    // Streaming an unknown dynamic preview lesson can otherwise send HTTP 200
    // before notFound() is reached. Resolve its fixed preview route set early.
    const match = /^\/learn\/([^/]+)\/?$/.exec(pathname);
    if (
      match &&
      ![
        "courses",
        "pronunciation",
        "draft",
        "local-foundation-v1",
        ...demoLessons.map((l) => l.id),
      ].includes(match[1])
    )
      return NextResponse.rewrite(new URL("/_not-found", request.url), {
        status: 404,
      });
    return NextResponse.next();
  }
  // API handlers authorize again immediately before accessing data and own cookie writes.
  if (pathname.startsWith("/api/")) return NextResponse.next();
  const publicPage = ["/login", "/session-expired", "/unauthorized"].includes(
    pathname,
  );
  const session = authSession(request);
  try {
    validateAuthRequest(request, false);
    if (!publicPage) await session.owner();
    const h = new Headers(request.headers);
    h.set("cookie", request.cookies.toString());
    const response = NextResponse.next({ request: { headers: h } });
    return session.finish(response);
  } catch (e) {
    if (e instanceof CommandError) {
      const destination =
        e.status === 401
          ? `/login?next=${encodeURIComponent(safeRedirect(pathname + request.nextUrl.search))}`
          : "/unauthorized";
      return session.finish(
        NextResponse.redirect(new URL(destination, session.cfg.origin)),
      );
    }
    return privateResponse(
      NextResponse.json(
        {
          error: {
            code: "AUTH_UNAVAILABLE",
            message: "Chưa xác nhận được phiên đăng nhập. Thử lại sau.",
          },
        },
        { status: 503 },
      ),
    );
  }
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
