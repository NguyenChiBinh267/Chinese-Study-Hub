import type { NextRequest } from "next/server";
import { uuid } from "@/modules/learning/domain/local-foundation";
import { revealCommand } from "@/modules/review/domain/local-review";
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
      command = await body(request, revealCommand);
    return response(
      await reviewRepository().reveal(uid, key, id, command.expectedVersion),
    );
  } catch (e) {
    return failure(e);
  }
}
