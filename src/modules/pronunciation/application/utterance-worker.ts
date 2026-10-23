import { prepareUtterance } from "../domain/utterance-playback";
self.onmessage = (
  event: MessageEvent<{
    samples: Float32Array;
    sampleRate: number;
    referenceConfirmed: boolean;
  }>,
) => {
  try {
    const { samples, sampleRate, referenceConfirmed } = event.data;
    const data = prepareUtterance(samples, sampleRate, referenceConfirmed);
    if (!data) throw new Error("CANCELLED");
    const transfers = [
      ...new Set([data.raw.buffer, data.filtered.buffer]),
    ] as ArrayBuffer[];
    self.postMessage({ ok: true, data }, { transfer: transfers });
  } catch {
    self.postMessage({
      ok: false,
      reason: "Chưa xử lý được bản thu này. Thử ghi lại một âm ngắn.",
    });
  }
};
