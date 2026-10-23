import type { NextRequest } from "next/server";
import {
  identity,
  repository,
  response,
  failure,
} from "@/modules/learning/server/local-service";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const uid = identity(request);
    return response(await repository().snapshot(uid));
  } catch (e) {
    return failure(e);
  }
}
