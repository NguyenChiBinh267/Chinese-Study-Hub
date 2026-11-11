import type { NextRequest } from "next/server";
import {
  identity,
  contentRepository,
  response,
  failure,
} from "@/modules/learning/server/local-service";
export async function GET(request: NextRequest) {
  try {
    return response(await contentRepository().summary(identity(request)));
  } catch (e) {
    return failure(e);
  }
}
