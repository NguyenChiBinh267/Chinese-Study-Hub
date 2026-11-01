import { NextResponse, type NextRequest } from "next/server";
import {
  body,
  response,
  failure,
  idempotencyKey,
} from "@/modules/learning/server/local-service";
import {
  authSession,
  validateAuthRequest,
} from "@/modules/auth/server/session";
import {
  ownerProfile,
  saveOwnerProfile,
  ownerSettings,
  ownerProgress,
  releasePreview,
  saveOwnerSettings,
} from "@/modules/auth/server/repositories";
import { profileCommand } from "@/modules/auth/domain/profile";
import {
  studyPreferenceCommand,
  studyPreviewCommand,
} from "@/modules/planning/domain/study-commands";
import { CommandError } from "@/modules/learning/domain/local-foundation";
import { appMode, AuthConfigurationError } from "@/modules/auth/server/config";
import { FilePronunciationNoteRepository } from "@/modules/pronunciation/application/repository";
import {
  selectedLearning,
  publishedServices,
  publishedCommand,
  assertRegisteredRelease,
} from "@/modules/auth/server/published-learning";
import {
  technicalLearningEnabled,
  technicalSnapshot,
  technicalCommand,
} from "@/modules/auth/server/technical-learning";
export const dynamic = "force-dynamic";
async function handle(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
) {
  let session: ReturnType<typeof authSession> | undefined;
  try {
    if (appMode() !== "PRODUCTION_AUTHENTICATED")
      throw new CommandError(
        403,
        "AUTH_MODE_REQUIRED",
        "API owner chỉ mở trong chế độ xác thực.",
      );
    validateAuthRequest(request);
    session = authSession(request);
    const uid = await session.owner(),
      path = (await params).path.join("/");
    let data: unknown;
    const release =
      /^(status|release|snapshot|content|curriculum|pronunciation|media|cards|study|preferences|progress)(\/|$)/.test(
        path,
      )
        ? selectedLearning()
        : null;
    if (release) await assertRegisteredRelease(uid, release);
    if (release && !["status", "study/settings", "progress"].includes(path)) {
      if (path === "release")
        data = {
          id: release.id,
          available: true,
          technical: release.technical,
          privateOwnerPreview:
            "privateOwnerPreview" in release && release.privateOwnerPreview,
        };
      else if (
        path === "pronunciation" &&
        request.method === "GET" &&
        "privateOwnerPreview" in release
      )
        data = new FilePronunciationNoteRepository().load();
      else if (path === "snapshot")
        data = await publishedServices(release).snapshot(uid);
      else if (request.method === "GET" && path.startsWith("media/")) {
        const a = release.audio(path.slice(6));
        return session.finish(
          new NextResponse(new Uint8Array(a.bytes), {
            headers: {
              "Content-Type": a.type,
              "Cache-Control": "private, no-store",
              "X-Content-Type-Options": "nosniff",
            },
          }),
        );
      } else data = await publishedCommand(request, uid, path, release);
      return session.finish(response(data));
    }
    if (request.method === "GET" && path === "status")
      data = {
        enabled: false,
        active: true,
        environment: "PRODUCTION_AUTHENTICATED",
        technicalFixture: await technicalLearningEnabled(uid),
        publishedContent:
          release !== null && !("privateOwnerPreview" in release),
        privateOwnerPreview:
          !!release &&
          "privateOwnerPreview" in release &&
          release.privateOwnerPreview,
      };
    else if (request.method === "GET" && path === "release")
      data = { available: false, technical: false };
    else if (request.method === "GET" && path === "me")
      data = await ownerProfile(uid);
    else if (request.method === "PATCH" && path === "me")
      data = await saveOwnerProfile(uid, await body(request, profileCommand));
    else if (request.method === "GET" && path === "study/settings")
      data = await ownerSettings(uid);
    else if (request.method === "POST" && path === "study/preview")
      data = releasePreview(await body(request, studyPreviewCommand));
    else if (request.method === "PATCH" && path === "preferences")
      data = await saveOwnerSettings(
        uid,
        idempotencyKey(request),
        await body(request, studyPreferenceCommand),
      );
    else if (request.method === "GET" && path === "progress")
      data = {
        ...(await ownerProgress(uid)),
        approvedContentAvailable:
          release !== null && !("privateOwnerPreview" in release),
        privateOwnerPreview: !!release && "privateOwnerPreview" in release,
        publishedScope:
          release && !("privateOwnerPreview" in release)
            ? {
                releaseId: release.id,
                lessons: (
                  await publishedServices(release).catalog(uid)
                ).lessons.map((l) => ({
                  versionId: l.currentVersion,
                  completed: l.completed,
                })),
              }
            : null,
        privatePreviewScope:
          release && "privateOwnerPreview" in release
            ? {
                selectionId: release.id,
                lessons: (
                  await publishedServices(release).catalog(uid)
                ).lessons.map((l) => ({
                  versionId: l.currentVersion,
                  completed: l.completed,
                })),
              }
            : null,
      };
    else if (request.method === "GET" && path === "snapshot") {
      if (await technicalLearningEnabled(uid))
        return session.finish(response(await technicalSnapshot(uid)));
      const [settings, progress] = await Promise.all([
        ownerSettings(uid),
        ownerProgress(uid),
      ]);
      data = {
        settings: settings.configured
          ? {
              preferences: settings.preferences,
              version: settings.expectedVersion,
              updatedAt: progress.preferencesUpdatedAt,
            }
          : null,
        session: null,
        progress: {
          attempts: progress.attempts,
          correct: progress.correct,
          completedSessions: progress.completedSessions,
        },
        learning: {
          due: [],
          dueCount: 0,
          nextDueAt: null,
          reviews: progress.reviews,
          mastery: [],
        },
        source: "postgresql-owner",
      };
    } else if (
      /^(fixture|sessions|cards)(\/|$)/.test(path) &&
      (await technicalLearningEnabled(uid))
    )
      data = await technicalCommand(request, uid, path);
    else if (
      /^(content|curriculum|pronunciation|fixture|sessions|cards|study\/today|study\/replan|study\/review-activity)(\/|$)/.test(
        path,
      )
    )
      throw new CommandError(
        403,
        "DRAFT_CONTENT_LOCKED",
        "Học liệu và thẻ hiện chưa được duyệt để dùng trong production.",
      );
    else throw new CommandError(404, "NOT_FOUND", "Không có API này.");
    return session.finish(response(data));
  } catch (e) {
    const error =
      e instanceof AuthConfigurationError
        ? response(
            {
              error: {
                code: "AUTH_CONFIG",
                message: "Chưa cấu hình xác thực an toàn.",
              },
            },
            503,
          )
        : failure(e);
    return session ? session.finish(error) : error;
  }
}
export function GET(
  r: NextRequest,
  c: { params: Promise<{ path: string[] }> },
) {
  return handle(r, c.params);
}
export function POST(
  r: NextRequest,
  c: { params: Promise<{ path: string[] }> },
) {
  return handle(r, c.params);
}
export function PATCH(
  r: NextRequest,
  c: { params: Promise<{ path: string[] }> },
) {
  return handle(r, c.params);
}
