"use client";
import Link from "next/link";
import { PageHeading } from "@/components/ui";
import { LocalLessonPlayer } from "@/modules/learning/ui/local-slice";
import { LocalReview } from "@/modules/review/ui/local-review";
import { useLocal } from "@/modules/learning/ui/local-provider";

export function TechnicalCourse({ path }: { path: string }) {
  const local = useLocal();
  const base = "/learn/courses/TECHNICAL";
  let content;
  if (path === "/learn/local-foundation-v1") content = <LocalLessonPlayer />;
  else if (path === "/review") content = <LocalReview technicalOnly />;
  else if (path === base + "/units/storage")
    content = (
      <>
        <h1>Unit · lưu kết quả</h1>
        <Link className="button primary" href="/learn/local-foundation-v1">
          Mở bài kiểm tra chuỗi ký tự
        </Link>
      </>
    );
  else if (path === base)
    content = (
      <>
        <h1>Khóa kỹ thuật · không phải khóa HSK</h1>
        <Link className="button primary" href={base + "/units/storage"}>
          Mở unit lưu kết quả
        </Link>
      </>
    );
  else if (path === "/learn")
    content = (
      <>
        <h1>Khóa kiểm thử riêng</h1>
        <Link className="button primary" href={base}>
          Mở khóa kỹ thuật
        </Link>
      </>
    );
  else if (path === "/today" || path === "/")
    content = (
      <>
        <PageHeading
          eyebrow="HÔM NAY · KIỂM THỬ"
          title="Kiểm tra luồng học đã xác thực"
          description="Lịch, câu trả lời và lượt ôn được lưu vào database kiểm thử riêng."
        />
        <p>
          {local.data?.settings
            ? `${local.data.settings.preferences.weeklyHours} giờ/tuần đã lưu.`
            : "Thiết lập lịch trước khi thử bài."}
        </p>
        <Link className="button secondary" href="/schedule">
          Chỉnh lịch học
        </Link>
        <Link
          className="button primary"
          href={local.data?.learning.dueCount ? "/review" : "/learn"}
        >
          {local.data?.learning.dueCount
            ? "Ôn thẻ kỹ thuật đến hạn"
            : "Tiếp tục đến khóa kiểm thử"}
        </Link>
        <Link className="text-link" href="/progress">
          Xem tiến độ
        </Link>
      </>
    );
  else return null;
  return (
    <>
      <p className="notice" role="note">
        FIXTURE KỸ THUẬT · database riêng · Auth thật. Hai câu kiểm tra chuỗi ký
        tự tự soạn, chỉ dùng xác minh phần mềm. Không có duyệt chuyên môn tiếng
        Trung, không xuất bản học liệu và không tạo mastery độc lập.
      </p>
      <section className="panel">{content}</section>
    </>
  );
}
