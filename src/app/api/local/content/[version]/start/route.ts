import type { NextRequest } from "next/server";
import { draftStart } from "@/modules/content/domain/commands";
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
  { params }: { params: Promise<{ version: string }> },
) {
  try {
    const uid = identity(request),
      key = idempotencyKey(request),
      input = await body(request, draftStart);
    return response(
      await contentRepository().start(uid, key, (await params).version, input),
    );
  } catch (e) {
    return failure(e);
  }
}
