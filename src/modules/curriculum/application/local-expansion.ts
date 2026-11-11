import fs from "node:fs";
import path from "node:path";
import base from "../../../../content/curriculum/catalog.v1.json";

// Explicit opt-in for an isolated development database; never a production policy.
export function expansionEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.CSH_LOCAL_CURRICULUM === "hsk24-batch1" &&
    process.env.CSH_LOCAL_DATABASE === "1" &&
    !process.env.CSH_PRIVATE_OWNER_PREVIEW &&
    !process.env.CSH_CONTENT_RELEASE &&
    !process.env.VERCEL
  );
}
export function curriculumOutline() {
  if (!expansionEnabled()) return base;
  return JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "content/hsk24/catalog.json"),
      "utf8",
    ),
  );
}
