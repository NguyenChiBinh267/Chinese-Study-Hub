// The authenticated study layout resolves the immutable version through its API.
import { notFound } from "next/navigation";
import { appMode } from "@/modules/auth/server/config";
export default function ReleasedLesson() {
  if (appMode() !== "PRODUCTION_AUTHENTICATED") notFound();
  return null;
}
