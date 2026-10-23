import "server-only";
import type { NextRequest } from "next/server";
import { authConfiguration } from "./config";
import { authenticatedPool } from "./repositories";
import { TECHNICAL_FIXTURE } from "../domain/technical-fixture";
import { ownerTransaction, assertLearningGate } from "@/shared/db/transaction";
import { PostgresLocalRepository } from "@/modules/learning/infrastructure/postgres-local-repository";
import { PostgresReviewRepository } from "@/modules/review/infrastructure/postgres-review-repository";
import { fixture } from "@/modules/learning/server/local-fixture";
import { body, idempotencyKey } from "@/modules/learning/server/local-service";
import {
  CommandError,
  startCommand,
  answerCommand,
  emptyCommand,
  uuid,
} from "@/modules/learning/domain/local-foundation";
import {
  revealCommand,
  ratingCommand,
} from "@/modules/review/domain/local-review";

// Called only AFTER remote owner verification. Config, database, migration/role
// proof and owner-bound fixture marker must all match. No DRAFT package is read.
export async function technicalLearningEnabled(uid: string) {
  if (!authConfiguration().technicalFixture) return false;
  return ownerTransaction(authenticatedPool(), uid, async (c) => {
    await assertLearningGate(c);
    const marker = (
      await c.query(
        "SELECT evidence FROM app_meta.runtime_proof WHERE singleton",
      )
    ).rows[0]?.evidence?.technicalFixture;
    if (marker?.id !== TECHNICAL_FIXTURE || marker?.ownerId !== uid)
      throw new CommandError(
        503,
        "TECHNICAL_FIXTURE_PROOF_REQUIRED",
        "Chưa có bằng chứng RLS cho bộ kiểm thử riêng.",
      );
    const mixed = (
      await c.query(
        "SELECT EXISTS(SELECT 1 FROM app_private.lesson_sessions WHERE user_id=$1 AND lesson_version_id<>$2) OR EXISTS(SELECT 1 FROM app_private.cards WHERE user_id=$1 AND template_version_id NOT IN ('local-recall-v1-0','local-recall-v1-1')) AS mixed",
        [uid, fixture.id],
      )
    ).rows[0].mixed;
    if (mixed)
      throw new CommandError(
        503,
        "TECHNICAL_FIXTURE_MIXED_DATA",
        "Database kiểm thử có dữ liệu ngoài fixture; tạm khóa thay vì đọc học liệu nháp.",
      );
    return true;
  });
}
export async function technicalSnapshot(uid: string) {
  const snapshot = await new PostgresLocalRepository(
    authenticatedPool(),
  ).snapshot(uid);
  return { ...snapshot, source: "postgresql-authenticated-test" };
}
export async function technicalCommand(
  request: NextRequest,
  uid: string,
  path: string,
) {
  if (!(await technicalLearningEnabled(uid)))
    throw new CommandError(
      403,
      "DRAFT_CONTENT_LOCKED",
      "Chỉ mở fixture kỹ thuật trong database kiểm thử riêng.",
    );
  const repo = new PostgresLocalRepository(authenticatedPool());
  if (request.method === "GET" && path === "fixture") return fixture;
  if (request.method !== "POST")
    throw new CommandError(404, "NOT_FOUND", "Không có thao tác này.");
  const key = idempotencyKey(request);
  if (path === "sessions")
    return repo.start(uid, key, (await body(request, startCommand)).restart);
  const parts = path.split("/"),
    id = uuid.parse(parts[1]);
  if (parts.length !== 3)
    throw new CommandError(404, "NOT_FOUND", "Không có thao tác này.");
  if (parts[0] === "sessions") {
    if (parts[2] === "answers")
      return repo.answer(uid, key, id, await body(request, answerCommand));
    if (parts[2] === "complete") {
      await body(request, emptyCommand);
      return repo.complete(uid, key, id);
    }
  }
  if (parts[0] === "cards") {
    // Even an owner's existing DRAFT card must not enter this technical route.
    const allowed = await ownerTransaction(
      authenticatedPool(),
      uid,
      async (c) =>
        (
          await c.query(
            "SELECT 1 FROM app_private.cards WHERE user_id=$1 AND id=$2 AND template_version_id IN ('local-recall-v1-0','local-recall-v1-1')",
            [uid, id],
          )
        ).rowCount === 1,
    );
    if (!allowed)
      throw new CommandError(
        404,
        "CARD_NOT_FOUND",
        "Không có thẻ kỹ thuật của bạn.",
      );
    const reviews = new PostgresReviewRepository(authenticatedPool());
    if (parts[2] === "reveal")
      return reviews.reveal(
        uid,
        key,
        id,
        (await body(request, revealCommand)).expectedVersion,
      );
    if (parts[2] === "rating")
      return reviews.rate(uid, key, id, await body(request, ratingCommand));
  }
  throw new CommandError(404, "NOT_FOUND", "Không có thao tác này.");
}
