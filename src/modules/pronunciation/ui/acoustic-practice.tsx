"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AcousticSession } from "../application/acoustic-session";
import { supportedTone } from "../domain/acoustic-types";
import {
  toneFeedback,
  frameExclusions,
  frameExclusionLabels,
} from "../domain/tone-feedback";
import type { Exclusion } from "../domain/acoustic-types";
import { PitchChart } from "./pitch-chart";
import type { AcousticResult } from "../domain/acoustic-types";
import { compareAttempts } from "../domain/compare-attempts";

export function AcousticPractice({
  blob,
  targetVersion,
  resetToken,
  onRetry,
  onListen,
  onShowGuide,
  onShowCorrection,
  listenRequired = false,
  retryDisabled = false,
  onMeasured,
}: {
  blob: Blob | null;
  targetVersion: string;
  resetToken: number;
  onRetry: () => void;
  onListen?: () => void;
  onShowGuide?: () => void;
  onShowCorrection?: () => void;
  listenRequired?: boolean;
  retryDisabled?: boolean;
  onMeasured?: (result: AcousticResult) => void;
}) {
  const [session] = useState(() => new AcousticSession(targetVersion));
  const technicalId = useId(),
    measured = useRef(onMeasured);
  useEffect(() => {
    measured.current = onMeasured;
  }, [onMeasured]);
  const { result, previous, single, noiseReduction } = useSyncExternalStore(
    session.subscribe,
    session.snapshot,
    session.snapshot,
  );
  useEffect(() => {
    session.clear();
  }, [resetToken, session]);
  useEffect(() => {
    session.setBlob(blob);
  }, [blob, session]);
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
  const supported = supportedTone(targetVersion) !== null;
  useEffect(() => {
    if (!["NOT_ANALYZED", "PROCESSING"].includes(result.status))
      measured.current?.(result);
  }, [result]);
  function retry() {
    onRetry();
  }
  function analyze() {
    if (!blob) return;
    session.run();
  }
  const feedback = toneFeedback(result);
  const excluded = frameExclusions(result);
  const periodicity = result.frames
    .flatMap((frame) => (frame.periodicity === null ? [] : [frame.periodicity]))
    .sort((a, b) => a - b);
  return (
    <section
      className="acoustic-practice"
      aria-label="Quan sát cao độ thử nghiệm"
      data-analysis-status={result.status}
    >
      <h3>Nghe hướng lên xuống · thử nghiệm</h3>
      <p>
        Chỉ đo cao độ từ bản thu ngay trong trình duyệt. Không nhận dạng chữ,
        không chấm đúng/sai, không tạo điểm hoặc mastery.
      </p>
      {!supported ? (
        <p className="pitch-scope">
          Âm này hiện chỉ có mẹo luyện âm. Muốn xem cao độ, chọn một thanh 1–4
          trong danh sách. Thanh nhẹ và thanh trong câu cần ngữ cảnh, chưa hỗ
          trợ phân tích.
        </p>
      ) : (
        <>
          <label className="pron-selfcheck">
            <input
              type="checkbox"
              checked={single}
              onChange={(e) => session.setSingle(e.target.checked)}
            />
            Tôi chỉ đọc một âm tiết riêng, không đọc câu hoặc nhiều âm
          </label>
          <p className="field-hint">
            Ví dụ: chọn thanh 2 rồi đọc một tiếng “má” theo Pinyin, khoảng nửa
            đến hai giây. App không tự xác minh bạn đã đọc đúng tiếng này.
          </p>
          <label className="pron-selfcheck">
            <input
              type="checkbox"
              checked={noiseReduction}
              onChange={(e) => session.setNoiseReduction(e.target.checked)}
            />
            Lọc tiếng nền đều · thử nghiệm (tôi để im lặng đầu bản thu)
          </label>
          <p className="field-hint">
            Khi bật: bấm ghi, giữ im lặng khoảng nửa giây rồi đọc một tiếng. App
            lấy 0,3 giây đầu làm mẫu nền; chỉ lọc bản sao phân tích, bản nghe
            lại giữ nguyên. Chỉ hỗ trợ nền tương đối đều; tiếng nói khác hoặc
            nhạc có thể vẫn làm phép đo sai. Bật/tắt rồi phân tích lại cùng bản
            thu để thử; app không tự kết luận có tạp âm.
          </p>
          {blob && (
            <div className="pron-actions">
              {result.status === "PROCESSING" ? (
                <button
                  type="button"
                  className="button secondary"
                  onClick={session.cancel}
                >
                  Hủy phân tích
                </button>
              ) : (
                <button
                  type="button"
                  className="button primary"
                  onClick={analyze}
                  disabled={listenRequired}
                >
                  Phân tích cao độ
                </button>
              )}
              <button
                type="button"
                className="button secondary"
                onClick={retry}
                disabled={retryDisabled}
              >
                Ghi lần tiếp · giữ đường để so
              </button>
            </div>
          )}
          {!blob && (
            <p>
              Ghi âm ở phía trên, rồi bấm Phân tích cao độ. Hai lần gần nhất chỉ
              giữ đường đo trong tab; bản thu cũ được bỏ khi ghi lại.
            </p>
          )}
          <div
            className="pitch-feedback"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <h4>App nghe thấy gì?</h4>
            <p>{feedback.summary}</p>
            <h4>Nên thử sửa thế nào?</h4>
            <p>{feedback.action}</p>
            <h4>Luyện lại ra sao?</h4>
            <p>{feedback.retry}</p>
          </div>
          {blob && listenRequired && (
            <p className="field-hint">
              Pilot: nghe hết bản thu gốc trước khi nhận kết quả phân tích.
            </p>
          )}
          <div className="pron-actions">
            {blob && onListen && (
              <button
                type="button"
                className="button secondary"
                onClick={onListen}
              >
                Nghe lại
              </button>
            )}
            {onShowCorrection && (
              <button
                type="button"
                className="button secondary"
                onClick={onShowCorrection}
              >
                Xem cách sửa
              </button>
            )}
            {onShowGuide && (
              <button
                type="button"
                className="button secondary"
                onClick={onShowGuide}
              >
                Xem khẩu hình
              </button>
            )}
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                const details = document.getElementById(
                  technicalId,
                ) as HTMLDetailsElement | null;
                if (details) {
                  details.open = true;
                  details.querySelector("summary")?.focus();
                  details.scrollIntoView({ block: "start" });
                }
              }}
            >
              Xem giải thích kỹ thuật
            </button>
          </div>
          <p className="pitch-boundary">
            Quan sát cao độ — chưa phải chấm phát âm. Quan sát cao độ thử
            nghiệm, chưa được hiệu chuẩn trên giọng nói thật. Đường trông giống
            thanh cần luyện vẫn không chứng minh phụ âm, nguyên âm hay cả âm
            tiết đúng.
          </p>
          {previous && (
            <p className="pitch-comparison" role="status">
              {compareAttempts(result, previous)}
            </p>
          )}
          {result.frames.length > 0 || previous?.frames.length ? (
            <>
              {result.status === "NOT_ANALYZED" && previous && (
                <p className="pitch-scope">
                  Bản hiện tại chưa phân tích. Đường nét đứt bên dưới thuộc lần
                  trước.
                </p>
              )}
              <PitchChart current={result} previous={previous} />
            </>
          ) : null}
          {previous && (
            <button
              className="button secondary"
              type="button"
              onClick={session.forgetPrevious}
            >
              Bỏ đường của lần trước
            </button>
          )}
          <details id={technicalId} className="pron-details pitch-technical">
            <summary>Giải thích kỹ thuật · cao độ và giới hạn</summary>
            <p>
              {result.algorithm} · {result.policyVersion}
            </p>
            <p data-noise-status={result.noiseReduction.status}>
              Lọc nền:{" "}
              {result.noiseReduction.status === "APPLIED"
                ? `Đã áp dụng trên bản sao phân tích; dùng ${result.noiseReduction.referenceMs} ms đầu làm mẫu nền do bạn khai báo.`
                : result.noiseReduction.status === "BYPASSED_NO_REFERENCE"
                  ? "Đã bỏ qua: bản thu quá ngắn hoặc đầu bản thu chưa đủ tách biệt về âm lượng. Giữ im lặng nửa giây trước khi đọc rồi ghi lại."
                  : result.noiseReduction.status === "BYPASSED_LOW_NOISE"
                    ? "Đã bỏ qua: mẫu nền có năng lượng quá nhỏ để ước lượng phổ."
                    : "Chưa áp dụng. Bật tùy chọn rồi bấm Phân tích cao độ nếu đầu bản thu có khoảng im lặng."}{" "}
              Không đo SNR, không bảo đảm đã loại hết tạp âm.
            </p>
            <p>
              Lọc Gaussian chỉ dùng cho phân tích, giảm ảnh hưởng họa âm cao
              trước bộ dò. Bản nghe lại giữ nguyên. Ngưỡng âm lượng và clipping
              vẫn đo trên tín hiệu gốc; độ tuần hoàn đo sau lọc, chưa phải độ
              tin cậy phát âm.
            </p>
            {periodicity.length > 0 && (
              <p>
                Độ tuần hoàn sau lọc (không phải điểm): nhỏ nhất{" "}
                {periodicity[0].toFixed(3)}, giữa{" "}
                {periodicity[Math.floor((periodicity.length - 1) / 2)].toFixed(
                  3,
                )}
                , lớn nhất {periodicity.at(-1)!.toFixed(3)}; ngưỡng giữ khung
                0.900.
              </p>
            )}
            <p>
              Trạng thái: {result.status}. Lý do: {result.reason}. Đã đọc{" "}
              {result.durationSeconds.toFixed(2)} giây;{" "}
              {result.voicedDurationMs.toFixed(0)} ms khung có tính tuần hoàn.
              Tỷ lệ khung toàn bản thu:{" "}
              {(result.voicedCoverage * 100).toFixed(0)}%; trong đoạn có năng
              lượng: {(result.activeVoicedCoverage * 100).toFixed(0)}%. Bỏ{" "}
              {result.excludedFrames} khung.
            </p>
            <p>
              Hz là số lần rung ước lượng mỗi giây. “Bán âm” diễn tả khoảng lên
              xuống quanh mức giữa của chính bản thu. Độ tuần hoàn MPM không
              phải xác suất phát âm đúng. Không có phép đo SNR, nhận dạng âm
              tiết hoặc tham chiếu nam/nữ cố định.
            </p>
            {result.frames.length > 0 && (
              <div
                className="pitch-exclusions"
                aria-label="Chi tiết các khung bị loại"
              >
                <p>
                  Chi tiết loại khung — đây là tiêu chí của bộ dò, không phải
                  loại lỗi phát âm:
                </p>
                <ul>
                  {(Object.keys(frameExclusionLabels) as Exclusion[]).map(
                    (code) => (
                      <li key={code}>
                        {code} · {frameExclusionLabels[code]}: {excluded[code]}{" "}
                        khung.
                      </li>
                    ),
                  )}
                </ul>
                <p>
                  Được giữ lại:{" "}
                  {result.frames.filter((frame) => frame.voiced).length}/
                  {result.frames.length} khung. Nếu bản nghe lại rõ giọng mà vẫn
                  không giữ được khung nào, cần kiểm tra bộ dò; chưa có căn cứ
                  kết luận micro hỏng hoặc bạn đọc sai.
                </p>
              </div>
            )}
            <p>
              Cảnh báo kỹ thuật:{" "}
              {result.status === "NOT_ANALYZED"
                ? "Chưa có phép đo cho bản hiện tại. Bấm Phân tích cao độ sau khi ghi âm."
                : result.status === "PROCESSING"
                  ? "Đang phân tích, chưa có kết luận."
                  : result.warnings.join(", ") ||
                    "Không phát hiện qua các kiểm tra giới hạn; không đảm bảo không có nhiễu hoặc lỗi quãng tám."}
            </p>
            <p>
              Nhạc, tiếng máy tuần hoàn, giọng khàn/rung hoặc nhiều âm liền nhau
              có thể làm số đo nhầm. Không suy môi, lưỡi, bật hơi hay năng lực
              nói từ đồ thị. Thanh 3 trong câu không bắt buộc võng xuống rồi bật
              lên.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
