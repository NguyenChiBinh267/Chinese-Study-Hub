import type { ReactNode } from "react";
import { appMode } from "@/modules/auth/server/config";
import { requirePageOwner } from "@/modules/auth/server/page-guard";
import { OwnerStudy } from "@/modules/auth/ui/study";
export default async function StudyLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requirePageOwner();
  return appMode() === "PRODUCTION_AUTHENTICATED" ? <OwnerStudy /> : children;
}
