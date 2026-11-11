// Master Plan §6.2 v1. Duration/key review are eligibility inputs, never guessed.
export const MASTERY_ENGINE = "mastery-v1-local-1";
export type Evidence = {
  id: string;
  item: string;
  at: string;
  score: number;
  weight: number;
  source:
    | "verified_key"
    | "human"
    | "ai_provisional"
    | "self"
    | "unreviewed_fixture";
  assisted: boolean;
  answerSeen: boolean;
  repeatedInSession: boolean;
  durationVerified: boolean;
  delayedProbe: boolean;
};
export type Mastery = {
  status: "unseen" | "learning" | "practicing" | "secure" | "needs_review";
  evidenceCount: number;
  independentCorrectCount: number;
  distinctItems: number;
  independentAccuracy: number | null;
  delayedAccuracy: number | null;
  stale: boolean;
  lastVerifiedAt: string | null;
  evidenceIds: string[];
  excludedCount: number;
  engineVersion: string;
};
const day = 86400000;
function accuracy(a: Evidence[]) {
  const weights = a.reduce((s, e) => s + e.weight, 0);
  return weights
    ? a.reduce((s, e) => s + e.score * e.weight, 0) / weights
    : null;
}
export function projectMastery(input: Evidence[], now: Date): Mastery {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid mastery clock");
  const eligible: Evidence[] = [],
    seen = new Map<string, number>(),
    ids = new Set<string>();
  for (const e of [...input].sort(
    (a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id),
  )) {
    if (ids.has(e.id)) continue;
    ids.add(e.id);
    const time = Date.parse(e.at);
    // Exposures, even excluded/assisted ones, prevent claiming independent
    // performance on the same item again inside 24h.
    if (
      !Number.isFinite(time) ||
      time > now.getTime() ||
      !Number.isFinite(e.score) ||
      e.score < 0 ||
      e.score > 1 ||
      !Number.isFinite(e.weight) ||
      e.weight <= 0
    )
      continue;
    const previous = seen.get(e.item);
    seen.set(e.item, time);
    if (
      !["verified_key", "human"].includes(e.source) ||
      e.assisted ||
      e.answerSeen ||
      e.repeatedInSession ||
      !e.durationVerified ||
      (previous !== undefined && time - previous < day)
    )
      continue;
    eligible.push(e);
  }
  const last = eligible.at(-1),
    last5 = eligible.slice(-5),
    last3 = eligible.slice(-3);
  const first = eligible[0];
  const delayed = eligible.filter(
    (e) =>
      e.delayedProbe &&
      first &&
      Date.parse(e.at) - Date.parse(first.at) >= 2 * day,
  );
  const distinct = new Set(eligible.map((e) => e.item)).size;
  const days = new Set(eligible.map((e) => e.at.slice(0, 10))).size; // UTC evidence days; never client locale.
  let status: Mastery["status"] = eligible.length ? "learning" : "unseen";
  if (eligible.length >= 3) status = "practicing";
  if (
    eligible.length >= 5 &&
    distinct >= 3 &&
    days >= 2 &&
    (accuracy(last5) ?? 0) >= 0.8 &&
    (accuracy(delayed) ?? 0) >= 0.8
  )
    status = "secure";
  if (last3.length >= 3 && (accuracy(last3) ?? 1) < 0.6)
    status = "needs_review";
  // Plan's stale prose is ambiguous about downgrade. Preserve attained status
  // and use stale flag as explicitly required by its following sentence.
  return {
    status,
    evidenceCount: eligible.length,
    independentCorrectCount: eligible.filter((e) => e.score === 1).length,
    distinctItems: distinct,
    independentAccuracy: accuracy(last5),
    delayedAccuracy: accuracy(delayed),
    stale: !!last && now.getTime() - Date.parse(last.at) > 30 * day,
    lastVerifiedAt: last?.at ?? null,
    evidenceIds: eligible.map((e) => e.id),
    excludedCount: input.length - eligible.length,
    engineVersion: MASTERY_ENGINE,
  };
}
export function foundationPrerequisite(m: Mastery) {
  return (
    ["practicing", "secure"].includes(m.status) &&
    !m.stale &&
    m.distinctItems >= 3 &&
    (m.independentAccuracy ?? 0) >= 0.8
  );
}
