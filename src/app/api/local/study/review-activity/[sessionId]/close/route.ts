import type { NextRequest } from "next/server";
import {
  identity,
  studyRepository,
  response,
  failure,
  body,
  idempotencyKey,
} from "@/modules/learning/server/local-service";
import { emptyCommand, uuid } from "@/modules/learning/domain/local-foundation";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const uid = identity(request),
      key = idempotencyKey(request);
    await body(request, emptyCommand);
    const { sessionId } = await context.params;
    return response(
      await studyRepository().closeReview(uid, key, uuid.parse(sessionId)),
    );
  } catch (e) {
    return failure(e);
  }
}
