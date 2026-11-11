import { z } from "zod";
import type { LearningSummary } from "../../review/domain/local-review";
import {
  previewPlan,
  validatePreferences,
} from "../../planning/domain/preview-plan";

export const preferencesSchema = z
  .strictObject({
    weeklyHours: z.number().finite(),
    days: z.array(z.int().min(0).max(6)),
    dailyCap: z.int(),
    sessionMinutes: z.int(),
  })
  .superRefine((value, ctx) => {
    for (const message of validatePreferences(value))
      ctx.addIssue({ code: "custom", message });
  });
export const preferenceCommand = z
  .strictObject({
    preferences: preferencesSchema,
    expectedVersion: z.int().min(0),
    acceptLimited: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (
      (previewPlan(value.preferences)?.shortfall ?? 0) > 0 &&
      !value.acceptLimited
    )
      ctx.addIssue({
        code: "custom",
        message: "Cần xác nhận riêng khi lịch rảnh không đủ quỹ giờ.",
      });
  });
export const startCommand = z.strictObject({ restart: z.boolean() });
export const answerCommand = z.strictObject({
  exerciseVersionId: z.string().max(80),
  response: z.strictObject({ choice: z.int().min(0).max(9) }),
});
export const emptyCommand = z.strictObject({});
export const uuid = z.uuid();
export type PreferenceCommand = z.infer<typeof preferenceCommand>;
export type AnswerCommand = z.infer<typeof answerCommand>;
export type SavedPreferences = {
  preferences: z.infer<typeof preferencesSchema>;
  version: number;
  updatedAt: string;
};
export type LocalAnswer = {
  feedback?: string;
  exerciseVersionId: string;
  response: { choice: number };
  correct: boolean;
  occurredAt: string;
};
export type LocalSession = {
  id: string;
  lessonVersionId: string;
  state: "active" | "completed";
  answers: LocalAnswer[];
};
export type LocalSnapshot = {
  learning: LearningSummary;
  settings: SavedPreferences | null;
  session: LocalSession | null;
  progress: { attempts: number; correct: number; completedSessions: number };
  source: "postgresql-local" | "postgresql-authenticated-test";
};
export type PublicFixture = {
  id: string;
  title: string;
  notice: string;
  exercises: { id: string; prompt: string; choices: string[] }[];
};
export class CommandError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
// Repository port: UI/Route Handlers do not own SQL or grading implementation.
export interface LocalLearningRepository {
  snapshot(userId: string): Promise<LocalSnapshot>;
  savePreferences(
    userId: string,
    key: string,
    command: PreferenceCommand,
  ): Promise<SavedPreferences>;
  start(
    userId: string,
    key: string,
    restart: boolean,
  ): Promise<{ sessionId: string }>;
  answer(
    userId: string,
    key: string,
    sessionId: string,
    command: AnswerCommand,
  ): Promise<LocalAnswer>;
  complete(
    userId: string,
    key: string,
    sessionId: string,
  ): Promise<{ completed: true }>;
}
