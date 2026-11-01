import { CourseExplorer } from "@/modules/curriculum/ui/courses";
export default async function UnitPage({
  params,
}: {
  params: Promise<{ courseId: string; unitSlug: string }>;
}) {
  const { courseId, unitSlug } = await params;
  return <CourseExplorer courseCode={courseId} unitSlug={unitSlug} />;
}
