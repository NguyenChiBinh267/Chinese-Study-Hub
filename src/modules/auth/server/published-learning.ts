import "server-only";
import type { NextRequest } from "next/server";
import { loadContentRelease } from "@/modules/content/application/releases";
import {
  loadPrivateOwnerPreview,
  assertPrivatePath,
} from "@/modules/content/application/private-preview";
import { PostgresContentRepository } from "@/modules/content/infrastructure/postgres-content";
import { PostgresReviewRepository } from "@/modules/review/infrastructure/postgres-review-repository";
import { PostgresStudyRepository } from "@/modules/planning/infrastructure/postgres-study";
import { PostgresLocalRepository } from "@/modules/learning/infrastructure/postgres-local-repository";
import { curriculumWithin } from "@/modules/curriculum/infrastructure/postgres-curriculum";
import { ownerTransaction } from "@/shared/db/transaction";
import { authenticatedPool } from "./repositories";
import { body, idempotencyKey } from "@/modules/learning/server/local-service";
import {
  CommandError,
  uuid,
  emptyCommand,
} from "@/modules/learning/domain/local-foundation";
import {
  draftStart,
  draftAnswer,
  draftAdvance,
} from "@/modules/content/domain/commands";
import {
  leaseCommand,
  durationCommand,
} from "@/modules/learning/domain/duration";
import {
  revealCommand,
  ratingCommand,
} from "@/modules/review/domain/local-review";
import {
  studyPreviewCommand,
  studyPreferenceCommand,
  replanCommand,
} from "@/modules/planning/domain/study-commands";
export function publishedRelease() {
  try {
    return loadContentRelease();
  } catch {
    throw new CommandError(
      503,
      "CONTENT_RELEASE_UNAVAILABLE",
      "Bản phát hành thiếu bằng chứng, đã rút hoặc không nhất quán. Lịch sử vẫn được giữ; thử tải lại sau.",
    );
  }
}
export function selectedLearning() {
  try {
    return loadPrivateOwnerPreview() ?? publishedRelease();
  } catch {
    throw new CommandError(
      503,
      "CONTENT_RELEASE_UNAVAILABLE",
      "Lựa chọn nội dung thiếu hoặc không khớp; tạm khóa bài. Lịch sử được giữ.",
    );
  }
}
type LearningSelection = NonNullable<ReturnType<typeof selectedLearning>>;
export async function assertRegisteredRelease(
  uid: string,
  r: LearningSelection,
) {
  try {
    await ownerTransaction(authenticatedPool(), uid, async (c) => {
      for (const p of r.all) await r.access.packageFor(c, p.lesson.versionId);
    });
  } catch {
    throw new CommandError(
      503,
      "CONTENT_RELEASE_UNAVAILABLE",
      "Bản phát hành không khớp phiên bản đã đăng ký. Lịch sử được giữ; chưa mở nội dung.",
    );
  }
}
export function publishedServices(r: LearningSelection) {
  const pool = authenticatedPool(),
    scope = {
      id: r.id,
      current: r.current,
      all: r.all,
      privateOwnerPreview: "privateOwnerPreview" in r && r.privateOwnerPreview,
    };
  return {
    content: new PostgresContentRepository(pool, r.access),
    review: new PostgresReviewRepository(pool, r.template),
    study: new PostgresStudyRepository(pool, scope),
    snapshot: async (uid: string) => {
      const data = await new PostgresLocalRepository(
        pool,
        r.template,
        r.all.map((p) => p.lesson.versionId),
      ).snapshot(uid);
      return {
        ...data,
        session: null,
        source: "postgresql-owner",
        learning: {
          ...data.learning,
          mastery: data.learning.mastery.filter((m) =>
            r.all.some((p) => p.concepts.some((c) => c.id === m.conceptId)),
          ),
        },
      };
    },
    catalog: (uid: string) =>
      ownerTransaction(pool, uid, (c) => curriculumWithin(c, uid, scope)),
  };
}
export async function publishedCommand(
  request: NextRequest,
  uid: string,
  path: string,
  r: LearningSelection,
) {
  if ("privateOwnerPreview" in r)
    await ownerTransaction(authenticatedPool(), uid, (c) =>
      assertPrivatePath(c, uid, path, r),
    );
  const repo = publishedServices(r),
    parts = path.split("/");
  if (request.method === "GET") {
    if (path === "content") return repo.content.library(uid);
    if (path === "curriculum") return repo.catalog(uid);
    if (path === "content/summary") return repo.content.summary(uid);
    if (parts[0] === "content" && parts.length === 2)
      return repo.content.view(uid, parts[1]);
    if (path === "study/today") return repo.study.today(uid);
  }
  const key =
    path === "study/preview" || path.endsWith("/duration")
      ? ""
      : idempotencyKey(request);
  if (request.method === "PATCH" && path === "preferences")
    return repo.study.save(
      uid,
      key,
      await body(request, studyPreferenceCommand),
    );
  if (request.method === "POST") {
    if (path === "study/preview")
      return repo.study.preview(uid, await body(request, studyPreviewCommand));
    if (path === "study/replan")
      return repo.study.replan(uid, key, await body(request, replanCommand));
    if (path === "study/review-activity")
      return repo.study.reviewActivity(uid, key);
    if (
      parts[0] === "study" &&
      parts[1] === "review-activity" &&
      parts[3] === "close" &&
      parts.length === 4
    ) {
      await body(request, emptyCommand);
      return repo.study.closeReview(uid, key, uuid.parse(parts[2]));
    }
    if (parts[0] === "content" && parts.length === 3 && parts[2] === "start")
      return repo.content.start(
        uid,
        key,
        parts[1],
        await body(request, draftStart),
      );
    if (
      parts[0] === "content" &&
      parts[1] === "sessions" &&
      parts.length === 4
    ) {
      const id = uuid.parse(parts[2]);
      if (parts[3] === "answers")
        return repo.content.answer(
          uid,
          key,
          id,
          await body(request, draftAnswer),
        );
      if (parts[3] === "advance")
        return repo.content.advance(
          uid,
          key,
          id,
          (await body(request, draftAdvance)).expectedVersion,
        );
      if (parts[3] === "complete") {
        await body(request, emptyCommand);
        return repo.content.complete(uid, key, id);
      }
      if (parts[3] === "lease")
        return repo.content.lease(
          uid,
          key,
          id,
          (await body(request, leaseCommand)).clientId,
        );
      if (parts[3] === "duration")
        return repo.content.duration(
          uid,
          id,
          await body(request, durationCommand),
        );
    }
    if (parts[0] === "cards" && parts.length === 3) {
      const id = uuid.parse(parts[1]);
      if (parts[2] === "reveal")
        return repo.review.reveal(
          uid,
          key,
          id,
          (await body(request, revealCommand)).expectedVersion,
        );
      if (parts[2] === "rating")
        return repo.review.rate(
          uid,
          key,
          id,
          await body(request, ratingCommand),
        );
    }
  }
  throw new CommandError(
    404,
    "NOT_FOUND",
    "Không có thao tác cho bản phát hành này.",
  );
}
