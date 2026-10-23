"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { contentApi } from "@/modules/content/ui/api";
import { activeWindow, type DurationInput } from "../domain/duration";
export function useActiveDuration(
  sessionId: string | undefined,
  active: boolean,
) {
  const [message, setMessage] = useState(
      "Thời gian chưa có interval được xác nhận.",
    ),
    [acceptedMs, setAccepted] = useState(0),
    [generation, setGeneration] = useState(0);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const flush = useCallback(() => flushRef.current(), []);
  useEffect(() => {
    if (!sessionId || !active) return;
    let disposed = false,
      leaseId = "",
      lastWall = Date.now(),
      lastMono = performance.now(),
      lastInteraction = Date.now(),
      visible = document.visibilityState === "visible" && document.hasFocus();
    let sending: Promise<void> | null = null;
    const pending: DurationInput[] = [],
      clientId = crypto.randomUUID();
    async function drain() {
      if (sending) return sending;
      sending = (async () => {
        while (pending.length && !disposed) {
          const input = pending[0];
          try {
            const ack = await contentApi<{
              acceptedMs: number;
              classification: string;
            }>(`/sessions/${sessionId}/duration`, input);
            pending.shift();
            if (!disposed) {
              setAccepted((old) => old + ack.acceptedMs);
              setMessage(
                ack.classification === "VALIDATED_TELEMETRY"
                  ? "Đã lưu interval quan sát; chưa phải bằng chứng độc lập."
                  : "Interval bị loại hoặc chưa đủ dữ liệu; không cộng thời gian.",
              );
            }
          } catch (e) {
            if (!disposed)
              setMessage(
                `Chưa xác nhận thời gian: ${e instanceof Error ? e.message : "Lỗi mạng"}. Interval chờ được thử lại với cùng event ID.`,
              );
            break;
          }
        }
      })();
      try {
        await sending;
      } finally {
        sending = null;
      }
    }
    function sample() {
      const now = Date.now(),
        mono = performance.now(),
        range = activeWindow(lastWall, now, lastInteraction, visible);
      if (leaseId && range && pending.length < 24) {
        const milliseconds = Math.round(
          Math.min(range.activeMs, mono - lastMono),
        );
        pending.push({
          eventId: crypto.randomUUID(),
          leaseId,
          clientId,
          observedStart: new Date(range.start).toISOString(),
          observedEnd: new Date(range.end).toISOString(),
          lastInteractionAt: new Date(
            Math.min(lastInteraction, range.end),
          ).toISOString(),
          activeMs: Math.max(0, milliseconds),
        });
      }
      lastWall = now;
      lastMono = mono;
    }
    async function flush() {
      sample();
      await drain();
    }
    flushRef.current = flush;
    void contentApi<{ leaseId: string }>(
      `/sessions/${sessionId}/lease`,
      { clientId },
      crypto.randomUUID(),
    )
      .then((result) => {
        if (!disposed) {
          leaseId = result.leaseId;
          lastWall = Date.now();
          lastMono = performance.now();
          lastInteraction = lastWall;
          setMessage(
            "Đang đo khi tab hiện, có focus và có tương tác trong 60 giây.",
          );
        }
      })
      .catch((e) => {
        if (!disposed)
          setMessage(
            `Chưa bắt đầu đo: ${e instanceof Error ? e.message : "Không có lease"}`,
          );
      });
    const interaction = () => {
      // Close the preceding interval before a new interaction resets the idle cap.
      // Otherwise waking after idle would incorrectly count the previous timer tail.
      sample();
      lastInteraction = Date.now();
    };
    const visibility = () => {
      sample();
      visible = document.visibilityState === "visible" && document.hasFocus();
      void drain();
    };
    const timer = window.setInterval(() => {
      void flush();
    }, 5000);
    for (const event of ["pointerdown", "keydown", "scroll"])
      window.addEventListener(event, interaction, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", visibility);
    window.addEventListener("focus", visibility);
    return () => {
      sample();
      void drain();
      disposed = true;
      window.clearInterval(timer);
      for (const event of ["pointerdown", "keydown", "scroll"])
        window.removeEventListener(event, interaction);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", visibility);
      window.removeEventListener("focus", visibility);
      flushRef.current = async () => {};
    };
  }, [sessionId, active, generation]);
  return {
    message,
    acceptedMs,
    flush,
    resume: () => setGeneration((g) => g + 1),
  };
}
