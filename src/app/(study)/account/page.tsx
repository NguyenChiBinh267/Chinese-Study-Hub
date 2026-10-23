import Link from "next/link";
export default function Account() {
  return (
    <section className="panel">
      <h1>Tài khoản owner</h1>
      <p>
        Chế độ hiện tại dùng DEMO hoặc danh tính development local. Đăng nhập
        owner cần cấu hình riêng.
      </p>
      <Link href="/login" className="button secondary">
        Trang đăng nhập
      </Link>
    </section>
  );
}
