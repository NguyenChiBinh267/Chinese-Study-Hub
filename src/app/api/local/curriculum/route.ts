import type { NextRequest } from "next/server";
import {
  identity,
  curriculumRepository,
  response,
  failure,
} from "@/modules/learning/server/local-service";
export async function GET(request: NextRequest) {
  const started = performance.now();
  let result;
  try {
    result = response(await curriculumRepository().snapshot(identity(request)));
  } catch (e) {
    result = failure(e);
  }
  result.headers.set(
    "Server-Timing",
    `app;dur=${(performance.now() - started).toFixed(1)}`,
  );
  return result;
}
