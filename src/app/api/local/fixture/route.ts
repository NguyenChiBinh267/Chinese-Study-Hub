import type { NextRequest } from "next/server";
import { fixture } from "@/modules/learning/server/local-fixture";
import {
  identity,
  response,
  failure,
} from "@/modules/learning/server/local-service";
export async function GET(request: NextRequest) {
  try {
    identity(request);
    return response(fixture);
  } catch (e) {
    return failure(e);
  }
}
