// Private authoring CLI only. Never import from learner routes/components.
import fs from "node:fs";
import path from "node:path";
import { loadCurriculum } from "../src/modules/curriculum/application/catalog";
import { loadDraftCatalog } from "../src/modules/content/application/catalog";
export function exportReviewPackets(
  directory = path.resolve(".local-postgres/review-packets/sprint6"),
) {
  const privateRoot = path.resolve(".local-postgres/review-packets");
  if (!directory.startsWith(privateRoot + path.sep))
    throw new Error("Reviewer output must stay in ignored private directory");
  fs.mkdirSync(directory, { recursive: true });
  const curriculum = loadCurriculum(),
    { packages } = loadDraftCatalog();
  for (const l of curriculum.lessons) {
    const p = packages.find((p) => p.lesson.versionId === l.currentVersion)!,
      file = path.join(directory, `${l.key}.${p.lesson.version}.json`);
    if (fs.existsSync(file)) {
      const old = JSON.parse(fs.readFileSync(file, "utf8"));
      if (old.packageHash !== p.packageHash)
        throw new Error(
          "Packet version/hash conflict; do not overwrite reviewer findings",
        );
      continue;
    }
    const unresolved = [
      "Kiểm tra tính tự nhiên, Pinyin/biến điệu, nghĩa tiếng Việt và độ rõ của distractor.",
      "Đánh giá từng đáp án/accepted alternatives và giới hạn normalizer; chưa có human approval.",
      "Chưa có audio/transcript được cấp quyền và duyệt; không xác nhận nghe/phát âm.",
      ...p.lesson.newGrammarPatterns.map(
        (pattern) =>
          `Mẫu giảng dạy ${pattern}: chưa xác minh mapping cụ thể; locator ngữ pháp rộng không thay thế review.`,
      ),
      ...p.alignment.grammarReferences
        .filter((r) => r.status !== "VERIFIED")
        .map((r) => r.note),
      ...p.concepts
        .filter((c) => c.scope === "SUPPLEMENTARY")
        .map(
          (c) => `${c.hanzi}: supplementary, không gán là từ HSK đã xác minh.`,
        ),
    ];
    const packet = {
      packetSchemaVersion: 1,
      visibility: "PRIVATE_REVIEWER_ONLY",
      lessonId: l.key,
      lessonVersion: p.lesson.versionId,
      packageHash: p.packageHash,
      release: p.release,
      curriculum: {
        course: curriculum.courses.find(
          (c) =>
            c.id === curriculum.units.find((u) => u.id === l.unitId)!.courseId,
        ),
        unit: curriculum.units.find((u) => u.id === l.unitId),
      },
      state: p.state,
      reviewStatus: p.reviewStatus,
      publicationStatus: p.publicationStatus,
      objectives: p.lesson.objectives,
      teaching: p.blocks.filter((b) => b.type === "teaching"),
      conceptSkills: p.concepts,
      exercises: p.exercises.map((e) => ({
        ...e,
        answerKey: p.privateKeys.find((k) => k.id === e.keyRef),
      })),
      prerequisiteRequirements: l.requirements,
      alignment: p.alignment,
      rights: p.rights,
      media: p.media,
      audioStatus: "MISSING_UNREVIEWED",
      transcriptStatus: "NO_APPROVED_AUDIO_TRANSCRIPT",
      unresolved,
      reviewer: {
        identity: null,
        qualifications: null,
        reviewedAt: null,
        findings: [],
        decision: null,
        rightsDecision: null,
        audioDecision: null,
      },
      notice:
        "Export is not human review. Do not publish or infer approval. Keep private answer keys outside learner APIs.",
    };
    fs.writeFileSync(file, JSON.stringify(packet, null, 2) + "\n");
    fs.writeFileSync(
      path.join(directory, `${l.key}.${p.lesson.version}.md`),
      `# PRIVATE REVIEWER ONLY — ${l.key}\n\nVersion: ${p.lesson.versionId}\nHash: ${p.packageHash}\n\nReviewer identity: ______\nQualifications: ______\nDate: ______\nDecision: ______\n\nDo not infer approval from this generated packet. The companion JSON contains complete objectives, Chinese/Pinyin/Vietnamese teaching, exercises, private keys/accepted alternatives, mappings and source locators.\n\n## Questions\n\n${unresolved.map((q) => "- " + q).join("\n")}\n\n## Findings\n\nPending actual qualified human review.\n`,
    );
  }
  console.log(
    "Four private review packets available under .local-postgres/review-packets/sprint6; existing reviewer findings preserved. No approval granted.",
  );
  return directory;
}
if (
  process.argv[1]?.replaceAll("\\", "/").endsWith("/export-review-packets.ts")
)
  exportReviewPackets();
