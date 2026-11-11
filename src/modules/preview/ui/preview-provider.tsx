"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  defaultPreferences,
  type Preferences,
} from "@/modules/planning/domain/preview-plan";

export type LessonSession = {
  step: number;
  answers: Record<number, number>;
  complete: boolean;
};
type PreviewState = {
  level: string;
  setLevel: (value: string) => void;
  preferences: Preferences;
  applyPreferences: (value: Preferences) => void;
  configured: boolean;
  sessions: Record<string, LessonSession>;
  updateSession: (id: string, value: LessonSession) => void;
  ratings: string[];
  rateCard: (value: string) => void;
  restartReview: () => void;
};
const Context = createContext<PreviewState | null>(null);
export function PreviewProvider({ children }: { children: ReactNode }) {
  const [level, setLevel] = useState("zero");
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [configured, setConfigured] = useState(false);
  const [sessions, setSessions] = useState<Record<string, LessonSession>>({});
  const [ratings, setRatings] = useState<string[]>([]);
  return (
    <Context.Provider
      value={{
        level,
        setLevel,
        preferences,
        configured,
        applyPreferences: (value) => {
          setPreferences(value);
          setConfigured(true);
        },
        sessions,
        updateSession: (id, value) =>
          setSessions((previous) => ({ ...previous, [id]: value })),
        ratings,
        rateCard: (value) => setRatings((previous) => [...previous, value]),
        restartReview: () => setRatings([]),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePreview() {
  const context = useContext(Context);
  if (!context) throw new Error("PreviewProvider is required");
  return context;
}
