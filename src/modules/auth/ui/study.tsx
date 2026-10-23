"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeading } from "@/components/ui";
import { StudySchedule } from "@/modules/planning/ui/study-schedule";
import { useLocal, LocalStatus } from "@/modules/learning/ui/local-provider";
import { protectedFetch } from "./protected-fetch";
import { AccountSettings } from "./account";
import { TechnicalCourse } from "./technical-course";
import { PublishedStudy } from "./published-study";
export function OwnerStudy() {
  const path = usePathname(),
    local = useLocal();
  // Preserve player cursor/feedback while a successful mutation refreshes its
  // snapshot. AuthRuntime still unmounts all private UI when identity is lost.
  if (path === "/account") return <AccountSettings />;
  if (local.status === "error" || !local.data) return <LocalStatus />;
  if (local.publishedContent || local.privateOwnerPreview)
    return <PublishedStudy path={path} />;
  if (path === "/schedule" || path === "/onboarding")
    return (
      <>
        <p className="notice">
          Lịch được lưu theo tài khoản. Chưa có bài đã duyệt nên chưa xếp nhiệm
          vụ học.
        </p>
        <StudySchedule />
      </>
    );
  if (path === "/progress") return <OwnerProgress />;
  if (
    local.technicalFixture &&
    [
      "/",
      "/today",
      "/learn",
      "/learn/courses/TECHNICAL",
      "/learn/courses/TECHNICAL/units/storage",
      "/learn/local-foundation-v1",
      "/review",
    ].includes(path)
  )
    return <TechnicalCourse path={path} />;
  if (path.startsWith("/learn") || path.startsWith("/review"))
    return <ContentLocked />;
  return (
    <>
      <PageHeading
        eyebrow="HÔM NAY · OWNER"
        title="Chào bạn, đến giờ học rồi."
        description="Phiên được xác nhận bởi dịch vụ đăng nhập. Lịch học được lưu theo tài khoản này."
      />
      <section className="panel">
        <h2>
          {local.data?.settings
            ? "Lịch học của bạn đã được lưu"
            : "Bắt đầu bằng một quỹ giờ vừa sức"}
        </h2>
        <p>
          {local.data?.settings
            ? `${local.data.settings.preferences.weeklyHours} giờ/tuần · ${local.data.settings.preferences.days.length} ngày rảnh.`
            : "Chọn giờ học và ngày rảnh để chuẩn bị buổi học đầu tiên."}
        </p>
        <Link className="button primary" href="/schedule">
          {local.data?.settings ? "Chỉnh lịch học" : "Thiết lập lịch học"}
        </Link>
      </section>
      <ContentLocked />
      <Link className="text-link" href="/account">
        Tài khoản và đăng xuất
      </Link>
    </>
  );
}
function ContentLocked() {
  return (
    <section className="panel empty-state space-top">
      <span className="badge neutral">CHƯA PHÁT HÀNH HỌC LIỆU</span>
      <h2>Chưa có bài được duyệt để học online.</h2>
      <p>
        Bốn bài, hướng dẫn phát âm, hình minh họa và đáp án vẫn chờ duyệt. Chưa
        mở bài, chấm bài hoặc ôn thẻ DRAFT trong chế độ này.
      </p>
      <p className="field-hint">
        Bản luyện local được giữ riêng. Đăng nhập không tự chuyển dữ liệu
        development sang tài khoản owner.
      </p>
      <Link className="button secondary" href="/today">
        Về Hôm nay
      </Link>
    </section>
  );
}
function OwnerProgress() {
  const [data, setData] = useState<{
      attempts: number;
      reviews: number;
      storedCards: number;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void protectedFetch("/api/v1/progress")
      .then(async (r) => {
        if (!r.ok) throw new Error("Chưa tải được tiến độ.");
        return r.json();
      })
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <>
      <PageHeading
        eyebrow="DỮ LIỆU TÀI KHOẢN"
        title="Tiến độ đã lưu"
        description="Số liệu từ PostgreSQL của đúng tài khoản đã xác thực; không phải số liệu DEMO."
      />
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Đang tải…</p>
      ) : (
        <section className="panel">
          <h2>
            {data.attempts === 0 && data.reviews === 0
              ? "Chưa có kết quả học đã lưu"
              : "Lịch sử đã lưu"}
          </h2>
          <p>
            {data.attempts} lượt trả lời · {data.reviews} lượt ôn ·{" "}
            {data.storedCards} thẻ trong dữ liệu.
          </p>
          <p>
            Kết quả luyện chưa duyệt không được coi là bằng chứng mastery độc
            lập. Chưa có đánh giá phát âm được hiệu chuẩn.
          </p>
        </section>
      )}
      <ContentLocked />
    </>
  );
}
