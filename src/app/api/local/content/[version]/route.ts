import type { NextRequest } from "next/server";
import {
  identity,
  contentRepository,
  response,
  failure,
} from "@/modules/learning/server/local-service";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ version: string }> },
) {
  try {
    const uid = identity(request);
    return response(
      await contentRepository().view(uid, (await params).version),
    );
  } catch (e) {
    return failure(e);
  }
}
