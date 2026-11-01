"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
export function LoginForm({ loggedOut }: { loggedOut?: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [showPassword, setShowPassword] = useState(false);
  const notice =
    loggedOut === "local"
      ? "Đã xóa phiên trên trình duyệt; chưa xác nhận thu hồi phiên tại dịch vụ đăng nhập."
      : loggedOut === "1"
        ? "Đã đăng xuất. Lịch sử đã lưu vẫn được giữ."
        : "";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget),
      params = new URLSearchParams(window.location.search);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "x-csh-auth": "1" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          next: params.get("next") ?? "/today",
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message ?? "Chưa đăng nhập được.");
      window.location.replace(data.redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa kết nối được. Thử lại.");
      setBusy(false);
    }
  }
  return (
    <main id="main" className="auth-page login-page">
      <div className="login-layout">
        <Link className="login-brand" href="/" title="Về trang chính">
          <span className="login-brand-mark" lang="zh-Hans">
            学
          </span>
          <span>
            Chinese <span className="login-brand-sub">STUDY HUB</span>
          </span>
        </Link>
        <section
          className="auth-card login-card"
          aria-labelledby="login-heading"
        >
          <h1 id="login-heading">Đăng nhập</h1>
          <p className="login-intro">
            Tiếp tục hành trình học tiếng Trung của bạn.
          </p>
          {notice && <p role="status">{notice}</p>}
          <form onSubmit={submit} aria-busy={busy}>
            <label htmlFor="login-email">
              Email
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="Email của bạn"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                required
                disabled={busy}
              />
            </label>
            <div className="login-password-field">
              <label htmlFor="login-password">Mật khẩu</label>
              <div className="login-password-control">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  maxLength={1024}
                  required
                  disabled={busy}
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-controls="login-password"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={busy}
                >
                  {showPassword ? (
                    <EyeOff size={19} aria-hidden="true" />
                  ) : (
                    <Eye size={19} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            {error && <p role="alert">{error}</p>}
            <button className="button primary full" disabled={busy}>
              {busy ? "Đang xác nhận…" : "Đăng nhập"}
              {!busy && <ArrowRight size={18} aria-hidden="true" />}
            </button>
          </form>
          <p className="login-access-note">
            <LockKeyhole size={15} aria-hidden="true" />
            Chỉ dành cho tài khoản chủ sở hữu.
          </p>
          <details className="login-help">
            <summary>Cần trợ giúp đăng nhập?</summary>
            <p>
              Ứng dụng chưa mở đăng ký. Nếu quên mật khẩu, chủ máy đặt lại trong
              dashboard quản trị; hiện chưa có email khôi phục tự động.
            </p>
          </details>
        </section>
        <Link className="login-back" href="/">
          <ArrowLeft size={15} aria-hidden="true" /> Về trang chính
        </Link>
      </div>
    </main>
  );
}
