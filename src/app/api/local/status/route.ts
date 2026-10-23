import type { NextRequest } from "next/server";
import { status, failure } from "@/modules/learning/server/local-service";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    return await status(request);
  } catch (e) {
    return failure(e);
  }
}
