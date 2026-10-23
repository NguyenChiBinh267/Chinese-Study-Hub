import { z } from "zod";
export const profileCommand = z.strictObject({
  displayName: z.string().trim().min(1).max(80),
  textSize: z.enum(["normal", "large"]),
  timezone: z
    .string()
    .min(1)
    .max(80)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("vi", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
});
export type ProfileCommand = z.infer<typeof profileCommand>;
export type OwnerProfile = ProfileCommand & {
  userId: string;
  scheduleTimezone: string | null;
  updatedAt: string | null;
};
