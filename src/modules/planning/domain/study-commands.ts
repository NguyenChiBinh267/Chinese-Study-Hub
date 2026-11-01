import { z } from "zod";
import { preferenceCommand } from "@/modules/learning/domain/local-foundation";
export const planningSettings = z.strictObject({
  dayCaps: z.array(z.int().min(0).max(180)).length(7),
  maxSessionMinutes: z.int().min(5).max(45),
  paused: z.boolean(),
  timezone: z
    .string()
    .max(80)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Invalid IANA timezone"),
  startingLevel: z.enum(["zero", "some"]),
});
export const studyPreferenceCommand = z
  .strictObject({
    preferences: preferenceCommand.shape.preferences,
    expectedVersion: z.int().min(0),
    acceptLimited: z.boolean(),
    planning: planningSettings,
  })
  .superRefine((c, ctx) => {
    if (c.preferences.sessionMinutes > c.planning.maxSessionMinutes)
      ctx.addIssue({
        code: "custom",
        message: "Preferred session exceeds max",
      });
    if (
      c.planning.dayCaps.some(
        (cap, i) => !c.preferences.days.includes(i) && cap !== 0,
      )
    )
      ctx.addIssue({ code: "custom", message: "Rest days must have zero cap" });
    const capacity = c.planning.dayCaps.reduce((a, b) => a + b, 0);
    if (
      !c.planning.paused &&
      c.preferences.weeklyHours * 60 > capacity &&
      !c.acceptLimited
    )
      ctx.addIssue({
        code: "custom",
        message: "Explicit limited-capacity consent required",
      });
  });
// Legacy preference clients remain valid; all new clients use the strict extended form.
export const compatiblePreferences = z.union([
  studyPreferenceCommand,
  preferenceCommand,
]);
export const replanCommand = z.strictObject({
  expectedVersion: z.int().min(0),
  action: z.enum(["refresh", "skip_today", "ten_minutes"]),
});
export type StudyPreferenceCommand = z.infer<typeof studyPreferenceCommand>;
export type ReplanCommand = z.infer<typeof replanCommand>;

export const studyPreviewCommand = z
  .strictObject({
    preferences: preferenceCommand.shape.preferences,
    planning: planningSettings,
  })
  .superRefine((c, ctx) => {
    if (
      c.preferences.sessionMinutes > c.planning.maxSessionMinutes ||
      c.planning.dayCaps.some(
        (cap, i) => !c.preferences.days.includes(i) && cap !== 0,
      )
    )
      ctx.addIssue({ code: "custom", message: "Invalid caps/session" });
  });
