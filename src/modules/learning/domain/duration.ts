import { z } from "zod";
export const DURATION_RULE = "foreground-idle60-v1";
export const durationCommand = z.strictObject({
  eventId: z.uuid(),
  leaseId: z.uuid(),
  clientId: z.uuid(),
  observedStart: z.iso.datetime(),
  observedEnd: z.iso.datetime(),
  lastInteractionAt: z.iso.datetime(),
  activeMs: z.int().min(0).max(15000),
});
export const leaseCommand = z.strictObject({ clientId: z.uuid() });
export type DurationInput = z.infer<typeof durationCommand>;
export type DurationClass =
  | "VALIDATED_TELEMETRY"
  | "SUSPICIOUS_INVALID"
  | "MISSING_INSUFFICIENT";
export function classifyDuration(
  input: DurationInput,
  now: Date,
  lease: { leaseId: string; clientId: string; issuedAt: Date; expiresAt: Date },
  overlaps: boolean,
) {
  const start = Date.parse(input.observedStart),
    end = Date.parse(input.observedEnd),
    interaction = Date.parse(input.lastInteractionAt),
    server = now.getTime();
  const reasons: string[] = [];
  if (![start, end, interaction, server].every(Number.isFinite) || end < start)
    reasons.push("ORDERING");
  if (
    input.leaseId !== lease.leaseId ||
    input.clientId !== lease.clientId ||
    server > lease.expiresAt.getTime()
  )
    reasons.push("LEASE_LOST");
  if (
    start < lease.issuedAt.getTime() - 2000 ||
    end > server + 2000 ||
    server - end > 120000 ||
    Math.abs(server - end) > 120000
  )
    reasons.push("CLOCK_OR_STALE");
  if (
    end - start > 15000 ||
    Math.abs(end - start - input.activeMs) > 500 ||
    input.activeMs > end - start + 1 ||
    (end === start && input.activeMs > 0) ||
    input.activeMs < 0
  )
    reasons.push("BOUNDS");
  if (interaction > end || end > interaction + 60000) reasons.push("IDLE_CAP");
  if (overlaps) reasons.push("OVERLAP");
  const classification: DurationClass = reasons.length
    ? "SUSPICIOUS_INVALID"
    : input.activeMs > 0
      ? "VALIDATED_TELEMETRY"
      : "MISSING_INSUFFICIENT";
  return {
    classification,
    acceptedMs: classification === "VALIDATED_TELEMETRY" ? input.activeMs : 0,
    reasons,
    ruleVersion: DURATION_RULE,
  };
}
// Client-side interval arithmetic is testable without DOM. Hidden/unfocused time is 0.
export function activeWindow(
  start: number,
  end: number,
  lastInteraction: number,
  visible: boolean,
) {
  if (!visible || end < start) return null;
  const stop = Math.min(end, lastInteraction + 60000);
  if (stop <= start) return null;
  return { start, end: stop, activeMs: Math.min(15000, stop - start) };
}
