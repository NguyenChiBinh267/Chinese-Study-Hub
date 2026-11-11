import { notFound } from "next/navigation";
import { demoLessons } from "@/modules/content/fixtures/demo";
import { LessonPlayer } from "@/modules/learning/ui/lesson-player";
import { LocalLessonPlayer } from "@/modules/learning/ui/local-slice";
export function generateStaticParams() {
  return demoLessons.map((lesson) => ({ lessonId: lesson.id }));
}
export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  if (lessonId === "local-foundation-v1") return <LocalLessonPlayer />;
  const lesson = demoLessons.find((item) => item.id === lessonId);
  if (!lesson) notFound();
  return <LessonPlayer key={lesson.id} lesson={lesson} />;
}
