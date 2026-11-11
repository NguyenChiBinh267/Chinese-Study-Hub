import { z } from "zod";
import type { PublicLesson } from "./package";
export const draftStart = z.strictObject({
  restart: z.boolean(),
  packageHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const draftAnswer = z.strictObject({
  exerciseVersionId: z.string().max(100),
  response: z.union([
    z.strictObject({ choice: z.int().min(0).max(5) }),
    z.strictObject({ text: z.string().min(1).max(160) }),
    z.strictObject({ order: z.array(z.int().min(0).max(5)).min(2).max(6) }),
  ]),
});
export const draftAdvance = z.strictObject({
  expectedVersion: z.int().positive(),
});
export type DraftAnswer = z.infer<typeof draftAnswer>;
export type DraftSession = {
  id: string;
  state: "active" | "completed";
  cursor: number;
  version: number;
  answers: {
    exerciseVersionId: string;
    response: { choice?: number; text?: string; order?: number[] };
    correct: boolean;
    feedback: string;
  }[];
};
export type DraftView = { lesson: PublicLesson; session: DraftSession | null };
