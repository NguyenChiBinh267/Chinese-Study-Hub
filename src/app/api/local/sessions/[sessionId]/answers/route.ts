import type { NextRequest } from "next/server";
import {
  answerCommand,
  uuid,
} from "@/modules/learning/domain/local-foundation";
import {
  body,
  identity,
  repository,
  response,
  failure,
  idempotencyKey,
} from "@/modules/learning/server/local-service";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const uid = identity(request),
      key = idempotencyKey(request),
      id = uuid.parse((await context.params).sessionId),
      command = await body(request, answerCommand);
    return response(await repository().answer(uid, key, id, command));
  } catch (e) {
    return failure(e);
  }
}
