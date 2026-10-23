import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </header>
  );
}
export function DemoNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="demo-notice">
      <span className="badge amber">DEMO</span>
      <p>
        {children ??
          "Dữ liệu thử trong tab này. Chưa lưu lên server; tải lại trang sẽ đặt lại."}
      </p>
    </div>
  );
}
export function ActionLink({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link
      className={secondary ? "button secondary" : "button primary"}
      href={href}
    >
      {children}
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}
export function SectionTitle({
  children,
  href,
  linkLabel,
}: {
  children: ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {href && (
        <Link className="text-link" href={href}>
          {linkLabel ?? "Xem tất cả"}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
export function ChineseText({
  hanzi,
  pinyin,
  className = "",
}: {
  hanzi: string;
  pinyin: string;
  className?: string;
}) {
  return (
    <ruby lang="zh-Hans" className={`chinese ${className}`}>
      {hanzi}
      <rp> (</rp>
      <rt>{pinyin}</rt>
      <rp>)</rp>
    </ruby>
  );
}
