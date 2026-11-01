"use client";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import {
  PracticeRecorder,
  browserRecorderEnvironment,
  type RecorderState,
} from "../application/practice-recorder";
import { pronunciationCopy } from "../domain/feedback";
import { AcousticPractice } from "./acoustic-practice";
import { UtterancePlayback } from "./utterance-playback";
import { usePilot } from "./pilot-context";
import { measurementSummary } from "../domain/pilot";

export function PracticeRecorderPanel({
  targetVersion,
  onShowGuide,
  onShowCorrection,
}: {
  targetVersion: string;
  onShowGuide?: () => void;
  onShowCorrection?: () => void;
}) {
  const [state, setState] = useState<RecorderState>({
    status: "idle",
    message: "Chưa bật micro. Bấm Ghi âm để yêu cầu quyền.",
  });
  const [playing, setPlaying] = useState(false),
    [playError, setPlayError] = useState("");
  const [resetToken, setResetToken] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [listened, setListened] = useState(false),
    [pilotLimit, setPilotLimit] = useState("");
  const pilot = usePilot(),
    pilotAttempt = useRef<number | null>(null);
  const [captureNoise, setCaptureNoise] = useState(!!pilot);
  const pilotView = useSyncExternalStore(
    pilot?.subscribe ?? (() => () => {}),
    pilot?.snapshot ?? (() => null),
    () => null,
  );
  const atLimit =
    !!pilot &&
    (pilotView?.attempts.filter((a) => a.target === targetVersion).length ??
      0) >= 3;
  const controller = useRef<PracticeRecorder | null>(null),
    audio = useRef<HTMLAudioElement | null>(null),
    uid = useId();
  const attachAudio = useCallback((element: HTMLAudioElement | null) => {
    if (!element) audio.current?.pause();
    audio.current = element;
  }, []);
  useEffect(() => {
    const recorder = new PracticeRecorder(
      browserRecorderEnvironment(captureNoise),
      (next) => {
        setState(next);
        setBlob(next.status === "ready" ? recorder.recording() : null);
        const id = pilotAttempt.current;
        if (pilot && id !== null) {
          const row = pilot.snapshot().attempts.find((a) => a.id === id);
          pilot.update(id, {
            recording:
              next.status === "idle" && row?.recording === "ready"
                ? "ready"
                : next.status,
            permission: ["recording", "stopping", "ready"].includes(next.status)
              ? "GRANTED"
              : next.status === "error" && row?.permission !== "GRANTED"
                ? "DENIED_OR_FAILED"
                : (row?.permission ?? "UNKNOWN"),
            peak:
              next.status === "recording" && next.level
                ? Math.max(row?.peak ?? 0, next.level.peak)
                : (row?.peak ?? null),
            noiseSuppressionReported:
              next.status === "ready"
                ? (next.capture?.noiseSuppression ?? null)
                : (row?.noiseSuppressionReported ?? null),
          });
        }
      },
    );
    controller.current = recorder;
    const stopBackground = () => {
      if (document.visibilityState !== "visible") {
        setResetToken((n) => n + 1);
        audio.current?.pause();
        recorder.cancel("Đã tắt micro và bỏ bản thu khi tab chuyển sang nền.");
      }
    };
    const blur = () => {
      if (recorder.snapshot().status === "recording")
        recorder.cancel(
          "Đã tắt micro vì cửa sổ không còn được chọn. Hãy ghi lại khi sẵn sàng.",
        );
      audio.current?.pause();
    };
    const pagehide = () => {
      setResetToken((n) => n + 1);
      audio.current?.pause();
      recorder.cancel("Đã tắt micro khi rời trang.");
    };
    document.addEventListener("visibilitychange", stopBackground);
    window.addEventListener("blur", blur);
    window.addEventListener("pagehide", pagehide);
    return () => {
      document.removeEventListener("visibilitychange", stopBackground);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pagehide", pagehide);
      recorder.dispose();
      controller.current = null;
    };
  }, [pilot, captureNoise]);
  function clear() {
    setResetToken((n) => n + 1);
    audio.current?.pause();
    setPlaying(false);
    setPlayError("");
    controller.current?.cancel();
  }
  function start() {
    if (pilot) {
      const id = pilot.begin(targetVersion, captureNoise);
      if (id === null) {
        setPilotLimit(
          "Đã đủ 3 lượt cho thanh này hoặc mục tiêu chưa hỗ trợ. Chọn thanh khác trong pilot.",
        );
        return;
      }
      pilotAttempt.current = id;
    }
    setListened(false);
    setPilotLimit("");
    audio.current
      ?.closest(".pron-recorder")
      ?.querySelectorAll<HTMLAudioElement>("audio")
      .forEach((element) => element.pause());
    setPlaying(false);
    setPlayError("");
    void controller.current?.start();
  }
  async function play() {
    setPlayError("");
    try {
      await audio.current?.play();
    } catch {
      setPlayError(
        "Trình duyệt chưa phát được bản thu. Thử bấm nghe lại hoặc ghi bằng định dạng khác trong trình duyệt hỗ trợ.",
      );
    }
  }
  return (
    <section
      className="pron-recorder"
      aria-labelledby={`${uid}-title`}
      data-target-version={targetVersion}
      data-recorder-state={state.status}
      data-capture-noise-requested={String(captureNoise)}
    >
      <h3 id={`${uid}-title`}>Thử luyện · ghi một âm ngắn</h3>
      <p>{pronunciationCopy.privacy}</p>
      <p className="field-hint">
        Tối đa 12 giây / 2 MB. Chuyển tab, đổi âm hoặc rời trang sẽ tắt micro và
        bỏ bản thu.
      </p>
      <p className="field-hint">
        Để nghe riêng âm đọc: bấm ghi, im lặng khoảng nửa giây rồi đọc một âm.
        Khử nhiễu khi thu áp dụng cho cả bản nghe và đầu vào đồ thị. App vẫn yêu
        cầu tắt tự tăng âm lượng; thiết bị có thể bỏ qua yêu cầu.
      </p>
      <label className="pron-selfcheck">
        <input
          type="checkbox"
          checked={captureNoise}
          disabled={["requesting", "recording", "stopping"].includes(
            state.status,
          )}
          onChange={(event) => {
            clear();
            setListened(false);
            setCaptureNoise(event.target.checked);
          }}
        />
        Giảm ồn khi thu · trình duyệt xử lý
      </label>
      <p className="field-hint">
        Bật sẵn trong pilot. Đổi lựa chọn sẽ bỏ bản thu và hai đường cũ; cần ghi
        mới. Có thể ảnh hưởng tiếng nhỏ hoặc cao độ; không bảo đảm chỉ giữ giọng
        bạn. Nếu giọng bị mất hoặc méo, tắt để đối chiếu.
      </p>
      {state.status === "ready" && (
        <p className="capture-noise-status" role="status">
          Khử nhiễu khi thu — đã yêu cầu: {captureNoise ? "Bật" : "Tắt"}. Trình
          duyệt báo:{" "}
          {state.capture?.noiseSuppression === true
            ? "Bật"
            : state.capture?.noiseSuppression === false
              ? "Tắt"
              : "Không có thông tin"}
          .
          {captureNoise &&
            state.capture?.noiseSuppression !== true &&
            " Chưa xác nhận khử nhiễu được bật trên bản thu này."}
        </p>
      )}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`pron-record-status ${state.status === "recording" ? "is-recording" : ""}`}
      >
        {state.message}
      </p>
      <div className="pron-actions">
        {pilotLimit && <p role="alert">{pilotLimit}</p>}
        {state.status === "recording" ? (
          <button
            type="button"
            className="button primary"
            onClick={() => controller.current?.stop()}
          >
            <Square size={17} aria-hidden="true" />
            Dừng ghi
          </button>
        ) : state.status === "requesting" || state.status === "stopping" ? (
          <button type="button" className="button secondary" onClick={clear}>
            Hủy yêu cầu / bỏ bản thu
          </button>
        ) : (
          <button
            type="button"
            className="button primary"
            onClick={start}
            disabled={atLimit}
          >
            <Mic size={17} aria-hidden="true" />
            {state.status === "ready"
              ? "Ghi lại · bỏ bản cũ"
              : "Ghi âm · tối đa 12 giây"}
          </button>
        )}
        {state.status === "ready" && (
          <button type="button" className="button secondary" onClick={clear}>
            <Trash2 size={17} aria-hidden="true" />
            Xóa bản thu
          </button>
        )}
      </div>
      {state.status === "ready" && (
        <div className="pron-playback">
          <p>
            <strong>Bản gốc · toàn bộ lần ghi</strong>
          </p>
          <audio
            ref={attachAudio}
            src={state.url}
            controls
            preload="metadata"
            aria-label="Bản thu tạm của bạn"
            onPlay={() => {
              setPlaying(true);
              audio.current
                ?.closest(".pron-recorder")
                ?.querySelectorAll<HTMLAudioElement>("audio")
                .forEach((element) => {
                  if (element !== audio.current) element.pause();
                });
            }}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              setListened(true);
              if (pilot && pilotAttempt.current !== null)
                pilot.update(pilotAttempt.current, { playedToEnd: true });
            }}
            onError={() =>
              setPlayError(
                "Không phát được định dạng này. Xóa hoặc ghi lại bằng trình duyệt hỗ trợ; hướng dẫn vẫn dùng được.",
              )
            }
          />
          <button
            type="button"
            className="button secondary"
            onClick={() => (playing ? audio.current?.pause() : void play())}
          >
            {playing ? "Tạm dừng nghe" : "Nghe bản thu"}
          </button>
          {pilot && (
            <details className="pron-details">
              <summary>Lưu bản gốc để chẩn đoán cục bộ · tùy chọn</summary>
              <p>
                File này có giọng của bạn. Chỉ khi bạn bấm tải, trình duyệt mới
                lưu file về máy; app không gửi audio lên server. Đây là toàn bộ
                bản thu, chưa cắt hoặc lọc nền local. Khử nhiễu khi thu nếu bật
                đã nằm trong bản gốc này. File khác với báo cáo JSON không có
                audio.
              </p>
              <a
                className="button secondary"
                href={state.url}
                download={`csh-pilot-original.${
                  state.mimeType.includes("webm")
                    ? "webm"
                    : state.mimeType.includes("ogg")
                      ? "ogg"
                      : state.mimeType.includes("mp4")
                        ? "m4a"
                        : "bin"
                }`}
              >
                Tải audio gốc về máy
              </a>
              <p className="field-hint">
                Chỉ lưu nếu bạn đồng ý giữ giọng trên máy để chẩn đoán. Không
                dùng nút lưu của “Đoạn đọc đã chọn” để thay cho bản gốc.
              </p>
            </details>
          )}
        </div>
      )}
      {playError && <p role="alert">{playError}</p>}
      {state.status === "recording" && (
        <div className="input-level">
          <label htmlFor={`${uid}-level`}>
            Mức tín hiệu micro · không phải điểm phát âm
          </label>
          <meter
            id={`${uid}-level`}
            min="0"
            max="1"
            value={Math.min(1, state.level?.peak ?? 0)}
          />
          <p role="status">
            {!state.level
              ? "Chưa có số đo mức thu từ trình duyệt."
              : state.level.peak >= 0.98
                ? "Tín hiệu chạm giới hạn; thử giảm mức thu hoặc xa micro một chút."
                : state.level.rms < 0.008
                  ? "Chưa thấy tín hiệu đủ lớn theo ngưỡng thử nghiệm; chưa kết luận micro hỏng."
                  : "Có tín hiệu âm thanh. App chưa xác minh đây là giọng nói."}
          </p>
        </div>
      )}
      {atLimit && (
        <p className="field-hint">
          Đã ghi đủ 3 lượt của mục tiêu này trong pilot. Hoàn tất form rồi chọn
          thanh tiếp theo.
        </p>
      )}
      {blob && <UtterancePlayback blob={blob} />}
      {state.status === "ready" && (
        <details className="pron-details">
          <summary>Thiết lập thu mà trình duyệt báo lại</summary>
          <p>
            App yêu cầu tắt tự tăng âm lượng (AGC), tắt khử vọng (AEC) và đặt
            khử nhiễu (NS) theo lựa chọn trước lúc ghi. Bản gốc là bản trình
            duyệt thu được, có thể đã qua NS. Trạng thái trình duyệt báo:
          </p>
          <ul>
            {(
              [
                "autoGainControl",
                "noiseSuppression",
                "echoCancellation",
              ] as const
            ).map((name) => (
              <li key={name}>
                {name}:{" "}
                {state.capture?.[name] === false
                  ? "Tắt"
                  : state.capture?.[name] === true
                    ? "Vẫn bật"
                    : "Không có thông tin"}
                .
              </li>
            ))}
          </ul>
          <p>
            Thông tin này không xác minh được các hiệu ứng riêng của driver hoặc
            micro. Nếu bản thu đã bị hạ mức hoặc méo ở thiết bị, bộ lọc sau thu
            không thể khôi phục đầy đủ.
          </p>
        </details>
      )}
      <AcousticPractice
        blob={blob}
        targetVersion={targetVersion}
        resetToken={resetToken}
        onRetry={start}
        onListen={() => void play()}
        onShowGuide={onShowGuide}
        onShowCorrection={onShowCorrection}
        listenRequired={!!pilot && !listened}
        retryDisabled={atLimit}
        onMeasured={(result) => {
          if (pilot && pilotAttempt.current !== null)
            pilot.update(pilotAttempt.current, {
              measurement: measurementSummary(result),
            });
        }}
      />
      <p className="pron-muted">
        Chưa có giọng mẫu được cấp quyền và duyệt để phát đối chiếu. Bản thu của
        bạn không phải giọng mẫu. Không dùng TTS hoặc nhận dạng lời nói trong
        tính năng này.
      </p>
    </section>
  );
}
