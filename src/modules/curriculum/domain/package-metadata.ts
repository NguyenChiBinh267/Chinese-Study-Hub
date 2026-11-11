import type { ContentPackage } from "@/modules/content/domain/package";

export type CurriculumPackageMetadata = Pick<
  ContentPackage,
  | "packageHash"
  | "lesson"
  | "release"
  | "state"
  | "reviewStatus"
  | "publicationStatus"
  | "humanReview"
> & {
  alignment: Pick<
    ContentPackage["alignment"],
    "syllabusId" | "targetLevel" | "alignmentStatus"
  >;
  rights: Pick<
    ContentPackage["rights"],
    "licenseDecision" | "publicationReceipt"
  >;
  concepts: Pick<
    ContentPackage["concepts"][number],
    "id" | "hanzi" | "dictionaryPinyin" | "skills"
  >[];
  blockCount: number;
  exerciseCount: number;
};
export function curriculumPackageMetadata(
  p: ContentPackage,
): CurriculumPackageMetadata {
  return {
    packageHash: p.packageHash,
    lesson: p.lesson,
    release: p.release,
    state: p.state,
    reviewStatus: p.reviewStatus,
    publicationStatus: p.publicationStatus,
    humanReview: p.humanReview,
    alignment: {
      syllabusId: p.alignment.syllabusId,
      targetLevel: p.alignment.targetLevel,
      alignmentStatus: p.alignment.alignmentStatus,
    },
    rights: {
      licenseDecision: p.rights.licenseDecision,
      publicationReceipt: p.rights.publicationReceipt,
    },
    concepts: p.concepts.map(({ id, hanzi, dictionaryPinyin, skills }) => ({
      id,
      hanzi,
      dictionaryPinyin,
      skills,
    })),
    blockCount: p.blocks.length,
    exerciseCount: p.exercises.length,
  };
}
