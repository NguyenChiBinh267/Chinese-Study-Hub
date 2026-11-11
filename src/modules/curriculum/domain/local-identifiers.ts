// Compatibility: the padded suffix is byte-identical to every existing
// three-digit allocation, and supports the saved L4001+ continuation.
export function localCurriculumUuid(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 999999)
    throw Error("LOCAL_CURRICULUM_ID_RANGE");
  return `62000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
}
