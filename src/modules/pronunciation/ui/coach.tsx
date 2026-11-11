"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Wind } from "lucide-react";
import { useLocal } from "@/modules/learning/ui/local-provider";
import { localRequest } from "@/modules/content/ui/api";
import type { PronunciationNote, PronunciationRelease } from "../domain/notes";
import { mapPronunciationFeedback } from "../domain/feedback";
import { ArticulationGuide } from "./articulation-guide";
import { PracticeRecorderPanel } from "./practice-recorder";
import "./pronunciation.css";
import { PilotSession } from "../domain/pilot";
import { PilotPanel } from "./pilot-panel";
import { PilotContext } from "./pilot-context";

const groupNames = {
  ASPIRATION: "Bật hơi: b/p, d/t, g/k",
  FRONT: "Gần răng: z/c/s",
  PALATAL: "Phần trước lưỡi: j/q/x",
  RETROFLEX: "Đầu lưỡi lùi: zh/ch/sh/r",
  VOWELS: "Vần u / ü và cách viết",
  TONES: "Thanh điệu",
  CONTEXT: "Thanh trong câu",
  COMPARE: "So sánh và điều dễ nhầm",
};
export function PronunciationCoach({
  lessonId,
  initialTarget,
  pilot = false,
}: {
  lessonId?: "F01" | "F02";
  initialTarget?: string;
  pilot?: boolean;
}) {
  const local = useLocal(),
    [release, setRelease] = useState<PronunciationRelease | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(
    initialTarget ?? (lessonId === "F02" ? "pron-tone-3-v1" : "pron-p-v1"),
  );
  const uid = useId();
  const [pilotSession] = useState(() => new PilotSession());
  useEffect(() => {
    if (local.mode !== "local" || local.status !== "ready") return;
    let alive = true;
    void localRequest<PronunciationRelease>("/pronunciation")
      .then((value) => {
        if (alive) {
          setRelease(value);
          setError("");
        }
      })
      .catch((e) => {
        if (alive)
          setError(e instanceof Error ? e.message : "Chưa đọc được hướng dẫn.");
      });
    return () => {
      alive = false;
    };
  }, [local.mode, local.status, revision]);
  if (local.mode !== "local")
    return (
      <section className="panel pronunciation pron-empty">
        <h2>Hướng dẫn phát âm DRAFT chỉ mở ở local</h2>
        <p>
          Chọn LOCAL DATABASE để xem nội dung chưa duyệt. Đây là luyện tự chọn,
          không phải đánh giá giọng hoặc mở khóa bài.
        </p>
        <Link className="button secondary" href="/learn/courses/FOUNDATION">
          Về khóa Nền tảng
        </Link>
      </section>
    );
  if (error || local.status === "error")
    return (
      <section className="panel pronunciation">
        <h2>Chưa mở được hướng dẫn phát âm</h2>
        <p role="alert">{error || local.error}</p>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            if (local.status === "error") void local.reload();
            setRevision((n) => n + 1);
          }}
        >
          Thử tải hướng dẫn lại
        </button>
      </section>
    );
  if (!release)
    return (
      <section className="panel pronunciation">
        <h2>Cách phát âm</h2>
        <p role="status">Đang đọc hướng dẫn phát âm có phiên bản…</p>
      </section>
    );
  const notes = lessonId
    ? release.notes.filter((n) =>
        release.lessonBindings[lessonId].includes(n.versionId),
      )
    : release.notes;
  const note = notes.find((n) => n.versionId === selected);
  return (
    <PilotContext.Provider value={pilot ? pilotSession : null}>
      <section
        className="pronunciation"
        aria-label="Hướng dẫn phát âm"
        data-release={release.id}
      >
        {!lessonId && !pilot && (
          <Link
            className="button secondary"
            href="/learn/pronunciation?pilot=1&target=pron-tone-1-v1"
          >
            Thử micro thật · pilot 4 thanh
          </Link>
        )}
        {pilot && (
          <PilotPanel
            session={pilotSession}
            selected={selected}
            select={setSelected}
          />
        )}
        <div className="pron-toolbar">
          <label htmlFor={`${uid}-target`}>Chọn âm hoặc thanh</label>
          <select
            id={`${uid}-target`}
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {!note && (
              <option value={selected}>Chưa có hướng dẫn cho mã này</option>
            )}
            {Object.entries(groupNames).map(([group, title]) => {
              const children = notes.filter((n) => n.group === group);
              return children.length ? (
                <optgroup label={title} key={group}>
                  {children.map((n) => (
                    <option value={n.versionId} key={n.versionId}>
                      {n.title}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
          <p className="field-hint">
            Luyện tùy chọn · Không tạo attempt, điểm, thời gian học đã lưu hoặc
            mastery. Notes và hình chưa được chuyên gia duyệt.
          </p>
        </div>
        {!note ? (
          <div className="panel pron-empty">
            <h2>Chưa có hướng dẫn cho âm/phiên bản này</h2>
            <p>
              Không tự thay bằng một âm gần giống. Chọn hướng dẫn có thực trong
              danh sách.
            </p>
            <button
              className="button secondary"
              type="button"
              onClick={() => setSelected(notes[0].versionId)}
            >
              Mở hướng dẫn đầu tiên
            </button>
          </div>
        ) : (
          <NoteView
            key={note.versionId}
            note={note}
            release={release}
            select={setSelected}
          />
        )}
        {!lessonId && (
          <Link
            className="button secondary pron-back"
            href="/learn/courses/FOUNDATION"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            Về khóa Nền tảng
          </Link>
        )}
      </section>
    </PilotContext.Provider>
  );
}
function NoteView({
  note,
  release,
  select,
}: {
  note: PronunciationNote;
  release: PronunciationRelease;
  select: (ref: string) => void;
}) {
  const [selfReported, setSelfReported] = useState(false);
  const uid = useId(),
    guideId = `${uid}-guide`,
    correctionId = `${uid}-correction`;
  function show(id: string) {
    const element = document.getElementById(id);
    if (!element) return;
    if (element instanceof HTMLDetailsElement) element.open = true;
    element.scrollIntoView({ block: "start" });
    const focus = (element.querySelector("summary") ?? element) as HTMLElement;
    focus.setAttribute("tabindex", "-1");
    focus.focus({ preventScroll: true });
  }
  const feedback = mapPronunciationFeedback(
    { state: "NOT_ANALYZED", reason: "NO_VALIDATED_ANALYZER" },
    note,
    selfReported,
  );
  return (
    <article className="pron-note" data-note-version={note.versionId}>
      <header className="pron-hero panel">
        <span className="badge amber">DRAFT · Chưa duyệt chuyên môn</span>
        <h2>{note.title}</h2>
        <p className="pron-target" lang="zh-Hans">
          {note.target}
        </p>
        <p className="pron-pinyin" lang="zh-Latn-pinyin">
          {note.pinyin}
        </p>
        <div className="pron-quick">
          <Wind size={22} aria-hidden="true" />
          <p>{note.quickTip}</p>
        </div>
        <p>{note.explanation}</p>
      </header>
      <section
        className="panel pron-visuals"
        aria-label="Khẩu hình và đường thanh"
        id={guideId}
      >
        <h3>
          {["LEXICAL_TONE", "CONTEXTUAL_TONE"].includes(note.category)
            ? "Nhìn hướng giọng"
            : "Khẩu hình · lưỡi và luồng hơi"}
        </h3>
        {note.illustrationRefs.map((ref) => (
          <ArticulationGuide
            key={ref}
            model={release.illustrations.find((i) => i.id === ref)!}
          />
        ))}
        {["LEXICAL_TONE", "CONTEXTUAL_TONE"].includes(note.category) && (
          <p className="field-hint">
            Đường minh họa lý thuyết — không phải bản ghi âm mẫu chuẩn.
          </p>
        )}
        {note.comparisonRefs.length > 0 && (
          <div className="pron-actions">
            {note.comparisonRefs.map((ref) => (
              <button
                type="button"
                className="button secondary"
                key={ref}
                onClick={() => select(ref)}
              >
                Xem riêng{" "}
                {release.notes.find((n) => n.versionId === ref)!.title}
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="panel pron-instructions">
        <h3>Thử từng bước</h3>
        <ol>
          {note.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <details className="pron-details">
          <summary>Môi, lưỡi và hơi: mô tả bằng chữ</summary>
          <dl className="pron-anatomy">
            {Object.entries(note.articulation).map(([key, value]) => (
              <div key={key}>
                <dt>
                  {
                    {
                      lips: "Môi",
                      tongueTip: "Đầu lưỡi",
                      tongueBody: "Thân lưỡi",
                      jaw: "Hàm",
                      airflow: "Luồng hơi",
                      voicing: "Tiếng rung",
                      tone: "Hướng giọng",
                      timing: "Nhịp",
                    }[key]
                  }
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
      <section className="panel pron-feedback" aria-label="Mẹo sửa và tự kiểm">
        <h3>Chỉ thử sửa một điều</h3>
        <p className="pron-not-diagnosis">{feedback.summary}</p>
        <p>
          <strong>Điều dễ nhầm:</strong> {note.commonMistakes[0]}
        </p>
        <label className="pron-selfcheck">
          <input
            type="checkbox"
            checked={selfReported}
            onChange={(event) => setSelfReported(event.target.checked)}
          />
          Tôi tự nhận thấy điều này và muốn thử mẹo sửa
        </label>
        <details
          id={correctionId}
          className="pron-details"
          open={selfReported || undefined}
        >
          <summary>Xem một động tác để thử sửa</summary>
          <dl className="pron-anatomy">
            <div>
              <dt>Điều có thể cần chú ý</dt>
              <dd>{feedback.correction.mayBeWrong}</dd>
            </div>
            <div>
              <dt>Thử đổi</dt>
              <dd>{feedback.correction.change}</dd>
            </div>
            <div>
              <dt>Luyện tiếp</dt>
              <dd>{feedback.correction.nextTry}</dd>
            </div>
          </dl>
          <p>{feedback.evidence}</p>
        </details>
        <p>
          <strong>Tự hỏi:</strong> {note.selfCheck}
        </p>
      </section>
      <PracticeRecorderPanel
        targetVersion={note.versionId}
        onShowGuide={() => show(guideId)}
        onShowCorrection={() => show(correctionId)}
      />
      <details className="panel pron-details pron-advanced">
        <summary>Giải thích chuyên sâu và nguồn · {note.versionId}</summary>
        <p>{note.technical}</p>
        <p>{note.limitations}</p>
        <p>Người soạn: {release.author}</p>
        <ul>
          {note.references.map((ref) => {
            const source = release.sources.find((s) => s.id === ref.sourceId)!;
            return (
              <li key={ref.sourceId}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>{" "}
                — {ref.locator}. Chỉ tham khảo kiến thức, không sao chép hình/âm
                thanh. Quyền phát hành nội dung mới vẫn chờ duyệt.
              </li>
            );
          })}
        </ul>
      </details>
    </article>
  );
}
