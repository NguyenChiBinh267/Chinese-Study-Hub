import { ACOUSTIC_POLICY as P } from "../domain/acoustic-types";
import type { PreparedUtterance } from "../domain/utterance-playback";
export type PlaybackPreparation =
  | { ok: true; data: PreparedUtterance }
  | { ok: false; reason: string };
export function preparePlayback(blob: Blob, referenceConfirmed: boolean) {
  let worker: Worker | null = null,
    done = false;
  let finish!: (value: PlaybackPreparation) => void;
  const result = new Promise<PlaybackPreparation>((resolve) => {
    finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker?.terminate();
      worker = null;
      resolve(value);
    };
  });
  const cancel = () => finish({ ok: false, reason: "Đã hủy xử lý đoạn đọc." });
  const timer = setTimeout(
    () =>
      finish({
        ok: false,
        reason: "Xử lý quá thời gian. Thử một bản thu ngắn hơn.",
      }),
    P.timeoutMs,
  );
  void (async () => {
    if (!blob.size || blob.size > P.maxEncodedBytes)
      return finish({
        ok: false,
        reason: "Bản thu không hợp lệ hoặc vượt 2 MB.",
      });
    try {
      if (
        typeof OfflineAudioContext === "undefined" ||
        typeof Worker === "undefined"
      )
        return finish({
          ok: false,
          reason:
            "Trình duyệt chưa hỗ trợ xử lý đoạn đọc. Bản gốc vẫn nghe được.",
        });
      const context = new OfflineAudioContext(1, 1, P.sampleRate);
      const bytes = await blob.arrayBuffer();
      if (done) return;
      const audio = await context.decodeAudioData(bytes);
      if (done) return;
      if (
        audio.duration > P.maxAudioSeconds ||
        audio.numberOfChannels > 2 ||
        audio.length > 1200000
      )
        return finish({
          ok: false,
          reason: "Bản thu đã giải mã vượt giới hạn xử lý.",
        });
      const samples = new Float32Array(audio.length);
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        const channel = audio.getChannelData(ch);
        for (let i = 0; i < samples.length; i++)
          samples[i] += channel[i] / audio.numberOfChannels;
      }
      if (done) return;
      worker = new Worker(new URL("./utterance-worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<PlaybackPreparation>) =>
        finish(event.data);
      worker.onerror = (event) => {
        event.preventDefault();
        finish({
          ok: false,
          reason: "Chưa xử lý được đoạn đọc. Có thể thử lại hoặc nghe bản gốc.",
        });
      };
      worker.postMessage(
        { samples, sampleRate: audio.sampleRate, referenceConfirmed },
        [samples.buffer],
      );
    } catch {
      finish({
        ok: false,
        reason: "Chưa giải mã được bản thu. Thử ghi lại; bản gốc vẫn được giữ.",
      });
    }
  })();
  return { result, cancel };
}
