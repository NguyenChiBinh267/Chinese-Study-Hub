import type { PublicFixture } from "../domain/local-foundation";
import { findContentTemplate } from "@/modules/content/application/catalog";

// Original test tokens; no claim of HSK coverage, language review, published
// content or independent mastery evidence. Answer keys stay in server modules.
const exercises = [
  {
    id: "local-token-v1-a",
    prompt: "Fixture đọc ký tự: chọn chuỗi ‘ma’.",
    choices: ["ma", "am", "mm"],
    expected: "ma",
  },
  {
    id: "local-token-v1-b",
    prompt: "Fixture phân biệt chuỗi: chọn chuỗi ‘ni’.",
    choices: ["in", "nn", "ni"],
    expected: "ni",
  },
];
export const fixture: PublicFixture = {
  id: "local-foundation-v1",
  title: "Bài kiểm tra lưu kết quả local",
  notice:
    "Fixture development do dự án tạo; không phải học liệu HSK đã duyệt. Server chấm lựa chọn và tạo thẻ FSRS thử nghiệm; chưa đủ evidence mastery.",
  exercises: exercises.map(({ id, prompt, choices }) => ({
    id,
    prompt,
    choices,
  })),
};
export function gradeFixture(
  exerciseId: string,
  choice: number,
): boolean | null {
  const exercise = exercises.find((e) => e.id === exerciseId);
  return !exercise ||
    !Number.isInteger(choice) ||
    choice < 0 ||
    choice >= exercise.choices.length
    ? null
    : exercise.choices[choice] === exercise.expected;
}
// Explicit original template definitions only; never derive cards from arbitrary
// client text or pretend these keys have a competent language review.
export function fixtureDefinition(exerciseId: string) {
  const index = exercises.findIndex((e) => e.id === exerciseId);
  if (index < 0) return null;
  const e = exercises[index];
  return {
    conceptId: `local-token-recognition-v1-${index}`,
    skill: "recognition",
    templateVersionId: `local-recall-v1-${index}`,
    prompt: `Fixture nội bộ · Nhớ chuỗi cho nhãn ${index === 0 ? "A" : "B"} (đã học trong bài).`,
    back: e.expected,
    feedback: `Đáp án fixture: ${e.expected}. Bài kiểm tra chuỗi nội bộ; không đánh giá tiếng Trung.`,
  };
}
export function templateDefinition(templateId: string) {
  return (
    exercises
      .map((e) => fixtureDefinition(e.id)!)
      .find((e) => e.templateVersionId === templateId) ??
    findContentTemplate(templateId)
  );
}
