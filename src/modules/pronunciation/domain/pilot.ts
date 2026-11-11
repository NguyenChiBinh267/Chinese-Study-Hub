import { supportedTone, type AcousticResult } from "./acoustic-types";
export type PilotMeta = {
  platform: "UNKNOWN" | "WINDOWS" | "ANDROID";
  browser: string;
  microphone: string;
  source: "UNCONFIRMED" | "PHYSICAL_OWNER_DECLARED" | "SYNTHETIC";
};
export type PilotObservation = {
  clarity: "UNKNOWN" | "CLEAR" | "UNCLEAR";
  graph: "UNKNOWN" | "MATCHES" | "SUSPECT";
  feedback: "UNKNOWN" | "CLEAR" | "CONFUSING";
  outcome: "NOT_TESTED" | "PASS" | "FAIL";
  notes: string;
};
export type PilotAttempt = PilotObservation & {
  id: number;
  target: string;
  number: number;
  at: string;
  permission: "UNKNOWN" | "GRANTED" | "DENIED_OR_FAILED";
  recording: string;
  playedToEnd: boolean;
  peak: number | null;
  noiseSuppressionRequested: boolean | null;
  noiseSuppressionReported: boolean | null;
  measurement: null | {
    status: string;
    reason: string;
    policy: string;
    observation: string | null;
    acceptedFrames: number;
    totalFrames: number;
    warnings: string[];
  };
};
export const blankObservation = (): PilotObservation => ({
  clarity: "UNKNOWN",
  graph: "UNKNOWN",
  feedback: "UNKNOWN",
  outcome: "NOT_TESTED",
  notes: "",
});
export function hardwareStatus(
  meta: PilotMeta,
  attempts: PilotAttempt[],
  platform: PilotMeta["platform"],
) {
  if (platform === "UNKNOWN") return "NOT_TESTED";
  if (
    meta.platform !== platform ||
    meta.source !== "PHYSICAL_OWNER_DECLARED" ||
    !meta.browser.trim() ||
    !meta.microphone.trim()
  )
    return "NOT_TESTED";
  const reviewed = attempts.filter((a) => a.outcome !== "NOT_TESTED");
  if (
    reviewed.some(
      (a) =>
        a.outcome === "PASS" &&
        a.permission === "GRANTED" &&
        a.recording === "ready" &&
        a.playedToEnd &&
        a.clarity === "CLEAR" &&
        a.graph === "MATCHES" &&
        a.feedback === "CLEAR" &&
        a.measurement?.status === "ANALYZED" &&
        !a.measurement.warnings.length,
    )
  )
    return "OWNER_REPORTED_PASS";
  return reviewed.some((a) => a.outcome === "FAIL")
    ? "OWNER_REPORTED_FAIL"
    : "NOT_TESTED";
}
export function measurementSummary(
  r: AcousticResult,
): PilotAttempt["measurement"] {
  return {
    status: r.status,
    reason: r.reason,
    policy: r.policyVersion,
    observation: r.observation,
    acceptedFrames: r.frames.filter((f) => f.voiced).length,
    totalFrames: r.frames.length,
    warnings: [...r.warnings],
  };
}
export function pilotReport(meta: PilotMeta, attempts: PilotAttempt[]) {
  return {
    schema: "csh-pronunciation-pilot-v1",
    createdAt: new Date().toISOString(),
    evidenceKind: "OWNER_ENTERED_METADATA_ONLY",
    meta,
    windowsMicrophone: hardwareStatus(meta, attempts, "WINDOWS"),
    androidMicrophone: hardwareStatus(meta, attempts, "ANDROID"),
    phoneticAccuracy: "UNVERIFIED",
    audioIncluded: false,
    audioUploaded: false,
    storage: "TAB_MEMORY_UNTIL_EXPLICIT_JSON_DOWNLOAD",
    attempts,
  };
}
export class PilotSession {
  private nextId = 0;
  private state: { meta: PilotMeta; attempts: PilotAttempt[] } = {
    meta: {
      platform: "UNKNOWN",
      browser: "",
      microphone: "",
      source: "UNCONFIRMED",
    },
    attempts: [],
  };
  private listeners = new Set<() => void>();
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private publish() {
    this.state = { ...this.state, attempts: [...this.state.attempts] };
    for (const fn of this.listeners) fn();
  }
  setMeta(meta: PilotMeta) {
    // Reset attempt evidence if device/source changes; never relabel synthetic
    // observations as physical microphone evidence after the fact.
    this.state = {
      meta: {
        ...meta,
        browser: meta.browser.slice(0, 120),
        microphone: meta.microphone.slice(0, 120),
      },
      attempts: [],
    };
    this.publish();
  }
  count(target: string) {
    return this.state.attempts.filter((a) => a.target === target).length;
  }
  begin(target: string, noiseSuppression?: boolean): number | null {
    if (!supportedTone(target) || this.count(target) >= 3) return null;
    const id = ++this.nextId;
    this.state.attempts.push({
      ...blankObservation(),
      id,
      target,
      number: this.count(target) + 1,
      at: new Date().toISOString(),
      permission: "UNKNOWN",
      recording: "requesting",
      playedToEnd: false,
      peak: null,
      noiseSuppressionRequested: noiseSuppression ?? null,
      noiseSuppressionReported: null,
      measurement: null,
    });
    this.publish();
    return id;
  }
  update(
    id: number,
    patch: Partial<Omit<PilotAttempt, "id" | "target" | "number" | "at">>,
  ) {
    this.state.attempts = this.state.attempts.map((a) =>
      a.id === id
        ? { ...a, ...patch, notes: (patch.notes ?? a.notes).slice(0, 1000) }
        : a,
    );
    this.publish();
  }
}
