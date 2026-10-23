import type { NextRequest } from "next/server";
import {
  identity,
  studyRepository,
  response,
  failure,
  body,
} from "@/modules/learning/server/local-service";
import { studyPreviewCommand } from "@/modules/planning/domain/study-commands";
export async function POST(request: NextRequest) {
  try {
    const uid = identity(request),
      command = await body(request, studyPreviewCommand);
    return response(await studyRepository().preview(uid, command));
  } catch (e) {
    return failure(e);
  }
}
