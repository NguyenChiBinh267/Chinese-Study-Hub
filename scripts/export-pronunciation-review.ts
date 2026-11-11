// Local authoring only. Never imported by learner routes.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FilePronunciationNoteRepository } from "../src/modules/pronunciation/application/repository";
import { ArticulationGuide } from "../src/modules/pronunciation/ui/articulation-guide";

export function exportPronunciationReview(
  directory = path.resolve(".local-postgres/review-packets/sprint7/final"),
) {
  const root = path.resolve(".local-postgres/review-packets");
  directory = path.resolve(directory);
  if (!directory.startsWith(root + path.sep))
    throw new Error("Review output must stay in ignored private directory");
  fs.mkdirSync(directory, { recursive: true });
  const release = new FilePronunciationNoteRepository().load();
  const sha = (data: string) => createHash("sha256").update(data).digest("hex");
  const releaseHash = JSON.parse(
    fs.readFileSync("content/pronunciation/release-pin.json", "utf8"),
  ).sha256;
  const rendererHash = sha(
    fs
      .readFileSync(
        "src/modules/pronunciation/ui/articulation-guide.tsx",
        "utf8",
      )
      .replace(/\r\n/g, "\n"),
  );
  const output = path.join(directory, "pronunciation-foundation-v1.json");
  if (fs.existsSync(output)) {
    const prior = JSON.parse(fs.readFileSync(output, "utf8"));
    if (
      prior.releaseHash !== releaseHash ||
      prior.rendererHash !== rendererHash
    )
      throw new Error(
        "REVIEW_PACKET_CONFLICT: preserve findings; create a new packet version for changes",
      );
    console.log(
      "Existing private pronunciation packet/findings preserved; no approval imported.",
      directory,
    );
    return directory;
  }
  const visuals = release.illustrations.map((model) => {
    const rendered = renderToStaticMarkup(
      createElement(ArticulationGuide, { model }),
    );
    const frames = [...rendered.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(
      (match, index) => {
        const filename = `${model.id}.${index + 1}.svg`;
        const svg = match[0].replace(
          "<svg ",
          '<svg xmlns="http://www.w3.org/2000/svg" ',
        );
        const file = path.join(directory, filename);
        if (fs.existsSync(file) && fs.readFileSync(file, "utf8") !== svg)
          throw new Error("Do not overwrite annotated reviewer SVG");
        if (!fs.existsSync(file)) fs.writeFileSync(file, svg);
        return { filename, sha256: sha(svg) };
      },
    );
    return {
      model,
      frames,
      reviewer: {
        identity: null,
        qualifications: null,
        reviewedAt: null,
        findings: [],
        decision: null,
      },
    };
  });
  const packet = {
    visibility: "PRIVATE_REVIEW_PREPARATION_NOT_APPROVAL",
    releaseHash,
    rendererHash,
    releaseId: release.id,
    author: release.author,
    sources: release.sources,
    notes: release.notes.map((note) => ({
      note,
      reviewQuestions: [
        "Đối chiếu âm mẫu/Pinyin và phân loại phụ âm, nguyên âm, thanh.",
        "Kiểm tra mô tả môi, đầu/thân lưỡi, hàm, hơi, voicing, cao độ và nhịp.",
        "Thử hướng dẫn tiếng Việt với người bắt đầu; đây chưa phải pilot hiểu bài.",
        "Kiểm tra riêng sơ đồ: vị trí tiếp cận/đóng, pha thả hơi và giới hạn giải phẫu.",
        "Phân biệt citation/context/sandhi; không suy lỗi môi/lưỡi từ audio.",
        "Chưa có audio được duyệt hoặc bộ chấm âm học; cần quyền và đánh giá trước khi bật.",
      ],
      reviewer: {
        identity: null,
        qualifications: null,
        reviewedAt: null,
        findings: [],
        decision: null,
        rightsDecision: null,
        audioDecision: null,
      },
    })),
    illustrations: visuals,
    notice:
      "All text and SVGs remain unreviewed drafts. Export and model checks are not qualified human review. There is no approval-import/publishing endpoint.",
  };
  fs.writeFileSync(output, JSON.stringify(packet, null, 2) + "\n");
  fs.writeFileSync(
    path.join(directory, "README.md"),
    `# Private pronunciation review\n\nRelease: ${release.id}\nRelease hash: ${releaseHash}\nRenderer hash: ${rendererHash}\n\n31 original draft notes and 26 schematic configurations. Open the SVG frames locally and compare them with each note's anatomical claims. There is no approved reference audio. The JSON has findings/identity/date/decision fields per note and model; leave them empty until actual qualified review.\n\nNo approval is inferred or imported. Export again preserves existing findings; conflicts require a new version.\n`,
  );
  console.log(
    "Private review preparation exported: 31 notes, 26 configurations and SVG frames. Human fields empty; no approval granted.",
    directory,
  );
  return directory;
}
if (
  process.argv[1]
    ?.replaceAll("\\", "/")
    .endsWith("/export-pronunciation-review.ts")
)
  exportPronunciationReview();
