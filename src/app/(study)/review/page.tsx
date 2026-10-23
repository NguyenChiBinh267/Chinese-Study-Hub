"use client";
import { useState } from "react";
import { CheckCircle2, RotateCcw, RotateCw } from "lucide-react";
import {
  ActionLink,
  ChineseText,
  DemoNotice,
  PageHeading,
} from "@/components/ui";
import { demoCards } from "@/modules/content/fixtures/demo";
import { usePreview } from "@/modules/preview/ui/preview-provider";
import { useLocal } from "@/modules/learning/ui/local-provider";
import { LocalReview } from "@/modules/review/ui/local-review";

const ratings = [
  { id: "Again", label: "Quên", hint: "Chưa nhớ ra", className: "again" },
  { id: "Hard", label: "Khó", hint: "Nhớ nhưng khó", className: "hard" },
  { id: "Good", label: "Nhớ đúng", hint: "Nhớ bình thường", className: "good" },
  { id: "Easy", label: "Nhớ ngay", hint: "Nhớ rất dễ", className: "easy" },
];
export default function Review() {
  const state = usePreview();
  const [flipped, setFlipped] = useState(false);
  const local = useLocal();
  if (local.mode === "local") return <LocalReview />;
  const card = demoCards[state.ratings.length];
  return (
    <div className="review-container">
      <PageHeading
        eyebrow="NHỚ LẠI, TỪNG CHÚT MỘT"
        title="Gặp lại những điều đã học."
        description="Thử lật thẻ và chọn mức độ bạn nhớ. Không cần đoán thật nhanh."
      />
      <DemoNotice>
        4 thẻ fixture chưa kiểm duyệt. Nút Again / Hard / Good / Easy chỉ thử
        tương tác; chưa có FSRS, ngày đến hạn hoặc lưu server.
      </DemoNotice>
      {card ? (
        <>
          <div className="review-toolbar">
            <span className="badge green">THẺ MẪU · {card.id}</span>
            <span>
              Thẻ {state.ratings.length + 1} / {demoCards.length}
            </span>
          </div>
          <div
            className="review-progress"
            role="progressbar"
            aria-label="Số thẻ đã thử"
            aria-valuemin={0}
            aria-valuemax={demoCards.length}
            aria-valuenow={state.ratings.length}
          >
            <i
              style={{
                width: `${(state.ratings.length / demoCards.length) * 100}%`,
              }}
            />
          </div>
          <section
            className={`flashcard panel ${flipped ? "is-flipped" : ""}`}
            aria-label="Thẻ ôn tập"
          >
            <p className="eyebrow">
              {flipped ? "ĐỐI CHIẾU VỚI VÍ DỤ" : "CHỮ NÀY CÓ NGHĨA LÀ GÌ?"}
            </p>
            {flipped ? (
              <div className="flashcard-reveal" role="status">
                <ChineseText hanzi={card.hanzi} pinyin={card.pinyin} />
                <h2>{card.meaning}</h2>
                <p>Ví dụ DEMO · chưa kiểm duyệt</p>
              </div>
            ) : (
              <span lang="zh-Hans" className="flashcard-hanzi">
                {card.hanzi}
              </span>
            )}
            <button
              className="button secondary"
              onClick={() => setFlipped((previous) => !previous)}
            >
              <RotateCw size={17} aria-hidden="true" />
              {flipped ? "Xem lại mặt trước" : "Lật thẻ xem đáp án"}
            </button>
          </section>
          <fieldset className="rating-fieldset" disabled={!flipped}>
            <legend>
              {flipped
                ? "Bạn đã nhớ thế nào?"
                : "Lật thẻ trước khi tự đánh giá"}
            </legend>
            <div className="rating-grid">
              {ratings.map((rating) => (
                <button
                  key={rating.id}
                  type="button"
                  className={`rating ${rating.className}`}
                  onClick={() => {
                    state.rateCard(rating.id);
                    setFlipped(false);
                  }}
                >
                  <span className="rating-english">{rating.id}</span>
                  <strong>{rating.label}</strong>
                  <small>{rating.hint}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <p className="field-hint centered">
            Trả lời sai → Quên. Các mức còn lại dành cho khi bạn tự nhớ đúng.
            <br />
            Lượt thử này không tạo lịch ôn tiếp theo.
          </p>
        </>
      ) : (
        <section className="panel completion">
          <span className="completion-icon">
            <CheckCircle2 size={38} aria-hidden="true" />
          </span>
          <p className="eyebrow">ĐÃ THỬ HẾT THẺ MẪU</p>
          <h2>Một vòng ôn nhỏ đã xong.</h2>
          <p>Bạn đã thử {state.ratings.length} lượt đánh giá trong tab này.</p>
          <p className="field-hint">
            Đây không phải thông báo hết thẻ đến hạn. Chưa có hàng đợi FSRS
            thực.
          </p>
          <div className="completion-actions">
            <ActionLink href="/progress">Xem hoạt động demo</ActionLink>
            <button
              className="button secondary"
              onClick={() => {
                state.restartReview();
                setFlipped(false);
              }}
            >
              <RotateCcw size={17} aria-hidden="true" />
              Thử lại 4 thẻ
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
