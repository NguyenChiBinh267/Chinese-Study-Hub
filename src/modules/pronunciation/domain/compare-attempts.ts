import { supportedTone, type AcousticResult } from "./acoustic-types";
export function compareAttempts(
  current: AcousticResult,
  previous: AcousticResult | null,
) {
  const usable = (r: AcousticResult) =>
    r.status === "ANALYZED" &&
    !r.warnings.length &&
    r.observation !== null &&
    r.movementSemitones !== null &&
    Number.isFinite(r.movementSemitones);
  if (!previous || !usable(current) || !usable(previous))
    return "Chưa đủ dữ liệu đáng tin cậy để so sánh hai lượt.";
  if (
    !supportedTone(current.targetVersion) ||
    current.targetVersion !== previous.targetVersion ||
    current.policyVersion !== previous.policyVersion ||
    current.algorithm !== previous.algorithm ||
    current.noiseReduction.status !== previous.noiseReduction.status
  )
    return "Hai lượt khác mục tiêu hoặc chế độ xử lý; chưa so sánh xu hướng.";
  if (
    current.observation === "RISING" &&
    previous.observation === "RISING" &&
    current.movementSemitones! - previous.movementSemitones! >= 1
  )
    return "Số đo lượt sau có xu hướng lên lớn hơn lượt trước. Điều này chưa chứng minh phát âm tốt hơn.";
  if (current.observation !== previous.observation)
    return "Hai lượt có xu hướng cao độ khác nhau trong phần đo được. Chưa kết luận lượt nào phát âm đúng hơn.";
  return "Hai lượt có cùng loại xu hướng cao độ trong phần đo được; chưa đủ căn cứ kết luận tiến bộ.";
}
