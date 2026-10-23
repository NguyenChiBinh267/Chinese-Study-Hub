"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/ui";
import type { OwnerProfile } from "../domain/profile";
import { protectedFetch, logoutOwner } from "./protected-fetch";
export function AccountSettings() {
  const [profile, setProfile] = useState<OwnerProfile | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    void protectedFetch("/api/v1/me")
      .then(async (r) => {
        if (!r.ok) throw new Error("Chưa đọc được hồ sơ.");
        return r.json();
      })
      .then((p) => {
        if (alive) {
          setProfile(p);
          setFailed(false);
          setMessage("");
        }
      })
      .catch((e) => {
        if (alive) {
          setMessage(e.message);
          setFailed(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [retry]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    setFailed(false);
    setMessage("");
    try {
      const r = await protectedFetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csh-auth": "1" },
        body: JSON.stringify({
          displayName: profile.displayName,
          textSize: profile.textSize,
          timezone: profile.timezone,
        }),
      });
      if (!r.ok)
        throw new Error(
          (await r.json()).error?.message ?? "Chưa lưu được hồ sơ.",
        );
      document.documentElement.dataset.textSize = profile.textSize;
      setMessage("Đã lưu hồ sơ trên server.");
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : "Chưa xác nhận lưu.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="TÀI KHOẢN OWNER"
        title="Góc học của bạn"
        description="Tùy chỉnh hiển thị và kiểm tra tài khoản đang dùng."
      />
      {message && <p role={failed ? "alert" : "status"}>{message}</p>}
      {!profile ? (
        <section className="panel">
          <p>Đang đọc hồ sơ…</p>
          <button
            className="button secondary"
            onClick={() => setRetry((n) => n + 1)}
          >
            Thử tải lại
          </button>
        </section>
      ) : (
        <form className="panel account-form" onSubmit={save} aria-busy={busy}>
          <p className="field-hint">
            User ID: <span className="account-id">{profile.userId}</span>
          </p>
          <label>
            Tên hiển thị
            <input
              value={profile.displayName}
              onChange={(e) =>
                setProfile({ ...profile, displayName: e.target.value })
              }
              required
              maxLength={80}
            />
          </label>
          <label>
            Cỡ chữ
            <select
              value={profile.textSize}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  textSize: e.target.value as OwnerProfile["textSize"],
                })
              }
            >
              <option value="normal">Tiêu chuẩn</option>
              <option value="large">Lớn hơn</option>
            </select>
          </label>
          <label>
            Múi giờ hồ sơ
            <input
              value={profile.timezone}
              onChange={(e) =>
                setProfile({ ...profile, timezone: e.target.value })
              }
              required
              maxLength={80}
            />
          </label>
          <p className="field-hint">
            Múi giờ lịch học: {profile.scheduleTimezone ?? "Chưa có lịch"}. Đổi
            múi giờ hồ sơ không tự chuyển lịch đã lưu; chỉnh tại{" "}
            <Link href="/schedule">Lịch học</Link> để xem trước và xác nhận.
          </p>
          <button className="button primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu hồ sơ"}
          </button>
        </form>
      )}
      <section className="panel space-top">
        <h2>Kết thúc phiên trên trình duyệt này</h2>
        <p>
          Đăng xuất sẽ bỏ dữ liệu tạm trong tab; lịch sử đã lưu trên server được
          giữ.
        </p>
        <button className="button secondary" onClick={() => void logoutOwner()}>
          Đăng xuất
        </button>
      </section>
    </>
  );
}
