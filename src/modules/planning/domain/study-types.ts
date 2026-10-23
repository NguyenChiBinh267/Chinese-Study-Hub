import type { StudyPreferenceCommand } from "./study-commands";
import type { WeeklyPlan } from "./weekly-plan";
export type SavedStudySettings = Pick<
  StudyPreferenceCommand,
  "preferences" | "planning"
> & { configured: boolean; expectedVersion: number };
export type PersistedPlan = WeeklyPlan & {
  id: string;
  version: number;
  reason: string;
};
export type StudySnapshot = {
  configured: boolean;
  settings: SavedStudySettings;
  plan: PersistedPlan | null;
};
