import type { NextRequest } from "next/server";
import { uuid } from "@/modules/learning/domain/local-foundation";
import { ratingCommand } from "@/modules/review/domain/local-review";
import {
  body,
  identity,
  idempotencyKey,
  reviewRepository,
  response,
  failure,
} from "@/modules/learning/server/local-service";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ cardId: string }> },
) {
  try {
    const uid = identity(request),
      key = idempotencyKey(request),
      id = uuid.parse((await context.params).cardId),
      command = await body(request, ratingCommand);
    return response(await reviewRepository().rate(uid, key, id, command));
  } catch (e) {
    return failure(e);
  }
}
