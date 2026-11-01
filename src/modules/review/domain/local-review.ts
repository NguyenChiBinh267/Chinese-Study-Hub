import { z } from "zod";
import type { Mastery } from "../../learning/domain/mastery";
export const revealCommand = z.strictObject({
  expectedVersion: z.int().positive(),
});
export const ratingCommand = z.strictObject({
  expectedVersion: z.int().positive(),
  rating: z.enum(["Again", "Hard", "Good", "Easy"]),
});
export type RatingCommand = z.infer<typeof ratingCommand>;
export type DueCard = {
  id: string;
  templateVersionId: string;
  version: number;
  prompt: string;
  dueAt: string;
  state: number;
  reps: number;
  lapses: number;
};
export type LearningSummary = {
  due: DueCard[];
  dueCount: number;
  nextDueAt: string | null;
  reviews: number;
  mastery: { conceptId: string; skill: string; projection: Mastery }[];
};
