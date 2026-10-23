import type { NextRequest } from "next/server";
import { uuid } from "@/modules/learning/domain/local-foundation";
import { leaseCommand } from "@/modules/learning/domain/duration";
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
      input = await body(request, leaseCommand);
    return response(
      await contentRepository().lease(
        uid,
        key,
        uuid.parse((await params).sessionId),
        input.clientId,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
