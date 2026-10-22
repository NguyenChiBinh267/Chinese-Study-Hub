"use client";
import { useState, type FormEvent } from "react";
export default function Page() {
  const [status, setStatus] = useState("Chưa đăng nhập"),
    [busy, setBusy] = useState(false);
  async function send(action: string, value: unknown) {
    setBusy(true);
    try {
      const r = await fetch(`/api/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csh-proof": "1" },
        body: JSON.stringify(value),
        cache: "no-store",
      });
      setStatus(JSON.stringify({ status: r.status, result: await r.json() }));
    } catch {
      setStatus("Kết nối thất bại; chưa xác nhận lưu.");
    } finally {
      setBusy(false);
    }
  }
  function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    void send("login", { email: d.get("email"), password: d.get("password") });
  }
  return (
    <main>
      <h1>Kiểm chứng Cloud Gate</h1>
      <p>
        Proof kỹ thuật tạm thời · chỉ dữ liệu tổng hợp. Không có bài học, đáp án
        hay lịch sử cá nhân.
      </p>
      <form onSubmit={login}>
        <p>
          <label>
            Email thử nghiệm{" "}
            <input name="email" type="email" autoComplete="username" required />
          </label>
        </p>
        <p>
          <label>
            Mật khẩu{" "}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
        </p>
        <button disabled={busy}>Đăng nhập</button>
      </form>
      <p>
        <button
          disabled={busy}
          onClick={() => void send("proof", { key: crypto.randomUUID() })}
        >
          Ghi giao dịch tổng hợp
        </button>{" "}
        <button disabled={busy} onClick={() => void send("logout", {})}>
          Đăng xuất
        </button>
      </p>
      <pre
        role="status"
        style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      >
        {status}
      </pre>
    </main>
  );
}
