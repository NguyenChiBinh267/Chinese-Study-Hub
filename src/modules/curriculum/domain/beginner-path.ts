import type { CurriculumSnapshot, LessonView } from "./snapshot";

// Navigation uses completion of the current immutable version, never mastery.
export function beginnerPath(data: CurriculumSnapshot): LessonView[] {
  const courses = new Map(data.courses.map((c) => [c.id, c.order]));
  const units = new Map(data.units.map((u) => [u.id, u]));
  return data.lessons
    .filter((l) => ["FOUNDATION", "HSK1"].includes(l.courseCode))
    .toSorted((a, b) => {
      const au = units.get(a.unitId)!,
        bu = units.get(b.unitId)!;
      return (
        courses.get(au.courseId)! - courses.get(bu.courseId)! ||
        au.order - bu.order ||
        a.order - b.order
      );
    });
}

export function nextBeginnerLesson(path: LessonView[]): LessonView | undefined {
  return (
    path.find((l) => l.started && !l.completed && l.access.mayPractice) ??
    path.find((l) => !l.completed && l.access.mayPractice)
  );
}
