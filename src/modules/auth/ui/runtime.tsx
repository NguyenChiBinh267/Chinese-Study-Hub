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
    [error, setError] = useState(""),
    [verified, setVerified] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (mode !== "PRODUCTION_AUTHENTICATED" || publicPage) return;
    let alive = true,
      pending = false,
      terminating = false,
      generation = 0,
      activeGeneration = 0,
      checkAgain = false;
    const expire = () => {
      if (terminating) return;
      terminating = true;
      setVerified(false);
      cancelProtectedRequests();
      setState("ending");
      window.location.replace(
        `/session-expired?next=${encodeURIComponent(window.location.pathname)}`,
      );
    };
    const ending = () => {
      terminating = true;
      setVerified(false);
      setState("ending");
    };
    const failed = () => {
      terminating = false;
      setState("error");
      setError("Chưa xác nhận đăng xuất. Dữ liệu trên server vẫn được giữ.");
    };
    async function check() {
      if (!alive || terminating || document.visibilityState !== "visible")
        return;
      if (pending) {
        if (activeGeneration !== generation) checkAgain = true;
        return;
      }
      pending = true;
      const requestGeneration = generation;
      activeGeneration = generation;
      try {
        const r = await protectedFetch("/api/v1/me");
        if (!r.ok)
          throw new Error("Chưa xác nhận được tài khoản. Thử tải lại.");
        const p = await r.json();
        if (alive && !terminating && requestGeneration === generation) {
          document.documentElement.classList.remove("csh-auth-pending");
          document.documentElement.dataset.textSize = p.textSize;
          setVerified(true);
          setState("ready");
          setError("");
        }
      } catch (e) {
        if (
          alive &&
          !terminating &&
          requestGeneration === generation &&
          document.visibilityState === "visible"
        ) {
          setState("error");
          setError(e instanceof Error ? e.message : "Chưa xác nhận phiên.");
        }
      } finally {
        pending = false;
        if (checkAgain && alive && !terminating) {
          checkAgain = false;
          void check();
        }
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
    const hide = (event: PageTransitionEvent) => {
      // Only a restored document needs a privacy shield. Ordinary window/tab
      // focus revalidates in the background without blanking or remounting it.
      if (event.persisted) {
        generation++;
        document.documentElement.classList.add("csh-auth-pending");
      }
    };
    const wake = (event: Event) => {
      if (document.visibilityState === "visible" && !terminating) {
        if (
          event.type === "pageshow" &&
          (event as PageTransitionEvent).persisted
        )
          generation++;
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
  }, [mode, publicPage, retry]);
  if (publicPage) return children;
  const gated = mode === "PRODUCTION_AUTHENTICATED" && state !== "ready";
  return (
    <>
      {(verified || mode !== "PRODUCTION_AUTHENTICATED") && (
        <div className="auth-content" hidden={gated} inert={gated}>
          <LocalProvider authenticated={mode === "PRODUCTION_AUTHENTICATED"}>
            <PreviewProvider>
              <AppShell>{children}</AppShell>
            </PreviewProvider>
          </LocalProvider>
        </div>
      )}
      {gated && (
        <main className="auth-page" id={verified ? "auth-main" : "main"}>
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
                  onClick={() => {
                    setState("checking");
                    setRetry((value) => value + 1);
                  }}
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
      )}
    </>
  );
}
