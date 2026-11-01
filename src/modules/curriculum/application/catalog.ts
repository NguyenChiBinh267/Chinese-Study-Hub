import { curriculumOutline } from "./local-expansion";
import { loadDraftCatalog } from "@/modules/content/application/catalog";
import { validateCurriculum } from "../domain/catalog";
export function loadCurriculum() {
  return validateCurriculum(curriculumOutline(), loadDraftCatalog().packages);
}
