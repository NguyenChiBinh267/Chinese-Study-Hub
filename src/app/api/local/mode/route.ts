import type { NextRequest } from "next/server";
import { mode, failure } from "@/modules/learning/server/local-service";
export async function POST(request: NextRequest) {
  try {
    return await mode(request);
  } catch (e) {
    return failure(e);
  }
}
