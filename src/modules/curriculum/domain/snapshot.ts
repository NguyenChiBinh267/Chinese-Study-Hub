import type {
  Curriculum,
  AvailabilityState,
  prerequisiteStatus,
  lessonAccess,
} from "./catalog";
export type CourseView = Omit<Curriculum["courses"][number], "availability"> & {
  availability: AvailabilityState;
  activityState: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  unitCount: number;
  totalLessons: number;
  publishedAvailable: number;
  practiceOnly: number;
  practiced: number;
  completed: number;
  pending: number;
  independentEvidence: number;
  dueCards: number;
  currentPracticeScopeComplete: boolean;
};
export type LessonView = Curriculum["lessons"][number] & {
  courseCode: string;
  courseTitle: string;
  unitTitle: string;
  unitSlug: string;
  title: string;
  objectives: string[];
  estimatedMinutes: number;
  packageHash: string;
  reviewStatus: string;
  publicationStatus: string;
  alignment: string;
  contentPrerequisites: string[];
  exerciseCount: number;
  prerequisites: ReturnType<typeof prerequisiteStatus>;
  access: ReturnType<typeof lessonAccess>;
  started: boolean;
  practiced: boolean;
  completed: boolean;
  activityState: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  sessionId: string | null;
  independentEvidence: number;
  historicalVersions: string[];
  dueCards: number;
};
export type CurriculumSnapshot = {
  releaseId: string;
  asOf: string;
  units: Curriculum["units"];
  lessons: LessonView[];
  courses: CourseView[];
};
