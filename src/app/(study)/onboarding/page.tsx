"use client";
import { useLocal } from "@/modules/learning/ui/local-provider";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Sprout,
} from "lucide-react";
import { DemoNotice } from "@/components/ui";
import { usePreview } from "@/modules/preview/ui/preview-provider";

const levels = [
  {
    id: "zero",
    title: "Tôi bắt đầu từ số 0",
    text: "Làm quen với pinyin và những câu đầu tiên.",
  },
  {
    id: "some",
    title: "Tôi đã biết một chút",
    text: "Thử lại nền tảng và thao tác trong bài mẫu.",
  },
];
export default function Onboarding() {
  const { level, setLevel } = usePreview();
  const router = useRouter();
  const local = useLocal();
  return (
    <div className="onboarding">
      <div className="step-indicator">
        <span className="current">
          01 <span>Làm quen</span>
        </span>
        <i />
        <span>
          02 <span>Lịch học</span>
        </span>
        <i />
        <span>
          03 <span>Bắt đầu</span>
        </span>
      </div>
      <div className="welcome-grid">
        <section className="welcome-copy">
          <p className="eyebrow">
            <Sprout size={16} aria-hidden="true" /> MỘT HÀNH TRÌNH MỚI
          </p>
          <h1>
            Tiếng Trung,
            <br />
            bắt đầu từ <em>hôm nay.</em>
          </h1>
          <p className="welcome-description">
            Một không gian nhỏ để học, ôn tập và đi từng bước về phía mục tiêu
            của bạn.
          </p>
          <div className="welcome-details">
            <span>
              <BookOpen size={18} aria-hidden="true" /> Từ nền tảng đến giao
              tiếp
            </span>
            <span>
              <CalendarDays size={18} aria-hidden="true" /> Theo quỹ thời gian
              của bạn
            </span>
          </div>
          <div className="welcome-art" aria-label="学, xué, nghĩa là học">
            <span className="art-caption">MỖI NGÀY, MỘT BƯỚC NHỎ</span>
            <span className="art-hanzi" lang="zh-Hans">
              学
            </span>
            <span className="art-pinyin">
              xué <span>／</span> học
            </span>
            <span className="art-seal" lang="zh-Hans">
              日<br />日
            </span>
          </div>
        </section>
        <section className="panel setup-panel">
          <span className="badge green">CHÀO MỪNG BẠN</span>
          <h2>
            Bạn đang ở đâu
            <br />
            trên hành trình này?
          </h2>
          <p className="muted">Chọn điểm bắt đầu. Bạn có thể thay đổi sau.</p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (local.enabled) {
                const selected = await local.choose(true);
                if (selected) router.push(`/schedule?level=${level}`);
              } else router.push("/schedule");
            }}
          >
            <fieldset className="level-options">
              <legend className="sr-only">Trình độ bắt đầu</legend>
              {levels.map((item) => (
                <label
                  key={item.id}
                  className={`level-option ${level === item.id ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="level"
                    value={item.id}
                    checked={level === item.id}
                    onChange={() => setLevel(item.id)}
                  />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.text}</small>
                  </span>
                  <span className="selection-check" aria-hidden="true">
                    {level === item.id && <Check size={14} />}
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="field-hint">
              Mục tiêu dài hạn: HSK 4. Preview chưa có bài kiểm tra đầu vào hoặc
              cam kết thời gian đạt.
            </p>
            <button
              type="submit"
              className="button primary full"
              disabled={!local.initialized || local.status === "loading"}
            >
              {local.enabled ? "Bắt đầu học có lưu" : "Thiết lập lịch học"}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
          {local.enabled && (
            <>
              <p className="field-hint">
                Lưu lịch, bài học và ôn tập trong PostgreSQL trên máy. Nội dung
                DRAFT chưa được duyệt.
              </p>
              <button
                className="text-link"
                onClick={async () => {
                  if (await local.choose(false)) router.push("/schedule");
                }}
              >
                Chỉ thử giao diện DEMO
              </button>
            </>
          )}
          <p className="setup-footnote">Theo nhịp của bạn. Không cần vội.</p>
        </section>
      </div>
      <DemoNotice>
        {local.enabled
          ? "LOCAL DEVELOPMENT có lưu trên máy; danh tính development không phải tài khoản production. DEMO vẫn chỉ giữ state trong tab."
          : "Đây là bản thử giao diện. Không cần tài khoản; lựa chọn chỉ giữ trong tab và đặt lại khi tải lại trang."}
      </DemoNotice>
    </div>
  );
}
