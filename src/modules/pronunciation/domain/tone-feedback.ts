import {
  supportedTone,
  type AcousticResult,
  type Exclusion,
} from "./acoustic-types";

export const frameExclusionLabels: Record<Exclusion, string> = {
  NOISE_REFERENCE: "Đoạn đầu được khai báo làm mẫu tiếng nền",
  QUIET: "Dưới ngưỡng âm lượng của bộ dò",
  LOW_PERIODICITY: "Chu kỳ rung chưa đủ rõ",
  OUT_OF_RANGE: "Ước lượng nằm ngoài dải dò",
  OCTAVE_JUMP: "Nghi vấn đổi quãng tám",
  INVALID: "Giá trị đo không hợp lệ",
};
export function frameExclusions(
  result: AcousticResult,
): Record<Exclusion, number> {
  const counts: Record<Exclusion, number> = {
    NOISE_REFERENCE: 0,
    QUIET: 0,
    LOW_PERIODICITY: 0,
    OUT_OF_RANGE: 0,
    OCTAVE_JUMP: 0,
    INVALID: 0,
  };
  for (const frame of result.frames)
    if (frame.excluded !== null) counts[frame.excluded]++;
  return counts;
}
export function toneFeedback(result: AcousticResult) {
  const fallback = {
    summary:
      "App chưa nghe đủ rõ để nhận xét. Thử ghi âm lại trong phòng yên tĩnh.",
    action:
      "Đặt micro cách miệng một khoảng thoải mái, đọc một âm ngắn vừa đủ nghe.",
    retry: "Nghe lại rồi ghi một lần mới; tránh tiếng nhạc và tiếng nói khác.",
  };
  if (result.status === "NOT_ANALYZED")
    return {
      summary: "Bản thu chưa được phân tích.",
      action: "Đọc một âm tiết rồi bấm Phân tích cao độ.",
      retry: "Bạn có thể tự nghe trước khi phân tích.",
    };
  if (result.status === "PROCESSING")
    return {
      summary: "Đang tìm hướng lên xuống của giọng trong tab này…",
      action: "Bạn có thể hủy bất cứ lúc nào.",
      retry: "Không cần bật micro trong lúc xử lý.",
    };
  if (
    result.status === "UNSUPPORTED_TARGET" &&
    result.reason === "POSSIBLE_MULTIPLE_SYLLABLES"
  )
    return {
      summary:
        "Đoạn có cao độ kéo dài vượt phạm vi một âm ngắn của bản thử; app chưa đủ căn cứ nhận xét.",
      action: "Thử đọc một âm tiết ngắn, thoải mái rồi dừng ghi.",
      retry:
        "Không cần ép thanh 3 phải bật lên. Nếu đã đọc một âm mà vẫn gặp thông báo này, ghi nhận giới hạn của bộ dò.",
    };
  if (result.status === "UNSUPPORTED_TARGET")
    return {
      summary: "Chỉ thử phân tích một âm tiết riêng của thanh 1–4.",
      action:
        "Chọn một thanh 1–4 và chỉ đọc một âm tiết, chẳng hạn mā hoặc má.",
      retry: "Thanh nhẹ, 你好 và thanh trong câu hiện chỉ có hướng dẫn luyện.",
    };
  if (result.status === "ANALYSIS_FAILED")
    return {
      summary: "Chưa đọc hoặc xử lý được âm thanh này.",
      action: "Thử ghi lại một âm ngắn trong trình duyệt hỗ trợ.",
      retry: "Hướng dẫn và nghe lại vẫn dùng được; không có điểm phát âm.",
    };
  if (result.status === "INSUFFICIENT_SIGNAL") {
    const excluded = frameExclusions(result);
    if (result.frames.some((frame) => frame.voiced))
      fallback.summary =
        "App đo được một phần cao độ nhưng chưa đủ dữ liệu đáng tin cậy để nhận xét toàn âm. Đồ thị chỉ hiển thị phần đo được.";
    if (result.warnings.includes("CLIPPED"))
      return {
        ...fallback,
        action:
          "Bản thu chạm giới hạn biên độ ở nhiều mẫu. Thử đưa micro xa hơn hoặc giảm mức thu một chút.",
        retry:
          "Nghe xem bản thu có rè không, rồi ghi lại một tiếng ở âm lượng thoải mái.",
      };
    if (result.reason === "TOO_SHORT")
      return {
        ...fallback,
        action:
          "Bản thu quá ngắn để lấy được một khung đo. Thử giữ một tiếng khoảng một giây.",
        retry: "Bấm ghi, đọc một tiếng rồi mới bấm dừng.",
      };
    if (result.frames.length > 0 && excluded.QUIET === result.frames.length)
      return {
        ...fallback,
        action:
          "Tất cả khung đều dưới ngưỡng âm lượng của bộ dò. Nghe lại để kiểm tra bản thu có rõ giọng và trình duyệt đã chọn đúng micro chưa.",
        retry:
          "Nếu giọng quá nhỏ hoặc không nghe thấy, kiểm tra mức thu của micro rồi ghi lại một tiếng ở âm lượng thoải mái.",
      };
    if (result.warnings.includes("OCTAVE_AMBIGUITY"))
      return {
        ...fallback,
        action:
          "Ước lượng cao độ có bước nhảy lớn nên app chưa dùng để nhận xét. Thử đọc một tiếng liền, thoải mái.",
        retry:
          "Không cần ép giọng lên hoặc xuống; nếu vẫn bị loại, gửi mã và số khung trong phần kỹ thuật.",
      };
    if (result.warnings.includes("AMBIGUOUS_SEGMENTATION"))
      return {
        ...fallback,
        action:
          "Giữa các đoạn đo được có khoảng trống dài; app chưa xác định được một đoạn liên tục. Thử đọc đúng một tiếng liền.",
        retry:
          "Nếu bạn đã đọc liền và nghe lại rõ, giữ thông tin khung bị loại trong phần kỹ thuật để kiểm tra bộ dò.",
      };
    if (result.warnings.includes("UNSTABLE_TRACKING"))
      return {
        ...fallback,
        action:
          "Các mốc cao độ dao động mạnh nên app chưa dùng để nhận xét. Thử một âm liền ở mức giọng thoải mái.",
        retry:
          "Nếu bản nghe lại rõ mà đường vẫn dao động, ghi nhận để kiểm tra bộ dò; chưa suy ra lỗi phát âm.",
      };
    if (
      excluded.LOW_PERIODICITY > 0 ||
      excluded.OUT_OF_RANGE > 0 ||
      excluded.INVALID > 0
    )
      return {
        ...fallback,
        action:
          "Có khung đủ âm lượng nhưng bộ dò chưa giữ được cao độ đủ tin cậy. Điều này chưa chứng minh bạn đọc sai.",
        retry:
          "Nghe lại: nếu giọng rõ, gửi số khung bị loại trong phần kỹ thuật; không cần cố đọc lớn hơn hoặc đổi giọng.",
      };
  }
  if (
    result.status !== "ANALYZED" ||
    result.warnings.length ||
    !result.observation
  )
    return fallback;
  const tone = supportedTone(result.targetVersion);
  const summary = {
    RISING: "Trong đoạn đo được, cuối âm có cao độ cao hơn đầu âm.",
    FALLING: "Trong đoạn đo được, cuối âm có cao độ thấp hơn đầu âm.",
    LEVEL: "Trong đoạn đo được, cao độ thay đổi ít.",
    VARIABLE:
      "Trong đoạn đo được, cao độ thay đổi nhưng chưa có một hướng lên hoặc xuống rõ.",
  }[result.observation];
  const action =
    tone === 1
      ? "Thử giữ giọng tương đối đều trong một âm ngắn, ở mức thoải mái."
      : tone === 2
        ? "Thử bắt đầu thấp hơn một chút rồi nhấc giọng lên về cuối âm."
        : tone === 3
          ? "Khi đọc riêng, thử bắt đầu thấp rồi hạ giọng; không ép giọng hoặc bắt buộc bật lên cao."
          : "Thử bắt đầu cao hơn một chút rồi hạ giọng dứt khoát trong một âm.";
  return {
    summary,
    action,
    retry:
      "Nghe lại, đọc chậm một lần rồi ghi lại. Hai đường chỉ giúp tự quan sát, chưa chứng minh tiến bộ.",
  };
}
