import type { NextRequest } from "next/server";
import { draftAdvance } from "@/modules/content/domain/commands";
import { uuid } from "@/modules/learning/domain/local-foundation";
import {
  identity,
  contentRepository,
  response,
  failure,
  body,
  idempotencyKey,
} from "@/modules/learning/server/local-service";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const uid = identity(request),
      key = idempotencyKey(request),
      input = await body(request, draftAdvance),
      id = uuid.parse((await params).sessionId);
    return response(
      await contentRepository().advance(uid, key, id, input.expectedVersion),
    );
  } catch (e) {
    return failure(e);
  }
}
