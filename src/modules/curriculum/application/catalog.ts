import raw from "../../../../content/curriculum/catalog.v1.json";
import { loadDraftCatalog } from "@/modules/content/application/catalog";
import { validateCurriculum } from "../domain/catalog";
export function loadCurriculum() {
  return validateCurriculum(raw, loadDraftCatalog().packages);
}
