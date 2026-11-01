// One-time original draft authoring. Existing immutable versions are never overwritten.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  packageSchema,
  type ContentPackage,
} from "../src/modules/content/domain/package";
const root = path.join(process.cwd(), "content/staging/slice");
const pin = JSON.parse(
  fs.readFileSync(path.join(root, "source-pin.json"), "utf8"),
);
function author(id: "L001" | "L002") {
  const destination = path.join(root, `${id}.v2.json`);
  if (fs.existsSync(destination)) throw new Error("IMMUTABLE_VERSION_EXISTS");
  const p = JSON.parse(
    fs.readFileSync(path.join(root, `${id}.v1.json`), "utf8"),
  ) as ContentPackage;
  const version = `${id.toLowerCase()}-draft-v2`;
  p.lesson.version = 2;
  p.lesson.versionId = version;
  if (id === "L002") p.lesson.prerequisites = ["l001-draft-v2"];
  p.lesson.objectives =
    id === "L001"
      ? [
          "Đọc hội thoại tự giới thiệu và hiểu lời hỏi lại.",
          "Tự sắp xếp và nhập câu ngắn 我叫安 theo đáp án nháp.",
        ]
      : [
          "Hiểu câu nói về sở thích trong hội thoại ngắn.",
          "Sắp xếp và nhập câu về thích trà hoặc thích uống trà.",
        ];
  p.alignment.sourceSnapshotSha256 = pin.pdfSha256;
  p.alignment.alignmentEvidence.push(
    "Sprint5 original text/exercises; same 26 checked factual locators, direct exact-PDF pin. No human language/key approval; exact teaching-pattern interpretation remains UNVERIFIED.",
  );
  p.blocks = [];
  p.exercises = [];
  p.privateKeys = [];
  const concept = (hanzi: string) => {
    const c = p.concepts.find((c) => c.hanzi === hanzi);
    if (!c) throw new Error(`CONCEPT_MISSING:${hanzi}`);
    return c;
  };
  const teach = (
    title: string,
    text: string,
    hanzi: string,
    pinyin: string,
    meaning: string,
  ) =>
    p.blocks.push({
      id: `${version}-b${p.blocks.length + 1}`,
      type: "teaching",
      title,
      text,
      hanzi,
      pinyin,
      meaning,
      readingMinutes: 2,
    });
  const exercise = (
    type: "choice" | "pinyin" | "sequence" | "short",
    hanzi: string,
    prompt: string,
    choices: string[],
    accepted: string,
    feedback: string,
  ) => {
    const n = p.exercises.length + 1,
      c = concept(hanzi),
      exId = `${version}-e${n}`,
      keyId = `${exId}-key-v1`;
    p.exercises.push({
      id: exId,
      version: 1,
      type,
      skill: type === "pinyin" ? "pinyin" : "reading",
      conceptId: c.id,
      senseId: c.senseId,
      keyRef: keyId,
      prompt,
      choices,
      inputHint:
        type === "pinyin"
          ? "Gõ dấu thanh hoặc số, ví dụ wo3; không bỏ thanh."
          : type === "short"
            ? "Nhập đúng câu đã học bằng chữ Hán giản thể. Bỏ qua dấu câu và khoảng trắng; không chấm câu tự do."
            : "Chọn từng mảnh theo thứ tự; có thể bỏ mảnh cuối để sửa.",
      requiresAudio: false,
      mediaIds: [],
    });
    p.privateKeys.push({
      id: keyId,
      version: 1,
      exerciseVersionId: exId,
      senseId: c.senseId,
      accepted: [accepted],
      normalizerVersion:
        type === "choice"
          ? "exact-choice-v1"
          : type === "pinyin"
            ? "pinyin-nfc-tone-v1"
            : type === "sequence"
              ? "token-order-v1"
              : "hanzi-nfc-exact-v1",
      gradingVersion: "deterministic-content-v1",
      feedback,
    });
    p.blocks.push({
      id: `${version}-b${p.blocks.length + 1}`,
      type: "exercise",
      exerciseVersionId: exId,
    });
  };
  if (id === "L001") {
    teach(
      "Gặp nhau và nói tên",
      "Hội thoại gốc: A chào và giới thiệu; B đáp lời chào. 安 là tên riêng minh họa bổ trợ, không được tính vào coverage HSK1. Pinyin ghi dạng từ điển; nghe và phát âm chưa được đánh giá.",
      "A：你好！我叫安。\nB：你好！",
      "A: nǐ hǎo! wǒ jiào Ān.\nB: nǐ hǎo!",
      "A: Xin chào! Tôi tên là An.\nB: Xin chào!",
    );
    exercise(
      "choice",
      "你好",
      "你好 trong hội thoại có nghĩa gì?",
      ["Xin chào.", "Tôi tên là An.", "Còn bạn thì sao?"],
      "Xin chào.",
      "你好 · nǐ hǎo là lời chào trong ngữ cảnh này. Cách đọc thực tế của chuỗi thanh 3 cần mẫu âm được duyệt.",
    );
    teach(
      "Mẫu 我叫 + tên",
      "我 là tôi; 叫 ở đây dùng khi nói tên mình. Thứ tự là người nói + 叫 + tên. Không đảo vị trí tên lên trước 我. Bài tập dùng tên 安 để có một đáp án rõ ràng, không chấm tên riêng tự do.",
      "我叫安。",
      "wǒ jiào Ān.",
      "Tôi tên là An.",
    );
    exercise(
      "sequence",
      "叫",
      "Sắp xếp thành: Tôi tên là An.",
      ["安", "我", "叫"],
      "1,2,0",
      "Thứ tự trong câu mẫu là 我 + 叫 + 安. Đây là luyện tập theo đáp án nháp, không phải đánh giá hội thoại tự do.",
    );
    exercise(
      "short",
      "叫",
      "Nhập bằng chữ Hán: Tôi tên là An.",
      [],
      "我叫安",
      "Đáp án mẫu: 我叫安。Ứng dụng bỏ qua dấu câu/khoảng trắng, nhưng giữ thứ tự chữ và nghĩa.",
    );
    exercise(
      "pinyin",
      "我",
      "Gõ pinyin từ điển của 我.",
      [],
      "wǒ",
      "我 có pinyin từ điển wǒ (wo3). Thanh khác hoặc thiếu thanh không được tính khớp.",
    );
    teach(
      "Hỏi lại trong cùng ngữ cảnh",
      "Sau khi giới thiệu tên, A hỏi 你呢？ để mời người kia nói về mình. 呢 là trợ từ trong cấu trúc đang học. Câu hỏi này phụ thuộc ngữ cảnh; bản nháp không khẳng định nó dùng giống nhau trong mọi tình huống.",
      "A：我叫安。你呢？",
      "A: wǒ jiào Ān. nǐ ne?",
      "A: Tôi tên là An. Còn bạn thì sao?",
    );
    exercise(
      "choice",
      "呢",
      "Sau khi nói tên mình, 你呢？ hỏi điều gì?",
      ["Còn bạn thì sao?", "Tôi thích trà.", "Xin chào."],
      "Còn bạn thì sao?",
      "你呢？ hỏi lại người đối thoại trong ngữ cảnh vừa nói về bản thân. Không có nghĩa là một lời tự giới thiệu mới.",
    );
    exercise(
      "sequence",
      "你",
      "Sắp xếp lời hỏi lại: Còn bạn thì sao?",
      ["呢", "你"],
      "1,0",
      "Câu mẫu là 你呢？(nǐ ne). 呢 đọc thanh nhẹ trong ví dụ này.",
    );
  } else {
    teach(
      "Nói về điều mình thích",
      "Hội thoại ngắn gốc dùng những từ đã đối chiếu ở HSK1. A nói thích trà và hỏi lại; B nói thích uống trà. Nghĩa tiếng Việt và cách dạy ngữ pháp vẫn chờ người có năng lực duyệt.",
      "A：我喜欢茶。你呢？\nB：我喜欢喝茶。",
      "A: wǒ xǐ huan chá. nǐ ne?\nB: wǒ xǐ huan hē chá.",
      "A: Tôi thích trà. Còn bạn?\nB: Tôi thích uống trà.",
    );
    exercise(
      "choice",
      "喜欢",
      "我喜欢茶 nói điều gì?",
      ["Tôi thích trà.", "Tôi tên là An.", "Còn bạn thì sao?"],
      "Tôi thích trà.",
      "我 + 喜欢 + 茶: Tôi thích trà. Không thêm nghĩa không thích hoặc tên riêng vào câu.",
    );
    teach(
      "Mẫu người + 喜欢 + điều mình thích",
      "Mẫu chính là 我喜欢…; phía sau có thể là 茶 trong câu đã học. Ở ví dụ tiếp theo, 喝茶 là cụm chỉ việc uống trà. Hai ví dụ đều thuộc cùng mẫu về sở thích; chưa chấm cách diễn đạt tự do.",
      "我喜欢茶。\n我喜欢喝茶。",
      "wǒ xǐ huan chá.\nwǒ xǐ huan hē chá.",
      "Tôi thích trà.\nTôi thích uống trà.",
    );
    exercise(
      "sequence",
      "喜欢",
      "Sắp xếp thành: Tôi thích trà.",
      ["茶", "喜欢", "我"],
      "2,1,0",
      "Thứ tự mẫu là 我 + 喜欢 + 茶. Không đổi chủ thể hoặc đảo cụm sở thích.",
    );
    exercise(
      "short",
      "喜欢",
      "Nhập bằng chữ Hán: Tôi thích trà.",
      [],
      "我喜欢茶",
      "Đáp án mẫu: 我喜欢茶。Dấu câu/khoảng trắng không đổi kết quả, nhưng thêm hoặc thiếu 喝 sẽ đổi nghĩa cụ thể đang hỏi.",
    );
    exercise(
      "sequence",
      "喝",
      "Sắp xếp thành: Tôi thích uống trà.",
      ["喝", "我", "茶", "喜欢"],
      "1,3,0,2",
      "我 + 喜欢 + 喝 + 茶: Tôi thích uống trà. 喝茶 là uống trà trong ví dụ này.",
    );
    teach(
      "Giữ ngữ cảnh khi hỏi lại",
      "你呢？ đã gặp ở L001. Trong cuộc trò chuyện về sở thích, nó mời người kia nói sở thích của họ. Không tự suy ra người kia cũng thích trà nếu họ chưa trả lời.",
      "我喜欢茶。你呢？",
      "wǒ xǐ huan chá. nǐ ne?",
      "Tôi thích trà. Còn bạn?",
    );
    exercise(
      "short",
      "呢",
      "Nhập lời hỏi lại đã học: Còn bạn thì sao?",
      [],
      "你呢",
      "Trong ngữ cảnh này: 你呢？Không chấm các câu hỏi khác dù chúng có thể đúng trong ngữ cảnh khác.",
    );
    exercise(
      "pinyin",
      "茶",
      "Gõ pinyin từ điển của 茶.",
      [],
      "chá",
      "茶 có pinyin chá (cha2), thanh 2. Đây là nhận diện ký hiệu viết; không chứng minh đã nghe hoặc phát âm đúng.",
    );
  }
  p.packageHash = "0".repeat(64);
  const parsed = packageSchema.parse(p);
  const { packageHash, ...body } = parsed;
  void packageHash;
  parsed.packageHash = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  fs.writeFileSync(destination, JSON.stringify(parsed, null, 2) + "\n");
}
author("L001");
author("L002");
console.log(
  "Two original immutable v2 drafts authored; language/key/rights approval remains absent.",
);
