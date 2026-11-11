// One explicit character gap, without inventing an HSK2 vocabulary entry.
import fs from "node:fs";
import {
  contentHash,
  loadDraftCatalog,
} from "../src/modules/content/application/catalog";
import {
  packageSchema,
  validatePackage,
} from "../src/modules/content/domain/package";
import { expansionEnabled } from "../src/modules/curriculum/application/local-expansion";
import { PINYIN_NORMALIZER } from "../src/modules/content/domain/pinyin";
if (!expansionEnabled()) throw Error("LOCAL_ONLY");
const dir = "content/hsk24",
  read = (f: string) => JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
const manifest = read("manifest.json"),
  catalog = read("catalog.json"),
  extra = read("evidence.json"),
  reviews = read("reviews.json"),
  { packages, evidence } = loadDraftCatalog();
if (
  manifest.packages.some(
    (m: { versionId: string }) => m.versionId === "l296-draft-v1",
  )
)
  throw Error("BRIDGE_ALREADY_EXISTS");
const source = packages.find((p) => p.lesson.versionId === "l201-draft-v1")!,
  p = structuredClone(source);
const reference = {
  id: "h2-char-50",
  kind: "character" as const,
  status: "VERIFIED" as const,
  officialLevel: 2,
  sourceLocator: {
    pdfIndex: 357,
    physicalPage: 358,
    printedPage: 355,
    section: "character" as const,
    entry: "50",
  },
  written: "留",
  pinyin: null,
  senseId: null,
  ordinal: 50,
  note: "Pinned HSK2 recognition-character row50. This does not assign the vocabulary word 留 to HSK2; original teaching remains unreviewed.",
};
if (extra.references.some((r: { id: string }) => r.id === reference.id))
  throw Error("EXISTING_CHARACTER_REFERENCE");
extra.references.push(reference);
evidence.references.push(reference);
p.lesson = {
  ...p.lesson,
  id: "L296",
  version: 1,
  versionId: "l296-draft-v1",
  title: "Bổ sung nhận diện chữ 留 · đồ dùng đã học",
  prerequisites: [source.lesson.versionId],
  newGrammarPatterns: [],
  objectives: [
    "Nhận diện chữ 留, đọc liú trong ví dụ ở lại; ôn bốn từ đồ dùng đã học.",
    "Đây là chữ thuộc bảng nhận diện; không cộng thêm mục từ HSK2 hay công nhận mastery.",
  ],
};
p.alignment.characterReferences.push(reference);
p.alignment.alignmentEvidence = [
  "Source character row50 verified; vocabulary uses of 留 are supplementary, not an official HSK2 word claim.",
];
const concept = {
  id: "l296-char-liu",
  version: 1 as const,
  senseId: "l296-liu-stay",
  hanzi: "留",
  dictionaryPinyin: "liú",
  meaning: "chữ 留; trong ví dụ: ở lại",
  skills: ["recognition", "reading", "pinyin"] as (
    | "recognition"
    | "reading"
    | "pinyin"
  )[],
  referenceIds: [reference.id],
  scope: "SUPPLEMENTARY" as const,
};
p.concepts.push(concept);
p.exercises = p.exercises.slice(0, 5);
p.privateKeys = p.exercises.map(
  (e) => source.privateKeys.find((k) => k.id === e.keyRef)!,
);
for (const [i, e] of p.exercises.entries()) {
  const key = structuredClone(p.privateKeys[i]);
  e.id = `l296-e${i}`;
  e.keyRef = `l296-k${i}`;
  key.id = e.keyRef;
  key.exerciseVersionId = e.id;
  p.privateKeys[i] = key;
}
for (const [type, prompt, choices, answer, normalizer] of [
  [
    "choice",
    "Nhận diện chữ đọc liú trong ví dụ ở lại nhà: 我□在家里。",
    ["留", "流", "刘", "六"],
    "留",
    "exact-choice-v1",
  ],
  [
    "pinyin",
    "Chữ 留 trong nghĩa ở lại ở ví dụ này đọc thế nào?",
    [],
    "liú",
    PINYIN_NORMALIZER,
  ],
  [
    "short",
    "Nhập chữ vừa học, đọc liú, ở vị trí □ trong 我□在家里。",
    [],
    "留",
    "hanzi-nfc-exact-v1",
  ],
] as const) {
  const i = p.exercises.length,
    id = `l296-e${i}`,
    key = `l296-k${i}`;
  p.exercises.push({
    id,
    version: 1,
    type,
    skill: type === "pinyin" ? "pinyin" : "recognition",
    conceptId: concept.id,
    senseId: concept.senseId,
    keyRef: key,
    prompt,
    choices: [...choices],
    inputHint: "Nhận diện chữ theo ví dụ; chưa đánh giá viết tay.",
    requiresAudio: false,
    mediaIds: [],
  });
  p.privateKeys.push({
    id: key,
    version: 1,
    exerciseVersionId: id,
    senseId: concept.senseId,
    accepted: [answer],
    normalizerVersion: normalizer,
    gradingVersion: "deterministic-content-v1",
    feedback:
      "留 đọc liú trong ví dụ ở lại. Không lẫn 流 (chảy), 刘 (họ Lưu), 六 (sáu). Các chữ đối chiếu là hỗ trợ, không phải mục từ HSK2 mới.",
  });
}
p.blocks = [
  ...source.blocks
    .filter((b) => b.type === "teaching")
    .map((b, i) => ({ ...b, id: `l296-t${i}` })),
  {
    id: "l296-liu",
    type: "teaching",
    title: "Chữ 留 · liú",
    text: "留 là chữ trong bảng nhận diện HSK2. Trong 留在家里, nó diễn đạt ở lại nhà. Đây là ví dụ hỗ trợ đọc chữ, chưa xác minh cấp từ vựng của từ 留. Phân biệt với 流, 刘 và 六: hình chữ hoặc nghĩa khác. Các chữ đối chiếu chỉ làm gợi ý phân biệt.",
    hanzi: "我留在家里，用笔写这个字。我的本子是白色的。",
    pinyin:
      "Wǒ liú zài jiā lǐ, yòng bǐ xiě zhège zì. Wǒ de běnzi shì báisè de.",
    meaning: "Tôi ở lại nhà, dùng bút viết chữ này. Vở của tôi màu trắng.",
    readingMinutes: 2,
  },
  ...p.exercises.map((e, i) => ({
    id: `l296-b${i}`,
    type: "exercise" as const,
    exerciseVersionId: e.id,
  })),
];
p.packageHash = contentHash(p);
packageSchema.parse(p);
const issues = validatePackage(p, [...packages, p], evidence);
if (issues.length) throw Error(JSON.stringify(issues));
const file = "L296.v1.json";
manifest.packages.push({
  file,
  versionId: p.lesson.versionId,
  sha256: p.packageHash,
});
const original = catalog.lessons.find((l: { key: string }) => l.key === "L201");
catalog.lessons.push({
  ...original,
  id: "62000000-0000-4000-8000-000000000296",
  key: "L296",
  order:
    Math.max(
      ...catalog.lessons
        .filter((l: { unitId: string }) => l.unitId === original.unitId)
        .map((l: { order: number }) => l.order),
    ) + 1,
  currentVersion: p.lesson.versionId,
});
const origin = {
  file: "L201.v1.json",
  versionId: source.lesson.versionId,
  sha256: source.packageHash,
};
reviews.activities.push({
  versionId: p.lesson.versionId,
  sha256: p.packageHash,
  kind: "CHARACTER_BRIDGE",
  sourceVersions: [source.lesson.versionId],
  origins: Object.fromEntries(
    p.concepts.map((c) => [
      c.id,
      c.id === concept.id
        ? { file, versionId: p.lesson.versionId, sha256: p.packageHash }
        : origin,
    ]),
  ),
  characterItems: [{ character: "留", exerciseId: "l296-e5" }],
  scope:
    "One newly taught recognition character, four previously taught senses; zero additional official HSK2 vocabulary.",
});
for (const [name, data] of [
  [file, p],
  ["manifest.json", manifest],
  ["catalog.json", catalog],
  ["evidence.json", extra],
  ["reviews.json", reviews],
] as const)
  fs.writeFileSync(`${dir}/${name}`, JSON.stringify(data, null, 2) + "\n");
console.log(
  "Added recognition bridge for 留. No HSK2 vocabulary count change.",
);
