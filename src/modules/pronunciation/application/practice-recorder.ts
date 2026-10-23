import { monitorInput, type InputLevel } from "./input-monitor";
export const MAX_RECORDING_MS = 12000;
export const MAX_RECORDING_BYTES = 2 * 1024 * 1024;
export const CAPTURE_CONSTRAINTS = Object.freeze({
  autoGainControl: false,
  noiseSuppression: false,
  echoCancellation: false,
  channelCount: 1,
});
export type CaptureProcessing = {
  autoGainControl?: boolean;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
};
export type RecorderState =
  | { status: "idle"; message: string }
  | { status: "requesting"; message: string }
  | { status: "recording"; message: string; level?: InputLevel }
  | { status: "stopping"; message: string }
  | {
      status: "ready";
      message: string;
      url: string;
      mimeType: string;
      bytes: number;
      capture?: CaptureProcessing;
    }
  | { status: "error"; message: string };
// Small injectable browser port, used with real MediaRecorder in Chromium and
// deterministic fake ports for cleanup, late permissions and error tests.
export type RecorderEnvironment = {
  secure: () => boolean;
  foreground: () => boolean;
  supported: () => boolean;
  getStream: () => Promise<MediaStream>;
  create: (stream: MediaStream) => MediaRecorder;
  monitor?: (
    stream: MediaStream,
    publish: (level: InputLevel) => void,
  ) => () => void;
  objectUrl: (blob: Blob) => string;
  revoke: (url: string) => void;
  later: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clear: (timer: ReturnType<typeof setTimeout>) => void;
};
export function browserRecorderEnvironment(
  noiseSuppression = false,
): RecorderEnvironment {
  return {
    secure: () => window.isSecureContext,
    foreground: () =>
      document.visibilityState === "visible" && document.hasFocus(),
    supported: () =>
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined",
    getStream: () =>
      navigator.mediaDevices.getUserMedia({
        audio: { ...CAPTURE_CONSTRAINTS, noiseSuppression },
        video: false,
      }),
    create: (stream) => {
      const type = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      return type
        ? new MediaRecorder(stream, { mimeType: type })
        : new MediaRecorder(stream);
    },
    monitor: monitorInput,
    objectUrl: (blob) => URL.createObjectURL(blob),
    revoke: (url) => URL.revokeObjectURL(url),
    later: (fn, ms) => setTimeout(fn, ms),
    clear: (timer) => clearTimeout(timer),
  };
}
export class PracticeRecorder {
  private generation = 0;
  private disposed = false;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string | null = null;
  private recordingBlob: Blob | null = null;
  private capture: CaptureProcessing = {};
  private stopMonitor: (() => void) | null = null;
  private state: RecorderState = {
    status: "idle",
    message: "Chưa bật micro. Bấm Ghi âm để yêu cầu quyền.",
  };
  constructor(
    private env: RecorderEnvironment,
    private changed: (state: RecorderState) => void,
  ) {}
  snapshot() {
    return this.state;
  }
  recording() {
    return this.recordingBlob;
  }
  private emit(state: RecorderState) {
    this.state = state;
    if (!this.disposed) this.changed(state);
  }
  private tracksOff() {
    const stopMonitor = this.stopMonitor;
    this.stopMonitor = null;
    try {
      stopMonitor?.();
    } catch {
      /* A failed meter must not prevent microphone shutdown. */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.timer !== null) this.env.clear(this.timer);
    if (this.stopTimer !== null) this.env.clear(this.stopTimer);
    this.timer = null;
    this.stopTimer = null;
  }
  private revoke() {
    if (this.url) this.env.revoke(this.url);
    this.url = null;
    this.recordingBlob = null;
  }
  private clearCapture() {
    this.generation++;
    this.tracksOff();
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* Tracks already closed. */
        }
      }
    }
  }
  async start() {
    if (
      this.disposed ||
      ["requesting", "recording", "stopping"].includes(this.state.status)
    )
      return;
    this.clearCapture();
    this.revoke();
    if (!this.env.secure())
      return this.emit({
        status: "error",
        message:
          "Micro cần HTTPS hoặc localhost. Địa chỉ HTTP từ điện thoại vào máy tính thường không đủ; bạn vẫn xem được hướng dẫn.",
      });
    if (!this.env.supported())
      return this.emit({
        status: "error",
        message:
          "Trình duyệt này chưa hỗ trợ ghi âm phù hợp. Hướng dẫn và hình vẫn dùng được.",
      });
    if (!this.env.foreground())
      return this.emit({
        status: "error",
        message: "Hãy quay lại tab này rồi bấm Ghi âm. Không ghi âm nền.",
      });
    const generation = this.generation;
    this.emit({
      status: "requesting",
      message: "Đang chờ bạn cho phép micro. Chưa ghi âm.",
    });
    let stream: MediaStream | null = null;
    try {
      stream = await this.env.getStream();
      if (
        this.disposed ||
        generation !== this.generation ||
        !this.env.foreground()
      ) {
        stream.getTracks().forEach((t) => t.stop());
        if (!this.disposed && generation === this.generation)
          this.emit({
            status: "idle",
            message:
              "Đã hủy yêu cầu vì tab không còn ở phía trước. Micro đã tắt.",
          });
        return;
      }
      this.stream = stream;
      const settings = stream.getAudioTracks?.()[0]?.getSettings?.() ?? {};
      // Whitelist flags only: no device IDs, labels or group IDs are retained.
      this.capture = {
        autoGainControl: settings.autoGainControl,
        noiseSuppression: settings.noiseSuppression,
        echoCancellation: settings.echoCancellation,
      };
      const recorder = this.env.create(stream);
      this.recorder = recorder;
      const chunks: Blob[] = [];
      let size = 0;
      recorder.ondataavailable = (event) => {
        if (this.disposed || generation !== this.generation) return;
        size += event.data.size;
        if (size > MAX_RECORDING_BYTES) {
          this.clearCapture();
          this.emit({
            status: "error",
            message:
              "Bản thu vượt giới hạn bộ nhớ 2 MB nên đã bỏ và tắt micro. Thử một âm ngắn hơn.",
          });
          return;
        }
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (generation !== this.generation || this.disposed) return;
        this.clearCapture();
        this.emit({
          status: "error",
          message:
            "Ghi âm gặp lỗi; micro đã tắt và không giữ bản thu. Bạn có thể thử lại.",
        });
      };
      recorder.onstop = () => {
        if (this.disposed || generation !== this.generation) return;
        this.tracksOff();
        this.recorder = null;
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (!size)
          return this.emit({
            status: "error",
            message:
              "Trình duyệt chưa trả dữ liệu âm thanh. Thử ghi lại; chưa có nhận xét về giọng.",
          });
        try {
          const blob = new Blob(chunks, {
            type: recorder.mimeType || chunks[0]?.type || "audio/webm",
          });
          this.url = this.env.objectUrl(blob);
          this.recordingBlob = blob;
          this.emit({
            status: "ready",
            message:
              "Micro đã tắt. Có bản thu tạm để tự nghe; chưa phân tích phát âm.",
            url: this.url,
            mimeType: blob.type,
            bytes: blob.size,
            capture: this.capture,
          });
        } catch {
          this.revoke();
          this.emit({
            status: "error",
            message: "Chưa tạo được bản nghe tạm. Micro đã tắt; thử ghi lại.",
          });
        }
      };
      recorder.start(250);
      this.emit({
        status: "recording",
        message: "Đang ghi một âm/cụm ngắn. Tự dừng sau tối đa 12 giây.",
      });
      try {
        this.stopMonitor =
          this.env.monitor?.(stream, (level) => {
            if (
              generation === this.generation &&
              this.state.status === "recording"
            )
              this.emit({ ...this.state, level });
          }) ?? null;
      } catch {
        /* Meter capability must not break recording. */
      }
      this.timer = this.env.later(() => this.stop(), MAX_RECORDING_MS);
    } catch (error) {
      stream?.getTracks().forEach((t) => t.stop());
      if (this.disposed || generation !== this.generation) return;
      this.clearCapture();
      const name = error instanceof Error ? error.name : "";
      this.emit({
        status: "error",
        message:
          name === "NotAllowedError" || name === "SecurityError"
            ? "Chưa được phép dùng micro. Bạn có thể bật quyền trong trình duyệt rồi thử lại; hướng dẫn vẫn xem được."
            : name === "NotFoundError"
              ? "Không tìm thấy micro. Kết nối thiết bị rồi thử lại; hướng dẫn vẫn dùng được."
              : "Chưa mở được micro hoặc định dạng ghi âm. Đóng ứng dụng đang giữ micro rồi thử lại.",
      });
    }
  }
  stop() {
    if (!this.recorder || this.state.status !== "recording") return;
    const recorder = this.recorder;
    this.emit({
      status: "stopping",
      message: "Đang chốt bản thu trong tab; micro đã tắt.",
    });
    // Stop physical tracks immediately, even if the codec never emits onstop.
    this.tracksOff();
    this.stopTimer = this.env.later(() => {
      this.clearCapture();
      this.emit({
        status: "error",
        message:
          "Trình duyệt chưa chốt được bản thu. Micro đã tắt; thử ghi lại.",
      });
    }, 3000);
    try {
      if (recorder.state !== "inactive") recorder.stop();
    } catch {
      this.clearCapture();
      this.emit({
        status: "error",
        message: "Không chốt được bản thu. Micro đã tắt; hãy thử lại.",
      });
    }
  }
  cancel(message = "Đã bỏ bản thu và tắt micro.") {
    this.clearCapture();
    this.revoke();
    this.emit({ status: "idle", message });
  }
  dispose() {
    this.disposed = true;
    this.clearCapture();
    this.revoke();
  }
}
