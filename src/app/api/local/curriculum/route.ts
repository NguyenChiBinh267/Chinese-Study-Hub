import type { NextRequest } from "next/server";
import {
  identity,
  curriculumRepository,
  response,
  failure,
} from "@/modules/learning/server/local-service";
export async function GET(request: NextRequest) {
  try {
    return response(await curriculumRepository().snapshot(identity(request)));
  } catch (e) {
    return failure(e);
  }
}
