"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/ui";
import { localRequest } from "@/modules/content/ui/api";
import { FoundationPlayer } from "@/modules/content/ui/foundation";
import { LocalReview } from "@/modules/review/ui/local-review";
import { StudySchedule } from "@/modules/planning/ui/study-schedule";
import { useLocal } from "@/modules/learning/ui/local-provider";
import type { CurriculumSnapshot } from "@/modules/curriculum/domain/snapshot";
import type { StudySnapshot } from "@/modules/planning/domain/study-types";
import { PronunciationCoach } from "@/modules/pronunciation/ui/coach";
import { useSearchParams } from "next/navigation";
export function PublishedStudy({ path }: { path: string }) {
  return (
    <div className="published-study">
      <PublishedContent path={path} />
    </div>
  );
}
function PublishedContent({ path }: { path: string }) {
  const local = useLocal(),
    [catalog, setCatalog] = useState<CurriculumSnapshot | null>(null),
    [technical, setTechnical] = useState(false),
    [privatePreview, setPrivatePreview] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [study, setStudy] = useState<StudySnapshot | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all([
      localRequest<CurriculumSnapshot>("curriculum"),
      localRequest<{ technical: boolean; privateOwnerPreview?: boolean }>(
        "release",
      ),
      localRequest<StudySnapshot>("study/today"),
    ])
      .then(([c, r, s]) => {
        if (alive) {
          setCatalog(c);
          setTechnical(r.technical);
          setPrivatePreview(r.privateOwnerPreview === true);
          setStudy(s);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [retry, local.data?.progress.attempts, path]);
  if (error)
    return (
      <section className="panel" role="alert">
        <h1>Chưa mở được bản phát hành</h1>
        <p>{error}</p>
        <p>
          Lịch sử được giữ. Không bắt đầu bài khi chưa xác nhận tính hợp lệ.
        </p>
        <button
          className="button secondary"
          onClick={() => setRetry((n) => n + 1)}
        >
          Thử tải lại
        </button>
      </section>
    );
  if (!catalog)
    return <p role="status">Đang kiểm tra bản phát hành và lịch đã lưu…</p>;
  const prefix = path.split("/"),
    course =
      prefix[2] === "courses"
        ? catalog.courses.find((c) => c.code === prefix[3])
        : null,
    unit =
      prefix[4] === "units"
        ? catalog.units.find(
            (u) => u.slug === prefix[5] && u.courseId === course?.id,
          )
        : null,
    requested = path.startsWith("/learn/released/")
      ? decodeURIComponent(prefix[3])
      : null,
    lesson = requested
      ? catalog.lessons.find(
          (l) =>
            l.currentVersion === requested ||
            l.historicalVersions.includes(requested),
        )
      : null;
  const banner = privatePreview ? (
    <p className="notice">
      <strong>PRIVATE_OWNER_PREVIEW · DRAFT · AI-reviewed</strong> · Chưa có
      qualified human approval. Chỉ luyện tập tự chọn; không tự tạo verified
      mastery hoặc mở khóa. TTS tổng hợp chưa duyệt. Chỉ chủ tài khoản được
      luyện bốn phiên bản nháp đã chọn.
    </p>
  ) : technical ? (
    <p className="notice">
      <strong>KIỂM THỬ TỔNG HỢP · CHỈ LOCAL</strong> · Review/audio tổng hợp chỉ
      chứng minh pipeline; không phải F01/F02/L001/L002 được duyệt.
    </p>
  ) : (
    <p className="notice">
      Chỉ hiển thị phạm vi thuộc bản phát hành được chọn. Chưa có chứng nhận
      hoàn thành HSK.
    </p>
  );
  if (path === "/learn/pronunciation" && privatePreview)
    return (
      <>
        {banner}
        <PrivatePronunciation />
      </>
    );
  if (path === "/schedule" || path === "/onboarding")
    return (
      <>
        {banner}
        <StudySchedule />
      </>
    );
  if (path === "/review")
    return (
      <>
        {banner}
        <LocalReview technicalOnly={technical} />
      </>
    );
  if (requested)
    return (
      <>
        {banner}
        {lesson?.access.mayPractice ? (
          <FoundationPlayer
            key={requested}
            lessonId={lesson.key}
            versionId={requested}
            allowStart={lesson.currentVersion === requested}
            published
            privatePreview={privatePreview}
          />
        ) : (
          <section className="panel empty-state">
            <h1>Phiên bản chưa khả dụng</h1>
            <p>Bài không thuộc phạm vi được mở hoặc chưa đạt điều kiện học.</p>
            <Link href="/learn">Về khóa học</Link>
          </section>
        )}
      </>
    );
  if (path === "/progress")
    return (
      <>
        {banner}
        <PageHeading
          eyebrow="DỮ LIỆU ĐÃ LƯU"
          title="Tiến độ của bạn"
          description={
            privatePreview
              ? "Kết quả luyện DRAFT lưu trong PostgreSQL; không phải mastery được xác minh."
              : "Kết quả thực trong PostgreSQL; phạm vi dưới đây chỉ gồm bài được phát hành."
          }
        />
        <section className="panel">
          <p>
            {local.data?.progress.attempts ?? 0} lượt trả lời ·{" "}
            {local.data?.learning.reviews ?? 0} lượt ôn.
          </p>
          <p>
            {catalog.lessons.filter((l) => l.completed).length}/
            {catalog.lessons.length} bài trong phạm vi hiện tại đã luyện xong;
            không phải hoàn thành cấp HSK.
          </p>
          <p>Không tự trao mastery từ lượt luyện hoặc tự đánh giá FSRS.</p>
        </section>
      </>
    );
  if (!path.startsWith("/learn")) {
    const action = study?.plan?.action,
      next =
        action?.kind === "review" && !local.data?.learning.dueCount
          ? null
          : action,
      p = catalog.lessons.find(
        (l) =>
          l.currentVersion === next?.target ||
          l.historicalVersions.includes(next?.target ?? ""),
      );
    return (
      <>
        {banner}
        <PageHeading
          eyebrow="HÔM NAY"
          title="Chào bạn, đến giờ học rồi."
          description={
            privatePreview
              ? "Bốn bài DRAFT đã chọn: luyện tự chọn, chưa xác nhận điều kiện học chính thức."
              : "Nhiệm vụ chỉ lấy từ phạm vi đã phát hành và điều kiện học thực."
          }
        />
        <section className="panel">
          <h2>
            {study?.configured
              ? "Lịch học của bạn đã được lưu"
              : "Thiết lập quỹ giờ trước khi học"}
          </h2>
          <p>
            {study?.settings.preferences.weeklyHours ?? 0} giờ/tuần ·{" "}
            {local.data?.learning.dueCount ?? 0} thẻ đến hạn.
            {study?.plan &&
              ` Còn ${Math.round(study.plan.remainingMinutes)} phút trong quỹ tuần.`}
          </p>
          <Link
            className="button primary"
            href={
              !study?.configured
                ? "/schedule"
                : next?.kind === "review"
                  ? "/review"
                  : p
                    ? `/learn/released/${next!.target}`
                    : "/learn"
            }
          >
            {!study?.configured
              ? "Thiết lập lịch học"
              : next?.kind === "review"
                ? "Ôn thẻ đến hạn"
                : p
                  ? `Tiếp tục ${p.key}`
                  : privatePreview
                    ? "Chọn bài nháp preview"
                    : "Chọn bài được phát hành"}
          </Link>
          <Link className="text-link" href="/schedule">
            Chỉnh lịch học
          </Link>
        </section>
        <Link href="/learn" className="text-link">
          Khóa học
        </Link>
      </>
    );
  }
  const lessons = catalog.lessons.filter(
    (l) =>
      (!course || l.courseCode === course.code) &&
      (!unit || l.unitId === unit.id),
  );
  return (
    <>
      {banner}
      <PageHeading
        eyebrow={privatePreview ? "PREVIEW RIÊNG TƯ · DRAFT" : "BẢN PHÁT HÀNH"}
        title={unit?.title ?? course?.title ?? "Khóa học của bạn"}
        description={
          privatePreview
            ? "Chỉ bốn phiên bản nháp đã chọn; AI đối chiếu tài liệu, chưa có người duyệt."
            : "Hiển thị số bài thực có; cấp chưa phát hành không có nút bắt đầu."
        }
      />
      {!course ? (
        <div className="lesson-grid">
          {catalog.courses.map((c) => (
            <section className="panel" key={c.id}>
              <h2>{c.title}</h2>
              <p>
                {c.totalLessons} bài trong phạm vi · {c.completed} bài đã luyện
                xong.
              </p>
              {c.totalLessons ? (
                <Link
                  className="button secondary"
                  href={`/learn/courses/${c.code}`}
                >
                  Mở {c.code}
                </Link>
              ) : (
                <p>
                  Chưa có bài được phát hành. Bạn có thể chọn khóa đang có bài.
                </p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <>
          <Link href="/learn" className="text-link">
            Tất cả khóa học
          </Link>
          {!unit &&
            catalog.units
              .filter(
                (u) =>
                  u.courseId === course.id &&
                  lessons.some((l) => l.unitId === u.id),
              )
              .map((u) => (
                <p key={u.id}>
                  <Link href={`/learn/courses/${course.code}/units/${u.slug}`}>
                    {u.title}
                  </Link>
                </p>
              ))}
          {!lessons.length && (
            <p className="notice">Khóa/unit chưa có bài được phát hành.</p>
          )}
          {lessons.map((l) => (
            <section className="panel space-top" key={l.currentVersion}>
              <h2>
                {l.key} · {l.title}
              </h2>
              <p>
                {l.estimatedMinutes} phút ·{" "}
                {l.completed ? "Đã luyện xong" : "Chưa hoàn tất"}
              </p>
              {l.access.mayPractice ? (
                <Link
                  className="button primary"
                  href={`/learn/released/${l.currentVersion}`}
                >
                  Học {l.key}
                </Link>
              ) : (
                <p>
                  Chưa đạt điều kiện tiên quyết. Tiếp tục các bài nền tảng được
                  mở.
                </p>
              )}
            </section>
          ))}
        </>
      )}
    </>
  );
}
function PrivatePronunciation() {
  const params = useSearchParams();
  return (
    <PronunciationCoach
      initialTarget={params.get("target") ?? undefined}
      pilot={params.get("pilot") === "1"}
    />
  );
}
