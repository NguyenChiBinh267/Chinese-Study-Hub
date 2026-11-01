import type { NextRequest } from "next/server";
import { compatiblePreferences } from "@/modules/planning/domain/study-commands";
import {
  body,
  identity,
  repository,
  studyRepository,
  response,
  failure,
  idempotencyKey,
} from "@/modules/learning/server/local-service";
export async function PATCH(request: NextRequest) {
  try {
    const uid = identity(request),
      key = idempotencyKey(request),
      command = await body(request, compatiblePreferences);
    return response(
      "planning" in command
        ? await studyRepository().save(uid, key, command)
        : await repository().savePreferences(uid, key, command),
    );
  } catch (e) {
    return failure(e);
  }
}
