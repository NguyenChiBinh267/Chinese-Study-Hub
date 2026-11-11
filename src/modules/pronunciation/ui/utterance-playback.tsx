"use client";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { UtteranceSession } from "../application/utterance-session";
import {
  UTTERANCE_POLICY,
  type PreparedUtterance,
} from "../domain/utterance-playback";

export function UtterancePlayback({ blob }: { blob: Blob }) {
  const [session] = useState(() => new UtteranceSession());
  const [reference, setReference] = useState(false);
  const state = useSyncExternalStore(
    session.subscribe,
    session.snapshot,
    session.snapshot,
  );
  useEffect(() => {
    const background = () => {
      if (document.visibilityState !== "visible") session.clear();
    };
    document.addEventListener("visibilitychange", background);
    return () => {
      document.removeEventListener("visibilitychange", background);
      session.dispose();
    };
  }, [session]);
  return (
    <section
      className="utterance-preview"
      aria-label="Nghe riêng đoạn đọc"
      data-utterance-phase={state.phase}
    >
      <h4>Nghe riêng đoạn đọc</h4>
      <p>
        Cắt bỏ tiếng nền trước/sau âm đọc; có thể giảm nền đều trong đoạn giữ
        lại. Không tự nhận diện giọng bạn hoặc tách được người khác đang nói
        xen.
      </p>
      <label className="pron-selfcheck">
        <input
          type="checkbox"
          checked={reference}
          onChange={(e) => {
            session.clear();
            setReference(e.target.checked);
          }}
        />
        Tôi đã im lặng nửa giây đầu để lấy mẫu tiếng nền
      </label>
      <p className="field-hint">
        Muốn dùng lọc nền, ghi bản mới: bấm ghi, im lặng nửa giây rồi đọc một
        âm. Nếu đã đọc ngay, bỏ chọn và tự chỉnh đoạn cần nghe.
      </p>
      <button
        type="button"
        className="button secondary"
        onClick={() =>
          state.phase === "processing"
            ? session.clear()
            : session.run(blob, reference)
        }
      >
        {state.phase === "processing" ? "Hủy tách đoạn" : "Tách đoạn đọc"}
      </button>
      <p role="status" aria-live="polite">
        {state.message}
      </p>
      {state.data && <PreparedPlayback data={state.data} session={session} />}
      <p className="field-hint">
        Bản gốc ở phía trên vẫn giữ nguyên. Đoạn nghe này chỉ để tự đối chiếu;
        phần cao độ bên dưới vẫn phân tích bản thu gốc với tùy chọn riêng.
      </p>
      <details className="pron-details">
        <summary>Thông tin xử lý đoạn nghe</summary>
        <p>
          {UTTERANCE_POLICY}. Chỉ xử lý trong tab, không upload hoặc lưu lại.
          Không nén động hay tự tăng âm lượng; có làm mềm mép cắt 5 ms.
        </p>
        <p>
          Đề xuất điểm cắt dựa trên âm lượng, có thể cắt thiếu tiếng nhỏ, bỏ sót
          hơi bật hoặc chọn nhầm tiếng khác. Hãy nghe và chỉnh lại; đây không
          phải nhận dạng lời nói.
        </p>
      </details>
    </section>
  );
}

function PreparedPlayback({
  data,
  session,
}: {
  data: PreparedUtterance;
  session: UtteranceSession;
}) {
  const duration = data.raw.length / data.sampleRate;
  const [start, setStart] = useState(data.suggested?.start ?? 0);
  const [end, setEnd] = useState(
    data.suggested?.end ?? Math.min(duration, 1.5),
  );
  const [filtered, setFiltered] = useState(data.noise.status === "APPLIED");
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null),
    uid = useId();
  const attachAudio = useCallback((node: HTMLAudioElement | null) => {
    if (!node) audio.current?.pause();
    audio.current = node;
  }, []);
  const state = useSyncExternalStore(
    session.subscribe,
    session.snapshot,
    session.snapshot,
  );
  useEffect(() => {
    const pause = () => audio.current?.pause();
    window.addEventListener("blur", pause);
    return () => {
      window.removeEventListener("blur", pause);
    };
  }, []);
  function invalidate() {
    audio.current?.pause();
    session.discardExcerpt();
    setError("");
  }
  const count = 120,
    peaks = Array.from({ length: count }, (_, index) => {
      const from = Math.floor((index * data.raw.length) / count),
        to = Math.floor(((index + 1) * data.raw.length) / count);
      let peak = 0;
      for (let i = from; i < to; i++)
        peak = Math.max(peak, Math.abs(data.raw[i]));
      return peak;
    });
  const peak = Math.max(0.001, ...peaks);
  const displayStart = Number.isFinite(start)
    ? Math.max(0, Math.min(duration, start))
    : 0;
  const displayEnd = Number.isFinite(end)
    ? Math.max(displayStart, Math.min(duration, end))
    : displayStart;
  return (
    <div className="utterance-editor" data-playback-noise={data.noise.status}>
      <p>
        {data.suggested
          ? "Đoạn đề xuất dựa trên âm lượng; cần bạn nghe kiểm tra."
          : "Chưa có đoạn đề xuất đủ rõ; hãy chọn đoạn bạn muốn nghe."}
      </p>
      <svg viewBox="0 0 420 90" role="img" aria-labelledby={`${uid}-wave`}>
        <title id={`${uid}-wave`}>
          Biên độ bản thu gốc; vùng tô là đoạn đang chọn, không xác minh ai nói.
        </title>
        <rect
          x={(displayStart / duration) * 420}
          y="0"
          width={((displayEnd - displayStart) / duration) * 420}
          height="90"
          fill="#d8e6d1"
        />
        {peaks.map((value, i) => (
          <line
            key={i}
            x1={(i / count) * 420}
            x2={(i / count) * 420}
            y1={45 - (value / peak) * 40}
            y2={45 + (value / peak) * 40}
            stroke="#315b48"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="utterance-bounds">
        <label>
          Đầu đoạn (giây)
          <input
            type="number"
            min="0"
            max={duration}
            step="0.01"
            value={Number.isNaN(start) ? "" : start}
            onChange={(e) => {
              invalidate();
              setStart(e.target.valueAsNumber);
            }}
          />
        </label>
        <label>
          Cuối đoạn (giây)
          <input
            type="number"
            min="0"
            max={duration}
            step="0.01"
            value={Number.isNaN(end) ? "" : end}
            onChange={(e) => {
              invalidate();
              setEnd(e.target.valueAsNumber);
            }}
          />
        </label>
      </div>
      <p className="field-hint">
        Bản gốc {duration.toFixed(2)} giây. Giữ đoạn từ 0,15 đến 3,5 giây; chừa
        một chút trước/sau để tránh cắt mất đầu hoặc đuôi âm.
      </p>
      {data.noise.status === "APPLIED" ? (
        <label className="pron-selfcheck">
          <input
            type="checkbox"
            checked={filtered}
            onChange={(e) => {
              invalidate();
              setFiltered(e.target.checked);
            }}
          />
          Giảm tiếng nền trong đoạn chọn
        </label>
      ) : (
        <p className="field-hint">
          {data.noise.status === "OFF"
            ? "Chưa lọc nền: bạn chưa khai báo khoảng im lặng đầu bản thu."
            : data.noise.status === "BYPASSED_LOW_NOISE"
              ? "Không áp dụng lọc: mẫu nền quá nhỏ để ước lượng."
              : "Không áp dụng lọc: đầu bản thu chưa đủ tách biệt về âm lượng hoặc bản quá ngắn. Vẫn có thể cắt đoạn để nghe."}
        </p>
      )}
      <button
        type="button"
        className="button secondary"
        onClick={() => {
          setError("");
          session.build({ start, end }, filtered);
        }}
      >
        Tạo lại đoạn nghe
      </button>
      {state.url && (
        <div className="pron-playback">
          <p>
            {state.filtered
              ? "Đoạn đã cắt và giảm nền"
              : "Đoạn đã cắt, giữ âm thanh gốc"}
            : {state.range!.start.toFixed(2)}–{state.range!.end.toFixed(2)} giây
            của bản gốc.
          </p>
          <audio
            ref={attachAudio}
            src={state.url}
            controls
            preload="metadata"
            aria-label="Đoạn đọc đã chọn"
            onPlay={() => {
              audio.current
                ?.closest(".pron-recorder")
                ?.querySelectorAll<HTMLAudioElement>("audio")
                .forEach((element) => {
                  if (element !== audio.current) element.pause();
                });
            }}
            onError={() =>
              setError(
                "Chưa phát được đoạn nghe. Thử tạo lại hoặc nghe bản gốc.",
              )
            }
          />
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
