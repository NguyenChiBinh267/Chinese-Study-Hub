import type { NextRequest } from "next/server";
import { uuid, emptyCommand } from "@/modules/learning/domain/local-foundation";
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
      key = idempotencyKey(request);
    await body(request, emptyCommand);
    return response(
      await contentRepository().complete(
        uid,
        key,
        uuid.parse((await params).sessionId),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
