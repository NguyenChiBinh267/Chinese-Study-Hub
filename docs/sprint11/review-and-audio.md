# Gói duyệt và audio — chuẩn bị, không phải phê duyệt

Mở `D:\Chinese-Study-Hub\.local-postgres\review-packets\sprint11\index.html`. Đây là index hợp nhất riêng tư, đọc trực tiếp các packet Sprint 6/7 hiện có, không tạo hệ thống duyệt mới. `manifest.json` ghi đường dẫn và SHA-256. Chạy lại bằng `npm.cmd run review:release`; findings/sign-off cũ được giữ nguyên.

Index chứa đầy đủ chữ Hán, Pinyin có dấu, nghĩa/giải thích tiếng Việt, prompts, distractors, đáp án riêng/accepted alternatives/normalizer, bindings, provenance, media status và locators. Đáp án ở artifact reviewer-only bị Git ignore; không copy vào docs công khai, learner API hoặc hosting.

| Bài | Version phải duyệt | Packet gốc chứa findings/sign-off |
| --- | --- | --- |
| F01 | f01-draft-v1 | `.local-postgres/review-packets/sprint6/F01.1.json` |
| F02 | f02-draft-v1 | `.local-postgres/review-packets/sprint6/F02.1.json` |
| L001 | l001-draft-v2 | `.local-postgres/review-packets/sprint6/L001.2.json` |
| L002 | l002-draft-v2 | `.local-postgres/review-packets/sprint6/L002.2.json` |

31 notes và 26 cấu hình SVG nằm trong packet `sprint7/final/pronunciation-foundation-v1.json` và các SVG frames cùng thư mục. Duyệt từng note/hình, không suy từ bản vẽ sơ đồ rằng giải phẫu hoặc phát âm đã đúng.

## Bằng chứng tài liệu và giới hạn

[source-locators.json](source-locators.json) ghi lần đọc lại 26/26 entry locators từ bản PDF chính thức đã pin, đúng checksum `ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941`, 406 trang. Đây là đối chiếu bản lưu cố định, không phải kiểm chứng bản syllabus mới nhất hoặc quyền tái phân phối. Không đổi nội dung/version/approval của package.

Hai vấn đề vẫn **UNVERIFIED**: `g-jiao-pattern` (我叫 + tên) và mẫu 喜欢 / 喝 trong L002. Các mục chung “动词谓语句” và “动宾短语” tại trang in 384 / trang PDF vật lý 387 không chứng minh rằng toàn bộ cách giảng/mẫu câu/accepted answers đã được syllabus xác nhận. Từ vựng có locator không tự xác minh nghĩa cụ thể, cách dùng hoặc đáp án bài tập. 安 vẫn supplementary. Cần người có năng lực xác định phạm vi mapping; không tạo locator suy đoán.

## Checklist và luồng corrections

1. Ghi danh tính, năng lực tiếng Trung/phát âm, ngày, đúng lesson/version/hash; kiểm tra từng đoạn chữ Hán/Pinyin/biến điệu/nghĩa Việt, phạm vi sư phạm và distractors.
2. Duyệt từng private key, accepted alternatives và normalizer; ghi item ID, lỗi, mức độ, sửa đề nghị và bằng chứng. Không ký duyệt chung nếu còn đáp án không chắc.
3. Duyệt notes/hình khẩu hình và mọi claim âm học riêng; không dùng AI self-review làm human receipt.
4. Ghi rightsDecision và audioDecision riêng. `reviewer.identity`, `qualifications`, `reviewedAt`, `findings`, `decision`, `rightsDecision`, `audioDecision` trong packet gốc là record có thẩm quyền của gói này; để trống khi chưa có người thực sự cung cấp.
5. Findings không bị ghi đè khi export lại. Corrections tạo version/hash mới, kiểm thử lại và duyệt lại; giữ version cũ gắn với attempts/cards. Sprint này không có lệnh tự import sign-off hoặc publish.

## Kế hoạch audio phí 0

| Nguồn | Điều kiện trước khi dùng | Trạng thái hiện tại |
| --- | --- | --- |
| Người tự thu bản gốc | Người nói có năng lực phù hợp, đồng ý riêng bằng văn bản cho thu/lưu/chỉnh sửa/tái phân phối; nêu attribution, phạm vi, license, quyền rút lại và cách xử lý. Không mặc định quyền từ việc đồng ý phân tích micro. | Chưa có bản thu giọng mẫu hoặc consent phát hành. |
| Audio có license phù hợp | Pin nguồn/version/hash, license text, quyền redistribution/derivatives và attribution. Kiểm tra từng file; “nghe miễn phí” không có nghĩa được nhúng vào app. | Chưa chọn nguồn đủ bằng chứng; không scrape nền tảng học. |
| Browser TTS | Chỉ cân nhắc tiện ích tổng hợp có nhãn rõ sau khi kiểm điều khoản engine, privacy và khả năng chạy phí 0. Không hứa voice có sẵn trên mọi thiết bị; không xuất file nếu chưa rõ quyền. | Chưa triển khai; không phải giọng mẫu người bản ngữ được duyệt. |
| Thiếu quyền/duyệt | Giữ nút/ngữ cảnh không có audio được duyệt; không dùng bản thu riêng của owner thay giọng mẫu. | Các bài/audio hiện vẫn chưa phát hành. |

Quy trình thực tế: chốt transcript/version → xin consent/license riêng → thu bằng thiết bị/công cụ OSS sẵn có trong phòng yên tĩnh → nghe lại, cắt khoảng trống vừa đủ và giữ bản gốc riêng → người có chuyên môn duyệt âm/biến điệu/tốc độ/phù hợp bài → lưu metadata/hash/attribution/decision → chỉ xét phát hành khi toàn bộ gate của bài đạt. Không mua voice/API, không upload raw voice lên server trong sprint này.

Pilot microphone Sprint 9 vẫn PARTIAL; không thay thuật toán/ngưỡng, không trao speaking mastery và không coi nguồn tổng hợp trong browser tests là phần cứng thật.
