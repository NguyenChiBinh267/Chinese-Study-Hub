"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { ActionLink, ChineseText, DemoNotice } from "@/components/ui";
import type { DemoLesson } from "@/modules/content/fixtures/demo";
import { usePreview } from "@/modules/preview/ui/preview-provider";

export function LessonPlayer({ lesson }: { lesson: DemoLesson }) {
  const { sessions, updateSession } = usePreview();
  const session = sessions[lesson.id] ?? {
    step: 0,
    answers: {},
    complete: false,
  };
  const step = lesson.steps[session.step];
  const answer = session.answers[session.step];
  const [selection, setSelection] = useState<number | null>(null);
  const [error, setError] = useState("");
  const stepHeading = useRef<HTMLHeadingElement>(null);
  function move(target: number) {
    updateSession(lesson.id, { ...session, step: target });
    setSelection(null);
    setError("");
    requestAnimationFrame(() => stepHeading.current?.focus());
  }
  const correct = Object.entries(session.answers).filter(
    ([index, chosen]) => lesson.steps[Number(index)].answer === chosen,
  ).length;
  return (
    <div className="player-container">
      <Link href="/learn" className="text-link back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Các bài mẫu
      </Link>
      <DemoNotice>
        Bài {lesson.id} · Ví dụ chưa kiểm duyệt. Phản hồi theo fixture ở client;
        không chấm điểm hoặc lưu kết quả học thật. Chưa có audio.
      </DemoNotice>
      {session.complete ? (
        <section
          className="panel completion"
          aria-labelledby="completion-title"
        >
          <span className="completion-icon">
            <CheckCircle2 size={38} aria-hidden="true" />
          </span>
          <p className="eyebrow">ĐÃ HOÀN TẤT LƯỢT THỬ</p>
          <h1 id="completion-title">Thêm một bước nhỏ.</h1>
          <p>
            Bạn đã thử {lesson.steps.length} bước của {lesson.id}.
          </p>
          <div className="completion-stat">
            <strong>
              {correct} / {lesson.steps.length}
            </strong>
            <span>khớp đáp án fixture · không phải điểm năng lực</span>
          </div>
          <p className="field-hint">
            Kết quả chỉ còn trong tab này, chưa lưu lên server hoặc cập nhật
            mastery.
          </p>
          <div className="completion-actions">
            <ActionLink href="/review">Thử ôn bằng flashcard</ActionLink>
            <button
              className="button secondary"
              onClick={() => {
                updateSession(lesson.id, {
                  step: 0,
                  answers: {},
                  complete: false,
                });
                setSelection(null);
              }}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Thử lại bài mẫu
            </button>
            <Link className="text-link" href="/today">
              Về Hôm nay
            </Link>
          </div>
        </section>
      ) : (
        <>
          <header className="player-heading">
            <div>
              <p className="eyebrow">
                {lesson.id} · {lesson.type}
              </p>
              <h1>{lesson.title}</h1>
            </div>
            <span className="badge neutral">
              Bước {session.step + 1} / {lesson.steps.length}
            </span>
          </header>
          <div
            className="step-progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={lesson.steps.length}
            aria-valuenow={session.step + 1}
            aria-label={`Bước ${session.step + 1} trên ${lesson.steps.length}`}
          >
            {lesson.steps.map((_, index) => (
              <span
                key={index}
                className={index <= session.step ? "filled" : ""}
              />
            ))}
          </div>
          <section className="panel exercise">
            <p className="eyebrow">QUAN SÁT & THỬ TRẢ LỜI</p>
            <div className="lesson-word">
              <ChineseText hanzi={step.hanzi} pinyin={step.pinyin} />
              <p>{step.meaning}</p>
              <span className="field-hint">
                Pinyin dạng từ điển · chưa có audio được duyệt
              </span>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (selection === null) {
                  setError("Chọn một câu trả lời trước khi kiểm tra.");
                  return;
                }
                updateSession(lesson.id, {
                  ...session,
                  answers: { ...session.answers, [session.step]: selection },
                });
                setError("");
              }}
            >
              <h2 ref={stepHeading} tabIndex={-1}>
                {step.prompt}
              </h2>
              <fieldset
                className="answer-options"
                disabled={answer !== undefined}
              >
                <legend className="sr-only">Câu trả lời</legend>
                {step.choices.map((choice, index) => (
                  <label
                    key={`${session.step}-${index}`}
                    className={`answer-option ${(answer ?? selection) === index ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="answer"
                      checked={(answer ?? selection) === index}
                      onChange={() => {
                        setSelection(index);
                        setError("");
                      }}
                    />
                    <span className="choice-letter">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span>{choice}</span>
                    {(answer ?? selection) === index && (
                      <Check size={17} aria-hidden="true" />
                    )}
                  </label>
                ))}
              </fieldset>
              {error && (
                <p role="alert" className="error-text">
                  {error}
                </p>
              )}
              {answer === undefined ? (
                <button className="button primary full" type="submit">
                  Kiểm tra câu trả lời
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              ) : (
                <div
                  className={`feedback ${answer === step.answer ? "correct" : "retry"}`}
                  role="status"
                >
                  <strong>
                    {answer === step.answer
                      ? "Khớp đáp án mẫu"
                      : `Chưa khớp. Đáp án mẫu: ${step.choices[step.answer]}`}
                  </strong>
                  <p>{step.explanation}</p>
                  <button
                    className="button primary"
                    type="button"
                    onClick={() => {
                      if (session.step === lesson.steps.length - 1)
                        updateSession(lesson.id, {
                          ...session,
                          complete: true,
                        });
                      else move(session.step + 1);
                    }}
                  >
                    {session.step === lesson.steps.length - 1
                      ? "Kết thúc lượt thử"
                      : "Bước tiếp theo"}
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                </div>
              )}
            </form>
          </section>
          <div className="player-bottom">
            <button
              className="button ghost"
              disabled={session.step === 0}
              onClick={() => move(session.step - 1)}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Bước trước
            </button>
            <span>Tiến trình chỉ giữ khi tab còn mở.</span>
            <Link href="/today" className="text-link">
              Tạm dừng
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
