// Local UI preview only. Does not implement the production weekly planner.
export const weekdays = [
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
  "Chủ nhật",
];
export type Preferences = {
  weeklyHours: number;
  days: number[];
  dailyCap: number;
  sessionMinutes: number;
};
export const defaultPreferences: Preferences = {
  weeklyHours: 6,
  days: [0, 1, 2, 3, 4, 5],
  dailyCap: 60,
  sessionMinutes: 20,
};
export function validatePreferences(p: Preferences): string[] {
  const errors: string[] = [];
  if (
    !Number.isFinite(p.weeklyHours) ||
    p.weeklyHours < 0.5 ||
    p.weeklyHours > 21 ||
    !Number.isInteger(p.weeklyHours * 60)
  )
    errors.push("Nhập từ 0,5 đến 21 giờ mỗi tuần, theo số phút nguyên.");
  if (
    !p.days.length ||
    p.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    new Set(p.days).size !== p.days.length
  )
    errors.push("Chọn ít nhất một ngày rảnh.");
  if (!Number.isInteger(p.dailyCap) || p.dailyCap < 10 || p.dailyCap > 180)
    errors.push("Giới hạn mỗi ngày cần từ 10 đến 180 phút.");
  if (
    ![10, 15, 20, 25].includes(p.sessionMinutes) ||
    p.sessionMinutes > p.dailyCap
  )
    errors.push("Buổi học cần từ 10 đến 25 phút và không vượt giới hạn ngày.");
  return errors;
}
export function previewPlan(p: Preferences) {
  if (validatePreferences(p).length) return null;
  const target = Math.round(p.weeklyHours * 60);
  const capacity = p.days.length * p.dailyCap;
  const feasible = Math.min(target, capacity);
  const buffer = Math.round(feasible * 0.1);
  const active = feasible - buffer;
  const selected = [...p.days].sort((a, b) => a - b);
  const days = weekdays.map((label, day) => {
    const index = selected.indexOf(day);
    const minutes =
      index < 0
        ? 0
        : Math.floor(active / selected.length) +
          (index < active % selected.length ? 1 : 0);
    const blocks: number[] = [];
    for (let remaining = minutes; remaining > 0; remaining -= p.sessionMinutes)
      blocks.push(Math.min(remaining, p.sessionMinutes));
    return { day, label, minutes, blocks };
  });
  return {
    target,
    capacity,
    feasible,
    buffer,
    active,
    shortfall: target - feasible,
    days,
  };
}
