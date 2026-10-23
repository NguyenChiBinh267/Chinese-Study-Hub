"use client";
import { NextStudyAction } from "@/modules/planning/ui/study-panel";
import { useState } from "react";
import {
  BookOpen,
  ChartNoAxesCombined,
  CheckCircle2,
  Layers,
  Sprout,
} from "lucide-react";
import {
  ActionLink,
  DemoNotice,
  PageHeading,
  SectionTitle,
} from "@/components/ui";
import { demoLessons } from "@/modules/content/fixtures/demo";
import { usePreview } from "@/modules/preview/ui/preview-provider";
import { useLocal } from "@/modules/learning/ui/local-provider";
import { LocalProgress } from "@/modules/learning/ui/local-slice";

import { ContentProgress } from "@/modules/content/ui/foundation";
import { CourseExplorer } from "@/modules/curriculum/ui/courses";

export default function Progress() {
  const { sessions, ratings } = usePreview();
  const [view, setView] = useState("real");
  const completed = demoLessons.filter(
    (lesson) => sessions[lesson.id]?.complete,
  );
  const answers = Object.values(sessions).reduce(
    (sum, session) => sum + Object.keys(session.answers).length,
    0,
  );
  const local = useLocal();
  if (local.mode === "local")
    return (
      <>
        <PageHeading
          eyebrow="LOCAL DATABASE"
          title="Tiến độ được đọc lại từ PostgreSQL"
          description="Grading và lịch ôn fixture đã lưu; mastery chỉ tính từ evidence hợp lệ, không phải chứng nhận HSK."
        />
        <CourseExplorer progressOnly />
        <ContentProgress />
        <LocalProgress />
        <NextStudyAction />
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow="NHÌN LẠI HÀNH TRÌNH"
        title="Mỗi bước nhỏ đều có ý nghĩa."
        description="Phân biệt hoạt động thử giao diện với tiến độ học được xác nhận."
      />
      <div
        className="segmented"
        role="group"
        aria-label="Nguồn dữ liệu tiến độ"
      >
        <button aria-pressed={view === "real"} onClick={() => setView("real")}>
          Kết quả học thực
        </button>
        <button aria-pressed={view === "demo"} onClick={() => setView("demo")}>
          Hoạt động DEMO trong tab
        </button>
      </div>
      {view === "real" ? (
        <section className="panel empty-state">
          <span className="empty-icon">
            <Sprout size={36} aria-hidden="true" />
          </span>
          <span className="eyebrow">MỘT TRANG MỚI ĐANG CHỜ BẠN</span>
          <h2>Chưa có kết quả học đã lưu.</h2>
          <p>
            Preview chưa kết nối tài khoản hoặc server học tập.
            <br />
            Các lượt thử không được tính là thành tích, mastery hay trình độ
            HSK.
          </p>
          <ActionLink href="/learn">Khám phá bài mẫu</ActionLink>
          <small>Bạn có thể xem hoạt động tạm thời ở mục DEMO phía trên.</small>
        </section>
      ) : (
        <>
          <DemoNotice>
            Số liệu từ thao tác của bạn trong tab này; không phải số liệu học đã
            lưu. Tải lại trang sẽ đặt lại về 0.
          </DemoNotice>
          <div className="stat-grid progress-stats">
            <div className="panel">
              <BookOpen size={23} aria-hidden="true" />
              <strong>
                {completed.length}
                <small> / 4</small>
              </strong>
              <span>Bài mẫu hoàn tất</span>
            </div>
            <div className="panel">
              <CheckCircle2 size={23} aria-hidden="true" />
              <strong>{answers}</strong>
              <span>Bước đã trả lời</span>
            </div>
            <div className="panel">
              <Layers size={23} aria-hidden="true" />
              <strong>{ratings.length}</strong>
              <span>Lượt đánh giá thẻ</span>
            </div>
          </div>
          <section className="panel activity-panel">
            <SectionTitle>Bài mẫu đã thao tác</SectionTitle>
            {Object.keys(sessions).length ? (
              <div className="activity-list">
                {demoLessons
                  .filter((lesson) => sessions[lesson.id])
                  .map((lesson) => (
                    <div key={lesson.id}>
                      <span className="activity-icon">
                        <BookOpen size={18} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{lesson.title}</strong>
                        <small>
                          {lesson.id} ·{" "}
                          {Object.keys(sessions[lesson.id].answers).length}/
                          {lesson.steps.length} bước đã trả lời
                        </small>
                      </span>
                      <span
                        className={`badge ${sessions[lesson.id].complete ? "green" : "neutral"}`}
                      >
                        {sessions[lesson.id].complete
                          ? "Đã thử xong"
                          : "Đang thử"}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="empty-inline">
                <ChartNoAxesCombined size={28} aria-hidden="true" />
                <p>Chưa có thao tác demo trong tab này.</p>
                <ActionLink href="/learn" secondary>
                  Thử một bài mẫu
                </ActionLink>
              </div>
            )}
          </section>
          <div className="scope-note">
            <strong>Chưa đo năng lực hoặc thời gian học</strong>
            <p>
              Không có biểu đồ tiến bộ giả, streak giả, % mastery, điểm HSK hoặc
              dự báo đạt chứng chỉ. Các phần này cần dữ liệu và quy tắc đã kiểm
              chứng.
            </p>
          </div>
        </>
      )}
    </>
  );
}
