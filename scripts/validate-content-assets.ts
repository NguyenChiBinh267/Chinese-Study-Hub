// Offline validator: migration/authoring only, never imported by application routes.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { ContentPackage } from "../src/modules/content/domain/package";
export function validateAssetHashes(p: ContentPackage, root = process.cwd()) {
  const allowed = [
    path.resolve(root, "public"),
    path.resolve(root, "content/staging/slice/media"),
  ];
  const within = (parent: string, child: string) => {
    const rel = path.relative(parent, child);
    return (
      rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)
    );
  };
  return p.media.flatMap((m) => {
    const target = path.resolve(root, m.uri);
    let code = "";
    if (!allowed.some((dir) => within(dir, target))) code = "ASSET_PATH";
    else if (!fs.existsSync(target) || !fs.statSync(target).isFile())
      code = "ASSET_MISSING";
    else if (
      !allowed.some(
        (dir) =>
          fs.existsSync(dir) &&
          within(fs.realpathSync(dir), fs.realpathSync(target)),
      )
    )
      code = "ASSET_PATH";
    else if (
      createHash("sha256").update(fs.readFileSync(target)).digest("hex") !==
      m.sha256
    )
      code = "ASSET_HASH";
    return code
      ? [
          {
            file: `${p.lesson.id}.v1.json`,
            recordId: m.id,
            field: "media.sha256",
            code,
            message:
              "Local approved-path asset must exist and match declared bytes/hash",
          },
        ]
      : [];
  });
}
