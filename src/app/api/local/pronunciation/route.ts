import type { NextRequest } from "next/server";
import {
  identity,
  response,
  failure,
} from "@/modules/learning/server/local-service";
import { FilePronunciationNoteRepository } from "@/modules/pronunciation/application/repository";
import { CommandError } from "@/modules/learning/domain/local-foundation";
export async function GET(request: NextRequest) {
  try {
    identity(request); // Existing development/loopback/Host/Origin/HMAC/owner gates.
    const origin = request.headers.get("origin");
    if (
      origin &&
      origin !==
        new URL(process.env.CSH_APP_ORIGIN ?? "http://127.0.0.1:3000").origin
    ) {
      throw new CommandError(
        403,
        "ORIGIN_REQUIRED",
        "Hướng dẫn local chỉ được đọc từ origin đã cấu hình.",
      );
    }
    return response(new FilePronunciationNoteRepository().load());
  } catch (e) {
    if (e instanceof CommandError) return failure(e);
    return response(
      {
        error: {
          code: "PRONUNCIATION_CONTENT_UNAVAILABLE",
          message:
            "Chưa đọc được hướng dẫn phát âm có phiên bản. Thử lại hoặc quay về bài học; chưa có nhận xét giọng.",
        },
      },
      503,
    );
  }
}
