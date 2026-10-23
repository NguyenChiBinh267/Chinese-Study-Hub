// Pure, deterministic LOCAL planner. No provider, clock, SQL or AI calls.
export const PLANNER_VERSION = "weekly-v1-local-2-curriculum";
export type StudySettings = {
  weeklyMinutes: number;
  days: number[]; // Existing repository uses Monday=0..Sunday=6.
  dayCaps: number[];
  preferredMinutes: number;
  maxSessionMinutes: number;
  paused: boolean;
  timezone: string;
  startingLevel: "zero" | "some";
  version: number;
};
export type PlanLesson = {
  id: string;
  versionId: string;
  minutes: number;
  order: number;
  prerequisites: string[];
  completed: boolean;
  verifiedEligible: boolean;
  checkpointMinutes?: number;
  practiceAllowed?: boolean;
  courseCode?: string;
  courseTitle?: string;
  unitTitle?: string;
  unitSlug?: string;
};
export type PlanSession = {
  id: string;
  versionId: string;
  startedAt: string;
  remainingMinutes: number;
};
export type PlanCard = {
  id: string;
  dueAt: string;
  state: number;
  concept: string;
};
export type PlanBlock = {
  id: string;
  localDate: string;
  ordinal: number;
  kind: "review" | "resume" | "draft_lesson";
  target: string;
  targetIds: string[];
  estimatedMinutes: number;
  status: "ready" | "tentative" | "in_progress" | "completed";
  reason: string;
  sessionId?: string;
  courseCode?: string;
  courseTitle?: string;
  unitTitle?: string;
  unitSlug?: string;
};
export type WeeklyInput = {
  asOf: string;
  settings: StudySettings;
  cards: PlanCard[];
  lessons: PlanLesson[];
  sessions: PlanSession[];
  observedByDate: Record<string, number>; // Accepted milliseconds only, not estimates.
  overrides: Record<string, number>;
  frozen: PlanBlock[];
  reviewSecondsPerCard?: number;
  observedBySession?: Record<string, number>;
};
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
export function localDate(instant: string, timezone: string) {
  let formatter = dateFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(new Date(instant));
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function addDays(date: string, count: number) {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + count);
  return day.toISOString().slice(0, 10);
}
export function weekday(date: string) {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}
export function weekStart(date: string) {
  return addDays(date, -weekday(date));
}
export function allocateWeek(input: WeeklyInput) {
  const { settings: s } = input;
  const today = localDate(input.asOf, s.timezone),
    start = weekStart(today),
    end = addDays(start, 6);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const spentMs = dates.reduce((n, d) => n + (input.observedByDate[d] ?? 0), 0);
  const actualMinutes = spentMs / 60000;
  const requestedMinutes = s.paused ? 0 : s.weeklyMinutes;
  const remainingBudget = Math.max(0, requestedMinutes - actualMinutes);
  const fullCapacity = dates.reduce(
    (n, d) => n + (s.days.includes(weekday(d)) ? s.dayCaps[weekday(d)] : 0),
    0,
  );
  const capacityByDate = Object.fromEntries(
    dates.map((d) => [
      d,
      d < today || s.paused || !s.days.includes(weekday(d))
        ? 0
        : Math.max(
            0,
            Math.min(s.dayCaps[weekday(d)], input.overrides[d] ?? 180) -
              (input.observedByDate[d] ?? 0) / 60000,
          ),
    ]),
  );
  const remainingCapacity = Object.values(capacityByDate).reduce(
    (a, b) => a + b,
    0,
  );
  const todayCapacityMinutes = capacityByDate[today];
  const frozen = input.frozen.filter(
    (b) => b.localDate >= start && b.localDate <= end,
  );
  // Actual time and frozen intent are distinct. Reserve only the unobserved tail
  // of active blocks, once per date; completed estimates never become actual.
  const activeReserved: Record<string, number> = {};
  for (const b of frozen.filter(
    (b) => b.status === "in_progress" && b.localDate >= today,
  ))
    activeReserved[b.localDate] =
      (activeReserved[b.localDate] ?? 0) +
      Math.max(
        0,
        b.estimatedMinutes - (input.observedBySession?.[b.id] ?? 0) / 60000,
      );
  for (const d of dates)
    capacityByDate[d] = Math.max(
      0,
      capacityByDate[d] - (activeReserved[d] ?? 0),
    );
  const frozenRemaining = Object.values(activeReserved).reduce(
    (a, b) => a + b,
    0,
  );
  const usable = Math.max(
    0,
    Math.min(
      remainingBudget - frozenRemaining,
      Object.values(capacityByDate).reduce((a, b) => a + b, 0),
    ),
  );
  let left = Math.floor(usable),
    buffer = Math.min(Math.round(usable * 0.1), left);
  const blocks: PlanBlock[] = [];
  const reasons: string[] = [];
  if (s.paused) reasons.push("PAUSED");
  if (actualMinutes > s.weeklyMinutes) reasons.push("BUDGET_BELOW_SPENT");
  if (s.weeklyMinutes > fullCapacity) reasons.push("CAPACITY_SHORTFALL");
  if (dates.some((d) => d < today && s.days.includes(weekday(d))))
    reasons.push("PAST_DAYS_NOT_CARRIED");
  const cards = [...input.cards]
    .filter((c) => localDate(c.dueAt, s.timezone) <= end)
    .sort(
      (a, b) =>
        (a.state === 3 ? 0 : 1) - (b.state === 3 ? 0 : 1) ||
        a.dueAt.localeCompare(b.dueAt) ||
        a.id.localeCompare(b.id),
    );
  const costSeconds = Math.min(
    120,
    Math.max(5, input.reviewSecondsPerCard ?? 30),
  );
  // An active review block already reserves these cards and its remaining time.
  // Replanning must not schedule the same intent a second time.
  const allocatedCards = new Set<string>(
    frozen
      .filter(
        (b) =>
          b.kind === "review" &&
          b.status === "in_progress" &&
          b.localDate >= today,
      )
      .flatMap((b) => b.targetIds),
  );
  function put(
    date: string,
    block: Omit<PlanBlock, "id" | "localDate" | "ordinal" | "status">,
    status: PlanBlock["status"] = "ready",
  ) {
    const minutes = block.estimatedMinutes;
    if (
      minutes > left ||
      minutes > capacityByDate[date] ||
      minutes > s.maxSessionMinutes ||
      minutes <= 0
    )
      return false;
    const ordinal = blocks.filter((b) => b.localDate === date).length + 1;
    blocks.push({
      ...block,
      id: `${date}:${ordinal}:${block.kind}:${block.target}`,
      localDate: date,
      ordinal,
      status,
    });
    left -= minutes;
    capacityByDate[date] -= minutes;
    return true;
  }
  // Review can consume reserved slack, but never an extra minute beyond usable.
  for (const date of dates.filter((d) => d >= today)) {
    const eligible = cards.filter(
      (c) =>
        !allocatedCards.has(c.id) && localDate(c.dueAt, s.timezone) <= date,
    );
    while (
      eligible.length &&
      left >= 1 &&
      capacityByDate[date] >= 1 &&
      !s.paused
    ) {
      const cap = Math.floor(
        Math.min(
          s.preferredMinutes,
          s.maxSessionMinutes,
          left,
          capacityByDate[date],
        ),
      );
      const count = Math.min(
        eligible.length,
        Math.floor((cap * 60) / costSeconds),
      );
      if (!count) break;
      const picked = eligible.splice(0, count),
        minutes = Math.ceil((picked.length * costSeconds) / 60);
      if (
        !put(date, {
          kind: "review",
          target: "due",
          targetIds: picked.map((c) => c.id),
          estimatedMinutes: minutes,
          reason: picked.some((c) => c.state === 3)
            ? "RELEARNING_FIRST"
            : "DUE_BEFORE_NEW",
        })
      )
        break;
      picked.forEach((c) => allocatedCards.add(c.id));
    }
  }
  const unallocatedCards = cards.filter((c) => !allocatedCards.has(c.id));
  const reviewDebtCards = unallocatedCards.filter(
    (c) => c.dueAt <= input.asOf,
  ).length;
  if (reviewDebtCards) {
    reasons.push("REVIEW_OVERLOAD");
    buffer = 0;
  } else buffer = Math.min(buffer, left);
  const completed = new Set(
    input.lessons.filter((l) => l.completed).map((l) => l.versionId),
  );
  const active = new Set(input.sessions.map((x) => x.versionId));
  const pendingCandidates = [
    ...[...input.sessions]
      .sort(
        (a, b) =>
          a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
      )
      .map((session) => ({
        session,
        lesson: input.lessons.find((l) => l.versionId === session.versionId),
      })),
    ...[...input.lessons]
      .sort(
        (a, b) => a.order - b.order || a.versionId.localeCompare(b.versionId),
      )
      .filter((l) => !l.completed && !active.has(l.versionId))
      .map((lesson) => ({ lesson, session: undefined })),
  ];
  // Four bounded drafts, once each. No filler/repeated new concepts to consume budget.
  if (!reviewDebtCards && !s.paused)
    for (const candidate of pendingCandidates) {
      const { lesson, session } = candidate;
      if (
        !lesson ||
        frozen.some(
          (b) =>
            b.sessionId === session?.id && session && b.localDate === today,
        )
      )
        continue;
      const prerequisitesPracticed = lesson.prerequisites.every((p) =>
        completed.has(p),
      );
      if (!session && !prerequisitesPracticed) continue;
      if (!lesson.verifiedEligible && lesson.practiceAllowed === false)
        continue;
      let minutes = Math.min(
        session?.remainingMinutes ?? lesson.minutes,
        s.preferredMinutes,
        s.maxSessionMinutes,
      );
      // Pick the earliest usable date, including an explicitly supported saved
      // checkpoint today before a full-length slot on a later day.
      const date = dates.find(
        (d) =>
          d >= today &&
          !blocks.some((b) => b.localDate === d && b.kind !== "review") &&
          ((capacityByDate[d] >= minutes && left - buffer >= minutes) ||
            (lesson.checkpointMinutes !== undefined &&
              Math.floor(
                Math.min(10, minutes, capacityByDate[d], left - buffer),
              ) >= lesson.checkpointMinutes)),
      );
      if (date && (capacityByDate[date] < minutes || left - buffer < minutes))
        minutes = Math.floor(
          Math.min(10, minutes, capacityByDate[date], left - buffer),
        );
      if (!date) continue;
      put(
        date,
        {
          kind: session ? "resume" : "draft_lesson",
          target: lesson.versionId,
          targetIds: [lesson.versionId],
          estimatedMinutes: minutes,
          reason: session
            ? "RESUME_SAVED_CHECKPOINT"
            : lesson.verifiedEligible
              ? "ELIGIBLE_LESSON"
              : "OPTIONAL_DRAFT_NOT_UNLOCKED",
          ...(session ? { sessionId: session.id } : {}),
          ...(lesson.courseCode
            ? {
                courseCode: lesson.courseCode,
                courseTitle: lesson.courseTitle,
                unitTitle: lesson.unitTitle,
                unitSlug: lesson.unitSlug,
              }
            : {}),
        },
        lesson.verifiedEligible || session ? "ready" : "tentative",
      );
    }
  if (
    !blocks.length &&
    !frozen.some((b) => b.status === "in_progress") &&
    !s.paused
  )
    reasons.push(
      remainingBudget <= 0
        ? "BUDGET_EXHAUSTED"
        : capacityByDate[today] <= 0
          ? "REST_DAY_OR_CAP_REACHED"
          : "NO_ELIGIBLE_ACTIVITY",
    );
  const plannedMinutes = blocks.reduce((n, b) => n + b.estimatedMinutes, 0);
  const dueNow = input.cards.filter((c) => c.dueAt <= input.asOf).length;
  const dueIds = new Set(
    input.cards.filter((c) => c.dueAt <= input.asOf).map((c) => c.id),
  );
  const todayBlocks = blocks.filter(
    (b) =>
      b.localDate === today &&
      (b.kind !== "review" || b.targetIds.some((id) => dueIds.has(id))),
  );
  const frozenToday = frozen.find(
    (b) =>
      b.status === "in_progress" &&
      b.localDate === today &&
      (b.kind !== "review" || b.targetIds.some((id) => dueIds.has(id))),
  );
  const frozenReview = frozen.find(
    (b) =>
      b.status === "in_progress" &&
      b.localDate === today &&
      b.kind === "review" &&
      b.targetIds.some((id) => dueIds.has(id)),
  );
  const resumeToday = todayBlocks.find((b) => b.kind === "resume");
  const dueBlock = todayBlocks.find((b) => b.kind === "review");
  // Â§6.4: due/relearning before resume; otherwise resume then optional draft.
  const action =
    s.paused ||
    remainingBudget <= 0 ||
    remainingCapacity <= 0 ||
    todayCapacityMinutes <= 0
      ? null
      : dueNow && (frozenReview || dueBlock)
        ? (frozenReview ?? dueBlock!)
        : (frozenToday ?? resumeToday ?? todayBlocks[0] ?? null);
  return {
    plannerVersion: PLANNER_VERSION,
    asOf: input.asOf,
    timezone: s.timezone,
    weekStart: start,
    today,
    requestedMinutes,
    fullCapacityMinutes: fullCapacity,
    feasibleMinutes: Math.min(requestedMinutes, fullCapacity),
    unscheduledMinutes: Math.max(0, requestedMinutes - fullCapacity),
    actualMinutes,
    actualMs: spentMs,
    remainingMinutes: remainingBudget,
    remainingCapacityMinutes: remainingCapacity,
    todayCapacityMinutes,
    frozenRemainingMinutes: frozenRemaining,
    plannedMinutes,
    bufferMinutes: Math.min(buffer, Math.max(0, usable - plannedMinutes)),
    unusedMinutes: Math.max(0, usable - plannedMinutes - buffer),
    reviewDebtCards,
    unallocatedReviewCards: unallocatedCards.length,
    dueCount: dueNow,
    costModel: {
      secondsPerCard: costSeconds,
      source: input.reviewSecondsPerCard
        ? "observed_median_14d"
        : "fallback_30_seconds",
    },
    reasons,
    blocks,
    frozen,
    action,
    forecast: {
      status: "INSUFFICIENT_REVIEWED_DATA",
      message: "ChÆ°a Ä‘á»§ dá»¯ liá»‡u Ä‘á»ƒ dá»± bÃ¡o tiáº¿n Ä‘á»™ HSK.",
    },
  };
}
export type WeeklyPlan = ReturnType<typeof allocateWeek>;
