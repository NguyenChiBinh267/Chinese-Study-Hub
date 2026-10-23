import type { NextRequest } from "next/server";
import { emptyCommand, uuid } from "@/modules/learning/domain/local-foundation";
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
      id = uuid.parse((await context.params).sessionId);
    await body(request, emptyCommand);
    return response(await repository().complete(uid, key, id));
  } catch (e) {
    return failure(e);
  }
}
