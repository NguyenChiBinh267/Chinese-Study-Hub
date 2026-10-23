"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { AppMode } from "../domain/mode";
import { LocalProvider } from "@/modules/learning/ui/local-provider";
import { PreviewProvider } from "@/modules/preview/ui/preview-provider";
import { AppShell } from "@/components/app-shell";
import {
  cancelProtectedRequests,
  logoutOwner,
  protectedFetch,
} from "./protected-fetch";
export function AuthRuntime({
  mode,
  children,
}: {
  mode: AppMode;
  children: ReactNode;
}) {
  const path = usePathname(),
    publicPage = ["/login", "/session-expired", "/unauthorized"].includes(path);
  const [state, setState] = useState<"checking" | "ready" | "ending" | "error">(
      "checking",
    ),
    [error, setError] = useState("");
  useEffect(() => {
    if (mode !== "PRODUCTION_AUTHENTICATED" || publicPage) return;
    let alive = true,
      pending = false,
      terminating = false;
    const expire = () => {
      if (terminating) return;
      terminating = true;
      cancelProtectedRequests();
      setState("ending");
      window.location.replace(
        `/session-expired?next=${encodeURIComponent(window.location.pathname)}`,
      );
    };
    const ending = () => {
      terminating = true;
      setState("ending");
    };
    const failed = () => {
      terminating = false;
      setState("error");
      setError("Chưa xác nhận đăng xuất. Dữ liệu trên server vẫn được giữ.");
    };
    async function check() {
      if (
        !alive ||
        pending ||
        terminating ||
        document.visibilityState !== "visible"
      )
        return;
      pending = true;
      try {
        const r = await protectedFetch("/api/v1/me");
        if (!r.ok)
          throw new Error("Chưa xác nhận được tài khoản. Thử tải lại.");
        const p = await r.json();
        if (alive && !terminating) {
          document.documentElement.classList.remove("csh-auth-pending");
          document.documentElement.dataset.textSize = p.textSize;
          setState("ready");
          setError("");
        }
      } catch (e) {
        if (alive && !terminating) {
          setState("error");
          setError(e instanceof Error ? e.message : "Chưa xác nhận phiên.");
        }
      } finally {
        pending = false;
      }
    }
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("csh-owner-session")
        : null;
    if (channel)
      channel.onmessage = (e) => {
        if (e.data === "logout") expire();
      };
    const hide = () => {
      document.documentElement.classList.add("csh-auth-pending");
      cancelProtectedRequests();
    };
    const wake = () => {
      if (document.visibilityState === "visible" && !terminating) {
        document.documentElement.classList.add("csh-auth-pending");
        void check();
      }
    };
    window.addEventListener("csh-session-expired", expire);
    window.addEventListener("csh-session-ending", ending);
    window.addEventListener("csh-logout-failed", failed);
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", wake);
    const timer = setInterval(check, 5 * 60 * 1000);
    void check();
    return () => {
      alive = false;
      clearInterval(timer);
      channel?.close();
      cancelProtectedRequests();
      delete document.documentElement.dataset.textSize;
      document.documentElement.classList.remove("csh-auth-pending");
      window.removeEventListener("csh-session-expired", expire);
      window.removeEventListener("csh-session-ending", ending);
      window.removeEventListener("csh-logout-failed", failed);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("pagehide", hide);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [mode, publicPage]);
  if (publicPage) return children;
  if (mode === "PRODUCTION_AUTHENTICATED" && state !== "ready")
    return (
      <main className="auth-page" id="main">
        <section className="panel auth-card" aria-busy={state !== "error"}>
          <h1>
            {state === "ending"
              ? "Đang kết thúc phiên…"
              : "Đang kiểm tra đăng nhập…"}
          </h1>
          {state === "error" ? (
            <>
              <p role="alert">{error}</p>
              <button
                className="button secondary"
                onClick={() => window.location.reload()}
              >
                Kiểm tra lại
              </button>
              <button
                className="button secondary"
                onClick={() => void logoutOwner()}
              >
                Thử đăng xuất
              </button>
            </>
          ) : (
            <p role="status">Đang xác nhận với dịch vụ đăng nhập.</p>
          )}
        </section>
      </main>
    );
  return (
    <LocalProvider authenticated={mode === "PRODUCTION_AUTHENTICATED"}>
      <PreviewProvider>
        <AppShell>{children}</AppShell>
      </PreviewProvider>
    </LocalProvider>
  );
}
