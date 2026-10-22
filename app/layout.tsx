import type { ReactNode } from "react";
export const metadata = {
  title: "Chinese Study Hub · Cloud gate proof",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body
        style={{
          fontFamily: "system-ui",
          maxWidth: 620,
          margin: "40px auto",
          padding: 20,
        }}
      >
        {children}
      </body>
    </html>
  );
}
