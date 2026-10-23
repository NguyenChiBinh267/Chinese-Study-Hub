import { CourseExplorer } from "@/modules/curriculum/ui/courses";
export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <CourseExplorer courseCode={courseId} />;
}
