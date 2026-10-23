"use client";
import { NextStudyAction } from "@/modules/planning/ui/study-panel";
import { CourseReturnLinks } from "@/modules/curriculum/ui/courses";
import { PronunciationCoach } from "@/modules/pronunciation/ui/coach";
import { MandarinTts } from "./mandarin-tts";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { ChineseText, PageHeading } from "@/components/ui";
import { useLocal } from "@/modules/learning/ui/local-provider";
import { useActiveDuration } from "@/modules/learning/ui/active-duration";
import type { PublicLesson } from "../domain/package";
import type { DraftView } from "../domain/commands";
import { contentApi } from "./api";
type Entry = {
  lesson: PublicLesson;
  sessionState: "active" | "completed" | null;
};
type Summary = {
  observedActiveMs: number;
  invalidIntervals: number;
  lessons: { lessonId: string; versionId: string; completed: number }[];
  listening: string;
  pronunciation: string;
  independentEvidence: number;
};
function Notice({ lesson }: { lesson: PublicLesson }) {
  return (
    <div className="draft-notice">
      <span className="badge amber">LOCAL DEVELOPMENT · DRAFT</span>
      <p>
        Chưa duyệt ngôn ngữ, đáp án và audio. Chỉ luyện tập; không tính bằng
        chứng độc lập hoặc mở khóa HSK.
      </p>
      <p>
        {lesson.lesson.classification === "FOUNDATION_INTERNAL"
          ? "Nền tảng nội bộ, không phải một unit HSK chính thức."
          : `HSK ${lesson.alignment.targetLevel} · mapping ${lesson.alignment.alignmentStatus}. Mẫu ngữ pháp cụ thể còn chờ đối chiếu/duyệt.`}
      </p>
    </div>
  );
}
export function FoundationLibrary({ compact = false }: { compact?: boolean }) {
  const local = useLocal();
  const [entries, setEntries] = useState<Entry[] | null>(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    if (local.mode !== "local") return;
    let alive = true;
    void contentApi<Entry[]>("")
      .then((value) => {
        if (alive) {
          setEntries(value);
          setError("");
        }
      })
      .catch((e) => {
        if (alive)
          setError(e instanceof Error ? e.message : "Chưa tải được thư viện.");
      });
    return () => {
      alive = false;
    };
  }, [local.mode, reload]);
  if (local.mode !== "local") return null;
  if (error)
    return (
      <section className="panel local-panel" role="alert">
        <h2>Chưa đọc được thư viện nháp</h2>
        <p>{error}</p>
        <button
          className="button secondary"
          onClick={() => setReload((x) => x + 1)}
        >
          Thử tải thư viện lại
        </button>
      </section>
    );
  if (!entries)
    return <p role="status">Đang đọc thư viện foundation từ PostgreSQL…</p>;
  if (!entries.length)
    return (
      <section className="panel empty-state">
        <h2>Chưa có package nháp trong thư viện</h2>
        <p>Chưa có bài để mở. Có thể đọc lại sau khi đăng ký nội dung local.</p>
        <button
          className="button secondary"
          onClick={() => setReload((x) => x + 1)}
        >
          Đọc lại thư viện
        </button>
      </section>
    );
  const next =
    entries.find(
      (e) => e.lesson.lesson.id === "F01" && e.sessionState !== "completed",
    ) ?? entries.find((e) => e.lesson.lesson.id === "F02")!;
  if (compact)
    return (
      <section className="today-hero foundation-next">
        <div className="hero-copy">
          <p className="eyebrow">BÀI NHÁP GỢI Ý · LUYỆN TẬP LOCAL</p>
          <h2>{next.lesson.lesson.title}</h2>
          <p>
            Tiếp tục bài có lưu server. Chưa có bằng chứng đã duyệt để mở khóa;
            đây là practice tùy chọn.
          </p>
          <Link
            className="button primary"
            href={`/learn/draft/${next.lesson.lesson.id}`}
          >
            Mở {next.lesson.lesson.id} · học tiếp
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  return (
    <section className="foundation-library">
      <div className="section-title">
        <h2>
          <BookOpen size={21} aria-hidden="true" /> Bài nháp hiện có
        </h2>
        <span className="badge green">{entries.length} BÀI NHÁP</span>
      </div>
      <p className="muted">
        Nội dung tự soạn để học thử local. Không phải bài do HSK biên soạn hoặc
        khóa học đã duyệt.
      </p>
      <div className="lesson-grid">
        {entries.map(({ lesson: p, sessionState }, index) => (
          <article className="panel lesson-card" key={p.lesson.versionId}>
            <div className={`lesson-cover cover-${index}`}>
              <span>{p.lesson.id}</span>
              <span lang="zh-Hans">
                {["拼音", "声调", "你好", "喜欢"][index]}
              </span>
              <small>DRAFT · v{p.lesson.version}</small>
            </div>
            <div className="lesson-card-body">
              <span className="badge amber">
                {p.lesson.classification === "FOUNDATION_INTERNAL"
                  ? "NỀN TẢNG NỘI BỘ"
                  : `HSK 1 · ${p.alignment.alignmentStatus}`}
              </span>
              <h2>{p.lesson.title}</h2>
              <p>{p.objectives[0]}</p>
              <p className="field-hint">
                {p.lesson.prerequisites.length
                  ? `Điều kiện dự kiến: ${p.lesson.prerequisites.join(", ")}. Chưa có evidence được duyệt; practice tùy chọn.`
                  : "Bắt đầu từ số 0; chưa đánh giá phát âm."}
              </p>
              <div className="lesson-card-meta">
                <span>
                  <Clock3 size={14} aria-hidden="true" />
                  {p.lesson.estimatedMinutes} phút dự kiến
                </span>
                <span>{p.exercises.length} câu</span>
              </div>
              <Link
                className="button primary full"
                href={`/learn/draft/${p.lesson.id}`}
              >
                {sessionState === "active"
                  ? "Tiếp tục"
                  : sessionState === "completed"
                    ? "Xem lại / luyện lại"
                    : "Mở bài nháp"}{" "}
                {p.lesson.id}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
export function ContentProgress() {
  const local = useLocal(),
    [value, setValue] = useState<Summary | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (local.mode !== "local") return;
    let alive = true;
    void contentApi<Summary>("/summary")
      .then((s) => {
        if (alive) {
          setValue(s);
          setError("");
        }
      })
      .catch((e) => {
        if (alive)
          setError(e instanceof Error ? e.message : "Chưa đọc được thời gian.");
      });
    return () => {
      alive = false;
    };
  }, [local.mode, local.data, refresh]);
  if (local.mode !== "local") return null;
  return (
    <section className="panel local-panel">
      <h2>Bài nháp & thời gian quan sát</h2>
      {error ? (
        <p role="alert">{error}</p>
      ) : !value ? (
        <p role="status">Đang đọc hoạt động local…</p>
      ) : (
        <>
          <div className="stat-grid progress-stats">
            <div>
              <strong data-testid="observed-seconds">
                {Math.floor(value.observedActiveMs / 1000)}
              </strong>
              <span>Giây telemetry đã lưu</span>
            </div>
            <div>
              <strong>
                {value.lessons.reduce((n, l) => n + l.completed, 0)}
              </strong>
              <span>Phiên draft hoàn tất</span>
            </div>
            <div>
              <strong>0</strong>
              <span>Bằng chứng độc lập từ draft</span>
            </div>
          </div>
          {value.lessons.length ? (
            value.lessons.map((l) => (
              <p key={l.versionId}>
                {l.lessonId} · {l.completed} phiên luyện hoàn tất, không phải
                mastery.
              </p>
            ))
          ) : (
            <p>Chưa có lượt luyện bài nháp được lưu.</p>
          )}
          <p>
            {value.invalidIntervals} interval nghi vấn bị loại. Telemetry do
            client quan sát và server kiểm tra tính nhất quán; không phải tín
            hiệu tin cậy độc lập.
          </p>
          <p>
            Nghe: CHƯA ĐÁNH GIÁ · Phát âm: CHƯA ĐÁNH GIÁ. Self-rating FSRS không
            làm tăng mastery.
          </p>
        </>
      )}
      <button
        className="button secondary"
        onClick={() => setRefresh((n) => n + 1)}
      >
        Đọc lại hoạt động bài nháp
      </button>
    </section>
  );
}
export function FoundationPlayer({
  lessonId,
  versionId,
  published = false,
  privatePreview = false,
  allowStart = true,
}: {
  lessonId: string;
  versionId: string;
  published?: boolean;
  privatePreview?: boolean;
  allowStart?: boolean;
}) {
  const local = useLocal(),
    version = versionId;
  const [view, setView] = useState<DraftView | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [choice, setChoice] = useState<number | null>(null),
    [text, setText] = useState(""),
    [showPinyin, setPinyin] = useState(true),
    [order, setOrder] = useState<number[]>([]);
  const pending = useRef(new Map<string, string>()),
    heading = useRef<HTMLHeadingElement>(null);
  const [pronunciationOpen, setPronunciationOpen] = useState(false);
  const duration = useActiveDuration(
    view?.session?.id,
    local.mode === "local" &&
      view?.session?.state === "active" &&
      !pronunciationOpen,
  );
  async function load() {
    const fresh = await contentApi<DraftView>(`/${version}`);
    setView(fresh);
    setError("");
    return fresh;
  }
  useEffect(() => {
    if (local.mode === "local") {
      let alive = true;
      void contentApi<DraftView>(`/${version}`)
        .then((v) => {
          if (alive) setView(v);
        })
        .catch((e) => {
          if (alive)
            setError(e instanceof Error ? e.message : "Chưa tải được bài.");
        });
      return () => {
        alive = false;
      };
    }
  }, [local.mode, version]);
  async function act(path: string, input: unknown, measure = false) {
    setBusy(true);
    setError("");
    const signature = path + JSON.stringify(input),
      key = pending.current.get(signature) ?? crypto.randomUUID();
    pending.current.set(signature, key);
    try {
      if (measure) await duration.flush();
      await contentApi(path, input, key);
      pending.current.delete(signature);
      await load();
      await local.reload();
      setChoice(null);
      setText("");
      setOrder([]);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (e) {
      setError(
        `Chưa xác nhận thao tác: ${e instanceof Error ? e.message : "Lỗi mạng"}. Có thể thử lại; khóa gửi được giữ trong tab.`,
      );
    } finally {
      setBusy(false);
    }
  }
  if (local.mode !== "local")
    return (
      <section className="panel empty-state">
        <h1>Bài nháp chỉ mở ở LOCAL DEVELOPMENT</h1>
        <p>
          Chọn LOCAL DATABASE để dùng grading và lưu PostgreSQL. Production khóa
          nội dung nháp ở server.
        </p>
        <Link className="text-link" href="/learn">
          Về thư viện
        </Link>
      </section>
    );
  if (!view)
    return (
      <section className="panel local-panel">
        <h1>Đang mở bài {lessonId}</h1>
        <p role={error ? "alert" : "status"}>
          {error || "Đang đọc package và phiên đã lưu từ PostgreSQL…"}
        </p>
        {error && (
          <button
            className="button secondary"
            onClick={() => void load().catch((e) => setError(String(e)))}
          >
            Thử tải lại bài
          </button>
        )}
      </section>
    );
  const p = view.lesson,
    session = view.session,
    block = session ? p.blocks[session.cursor] : null,
    exercise =
      block?.type === "exercise"
        ? p.exercises.find((e) => e.id === block.exerciseVersionId)
        : null,
    saved = session?.answers.find((a) => a.exerciseVersionId === exercise?.id);
  return (
    <div className="player-container foundation-player">
      <Link href="/learn" className="text-link back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Thư viện
      </Link>
      <PageHeading
        eyebrow={`${lessonId} · PACKAGE v${p.lesson.version}`}
        title={p.lesson.title}
        description="Học qua phần giảng ngắn, rồi tự nhớ lại. Phản hồi do server trả về."
      />
      {privatePreview ? (
        <p className="notice">
          PRIVATE_OWNER_PREVIEW · DRAFT · AI-reviewed, chưa được người có chuyên
          môn duyệt. Chỉ luyện tự chọn; không xác nhận mastery, prerequisite
          hoặc cấp HSK.
        </p>
      ) : published ? (
        <p className="notice">
          Bản phát hành được server kiểm tra. Luyện bài và tự đánh giá thẻ không
          tự tạo mastery độc lập.
        </p>
      ) : (
        <Notice lesson={p} />
      )}
      {!published && <CourseReturnLinks lessonId={lessonId} />}
      {published &&
        p.audio.map((a) => (
          <div className="panel" key={a.id}>
            <p>
              {p.reviewKind === "synthetic"
                ? "Tín hiệu audio tổng hợp · không phải giọng mẫu"
                : "Audio của phiên bản này"}
            </p>
            <audio
              controls
              preload="none"
              src={a.src}
              aria-label="Audio bài học"
            />
            {a.attribution && <p className="muted">{a.attribution}</p>}
          </div>
        ))}
      {(!published || privatePreview) &&
        (lessonId === "F01" || lessonId === "F02") && (
          <details
            className="pron-optional"
            onToggle={(event) => {
              const open = event.currentTarget.open;
              if (open) void duration.flush();
              setPronunciationOpen(open);
            }}
          >
            <summary>Cách phát âm · luyện tùy chọn, không tính điểm</summary>
            <p>
              Khi mở phần này, đo thời gian của bài chữ tạm dừng. Không cần
              luyện phát âm để hoàn tất bài.
            </p>
            {pronunciationOpen && <PronunciationCoach lessonId={lessonId} />}
          </details>
        )}
      {error && (
        <div className="error-summary" role="alert">
          {error}
          <button
            className="text-link"
            onClick={() => void load().catch((e) => setError(String(e)))}
          >
            Đọc lại phiên đã lưu
          </button>
        </div>
      )}
      {!session || session.state === "completed" ? (
        <section className="panel completion">
          {session && <CheckCircle2 size={36} aria-hidden="true" />}
          <h2>
            {session
              ? "Đã hoàn tất luyện tập có lưu."
              : "Bắt đầu từ một bước nhỏ."}
          </h2>
          <ul className="lesson-objectives">
            {p.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
          <p>
            {published
              ? "Kết quả luyện được lưu theo đúng phiên bản; hoàn tất bài không phải chứng nhận HSK."
              : "Đáp án chưa có human review. Hoàn tất practice không chứng minh đã nắm vững ngữ âm hoặc đạt cấp HSK."}
          </p>
          <button
            className={session ? "button secondary" : "button primary"}
            disabled={busy || !allowStart}
            onClick={() =>
              void act(`/${version}/start`, {
                restart: Boolean(session),
                packageHash: p.packageHash,
              })
            }
          >
            {!allowStart
              ? "Phiên bản lưu trữ · không mở lượt mới"
              : session
                ? published
                  ? "Luyện lại bài"
                  : "Luyện lại bài nháp"
                : "Bắt đầu học " + lessonId}
          </button>
          {session && (
            <Link href="/review" className="button secondary">
              Ôn thẻ FSRS local
            </Link>
          )}
        </section>
      ) : (
        <>
          <div className="player-heading">
            <h2 ref={heading} tabIndex={-1}>
              Bước {Math.min(session.cursor + 1, p.blocks.length)} /{" "}
              {p.blocks.length}
            </h2>
            <button
              className="button secondary compact"
              aria-pressed={showPinyin}
              onClick={() => setPinyin((s) => !s)}
            >
              {showPinyin ? "Ẩn pinyin" : "Hiện pinyin"}
            </button>
          </div>
          <div
            className="review-progress"
            role="progressbar"
            aria-label={published ? "Các bước bài học" : "Các bước bài nháp"}
            aria-valuemin={0}
            aria-valuemax={p.blocks.length}
            aria-valuenow={session.cursor}
          >
            <i
              style={{ width: `${(session.cursor / p.blocks.length) * 100}%` }}
            />
          </div>
          <section className="panel exercise" aria-busy={busy}>
            {block?.type === "teaching" ? (
              <div className="teaching-block">
                <span className="eyebrow">ĐỌC & QUAN SÁT</span>
                <h2>{block.title}</h2>
                <p>{block.text}</p>
                {privatePreview && block.hanzi && (
                  <MandarinTts text={block.hanzi} />
                )}
                {block.hanzi && (
                  <div className="lesson-word">
                    {showPinyin ? (
                      <ChineseText hanzi={block.hanzi} pinyin={block.pinyin} />
                    ) : (
                      <span className="chinese" lang="zh-Hans">
                        {block.hanzi}
                      </span>
                    )}
                    <p>{block.meaning}</p>
                  </div>
                )}
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      `/sessions/${session.id}/advance`,
                      { expectedVersion: session.version },
                      true,
                    )
                  }
                >
                  Đã đọc · tiếp tục
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            ) : exercise ? (
              <>
                <span className="eyebrow">TỰ NHỚ LẠI · CHƯA ĐÁNH GIÁ NGHE</span>
                <h2>{exercise.prompt}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (
                      (exercise.type === "choice" && choice === null) ||
                      ((exercise.type === "pinyin" ||
                        exercise.type === "short") &&
                        !text.trim()) ||
                      (exercise.type === "sequence" &&
                        order.length !== exercise.choices.length)
                    ) {
                      setError("Chọn hoặc nhập câu trả lời trước khi gửi.");
                      return;
                    }
                    void act(
                      `/sessions/${session.id}/answers`,
                      {
                        exerciseVersionId: exercise.id,
                        response:
                          exercise.type === "choice"
                            ? { choice }
                            : exercise.type === "sequence"
                              ? { order }
                              : { text },
                      },
                      true,
                    );
                  }}
                >
                  {exercise.type === "choice" ? (
                    <fieldset
                      className="answer-options"
                      disabled={busy || Boolean(saved)}
                    >
                      <legend>Câu trả lời</legend>
                      {exercise.choices.map((value, index) => (
                        <label key={index} className="answer-option">
                          <input
                            type="radio"
                            name="draft-answer"
                            checked={
                              (saved?.response.choice ?? choice) === index
                            }
                            onChange={() => {
                              setChoice(index);
                              setError("");
                            }}
                          />
                          {value}
                        </label>
                      ))}
                    </fieldset>
                  ) : exercise.type === "sequence" ? (
                    <fieldset
                      className="sequence-answer"
                      disabled={busy || Boolean(saved)}
                    >
                      <legend>Sắp xếp câu</legend>
                      <p>{exercise.inputHint}</p>
                      <div className="sequence-tokens">
                        {exercise.choices.map((token, i) => (
                          <button
                            type="button"
                            className="button secondary"
                            key={i}
                            disabled={
                              busy || Boolean(saved) || order.includes(i)
                            }
                            onClick={() =>
                              setOrder((previous) => [...previous, i])
                            }
                            aria-label={`Thêm mảnh ${token}`}
                          >
                            <span lang="zh-Hans">{token}</span>
                          </button>
                        ))}
                      </div>
                      <ol
                        className="sequence-order"
                        data-testid="sequence-order"
                        aria-live="polite"
                      >
                        {(saved?.response.order ?? order).map((i, n) => (
                          <li key={i}>
                            <span className="muted">{n + 1}.</span>{" "}
                            <span lang="zh-Hans">{exercise.choices[i]}</span>
                          </li>
                        ))}
                      </ol>
                      <button
                        type="button"
                        className="button secondary"
                        disabled={busy || Boolean(saved) || !order.length}
                        onClick={() =>
                          setOrder((previous) => previous.slice(0, -1))
                        }
                      >
                        Bỏ mảnh cuối
                      </button>
                    </fieldset>
                  ) : (
                    <div className="typed-answer">
                      <label htmlFor="pinyin-answer">
                        {exercise.type === "pinyin"
                          ? "Pinyin của bạn"
                          : "Câu trả lời bằng chữ Hán"}
                      </label>
                      <input
                        id="pinyin-answer"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        maxLength={160}
                        value={saved?.response.text ?? text}
                        disabled={busy || Boolean(saved)}
                        onChange={(e) => setText(e.target.value)}
                      />
                      <p className="field-hint">{exercise.inputHint}</p>
                    </div>
                  )}
                  {!saved && (
                    <button
                      className="button primary"
                      disabled={busy}
                      type="submit"
                    >
                      {busy ? "Đang chờ server…" : "Gửi và lưu câu trả lời"}
                    </button>
                  )}
                </form>
                {saved && (
                  <div
                    className={`feedback ${saved.correct ? "correct" : "retry"}`}
                    role="status"
                  >
                    <strong>
                      Đã lưu PostgreSQL ·{" "}
                      {saved.correct
                        ? published
                          ? "Khớp đáp án"
                          : "Khớp đáp án nháp"
                        : published
                          ? "Chưa khớp đáp án"
                          : "Chưa khớp đáp án nháp"}
                    </strong>
                    <p>{saved.feedback}</p>
                    <p>
                      {published
                        ? "Lượt luyện không tự thành bằng chứng mastery độc lập."
                        : "Practice chưa duyệt, không có bằng chứng độc lập."}
                    </p>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          `/sessions/${session.id}/advance`,
                          { expectedVersion: session.version },
                          true,
                        )
                      }
                    >
                      Bước tiếp theo
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="completion">
                <h2>Bạn đã đi hết các bước.</h2>
                <p>
                  Xác nhận hoàn tất luyện tập để lưu trạng thái phiên. Không mở
                  khóa từ mastery chưa duyệt.
                </p>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void act(`/sessions/${session.id}/complete`, {}, true)
                  }
                >
                  Hoàn tất luyện tập có lưu
                </button>
              </div>
            )}
          </section>
          <div className="duration-note">
            <Clock3 size={17} aria-hidden="true" />
            <div>
              <strong>
                {Math.floor(duration.acceptedMs / 1000)} giây đã xác nhận trong
                lượt đo này
              </strong>
              <p>{duration.message}</p>
              <p>
                Không tính tab ẩn/mất focus hoặc quá 60 giây không tương tác.
                Nghe/phát âm: CHƯA ĐÁNH GIÁ.
              </p>
              <button className="text-link" onClick={duration.resume}>
                Tiếp tục đo ở tab này
              </button>
            </div>
          </div>
          <Link
            className="text-link"
            href="/today"
            onClick={() => void duration.flush()}
          >
            Tạm dừng · về Hôm nay
          </Link>
        </>
      )}
      {session?.state === "completed" && <NextStudyAction />}
      <details className="source-details">
        <summary>Phạm vi & nguồn đối chiếu</summary>
        <p>
          Alignment: {p.alignment.alignmentStatus} · Review: {p.reviewStatus} ·
          Publication: {p.publicationStatus}
        </p>
        <p>
          Prerequisites dự kiến: {p.lesson.prerequisites.join(", ") || "Không"}.
          Chỉ là practice local tùy chọn, không coi là đã mở khóa.
        </p>
        {p.alignment.taskReferences
          .concat(
            p.alignment.topicReferences,
            p.alignment.vocabularyReferences,
            p.alignment.characterReferences,
            p.alignment.grammarReferences,
          )
          .map((r) => (
            <p key={r.id}>
              <span lang="zh-Hans">{r.written}</span> · {r.status} ·{" "}
              {r.sourceLocator
                ? `PDF ${r.sourceLocator.physicalPage} (index ${r.sourceLocator.pdfIndex}), trang in ${r.sourceLocator.printedPage}; ${r.sourceLocator.entry}`
                : r.note}
            </p>
          ))}
        <a
          className="text-link"
          href={p.alignment.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Mở PDF tham chiếu chính thức
        </a>
      </details>
    </div>
  );
}
