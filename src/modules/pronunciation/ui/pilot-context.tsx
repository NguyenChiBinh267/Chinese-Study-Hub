"use client";
import { createContext, useContext } from "react";
import type { PilotSession } from "../domain/pilot";
export const PilotContext = createContext<PilotSession | null>(null);
export const usePilot = () => useContext(PilotContext);
