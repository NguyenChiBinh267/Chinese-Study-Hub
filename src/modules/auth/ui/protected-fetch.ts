"use client";
const active = new Set<AbortController>();
export function authenticatedUI() {
  return (
    typeof document !== "undefined" &&
    document.documentElement.dataset.appMode === "PRODUCTION_AUTHENTICATED"
  );
}
export function cancelProtectedRequests() {
  for (const c of active) c.abort();
  active.clear();
}
export async function protectedFetch(path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  active.add(controller);
  try {
    const r = await fetch(path, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(20000),
        ...(options.signal ? [options.signal] : []),
      ]),
    });
    if (
      authenticatedUI() &&
      (r.status === 401 ||
        (r.status === 403 &&
          (
            await r
              .clone()
              .json()
              .catch(() => null)
          )?.error?.code === "OWNER_ONLY"))
    ) {
      window.dispatchEvent(new Event("csh-session-expired"));
      throw new Error("Phiên đăng nhập không còn hợp lệ.");
    }
    const bytes = r.status === 204 ? null : await r.arrayBuffer();
    return new Response(bytes, {
      status: r.status,
      statusText: r.statusText,
      headers: r.headers,
    });
  } finally {
    active.delete(controller);
  }
}
export function applicationRequest(path: string, options: RequestInit = {}) {
  const production = authenticatedUI(),
    h = new Headers(options.headers);
  if (
    production &&
    options.method &&
    !["GET", "HEAD"].includes(options.method)
  ) {
    h.delete("x-csh-local");
    h.set("x-csh-auth", "1");
  }
  const url = `${production ? "/api/v1" : "/api/local"}/${path.replace(/^\//, "")}`;
  return production
    ? protectedFetch(url, { ...options, headers: h })
    : fetch(url, { ...options, headers: h });
}
export async function logoutOwner() {
  cancelProtectedRequests();
  window.dispatchEvent(new Event("csh-session-ending"));
  try {
    const r = await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csh-auth": "1" },
      body: "{}",
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error("Chưa xác nhận đăng xuất.");
    const result = await r.json();
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("csh-owner-session");
      channel.postMessage("logout");
      channel.close();
    }
    window.location.replace(
      result.revocationConfirmed
        ? "/login?loggedOut=1"
        : "/login?loggedOut=local",
    );
  } catch {
    window.dispatchEvent(new Event("csh-logout-failed"));
  }
}
