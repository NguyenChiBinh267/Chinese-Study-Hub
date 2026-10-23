"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  House,
  Layers,
  Sprout,
} from "lucide-react";
import type { ReactNode } from "react";
import { LocalModeBar } from "@/modules/learning/ui/local-provider";
import { authenticatedUI } from "@/modules/auth/ui/protected-fetch";

const navigation = [
  { href: "/today", label: "Hôm nay", icon: House },
  { href: "/learn", label: "Học tiếng Trung", icon: BookOpen },
  { href: "/review", label: "Ôn tập", icon: Layers },
  { href: "/progress", label: "Tiến độ", icon: ChartNoAxesCombined },
];
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ownerMode = authenticatedUI();
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Đi đến nội dung
      </a>
      <aside className="sidebar" aria-label="Thanh bên">
        <Link href="/today" className="brand">
          <span className="brand-mark" lang="zh-Hans">
            学
          </span>
          <span>
            Chinese<span className="brand-sub">STUDY HUB</span>
          </span>
        </Link>
        <p className="nav-label">GÓC HỌC TẬP</p>
        <nav aria-label="Điều hướng chính">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname.startsWith(href) ? "page" : undefined}
              className={`nav-item ${pathname.startsWith(href) ? "active" : ""}`}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
              {pathname.startsWith(href) && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sprout size={23} aria-hidden="true" />
            <strong>Mỗi ngày một chút.</strong>
            <p>Từng bước nhỏ tạo nên một hành trình dài.</p>
          </div>
          <Link
            href="/schedule"
            className={`nav-item ${pathname === "/schedule" ? "active" : ""}`}
            aria-current={pathname === "/schedule" ? "page" : undefined}
          >
            <CalendarDays size={20} aria-hidden="true" />
            Lịch học của tôi
          </Link>
          <Link
            href={ownerMode ? "/account" : "/onboarding"}
            className="profile"
          >
            <span className="avatar">B</span>
            <span>
              Người học
              <span className="profile-sub">
                {ownerMode ? "Tài khoản và đăng xuất" : "Không gian thử nghiệm"}
              </span>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            Không gian học tập <span>/</span>{" "}
            <strong>
              {pathname === "/onboarding"
                ? "Bắt đầu"
                : pathname === "/schedule"
                  ? "Lịch học"
                  : (navigation.find((item) => pathname.startsWith(item.href))
                      ?.label ?? "Chinese Study Hub")}
            </strong>
          </span>
          <span className="preview-indicator">
            <i /> {ownerMode ? "OWNER" : "LOCAL PREVIEW"}
          </span>
          <Link
            href={ownerMode ? "/account" : "/onboarding"}
            className="mobile-brand"
            aria-label="学 · Thiết lập hồ sơ"
          >
            学
          </Link>
        </header>
        <main id="main" tabIndex={-1}>
          <LocalModeBar />
          {children}
        </main>
        <footer className="app-footer">
          <span>
            Chinese Study Hub <span className="footer-dot">·</span> Học chậm mà
            chắc.
          </span>
          <span>Local interactive preview · v0.0.1</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Điều hướng di động">
        {navigation.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={pathname.startsWith(href) ? "page" : undefined}
            className={pathname.startsWith(href) ? "active" : ""}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label === "Học tiếng Trung" ? "Học" : label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
