"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="empty-state" role="alert">
      <h1>Chưa mở được màn hình</h1>
      <p>
        Đã có lỗi khi hiển thị. Thử lại để giữ trạng thái hiện tại trong tab.
      </p>
      <button className="button primary" onClick={reset}>
        Thử lại
      </button>
      <Link className="text-link" href="/today">
        Về Hôm nay
      </Link>
    </section>
  );
}
