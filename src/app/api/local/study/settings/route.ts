import type { NextRequest } from "next/server";
import {
  identity,
  studyRepository,
  response,
  failure,
} from "@/modules/learning/server/local-service";
export async function GET(request: NextRequest) {
  try {
    const uid = identity(request);
    return response(await studyRepository().settings(uid));
  } catch (e) {
    return failure(e);
  }
}
