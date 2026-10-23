"use client";
import { StudyToday } from "@/modules/planning/ui/study-today";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocal, LocalStatus } from "./local-provider";
import type { PublicFixture } from "../domain/local-foundation";

export function LocalLearningLink() {
  return (
    <section className="panel local-panel">
      <span className="badge green">LOCAL DATABASE</span>
      <h2>Thử một bài có lưu kết quả</h2>
      <p>
        Fixture development riêng, không phải học liệu HSK chính thức. Câu trả
        lời được lưu trên PostgreSQL; đáp án so khớp ở server.
      </p>
      <Link className="button secondary" href="/learn/local-foundation-v1">
        Học tiếp · fixture local
      </Link>
    </section>
  );
}
export function LocalProgress() {
  const local = useLocal();
  if (local.status !== "ready" || !local.data) return <LocalStatus />;
  return (
    <section className="panel local-panel">
      <span className="badge green">ĐỌC TỪ POSTGRESQL</span>
      <h2>Tiến độ luyện tập local đã xác nhận</h2>
      <div className="stat-grid progress-stats">
        <div>
          <strong data-testid="db-attempts">
            {local.data.progress.attempts}
          </strong>
          <span>Lượt trả lời đã lưu</span>
        </div>
        <div>
          <strong data-testid="db-correct">
            {local.data.progress.correct}
          </strong>
          <span>Khớp đáp án nháp ở server</span>
        </div>
        <div>
          <strong data-testid="db-completed">
            {local.data.progress.completedSessions}
          </strong>
          <span>Phiên luyện tập hoàn tất</span>
        </div>
      </div>
      <p>
        Kết quả fixture nội bộ; không phải điểm HSK hoặc học liệu đã duyệt. FSRS
        chỉ lập lịch ghi nhớ, không tự chứng minh năng lực.
      </p>
      <p data-testid="db-reviews">
        {local.data.learning.reviews} lượt ôn FSRS đã lưu ·{" "}
        {local.data.learning.dueCount} thẻ đến hạn.
      </p>
      <h3>Mastery · bằng chứng độc lập</h3>
      <p>
        Chưa đủ dữ liệu hợp lệ: fixture chưa có answer review và rule thời lượng
        được duyệt. Không mở khóa prerequisite từ các lượt thử hoặc self-rating.
      </p>
      <details className="source-details">
        <summary>Xem chi tiết bằng chứng theo kỹ năng</summary>
        {local.data.learning.mastery.map((m) => (
          <p key={`${m.conceptId}:${m.skill}`} data-testid="mastery-evidence">
            {m.conceptId} · {m.skill}: {m.projection.evidenceCount} evidence hợp
            lệ, {m.projection.excludedCount} lượt luyện chưa đủ điều kiện. Trạng
            thái{" "}
            {
              {
                unseen: "Chưa có bằng chứng độc lập",
                learning: "Đang học",
                practicing: "Đang luyện tập",
                secure: "Vững",
                needs_review: "Cần ôn lại",
              }[m.projection.status]
            }
            .
          </p>
        ))}
      </details>
      {local.data.session && (
        <p>
          Phiên gần nhất:{" "}
          {local.data.session.state === "completed"
            ? "Hoàn tất đã xác nhận"
            : "Đang học, có thể tiếp tục"}{" "}
          · {local.data.session.answers.length} câu đã lưu.
        </p>
      )}
      <button
        className="button secondary"
        onClick={() => void local.reload().catch(() => {})}
      >
        Đọc lại từ database
      </button>
    </section>
  );
}
export function LocalToday() {
  const local = useLocal();
  if (local.status !== "ready" || !local.data) return <LocalStatus />;
  return (
    <>
      <StudyToday />
      <section className="legacy-fixture-tools">
        <p className="field-hint">
          Fixture kỹ thuật Phase3, tách khỏi lộ trình bài học.
        </p>
        <LocalLearningLink />
      </section>
      <LocalProgress />
    </>
  );
}
export function LocalLessonPlayer() {
  const local = useLocal();
  const [fixture, setFixture] = useState<PublicFixture | null>(null),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [cursor, setCursor] = useState<number | null>(null),
    [choice, setChoice] = useState<number | null>(null);
  useEffect(() => {
    if (local.mode === "local")
      void local
        .readFixture()
        .then(setFixture)
        .catch((e) =>
          setError(e instanceof Error ? e.message : "Chưa tải được fixture."),
        );
  }, [local.mode]); // eslint-disable-line react-hooks/exhaustive-deps
  async function perform(path: string, payload: unknown, after?: () => void) {
    setBusy(true);
    setError("");
    try {
      await local.write(path, payload);
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa xác nhận lưu.");
    } finally {
      setBusy(false);
    }
  }
  if (local.mode !== "local")
    return (
      <section className="panel local-panel">
        <h1>Bài có lưu PostgreSQL</h1>
        <p>
          Chọn LOCAL DATABASE phía trên để mở fixture này. Các bài DEMO vẫn ở{" "}
          <Link href="/learn">danh sách bài mẫu</Link>.
        </p>
      </section>
    );
  if (local.status !== "ready" || !local.data) return <LocalStatus />;
  if (!fixture)
    return (
      <section className="panel local-panel">
        <p role={error ? "alert" : "status"}>
          {error || "Đang tải fixture từ server…"}
        </p>
        {error && (
          <button
            className="button secondary"
            onClick={() => {
              setError("");
              void local
                .readFixture()
                .then(setFixture)
                .catch((e) => setError(String(e)));
            }}
          >
            Thử tải fixture lại
          </button>
        )}
      </section>
    );
  const session = local.data.session;
  const first = fixture.exercises.findIndex(
    (e) => !session?.answers.some((a) => a.exerciseVersionId === e.id),
  );
  const index = cursor ?? (first < 0 ? fixture.exercises.length - 1 : first);
  const exercise = fixture.exercises[index],
    saved = session?.answers.find((a) => a.exerciseVersionId === exercise.id);
  return (
    <section className="panel local-panel local-player" aria-busy={busy}>
      <span className="badge green">LOCAL DATABASE · FIXTURE v1</span>
      <h1>{fixture.title}</h1>
      <p>{fixture.notice}</p>
      {error && <p role="alert">Chưa xác nhận thao tác: {error}</p>}
      {!session ? (
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void perform("sessions", { restart: false })}
        >
          Bắt đầu phiên local
        </button>
      ) : session.state === "completed" ? (
        <>
          <h2>Hoàn tất đã xác nhận từ PostgreSQL</h2>
          <p>
            Đã lưu {session.answers.length} câu trả lời của phiên này. Reload
            vẫn đọc lại được.
          </p>
          <Link className="button primary" href="/progress">
            Xem tiến độ đã lưu
          </Link>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void perform("sessions", { restart: true }, () => {
                setCursor(null);
                setChoice(null);
              })
            }
          >
            Bắt đầu lượt fixture mới
          </button>
        </>
      ) : (
        <>
          <p>
            Bước {index + 1} / {fixture.exercises.length} ·{" "}
            {session.answers.length} câu đã lưu
          </p>
          <h2>{exercise.prompt}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (choice === null) {
                setError("Chọn câu trả lời trước khi gửi.");
                return;
              }
              void perform(
                `sessions/${session.id}/answers`,
                { exerciseVersionId: exercise.id, response: { choice } },
                () => setCursor(index),
              );
            }}
          >
            <fieldset
              className="answer-options"
              disabled={busy || Boolean(saved)}
            >
              <legend>Câu trả lời fixture</legend>
              {exercise.choices.map((text, i) => (
                <label className="answer-option" key={`${index}-${i}`}>
                  <input
                    type="radio"
                    name="local-answer"
                    checked={(saved?.response.choice ?? choice) === i}
                    onChange={() => {
                      setChoice(i);
                      setError("");
                    }}
                  />
                  {text}
                </label>
              ))}
            </fieldset>
            {!saved && (
              <button className="button primary" disabled={busy} type="submit">
                {busy ? "Đang chờ xác nhận…" : "Gửi và lưu câu trả lời"}
              </button>
            )}
          </form>
          {saved && (
            <p role="status">
              Đã lưu vào PostgreSQL ·{" "}
              {saved.correct
                ? "Khớp đáp án fixture"
                : "Chưa khớp đáp án fixture"}
              . Kết quả do server trả về.
              {saved.feedback && <> {saved.feedback}</>}
            </p>
          )}
          <div className="completion-actions">
            {index > 0 && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setCursor(index - 1);
                  setChoice(null);
                }}
              >
                Bước trước
              </button>
            )}
            {saved && index < fixture.exercises.length - 1 && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setCursor(index + 1);
                  setChoice(null);
                }}
              >
                Câu tiếp theo
              </button>
            )}
            {session.answers.length === fixture.exercises.length && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  void perform(`sessions/${session.id}/complete`, {})
                }
              >
                Hoàn tất và lưu phiên
              </button>
            )}
          </div>
        </>
      )}
      <p>
        <Link className="text-link" href="/today">
          Tạm dừng · về Hôm nay
        </Link>
      </p>
    </section>
  );
}
