"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocal, LocalStatus } from "../../learning/ui/local-provider";
import { localRequest } from "@/modules/content/ui/api";
import { NextStudyAction } from "@/modules/planning/ui/study-panel";
import { useActiveDuration } from "@/modules/learning/ui/active-duration";
import type { ReviewRating } from "../domain/fsrs-adapter";
const ratings: { rating: ReviewRating; label: string }[] = [
  { rating: "Again", label: "Quên / sai" },
  { rating: "Hard", label: "Nhớ nhưng khó" },
  { rating: "Good", label: "Nhớ đúng" },
  { rating: "Easy", label: "Nhớ ngay" },
];
export function LocalReview({
  technicalOnly = false,
}: { technicalOnly?: boolean } = {}) {
  const local = useLocal();
  const [revealed, setRevealed] = useState<{
    cardId: string;
    version: number;
    back: string;
    previews: Record<ReviewRating, string>;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState("");
  const [activityId, setActivityId] = useState<string>(),
    [closeRetry, setCloseRetry] = useState(0);
  const observerKey = useRef<string | undefined>(undefined),
    closeKey = useRef<string | undefined>(undefined);
  const { flush: flushDuration, message: durationMessage } = useActiveDuration(
    activityId,
    Boolean(activityId),
  );
  const learning = local.data?.learning,
    card = learning?.due[0];
  const current =
    revealed?.cardId === card?.id && revealed?.version === card?.version
      ? revealed
      : null;
  useEffect(() => {
    if (
      !activityId ||
      learning?.dueCount !== 0 ||
      local.status !== "ready" ||
      busy
    )
      return;
    let alive = true;
    void (async () => {
      await flushDuration();
      const key = closeKey.current ?? crypto.randomUUID();
      closeKey.current = key;
      await localRequest(`/study/review-activity/${activityId}/close`, {}, key);
      if (alive) setActivityId(undefined);
    })().catch((e) => {
      if (alive)
        setError(
          `Chưa chốt thời gian ôn: ${e instanceof Error ? e.message : "Lỗi mạng"}`,
        );
    });
    return () => {
      alive = false;
    };
  }, [
    activityId,
    learning?.dueCount,
    local.status,
    busy,
    closeRetry,
    flushDuration,
  ]);
  async function act(rating?: ReviewRating) {
    if (!card) return;
    setBusy(true);
    setError("");
    setSaved("");
    try {
      if (!rating) {
        if (!activityId && !technicalOnly) {
          const key = observerKey.current ?? crypto.randomUUID();
          observerKey.current = key;
          const activity = await localRequest<{ sessionId: string }>(
            "/study/review-activity",
            {},
            key,
          );
          setActivityId(activity.sessionId);
          observerKey.current = undefined;
          closeKey.current = undefined;
        }
        setRevealed(
          await local.write(`cards/${card.id}/reveal`, {
            expectedVersion: card.version,
          }),
        );
      } else {
        await flushDuration();
        const result = await local.write<{ dueAt: string }>(
          `cards/${card.id}/rating`,
          { expectedVersion: card.version, rating },
        );
        setRevealed(null);
        setSaved(
          `Đã lưu lượt ôn vào PostgreSQL · hạn tiếp theo ${new Date(result.dueAt).toLocaleString("vi-VN")}.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa xác nhận lưu.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel local-panel" aria-busy={busy}>
      <p className="eyebrow">
        {technicalOnly
          ? "AUTH THẬT · FIXTURE KỸ THUẬT · KHÔNG ĐÁNH GIÁ TIẾNG TRUNG"
          : "LOCAL DATABASE · FSRS THẬT · DRAFT CHƯA DUYỆT"}
      </p>
      <h1>Ôn thẻ đến hạn</h1>
      <p>
        Thẻ fixture và bài nháp tự soạn, chưa được duyệt. FSRS lập lịch ghi nhớ;
        tự đánh giá không tăng mastery.
      </p>
      {error && <p role="alert">Chưa xác nhận thao tác: {error}</p>}
      {saved && (
        <p role="status" data-testid="review-saved">
          {saved}
        </p>
      )}
      {local.status !== "ready" || !learning ? (
        <LocalStatus />
      ) : card ? (
        <>
          <p>
            {learning.dueCount} thẻ đến hạn · {learning.reviews} lượt ôn đã lưu
          </p>
          <div className="flashcard panel">
            <h2>{card.prompt}</h2>
            {current ? (
              <p role="status" className="local-token">
                {current.back}
              </p>
            ) : (
              <p>Thử nhớ trước khi lật thẻ.</p>
            )}
            <button
              className="button secondary"
              disabled={busy || !!current}
              onClick={() => void act()}
            >
              Lật thẻ từ server
            </button>
          </div>
          <fieldset className="rating-fieldset" disabled={busy || !current}>
            <legend>Tự đánh giá sau khi lật thẻ</legend>
            <div className="rating-grid">
              {ratings.map(({ rating, label }) => (
                <button
                  key={rating}
                  className={`rating ${rating.toLowerCase()}`}
                  onClick={() => void act(rating)}
                >
                  <strong>{rating}</strong>
                  <span>{label}</span>
                  {current && (
                    <small>
                      Dự kiến{" "}
                      {new Date(current.previews[rating]).toLocaleString(
                        "vi-VN",
                      )}
                    </small>
                  )}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="field-hint">
            Trả lời sai chọn Again. Thời gian dự kiến tính khi lật; hạn chính
            thức được tính lại bằng đồng hồ server khi gửi rating.
          </p>
        </>
      ) : (
        <>
          <h2>Không có thẻ đến hạn lúc này.</h2>
          <p>
            {learning.nextDueAt
              ? `Hạn tiếp theo: ${new Date(learning.nextDueAt).toLocaleString("vi-VN")}`
              : "Chưa có thẻ; luyện một bài nháp để tạo thẻ theo giới hạn ngày."}
          </p>
          {activityId ? (
            <>
              <p role="status">Đang chốt khoảng thời gian ôn đã quan sát…</p>
              {error && (
                <button
                  className="button secondary"
                  onClick={() => setCloseRetry((n) => n + 1)}
                >
                  Thử chốt thời gian ôn lại
                </button>
              )}
            </>
          ) : technicalOnly ? (
            <p>Đã kiểm tra hàng đợi kỹ thuật; không tạo mastery.</p>
          ) : (
            <NextStudyAction />
          )}
          <Link className="button secondary" href="/today">
            Về Hôm nay
          </Link>
        </>
      )}
      {activityId && (
        <p className="field-hint">
          {durationMessage} Thời gian ôn không phải bằng chứng mastery.
        </p>
      )}
      <p>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void local.reload().catch(() => {})}
        >
          Đọc lại hàng đợi
        </button>
      </p>
    </section>
  );
}
