"use client";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, Clock3 } from "lucide-react";
import { DemoNotice, PageHeading } from "@/components/ui";
import { demoLessons } from "@/modules/content/fixtures/demo";
import { usePreview } from "@/modules/preview/ui/preview-provider";
import { useLocal } from "@/modules/learning/ui/local-provider";
import { LocalLearningLink } from "@/modules/learning/ui/local-slice";

import { FoundationLibrary } from "@/modules/content/ui/foundation";
import { CourseExplorer } from "@/modules/curriculum/ui/courses";

export default function Learn() {
  const { sessions } = usePreview();
  const local = useLocal();
  if (local.mode === "local")
    return (
      <>
        <PageHeading
          eyebrow="LOCAL DEVELOPMENT"
          title="Học theo từng bước nhỏ"
          description="Bốn bài tự soạn có lưu PostgreSQL. Practice chưa duyệt không phải mastery hoặc mở khóa HSK."
        />
        <CourseExplorer />
        <FoundationLibrary />
        <LocalLearningLink />
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow="HỌC TỪ NỀN TẢNG"
        title="Một hành trình, từng bài nhỏ."
        description="Làm quen với cách học, thử trả lời và xem phản hồi trong bốn bài mẫu."
      />
      <DemoNotice>
        Fixtures thử giao diện, chưa có duyệt ngôn ngữ, đáp án, quyền xuất bản
        hoặc audio. Đây không phải khóa học đã phát hành.
      </DemoNotice>
      <CourseExplorer />
      <div className="curriculum-intro">
        <BookOpen size={22} aria-hidden="true" />
        <div>
          <h2>Những bước đầu tiên</h2>
          <p>Nền tảng → lời chào → trò chuyện</p>
        </div>
        <span className="badge neutral">4 BÀI MẪU</span>
      </div>
      <div className="lesson-grid">
        {demoLessons.map((lesson, index) => (
          <article key={lesson.id} className="panel lesson-card">
            <div className={`lesson-cover cover-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span lang="zh-Hans">{lesson.steps[0].hanzi}</span>
              <small>{lesson.id} · DEMO</small>
            </div>
            <div className="lesson-card-body">
              <span className="eyebrow">{lesson.type}</span>
              <h2>{lesson.title}</h2>
              <p>{lesson.subtitle}</p>
              <div className="lesson-card-meta">
                <span>
                  <Clock3 size={15} aria-hidden="true" />
                  {lesson.minutes} phút dự kiến
                </span>
                <span>{lesson.steps.length} bước</span>
              </div>
              <Link
                className="button secondary full"
                href={`/learn/${lesson.id}`}
              >
                {sessions[lesson.id]?.complete ? (
                  <>
                    <Check size={17} aria-hidden="true" />
                    Xem lại bài mẫu
                  </>
                ) : sessions[lesson.id] ? (
                  "Tiếp tục thử"
                ) : (
                  "Mở bài mẫu"
                )}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <p className="field-hint space-top">
        Thứ tự gợi ý để thử giao diện. Demo cho mở mọi bài; chưa kiểm tra
        prerequisite hoặc mở khóa thực.
      </p>
    </>
  );
}
