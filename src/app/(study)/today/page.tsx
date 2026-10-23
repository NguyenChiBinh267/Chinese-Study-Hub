"use client";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  Layers,
  Leaf,
  MoveUpRight,
} from "lucide-react";
import {
  ActionLink,
  DemoNotice,
  PageHeading,
  SectionTitle,
} from "@/components/ui";
import { demoLessons } from "@/modules/content/fixtures/demo";
import { previewPlan } from "@/modules/planning/domain/preview-plan";
import { usePreview } from "@/modules/preview/ui/preview-provider";
import { useLocal } from "@/modules/learning/ui/local-provider";
import { LocalToday } from "@/modules/learning/ui/local-slice";

export default function Today() {
  const { preferences, configured, sessions, ratings } = usePreview();
  const plan = configured ? previewPlan(preferences) : null;
  const completed = Object.values(sessions).filter(
    (session) => session.complete,
  ).length;
  const nextLesson = demoLessons.find(
    (lesson) => !sessions[lesson.id]?.complete,
  );
  const activeSession = nextLesson && sessions[nextLesson.id];
  const local = useLocal();
  if (local.mode === "local") return <LocalToday />;
  return (
    <>
      <PageHeading
        eyebrow="TỪNG BƯỚC NHỎ, MỖI NGÀY"
        title="Hôm nay, mình học gì?"
        description="Một chút tập trung hôm nay. Thêm một bước trên hành trình tiếng Trung."
        action={
          <Link href="/schedule" className="button secondary compact">
            <CalendarDays size={17} aria-hidden="true" />
            Lịch học của tôi
          </Link>
        }
      />
      <DemoNotice />
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="today-hero">
            <div className="hero-copy">
              <span className="hero-kicker">
                <span />
                {!configured
                  ? "BẮT ĐẦU TỪ NHỊP HỌC"
                  : nextLesson
                    ? "VIỆC TIẾP THEO · DEMO"
                    : "ĐÃ THỬ HẾT BÀI MẪU"}
              </span>
              <h2>
                {!configured
                  ? "Một lịch học\nvừa với cuộc sống."
                  : nextLesson
                    ? nextLesson.title
                    : "Bạn đã đi hết\nlượt thử này."}
              </h2>
              <p>
                {!configured
                  ? "Chọn thời gian bạn có thể dành ra, rồi cùng bắt đầu với bài mẫu đầu tiên."
                  : nextLesson
                    ? nextLesson.subtitle
                    : "Bạn có thể xem lại các bài mẫu hoặc thử lật thẻ ôn tập."}
              </p>
              <div className="hero-meta">
                <span>
                  <Clock3 size={16} aria-hidden="true" />
                  {configured ? "15 phút dự kiến" : "Khoảng 1 phút thiết lập"}
                </span>
                <span>•</span>
                <span>
                  {configured
                    ? "Bài mẫu chưa kiểm duyệt"
                    : "Có thể chỉnh sửa bất cứ lúc nào"}
                </span>
              </div>
              <ActionLink
                href={
                  !configured
                    ? "/schedule"
                    : nextLesson
                      ? `/learn/${nextLesson.id}`
                      : "/review"
                }
              >
                {!configured
                  ? "Thiết lập lịch học"
                  : nextLesson
                    ? activeSession
                      ? "Tiếp tục bài mẫu"
                      : "Bắt đầu bài mẫu · 15 phút"
                    : "Thử ôn tập"}
              </ActionLink>
            </div>
            <div className="hero-art" aria-hidden="true">
              <span className="hero-art-circle" />
              <span className="hero-art-line" />
              <span lang="zh-Hans">学</span>
              <small>xué · học</small>
              <i lang="zh-Hans">
                每<br />天
              </i>
            </div>
          </section>
          <div className="stat-grid">
            <div className="stat">
              <span className="stat-icon sage">
                <Clock3 size={19} aria-hidden="true" />
              </span>
              <span>
                Quỹ giờ dự kiến
                <strong>{plan ? `${plan.feasible}′` : "Chưa đặt"}</strong>
                <small>
                  {plan
                    ? `Gồm ${plan.buffer}′ dự phòng · chưa đo thời gian thực`
                    : "Thiết lập lịch để xem preview"}
                </small>
              </span>
            </div>
            <div className="stat">
              <span className="stat-icon sand">
                <BookOpen size={19} aria-hidden="true" />
              </span>
              <span>
                Bài mẫu đã thử
                <strong>
                  {completed}
                  <small> / 4</small>
                </strong>
                <small>Trong tab này · không tính thành tích</small>
              </span>
            </div>
            <div className="stat">
              <span className="stat-icon lavender">
                <Layers size={19} aria-hidden="true" />
              </span>
              <span>
                Lượt thẻ đã thử
                <strong>
                  {ratings.length}
                  <small> / 4</small>
                </strong>
                <small>Hàng đợi demo · chưa có FSRS</small>
              </span>
            </div>
          </div>
          <SectionTitle href="/learn" linkLabel="Khám phá bài mẫu">
            Lộ trình đầu tiên
          </SectionTitle>
          <div className="lesson-path">
            {demoLessons.map((lesson, index) => (
              <Link
                key={lesson.id}
                href={`/learn/${lesson.id}`}
                className="path-row"
              >
                <span
                  className={`path-number ${sessions[lesson.id]?.complete ? "done" : ""}`}
                >
                  {sessions[lesson.id]?.complete ? (
                    <Check size={18} aria-hidden="true" />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span className="path-copy">
                  <small>
                    {lesson.id} · {lesson.type}
                  </small>
                  <strong>{lesson.title}</strong>
                </span>
                <span className="path-time">{lesson.minutes} phút</span>
                <MoveUpRight size={17} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
        <aside className="dashboard-aside">
          <section className="panel week-panel">
            <SectionTitle href="/schedule" linkLabel="Sửa">
              Nhịp học tuần này
            </SectionTitle>
            <p className="field-hint">
              {plan
                ? "Phân bổ mẫu · chưa gắn ngày thực"
                : "Bạn chưa áp dụng lịch học."}
            </p>
            <div className="mini-week">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label, day) => (
                <div key={label}>
                  <span>{label}</span>
                  <i className={plan?.days[day].minutes ? "planned" : ""}>
                    {plan?.days[day].minutes ? <span /> : "–"}
                  </i>
                </div>
              ))}
            </div>
            <div className="weekly-summary">
              <span>Thời gian học dự kiến</span>
              <strong>{plan ? `${plan.active} phút` : "—"}</strong>
            </div>
            <p className="field-hint">
              {plan
                ? "Quỹ còn lại thực tế chưa có: preview chưa ghi thời gian học."
                : "Một khởi đầu nhẹ nhàng, theo lịch của bạn."}
            </p>
          </section>
          <section className="word-note">
            <div className="note-top">
              <span className="eyebrow">GÓC CHỮ HÁN · DEMO</span>
              <Leaf size={17} aria-hidden="true" />
            </div>
            <span className="note-hanzi" lang="zh-Hans">
              好
            </span>
            <span className="note-pinyin">hǎo</span>
            <h3>Tốt, đẹp</h3>
            <p>Một chữ nhỏ trong lời chào đầu tiên của bạn.</p>
            <Link href="/learn/L001" className="text-link">
              Thử bài lời chào
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>
          <p className="quiet-note">
            Không cần đi thật nhanh.
            <br />
            Hãy bắt đầu bằng một bước vừa sức.
          </p>
        </aside>
      </div>
    </>
  );
}
