import type { PronunciationNote } from "./notes";

export type AcousticAnalysisResult =
  | { state: "NOT_ANALYZED"; reason: "NO_VALIDATED_ANALYZER" }
  | { state: "INSUFFICIENT_AUDIO"; reason: string }
  | { state: "UNSUPPORTED_TARGET"; targetVersion: string }
  | {
      state: "ACOUSTIC_OBSERVATION";
      targetVersion: string;
      policy: "UNVALIDATED";
      measurements: { durationMs?: number };
    }
  | { state: "REVIEW_REQUIRED"; reason: string };
export interface AcousticAnalysisAdapter {
  analyze(input: {
    recording: Blob;
    targetVersion: string;
  }): Promise<AcousticAnalysisResult>;
}
// Legacy teaching-feedback contract remains disabled. Local F0 observations use
// acoustic-types/engine; they are not a validated pronunciation assessor.
export class DisabledAcousticAnalysisAdapter implements AcousticAnalysisAdapter {
  async analyze(): Promise<AcousticAnalysisResult> {
    return { state: "NOT_ANALYZED", reason: "NO_VALIDATED_ANALYZER" };
  }
}
export const pronunciationCopy = {
  notAnalyzed: "Đây là mẹo luyện âm, chưa phải nhận xét về giọng của bạn.",
  insufficient:
    "App chưa nghe đủ rõ để nhận xét. Thử ghi âm lại trong phòng yên tĩnh.",
  unsupported:
    "Chưa có bộ phân tích được kiểm chứng cho âm này. Bạn vẫn có thể xem hướng dẫn và tự nghe lại.",
  review:
    "Chưa đủ căn cứ để nhận xét phát âm. Cần bộ phân tích và chính sách đánh giá được kiểm chứng.",
  selfReport:
    "Bạn tự chọn điều muốn thử sửa; app chưa xác nhận lỗi từ bản ghi.",
  privacy:
    "App chỉ giữ bản thu trong bộ nhớ của tab, không tự lưu file hoặc upload. Không lưu vào database, không tạo điểm hoặc mastery. Trong pilot, bạn có thể chủ động tải audio gốc về máy để chẩn đoán.",
} as const;
export function mapPronunciationFeedback(
  result: AcousticAnalysisResult,
  note: PronunciationNote,
  selfReported = false,
) {
  const summary =
    result.state === "NOT_ANALYZED"
      ? pronunciationCopy.notAnalyzed
      : result.state === "INSUFFICIENT_AUDIO"
        ? pronunciationCopy.insufficient
        : result.state === "UNSUPPORTED_TARGET"
          ? pronunciationCopy.unsupported
          : pronunciationCopy.review;
  return {
    summary,
    evidence: selfReported
      ? pronunciationCopy.selfReport
      : "Mẹo này không dựa trên phép đo âm học hoặc quan sát môi/lưỡi của bạn.",
    // These are teaching suggestions, always explicitly conditional, never a diagnosis.
    correction: note.correction,
    masteryEligible: false as const,
  };
}
