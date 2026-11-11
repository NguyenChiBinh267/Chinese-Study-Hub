// Consolidated private index over existing review packets. No new approval store.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { exportReviewPackets } from "./export-review-packets";
import { exportPronunciationReview } from "./export-pronunciation-review";
const lessons = exportReviewPackets();
const pronunciation = exportPronunciationReview();
const output = path.resolve(".local-postgres/review-packets/sprint11");
fs.mkdirSync(output, { recursive: true });
const hash = (file: string) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const escapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const escape = (value: unknown) =>
  String(value).replace(/[&<>"']/g, (c) => escapes[c]!);
const packets = fs
  .readdirSync(lessons)
  .filter((n) => n.endsWith(".json"))
  .map((name) => {
    const file = path.join(lessons, name),
      packet = JSON.parse(fs.readFileSync(file, "utf8"));
    return { file, packet, sha256: hash(file) };
  });
if (packets.length !== 4)
  throw Error("Expected four existing lesson review packets");
const pronFile = path.join(pronunciation, "pronunciation-foundation-v1.json");
const pron = JSON.parse(fs.readFileSync(pronFile, "utf8"));
if (pron.notes.length !== 31 || pron.illustrations.length !== 26)
  throw Error("Pronunciation review footprint changed");
const manifest = {
  kind: "PRIVATE_REVIEWER_ONLY_EXISTING_PACKETS",
  generatedAt: new Date().toISOString(),
  approvalGranted: false,
  lessons: packets.map(({ file, packet, sha256 }) => ({
    lesson: packet.lessonId,
    version: packet.lessonVersion,
    packageHash: packet.packageHash,
    packet: file,
    sha256,
    reviewStatus: packet.reviewStatus,
  })),
  pronunciation: {
    packet: pronFile,
    sha256: hash(pronFile),
    notes: pron.notes.length,
    configurations: pron.illustrations.length,
    svgDirectory: pronunciation,
  },
  humanRecords:
    "Existing lesson/pronunciation packet reviewer fields remain the only findings/sign-off records; this index is not a second review system.",
  unresolvedGrammar: [
    { id: "g-jiao-pattern", pattern: "我叫 + tên", status: "UNVERIFIED" },
    {
      id: "g-like-pattern",
      pattern: "喜欢 + cụm chỉ sở thích",
      status: "UNVERIFIED",
    },
  ],
  documentaryEvidence: path.resolve("docs/sprint11/source-locators.json"),
  audioPlan: path.resolve("docs/sprint11/review-and-audio.md"),
};
fs.writeFileSync(
  path.join(output, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
const sections = packets
  .map(
    ({ file, packet }) =>
      `<section><h2>${escape(packet.lessonId)} · ${escape(packet.lessonVersion)}</h2><p>DRAFT · chưa được duyệt. Package ${escape(packet.packageHash)}</p><a href="${escape(pathToFileURL(file).href)}">Mở packet gốc để ghi findings và sign-off</a><details><summary>Toàn bộ chữ Hán, Pinyin, tiếng Việt, bài tập, ĐÁP ÁN RIÊNG, provenance và locators</summary><pre>${escape(JSON.stringify(packet, null, 2))}</pre></details></section>`,
  )
  .join("\n");
fs.writeFileSync(
  path.join(output, "index.html"),
  `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chinese Study Hub · PRIVATE REVIEWER ONLY</title><style>body{font:17px/1.6 system-ui;max-width:1000px;margin:32px auto;padding:0 20px;color:#18352b;background:#fafbf7}section{border:1px solid #8b9f92;padding:20px;margin:24px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:15px/1.7 monospace}a{color:#165b89}summary{cursor:pointer}img{max-width:100%}</style><h1>PRIVATE REVIEWER ONLY · chưa được phép xuất bản</h1><p>Index hợp nhất từ packets Sprint 6/7 hiện có. Đáp án riêng chỉ để người duyệt đọc trên máy; không đưa artifact này vào Git, API hoặc public hosting. Không có sign-off tự động.</p><p>Ghi identity, qualifications, date, findings, decision, rights/audio decision vào packet gốc. Quyết định áp dụng cho đúng version/hash; correction cần version mới, không sửa lịch sử.</p>${sections}<section><h2>31 hướng dẫn phát âm và 26 cấu hình hình</h2><a href="${escape(pathToFileURL(path.join(pronunciation, "README.md")).href)}">Mở README và các SVG frames cùng thư mục</a><details><summary>Notes, illustration references, sources và các fields duyệt hiện có</summary><pre>${escape(JSON.stringify(pron, null, 2))}</pre></details></section><section><h2>Hai mapping còn UNVERIFIED</h2><p>我叫 + tên; 喜欢 / 喝. Một locator chung về câu vị ngữ động từ hoặc cụm động-tân không chứng minh toàn bộ mẫu giảng dạy. Xem source-locators.json và review-and-audio.md trong docs/sprint11.</p><h2>Checklist</h2><p>Chữ giản thể · Pinyin/biến điệu · nghĩa tiếng Việt · tự nhiên/phạm vi · distractors · mọi đáp án và accepted alternatives · normalizer · locators/HSK level · hình khẩu hình · provenance/quyền · transcript/giọng/consent/audio · keyboard/mobile.</p><p>Audio hiện chưa có bản được cấp quyền và duyệt. TTS tổng hợp không phải giọng mẫu người bản ngữ được duyệt. Không trao mastery từ tự đánh giá hoặc đồ thị cao độ.</p></section></html>`,
);
console.log(
  "Private consolidated review index ready: .local-postgres/review-packets/sprint11/index.html; existing human findings preserved, no approval granted.",
);
