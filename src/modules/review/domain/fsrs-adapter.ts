import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card,
  type CardInput,
} from "ts-fsrs";
export const ALGORITHM = "ts-fsrs@5.4.2/FSRS-6";
// Persist full defaults (including weights/steps); fuzz off for reproducible replay.
export const SCHEDULER_CONFIG = generatorParameters({
  request_retention: 0.9,
  enable_fuzz: false,
});
const scheduler = fsrs(SCHEDULER_CONFIG);
export const ratings = ["Again", "Hard", "Good", "Easy"] as const;
export type ReviewRating = (typeof ratings)[number];
export type StoredCard = Omit<Card, "due" | "last_review"> & {
  due: string;
  last_review?: string;
};
export function storeCard(card: Card): StoredCard {
  const { last_review, ...rest } = card;
  return {
    ...rest,
    due: card.due.toISOString(),
    ...(last_review ? { last_review: last_review.toISOString() } : {}),
  };
}
export function newCard(now: Date): StoredCard {
  return storeCard(createEmptyCard(now));
}
export function schedule(card: StoredCard, now: Date, rating: ReviewRating) {
  if (
    !Number.isFinite(now.getTime()) ||
    now.getTime() < Date.parse(card.last_review ?? card.due)
  )
    throw new Error("Scheduler time precedes card availability");
  const result = scheduler.next(card as CardInput, now, Rating[rating]);
  return {
    card: storeCard(result.card),
    log: JSON.parse(JSON.stringify(result.log)) as Record<string, unknown>,
  };
}
export function previews(card: StoredCard, now: Date) {
  return Object.fromEntries(
    ratings.map((r) => [r, schedule(card, now, r).card.due]),
  ) as Record<ReviewRating, string>;
}
