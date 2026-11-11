import type { NextRequest } from "next/server";
import { startCommand } from "@/modules/learning/domain/local-foundation";
import {
  body,
  identity,
  repository,
  response,
  failure,
  idempotencyKey,
} from "@/modules/learning/server/local-service";
export async function POST(request: NextRequest) {
  try {
    const uid = identity(request),
      key = idempotencyKey(request),
      command = await body(request, startCommand);
    return response(await repository().start(uid, key, command.restart));
  } catch (e) {
    return failure(e);
  }
}
