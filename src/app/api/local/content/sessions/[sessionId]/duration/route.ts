import type { NextRequest } from "next/server";
import { uuid } from "@/modules/learning/domain/local-foundation";
import { durationCommand } from "@/modules/learning/domain/duration";
import {
  identity,
  contentRepository,
  response,
  failure,
  body,
} from "@/modules/learning/server/local-service";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const uid = identity(request),
      input = await body(request, durationCommand);
    return response(
      await contentRepository().duration(
        uid,
        uuid.parse((await params).sessionId),
        input,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
