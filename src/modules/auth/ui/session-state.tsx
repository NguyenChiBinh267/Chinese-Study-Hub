"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { logoutOwner } from "./protected-fetch";
export function SessionState({ denied = false }: { denied?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const failed = () => {
      setBusy(false);
      setError("Chưa xác nhận đăng xuất. Thử lại khi có kết nối.");
    };
    window.addEventListener("csh-logout-failed", failed);
    return () => window.removeEventListener("csh-logout-failed", failed);
  }, []);
  return (
    <main id="main" className="auth-page">
      <section className="panel auth-card">
        <span className="eyebrow">TÀI KHOẢN</span>
        <h1>
          {denied
            ? "Tài khoản chưa được cấp quyền."
            : "Phiên đăng nhập đã kết thúc."}
        </h1>
        <p>
          {denied
            ? "Chỉ tài khoản owner đã cấu hình mới được truy cập. Đăng nhập thành công không tự cấp quyền sử dụng ứng dụng."
            : "Đăng nhập lại để tiếp tục. Lịch và kết quả đã lưu vẫn được giữ trên server."}
        </p>
        <Link className="button primary" href="/login">
          Đến trang đăng nhập
        </Link>
        {error && <p role="alert">{error}</p>}
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError("");
            void logoutOwner();
          }}
        >
          {busy ? "Đang kết thúc phiên…" : "Xóa phiên và đăng xuất"}
        </button>
      </section>
    </main>
  );
}
