"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  LocalSnapshot,
  PreferenceCommand,
  PublicFixture,
} from "../domain/local-foundation";
import {
  applicationRequest,
  authenticatedUI,
} from "@/modules/auth/ui/protected-fetch";

type LocalState = {
  mode: "demo" | "local";
  enabled: boolean;
  initialized: boolean;
  technicalFixture: boolean;
  publishedContent: boolean;
  privateOwnerPreview: boolean;
  status: "loading" | "ready" | "error";
  error: string;
  data: LocalSnapshot | null;
  choose: (local: boolean) => Promise<boolean>;
  reload: () => Promise<void>;
  write: <T>(path: string, payload: unknown, method?: string) => Promise<T>;
  readFixture: () => Promise<PublicFixture>;
};
const Context = createContext<LocalState | null>(null);
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const r = await applicationRequest(path, {
    ...options,
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
    credentials: "same-origin",
  });
  const value = await r.json();
  if (!r.ok)
    throw new Error(
      value.error?.message ??
        "Chưa xác nhận từ server. Thử lại với dữ liệu hiện tại.",
    );
  return value as T;
}
export function LocalProvider({
  children,
  authenticated = false,
}: {
  children: ReactNode;
  authenticated?: boolean;
}) {
  const [mode, setMode] = useState<"demo" | "local">("demo");
  const [technicalFixture, setTechnicalFixture] = useState(false);
  const [publishedContent, setPublishedContent] = useState(false);
  const [privateOwnerPreview, setPrivateOwnerPreview] = useState(false);
  const [enabled, setEnabled] = useState(false),
    [initialized, setInitialized] = useState(false);
  const [status, setStatus] = useState<LocalState["status"]>("loading"),
    [error, setError] = useState("");
  const [data, setData] = useState<LocalSnapshot | null>(null);
  const pending = useRef(new Map<string, string>());
  async function loadSnapshot() {
    setStatus("loading");
    setError("");
    try {
      const result = await api<LocalSnapshot>("snapshot");
      setData(result);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Database chưa phản hồi.");
      throw e;
    }
  }
  async function initialize() {
    try {
      const s = await api<{
        enabled: boolean;
        active: boolean;
        technicalFixture?: boolean;
        publishedContent?: boolean;
        privateOwnerPreview?: boolean;
      }>("status");
      setEnabled(s.enabled);
      setTechnicalFixture(s.technicalFixture === true);
      setPublishedContent(s.publishedContent === true);
      setPrivateOwnerPreview(s.privateOwnerPreview === true);
      setInitialized(true);
      setMode(s.active ? "local" : "demo");
      if (s.active) await loadSnapshot();
      else {
        setStatus("ready");
        setError("");
      }
    } catch (e) {
      setStatus("error");
      setError(
        e instanceof Error ? e.message : "Chưa xác định được chế độ dữ liệu.",
      );
    }
  }
  useEffect(() => {
    let mounted = true;
    void api<{
      enabled: boolean;
      active: boolean;
      technicalFixture?: boolean;
      publishedContent?: boolean;
      privateOwnerPreview?: boolean;
    }>("status")
      .then(async (s) => {
        if (!mounted) return;
        setEnabled(s.enabled);
        setTechnicalFixture(s.technicalFixture === true);
        setPublishedContent(s.publishedContent === true);
        setPrivateOwnerPreview(s.privateOwnerPreview === true);
        setInitialized(true);
        setMode(s.active ? "local" : "demo");
        if (s.active) await loadSnapshot();
        else setStatus("ready");
      })
      .catch((e) => {
        if (mounted) {
          setStatus("error");
          setError(
            e instanceof Error ? e.message : "Chưa xác định được chế độ.",
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, []);
  async function choose(local: boolean) {
    if (authenticated) return false;
    setError("");
    setStatus("loading");
    try {
      if (enabled)
        await api("mode", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csh-local": "1" },
          body: JSON.stringify({ local }),
        });
      else if (local)
        throw new Error("LOCAL DATABASE bị khóa ngoài development.");
      setMode(local ? "local" : "demo");
      if (local) await loadSnapshot();
      else {
        setStatus("ready");
        setData(null);
      }
      return true;
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Chưa đổi được chế độ.");
      return false;
    }
  }
  async function write<T>(
    path: string,
    payload: unknown,
    method = "POST",
  ): Promise<T> {
    if (mode !== "local") throw new Error("Hãy chọn LOCAL DATABASE trước.");
    const body = JSON.stringify(payload),
      signature = `${path}:${body}`;
    const key = pending.current.get(signature) ?? crypto.randomUUID();
    pending.current.set(signature, key);
    try {
      const result = await api<T>(path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-csh-local": "1",
          "Idempotency-Key": key,
        },
        body,
      });
      pending.current.delete(signature); // Only after a server acknowledgement.
      await loadSnapshot();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa xác nhận lưu.");
      throw e;
    }
  }
  return (
    <Context.Provider
      value={{
        mode,
        enabled,
        initialized,
        technicalFixture,
        publishedContent,
        privateOwnerPreview,
        status,
        error,
        data,
        choose,
        reload: async () => {
          if (!initialized) await initialize();
          else if (mode === "local") await loadSnapshot();
        },
        write,
        readFixture: () => api<PublicFixture>("fixture"),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLocal() {
  const value = useContext(Context);
  if (!value) throw new Error("LocalProvider missing");
  return value;
}
export function LocalModeBar() {
  const local = useLocal();
  if (authenticatedUI())
    return (
      <section className="data-mode panel" aria-label="Chế độ dữ liệu">
        <div>
          <strong>PRODUCTION_AUTHENTICATED · OWNER</strong>
          <p>
            {local.privateOwnerPreview
              ? "Danh tính được xác nhận trên server. Chỉ mở các phiên bản DRAFT đã chọn cho preview riêng tư local."
              : "Danh tính được xác nhận trên server. Học liệu chưa duyệt vẫn bị khóa."}
          </p>
          {document.documentElement.dataset.authEnvironment === "local" && (
            <p>
              Dịch vụ Auth cục bộ để kiểm thử; không phải tài khoản owner
              online.
            </p>
          )}
        </div>
      </section>
    );
  return (
    <section className="data-mode panel" aria-label="Chế độ dữ liệu">
      <div>
        <strong>
          {!local.initialized
            ? "Đang kiểm tra chế độ…"
            : local.mode === "local"
              ? "LOCAL DATABASE · PostgreSQL"
              : "DEMO · bộ nhớ trong tab"}
        </strong>
        <p>
          {local.mode === "local"
            ? "Danh tính development local, không phải đăng nhập thật. Chỉ xác nhận lưu sau phản hồi server."
            : "DEMO không lưu bền vững. Chuyển sang LOCAL DATABASE để lưu lịch và bài fixture riêng."}
        </p>
      </div>
      <div className="mode-buttons" role="group" aria-label="Chọn chế độ">
        <button
          className="button secondary compact"
          aria-pressed={local.mode === "demo"}
          disabled={!local.initialized || local.status === "loading"}
          onClick={() => void local.choose(false)}
        >
          DEMO
        </button>
        <button
          className="button secondary compact"
          aria-pressed={local.mode === "local"}
          disabled={!local.enabled || local.status === "loading"}
          onClick={() => void local.choose(true)}
        >
          LOCAL DATABASE
        </button>
      </div>
      {local.error && (
        <p role="alert">
          {local.error}{" "}
          <button
            className="text-link"
            onClick={() => void local.reload().catch(() => {})}
          >
            Thử đọc lại
          </button>
        </p>
      )}
      {local.mode === "local" && local.status === "loading" && (
        <p role="status">Đang chờ database xác nhận…</p>
      )}
      {local.initialized && !local.enabled && (
        <small>
          LOCAL DATABASE chỉ mở bằng development local; production luôn khóa.
        </small>
      )}
    </section>
  );
}
export function LocalStatus() {
  const local = useLocal();
  return (
    <section
      className="panel empty-state"
      aria-busy={local.status === "loading"}
    >
      <h2>
        {local.status === "loading"
          ? "Đang đọc PostgreSQL…"
          : "Dữ liệu chưa được xác nhận"}
      </h2>
      <p>
        {local.error ||
          "Giữ chế độ LOCAL DATABASE; không thay bằng dữ liệu DEMO."}
      </p>
      {local.status === "error" && (
        <button
          className="button secondary"
          onClick={() => void local.reload().catch(() => {})}
        >
          Tải lại dữ liệu
        </button>
      )}
    </section>
  );
}
export type { PreferenceCommand };
