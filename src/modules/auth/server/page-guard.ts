import "server-only";
import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { appMode, authConfiguration } from "./config";
import { authSession, validateAuthRequest } from "./session";
import { CommandError } from "@/modules/learning/domain/local-foundation";
export async function requirePageOwner() {
  if (appMode() !== "PRODUCTION_AUTHENTICATED") return null;
  const store = await cookies();
  const cfg = authConfiguration(),
    h = new Headers(await headers());
  h.set("cookie", store.toString());
  const request = new NextRequest(cfg.origin, { headers: h });
  validateAuthRequest(request, false);
  try {
    return await authSession(request).owner();
  } catch (e) {
    if (e instanceof CommandError)
      redirect(e.status === 403 ? "/unauthorized" : "/login");
    throw e;
  }
}
