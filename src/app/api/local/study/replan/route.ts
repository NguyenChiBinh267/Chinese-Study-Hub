import type { NextRequest } from "next/server";
import {
  identity,
  studyRepository,
  response,
  failure,
  body,
  idempotencyKey,
} from "@/modules/learning/server/local-service";
import { replanCommand } from "@/modules/planning/domain/study-commands";
export async function POST(request: NextRequest) {
  try {
    const uid = identity(request),
      key = idempotencyKey(request),
      command = await body(request, replanCommand);
    return response(await studyRepository().replan(uid, key, command));
  } catch (e) {
    return failure(e);
  }
}
