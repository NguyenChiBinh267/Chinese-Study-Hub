"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useStudy } from "./use-study";
import { ActionContent, WeeklyPlanView } from "./study-panel";
import { localRequest } from "@/modules/content/ui/api";
import type { ReplanCommand } from "../domain/study-commands";
export function StudyToday() {
  const state = useStudy(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(
    new Map<string, { key: string; command: ReplanCommand }>(),
  );
  async function replan(action: ReplanCommand["action"]) {
    if (!state.data?.plan) return;
    const attempt = pending.current.get(action) ?? {
      key: crypto.randomUUID(),
      command: { expectedVersion: state.data.plan.version, action },
    };
    pending.current.set(action, attempt);
    setBusy(true);
    setError("");
    try {
      await localRequest("/study/replan", attempt.command, attempt.key);
      pending.current.delete(action);
      state.reload();
    } catch (e) {
      setError(
        `Chưa xác nhận thay đổi. Thử lại cùng thao tác: ${e instanceof Error ? e.message : "Lỗi mạng"}`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Hôm nay, mình học gì?</h1>
          <p>Việc tiếp theo từ lịch học và dữ liệu PostgreSQL.</p>
        </div>
        <Link href="/schedule" className="button secondary">
          Lịch học của tôi
        </Link>
      </div>
      {state.error ? (
        <section className="panel">
          <p role="alert">{state.error}</p>
          <button className="button secondary" onClick={state.reload}>
            Đọc lại lịch đã lưu
          </button>
        </section>
      ) : !state.data ? (
        <p role="status">Đang xếp việc học từ dữ liệu đã lưu…</p>
      ) : (
        <>
          <section className="today-hero study-today-hero">
            <div className="hero-copy">
              <ActionContent snapshot={state.data} />
            </div>
          </section>
          {state.data.plan && (
            <>
              <p className="study-saved-line">
                {state.data.settings.preferences.weeklyHours} giờ / tuần ·{" "}
                {state.data.settings.preferences.days.length} ngày ·{" "}
                {state.data.settings.preferences.sessionMinutes} phút / buổi.
                Lịch phiên bản {state.data.plan.version} · đã đọc PostgreSQL.
              </p>
              <div className="study-controls" aria-busy={busy}>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void replan("ten_minutes")}
                >
                  Hôm nay chỉ có 10 phút
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void replan("skip_today")}
                >
                  Hôm nay nghỉ · xếp lại
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void replan("refresh")}
                >
                  Xếp lại phần chưa học
                </button>
              </div>
              {error && (
                <div role="alert">
                  <p>{error}</p>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      pending.current.clear();
                      setError("");
                      state.reload();
                    }}
                  >
                    Đọc lại lịch trước khi đổi
                  </button>
                </div>
              )}
              <WeeklyPlanView plan={state.data.plan} />
            </>
          )}
        </>
      )}
    </>
  );
}
