"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Clock3 } from "lucide-react";
import { useLocal } from "@/modules/learning/ui/local-provider";
import { localRequest } from "@/modules/content/ui/api";
import outline from "../../../../content/curriculum/catalog.v1.json";
import type { CurriculumSnapshot } from "../domain/snapshot";
export const courseHref = (code: string) => `/learn/courses/${code}`;
export const unitHref = (code: string, slug: string) =>
  `${courseHref(code)}/units/${slug}`;
const states: Record<string, string> = {
  NOT_RELEASED: "Chưa phát hành học liệu",
  PRACTICE_ONLY: "Chỉ luyện draft local",
  AVAILABLE: "Có nội dung đủ điều kiện",
  PREREQUISITE_BLOCKED: "Thiếu điều kiện tiên quyết",
  IN_PROGRESS: "Đang học có lưu",
  COMPLETED: "Đã hoàn tất phạm vi hiện có",
  NOT_STARTED: "Chưa bắt đầu",
};
export function useCurriculum() {
  const local = useLocal(),
    [data, setData] = useState<CurriculumSnapshot | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (local.mode !== "local" || local.status !== "ready") return;
    let alive = true;
    void localRequest<CurriculumSnapshot>("/curriculum")
      .then((v) => {
        if (alive) {
          setData(v);
          setError("");
        }
      })
      .catch((e) => {
        if (alive)
          setError(e instanceof Error ? e.message : "Chưa đọc được khóa học.");
      });
    return () => {
      alive = false;
    };
  }, [
    local.mode,
    local.status,
    local.data?.progress.attempts,
    local.data?.progress.completedSessions,
    local.data?.learning.reviews,
    revision,
  ]);
  return { data, error, reload: () => setRevision((n) => n + 1), local };
}
function Stats({
  course: c,
}: {
  course: CurriculumSnapshot["courses"][number];
}) {
  return (
    <>
      <dl className="course-stats">
        <div>
          <dt>Bài hiện có</dt>
          <dd>{c.totalLessons}</dd>
        </div>
        <div>
          <dt>Đã luyện</dt>
          <dd>{c.practiced}</dd>
        </div>
        <div>
          <dt>Hoàn tất luyện</dt>
          <dd>{c.completed}</dd>
        </div>
        <div>
          <dt>Bằng chứng hợp lệ</dt>
          <dd>{c.independentEvidence}</dd>
        </div>
        <div>
          <dt>Bài chưa duyệt</dt>
          <dd>{c.pending}</dd>
        </div>
        <div>
          <dt>Thẻ đến hạn</dt>
          <dd>{c.dueCards}</dd>
        </div>
      </dl>
      {c.totalLessons > 0 && (
        <p className="field-hint">
          Đã luyện {c.practiced}/{c.totalLessons} bài hiện có · hoàn tất luyện{" "}
          {c.completed}/{c.totalLessons}. Đây là phạm vi nội dung hiện có, chưa
          phải hoàn thành cấp HSK.
        </p>
      )}
    </>
  );
}
export function CourseExplorer({
  courseCode,
  unitSlug,
  progressOnly = false,
}: {
  courseCode?: string;
  unitSlug?: string;
  progressOnly?: boolean;
}) {
  const state = useCurriculum(),
    { local, data } = state;
  const selected = courseCode
    ? outline.courses.find((c) => c.code === courseCode)
    : undefined;
  if (courseCode && !selected)
    return (
      <section className="panel empty-state">
        <h1>Không tìm thấy khóa học</h1>
        <Link className="button secondary" href="/learn">
          Về danh mục khóa học
        </Link>
      </section>
    );
  if (local.mode === "local" && state.error)
    return (
      <section className="panel">
        <h2>Chưa đọc được danh mục khóa học</h2>
        <p role="alert">{state.error}</p>
        <button className="button secondary" onClick={state.reload}>
          Thử đọc khóa học lại
        </button>
      </section>
    );
  if (local.mode === "local" && !data)
    return (
      <section className="panel">
        <h2>Khóa học theo trình độ</h2>
        <p role="status">Đang đọc khóa học và tiến độ PostgreSQL…</p>
      </section>
    );
  if (local.mode !== "local")
    return (
      <section className="course-explorer">
        <h2>Khóa học theo trình độ</h2>
        <p className="field-hint">
          Sơ đồ khóa học, không có tiến độ PostgreSQL ở chế độ DEMO. Foundation
          không phải cấp thi HSK.
        </p>
        {selected ? (
          <div className="panel">
            <h1>{selected.title}</h1>
            <p>{selected.description}</p>
            <p>
              {selected.availability === "NOT_RELEASED"
                ? "Chưa phát hành học liệu"
                : "Bài draft chỉ mở khi chọn LOCAL DATABASE; chưa có nội dung được duyệt để phát hành."}
            </p>
            {local.enabled && (
              <button
                className="button primary"
                onClick={() => void local.choose(true)}
              >
                Xem nội dung local có lưu
              </button>
            )}
            <Link className="button secondary" href="/learn">
              Về danh mục khóa học
            </Link>
          </div>
        ) : (
          <div className="course-grid">
            {outline.courses.map((c) => (
              <article className="panel course-card" key={c.id}>
                <h3>Khóa: {c.title}</h3>
                <p>{c.description}</p>
                <span className="badge neutral">
                  {c.availability === "NOT_RELEASED"
                    ? "Chưa phát hành học liệu"
                    : "Bản nháp local, chưa phát hành"}
                </span>
                <Link className="button secondary" href={courseHref(c.code)}>
                  Xem khóa {c.code}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  if (!data) return null;
  const course = selected
    ? data.courses.find((c) => c.code === selected.code)
    : undefined;
  if (course) {
    const units = data.units.filter((u) => u.courseId === course.id),
      unit = unitSlug ? units.find((u) => u.slug === unitSlug) : undefined;
    if (unitSlug && !unit)
      return (
        <section className="panel">
          <h1>Không tìm thấy unit trong khóa này</h1>
          <Link className="button secondary" href={courseHref(course.code)}>
            Về khóa {course.code}
          </Link>
        </section>
      );
    const lessons = data.lessons.filter(
      (l) => l.courseCode === course.code && (!unit || l.unitId === unit.id),
    );
    return (
      <section className="course-explorer">
        <nav className="course-breadcrumbs" aria-label="Vị trí khóa học">
          <Link href="/learn">Khóa học</Link>
          <span aria-hidden="true">/</span>
          <Link href={courseHref(course.code)}>{course.title}</Link>
          {unit && (
            <>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{unit.title}</span>
            </>
          )}
        </nav>
        <div className="panel">
          <span className="eyebrow">
            {course.code} · {states[course.availability]}
          </span>
          <h1>{unit?.title ?? course.title}</h1>
          <p>{unit?.objective ?? course.description}</p>
          {course.code === "FOUNDATION" && (
            <p>
              Foundation là nền tảng nội bộ, không phải cấp thi HSK. F03–F05 là
              mục tiêu tương lai, chưa có bài để học.
              <br />
              <Link className="button secondary" href="/learn/pronunciation">
                Luyện khẩu hình và thanh điệu · draft
              </Link>
            </p>
          )}
          <p className="field-hint">
            {unit
              ? "Tiến độ trong unit này"
              : "Tiến độ nội dung hiện có của khóa"}
          </p>
          <Stats
            course={
              unit
                ? {
                    ...course,
                    totalLessons: lessons.length,
                    practiced: lessons.filter((l) => l.practiced).length,
                    completed: lessons.filter((l) => l.completed).length,
                    pending: lessons.filter((l) => !l.access.published).length,
                    independentEvidence: lessons.reduce(
                      (n, l) => n + l.independentEvidence,
                      0,
                    ),
                    dueCards: lessons.reduce((n, l) => n + l.dueCards, 0),
                  }
                : course
            }
          />
          {course.code !== "FOUNDATION" && (
            <p className="field-hint">
              Syllabus hsk-exam-2025-11. Chưa xác minh mẫu số bao phủ toàn cấp;
              không suy ra sẵn sàng thi.
            </p>
          )}
        </div>
        {!units.length ? (
          <div className="panel empty-state">
            <BookOpen size={28} aria-hidden="true" />
            <h2>Chưa phát hành học liệu</h2>
            <p>
              Chưa có unit hoặc bài học thực để luyện. Hoàn tất các draft hiện
              tại không tự mở cấp này.
            </p>
            <Link className="button primary" href={courseHref("FOUNDATION")}>
              Xem nền tảng hiện có
            </Link>
            <Link className="button secondary" href="/today">
              Về Hôm nay
            </Link>
          </div>
        ) : (
          <>
            {!unit && (
              <div className="unit-grid">
                {units.map((u) => (
                  <article className="panel" key={u.id}>
                    <span className="eyebrow">UNIT {u.order + 1}</span>
                    <h2>{u.title}</h2>
                    <p>{u.objective}</p>
                    {u.prerequisites.length > 0 && (
                      <p className="field-hint">
                        Thứ tự gợi ý sau:{" "}
                        {u.prerequisites
                          .map(
                            (id) => data.units.find((x) => x.id === id)?.title,
                          )
                          .join(", ")}
                        . Điều kiện mastery được kiểm tra riêng.
                      </p>
                    )}
                    <Link
                      className="button secondary"
                      href={unitHref(course.code, u.slug)}
                    >
                      Mở unit {u.title}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>
            )}
            <div className="course-lesson-list">
              {lessons.map((l) => (
                <LessonCard key={l.id} lesson={l} />
              ))}
            </div>
          </>
        )}
      </section>
    );
  }
  return (
    <section
      className="course-explorer"
      aria-label={progressOnly ? "Tiến độ theo khóa" : "Danh mục khóa học"}
    >
      <div className="section-title">
        <h2>{progressOnly ? "Tiến độ theo khóa" : "Khóa học theo trình độ"}</h2>
        <span className="badge green">FOUNDATION → HSK 4</span>
      </div>
      <p className="field-hint">
        Tiến độ từ PostgreSQL. Luyện draft, hoàn tất luyện và mastery là ba
        trạng thái riêng. Foundation không phải cấp thi HSK.
      </p>
      <div className="course-grid">
        {data.courses.map((c) => (
          <article
            className="panel course-card"
            key={c.id}
            data-testid={`course-${c.code}`}
          >
            <span className="eyebrow">
              {c.code === "FOUNDATION"
                ? "BƯỚC CHUẨN BỊ"
                : c.code === outline.courses.at(-1)?.code
                  ? "MỤC TIÊU DÀI HẠN"
                  : `KHÓA ${c.order}`}
            </span>
            <h3>Khóa: {c.title}</h3>
            <p>{c.description}</p>
            <span
              className={`badge ${c.availability === "NOT_RELEASED" ? "neutral" : "amber"}`}
            >
              {states[c.availability]}
            </span>
            {c.activityState === "IN_PROGRESS" && (
              <span className="badge green">Có hoạt động đã lưu</span>
            )}
            <Stats course={c} />
            <Link className="button secondary" href={courseHref(c.code)}>
              Xem khóa {c.code}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
function LessonCard({
  lesson: l,
}: {
  lesson: CurriculumSnapshot["lessons"][number];
}) {
  return (
    <article
      className="panel course-lesson"
      data-testid={`curriculum-lesson-${l.key}`}
    >
      <div className="section-title">
        <h2>
          {l.key} · {l.title}
        </h2>
        <span className="badge amber">{states[l.access.availability]}</span>
      </div>
      <ul>
        {l.objectives.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>
      <p>
        <Clock3 size={15} aria-hidden="true" /> Khoảng {l.estimatedMinutes} phút
        dự kiến · {l.exerciseCount} bài tập · {l.currentVersion}
      </p>
      <p>
        {states[l.activityState]} ·{" "}
        {l.reviewStatus === "DRAFT_UNREVIEWED"
          ? "Chưa duyệt chuyên môn"
          : l.reviewStatus === "HUMAN_REVIEWED"
            ? "Có ghi nhận duyệt chuyên môn"
            : l.reviewStatus}{" "}
        ·{" "}
        {l.publicationStatus === "APPROVED"
          ? "Được duyệt phát hành"
          : "Chưa được xuất bản"}{" "}
        ·{" "}
        {l.alignment === "PARTIAL"
          ? "Đối chiếu syllabus một phần"
          : l.alignment === "NOT_APPLICABLE"
            ? "Nội dung nền tảng nội bộ"
            : l.alignment}
        .
      </p>
      <p>
        {l.access.prerequisitesSatisfied
          ? "Đã thỏa điều kiện tiên quyết về bằng chứng; publication vẫn được kiểm tra riêng."
          : "Chưa đủ bằng chứng độc lập để mở khóa đã kiểm chứng."}{" "}
        {l.access.availability === "PRACTICE_ONLY" &&
          "Được luyện nháp tùy chọn ở local; hoàn tất không thay thế mastery."}
      </p>
      <details>
        <summary>Điều kiện tiên quyết và bằng chứng</summary>
        {l.prerequisites.length ? (
          <ul>
            {l.prerequisites.map((r) => (
              <li key={`${r.conceptId}:${r.skill}`}>
                {r.reason} ({r.evidenceCount} evidence hợp lệ)
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Bài đầu tiên không có prerequisite về kỹ năng. Nội dung vẫn chưa
            được duyệt.
          </p>
        )}
        {l.historicalVersions.length > 0 && (
          <p>
            Lịch sử phiên bản cũ được giữ riêng:{" "}
            {l.historicalVersions.join(", ")}; không chuyển thành hoàn tất phiên
            bản hiện tại.
          </p>
        )}
      </details>
      {l.access.mayPractice ? (
        <Link
          className="button primary"
          href={`/learn/draft/${l.key}?version=${encodeURIComponent(l.currentVersion)}`}
        >
          {l.activityState === "IN_PROGRESS"
            ? `Tiếp tục ${l.key}`
            : l.completed
              ? `Luyện lại ${l.key} · draft`
              : `Luyện ${l.key} · draft`}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <p>
          Chưa có hành động học đủ điều kiện. Xem điều kiện hoặc quay lại danh
          mục.
        </p>
      )}
    </article>
  );
}
export function CourseReturnLinks({ lessonId }: { lessonId: string }) {
  const l = outline.lessons.find((l) => l.key === lessonId),
    u = outline.units.find((u) => u.id === l?.unitId),
    c = outline.courses.find((c) => c.id === u?.courseId);
  if (!u || !c) return null;
  return (
    <nav className="course-return" aria-label="Quay lại khóa học">
      <Link className="button secondary" href={courseHref(c.code)}>
        Về khóa {c.title}
      </Link>
      <Link className="button secondary" href={unitHref(c.code, u.slug)}>
        Về unit {u.title}
      </Link>
    </nav>
  );
}
