import type { Metadata } from "next";
import { appMode } from "@/modules/auth/server/config";
import { AuthRuntime } from "@/modules/auth/ui/runtime";
import { LocalProvider } from "@/modules/learning/ui/local-provider";
import { PreviewProvider } from "@/modules/preview/ui/preview-provider";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Chinese Study Hub · Preview riêng tư",
    template: "%s · Chinese Study Hub",
  },
  description:
    "Không gian học tiếng Trung riêng tư. Học liệu DRAFT chưa được duyệt chuyên môn.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const mode = appMode();
  return (
    <html
      lang="vi"
      data-app-mode={mode}
      data-auth-environment={
        process.env.NODE_ENV === "development" ? "local" : "production"
      }
    >
      <body>
        {mode === "PRODUCTION_AUTHENTICATED" ? (
          <AuthRuntime mode={mode}>{children}</AuthRuntime>
        ) : (
          <LocalProvider>
            <PreviewProvider>
              <AppShell>{children}</AppShell>
            </PreviewProvider>
          </LocalProvider>
        )}
      </body>
    </html>
  );
}
