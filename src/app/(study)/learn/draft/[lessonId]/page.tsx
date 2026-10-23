import { notFound } from "next/navigation";
import { FoundationPlayer } from "@/modules/content/ui/foundation";
import { loadCurriculum } from "@/modules/curriculum/application/catalog";
import { loadDraftCatalog } from "@/modules/content/application/catalog";
export default async function DraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { lessonId } = await params;
  const lesson = loadCurriculum().lessons.find((l) => l.key === lessonId);
  if (!lesson) notFound();
  const requested = (await searchParams).version;
  const version = requested ?? lesson.currentVersion;
  if (
    !loadDraftCatalog().packages.some(
      (p) => p.lesson.id === lessonId && p.lesson.versionId === version,
    )
  )
    notFound();
  return (
    <FoundationPlayer key={version} lessonId={lessonId} versionId={version} />
  );
}
