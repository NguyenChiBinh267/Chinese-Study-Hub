import {
  excerptWav,
  type PreparedUtterance,
  type UtteranceRange,
} from "../domain/utterance-playback";
import { preparePlayback } from "./prepare-playback";
type View = {
  phase: "idle" | "processing" | "ready" | "error";
  message: string;
  data: PreparedUtterance | null;
  url: string | null;
  range: UtteranceRange | null;
  filtered: boolean;
};
export class UtteranceSession {
  private view: View = {
    phase: "idle",
    message: "",
    data: null,
    url: null,
    range: null,
    filtered: false,
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private job: ReturnType<typeof preparePlayback> | null = null;
  constructor(
    private prepare = preparePlayback,
    private urls = {
      create: (blob: Blob) => URL.createObjectURL(blob),
      revoke: (url: string) => URL.revokeObjectURL(url),
    },
  ) {}
  snapshot = () => this.view;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private publish(view: View) {
    this.view = view;
    for (const fn of this.listeners) fn();
  }
  clear = () => {
    this.generation++;
    this.job?.cancel();
    this.job = null;
    if (this.view.url) this.urls.revoke(this.view.url);
    this.publish({
      phase: "idle",
      message: "",
      data: null,
      url: null,
      range: null,
      filtered: false,
    });
  };
  run = (blob: Blob, reference: boolean) => {
    this.clear();
    const generation = this.generation;
    this.publish({
      ...this.view,
      phase: "processing",
      message: "Đang tìm đoạn có tiếng và chuẩn bị bản nghe trong tab…",
    });
    this.job = this.prepare(blob, reference);
    void this.job.result.then((result) => {
      if (generation !== this.generation) return;
      this.job = null;
      if (!result.ok)
        return this.publish({
          ...this.view,
          phase: "error",
          message: result.reason,
        });
      this.publish({
        ...this.view,
        phase: "ready",
        data: result.data,
        message: result.data.suggested
          ? "Đã đề xuất một đoạn theo âm lượng. Nghe và chỉnh lại nếu cắt thiếu âm."
          : "Chưa tìm được một đoạn duy nhất. Chọn điểm bắt đầu và kết thúc để giữ đúng âm bạn đọc.",
      });
      if (result.data.suggested)
        this.build(
          result.data.suggested,
          result.data.noise.status === "APPLIED",
        );
    });
  };
  build = (range: UtteranceRange, filtered: boolean) => {
    if (!this.view.data) return;
    // Invalidate any previous excerpt before validation; never play stale bounds.
    if (this.view.url) this.urls.revoke(this.view.url);
    this.publish({ ...this.view, url: null, range: null });
    try {
      const wav = excerptWav(this.view.data!, range, filtered);
      const url = this.urls.create(new Blob([wav], { type: "audio/wav" }));
      this.publish({
        ...this.view,
        url,
        range,
        filtered,
        message:
          "Đã tạo bản nghe cho đoạn đã chọn. Bản gốc vẫn được giữ để đối chiếu.",
      });
    } catch (error) {
      this.publish({
        ...this.view,
        message:
          error instanceof Error ? error.message : "Chưa tạo được bản nghe.",
      });
    }
  };
  discardExcerpt = () => {
    if (this.view.url) this.urls.revoke(this.view.url);
    this.publish({ ...this.view, url: null, range: null });
  };
  dispose = () => {
    this.clear();
    this.listeners.clear();
  };
}
