import { ActionLink } from "@/components/ui";
export default function NotFound() {
  return (
    <section className="empty-state">
      <span className="eyebrow">404 · LẠC ĐƯỜNG MỘT CHÚT</span>
      <h1>Trang này chưa có</h1>
      <p>Quay về góc học tập để tiếp tục.</p>
      <ActionLink href="/today">Về Hôm nay</ActionLink>
    </section>
  );
}
