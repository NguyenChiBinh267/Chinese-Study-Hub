"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocal, LocalStatus } from "@/modules/learning/ui/local-provider";
export function HomeEntry() {
  const local = useLocal(),
    router = useRouter();
  useEffect(() => {
    if (local.initialized && local.status === "ready")
      router.replace(
        local.mode === "local" && local.data?.settings
          ? "/today"
          : "/onboarding",
      );
  }, [
    local.initialized,
    local.status,
    local.mode,
    local.data?.settings,
    router,
  ]);
  if (local.status === "error") return <LocalStatus />;
  return (
    <section className="panel">
      <h1>Chinese Study Hub</h1>
      <p role="status">Đang mở hành trình học của bạn…</p>
    </section>
  );
}
