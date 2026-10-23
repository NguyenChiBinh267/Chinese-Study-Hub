import type { NextRequest } from "next/server";
import {
  identity,
  studyRepository,
  response,
  failure,
  body,
  idempotencyKey,
} from "@/modules/learning/server/local-service";
import { emptyCommand } from "@/modules/learning/domain/local-foundation";
export async function POST(request: NextRequest) {
  try {
    const uid = identity(request),
      key = idempotencyKey(request);
    await body(request, emptyCommand);
    return response(await studyRepository().reviewActivity(uid, key));
  } catch (e) {
    return failure(e);
  }
}
