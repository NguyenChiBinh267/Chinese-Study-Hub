# Publication adapter — local release code, chưa phát hành bốn bài

Registry thật là `content/releases/trusted.json`, hiện **rỗng**. F01/F02/L001v2/L002v2 giữ nguyên REVIEW_PENDING / DRAFT_UNREVIEWED / BLOCKED (bản nháp chờ duyệt). Không có approval, audio giọng mẫu hay deploy mới.

## Ranh giới tin cậy

Đây là **deployment allowlist**, không phải chữ ký số. Người vận hành có thẩm quyền kiểm tra review/rights thật, pin SHA-256 của từng review record và toàn bộ manifest trong registry được kiểm soát cùng artifact deploy. Server kiểm tra registry → manifest → immutable packages → review/version/hash/scope/evidence → audio bytes/receipts → registered SQL versions. `approved:true` từ client hoặc JSON ngoài allowlist không cấp quyền. SHA chứng minh các byte khớp, không chứng minh ai thực sự đọc bài, năng lực người duyệt hay tính hợp pháp của license. Compromised operator/filesystem vẫn thuộc trust boundary; không tuyên bố chống người có quyền sửa code/allowlist.

`CSH_CONTENT_RELEASE` chọn đúng một release có entry và manifest PUBLISHED. Không tự chọn bản mới nhất. DRAFT/REVIEW_PENDING/APPROVED/WITHDRAWN không phục vụ học. Approval khác publication. Review phải pin version/hash, identity, qualification, date, language/keys/alignment/rights/audio scope, findings, unresolved issues và evidence file/hash. Thay nội dung làm hash/approval cũ mất hiệu lực. Receipt phải do người có thẩm quyền cung cấp, AI không điền thay.

Package dùng các trạng thái legacy REVIEWED/RETIRED; release dùng APPROVED/WITHDRAWN tương ứng approval/withdrawal ở cấp bundle. `transitionRelease` kiểm DRAFT → REVIEW_PENDING → APPROVED → PUBLISHED → WITHDRAWN; APPROVED/PUBLISHED cần validator và trusted receipts. Các bước sửa trở lại DRAFT giữ artifact cũ. CLI chỉ tạo **candidate chưa tin cậy**, không tự sửa registry hoặc học liệu thật.

Khóa private nằm trong server package/SQL SELECT của runtime grading. Learner projection không có keys/keyRef/reviewer/rights receipts; audio qua API owner/no-store, không đặt file vào `public`. Audio sau lật thẻ là nội dung cần hiển thị, không phải xuất private grading key. Không nhận đường dẫn tệp/URL audio do browser điều khiển. File imports giới hạn PCM16 WAV 0,1–30 giây/4 MB, kiểm RIFF/chunks/duration/hash; realpath phải nằm trong root riêng.

Mọi read/command/media request đối chiếu cả registered package hash/state trong SQL; metadata filesystem đúng nhưng SQL RETIRED/không khớp vẫn bị chặn.

Package hash dùng SHA-256 của JSON theo schema (bỏ packageHash); review hash dùng JSON reviewRecord theo schema. Manifest/evidence/audio hash theo byte. Quy tắc -text cho content/releases giữ byte khi chuyển Windows/Linux. Nếu repository public, không push private keys/reviewer bundle lên đó: giữ build input server riêng và registry/hash có kiểm soát, không đưa vào public assets.

Review phải ký nhận **hash candidate cuối**, gồm metadata trạng thái/review/rights. Không sửa state/humanReview/media rồi dùng lại approval của hash nháp. Khi package đã đăng ký immutable, chuẩn bị version mới; giữ v1/v2 cũ gắn lịch sử. Worksheet từ packet cũ không tự cho phép sửa receipt sang hash mới.

## Version, rollback và dữ liệu

Repository chấm bài, FSRS và weekly planner được tái sử dụng qua content access/scope. Start kiểm current version và prerequisites trên server. Resume/grade phiên cũ chỉ dùng exact immutable package còn được phép trong registry; không đổi exercise/key/hash binding. Bản cũ PUBLISHED được giữ để rollback hoặc đọc lịch sử. Rút bản cũ khỏi registry khóa tiếp nội dung đó; records vẫn giữ. Withdrawal/activation có hiệu lực ở request kế tiếp; không hứa hủy transaction đã bắt đầu trước khi operator thay registry.

Rollback chọn lại `CSH_CONTENT_RELEASE` của bundle PUBLISHED đã pin rồi restart code; không down-migrate hoặc ghi lại attempts/progress/card state. Package legacy chứa release identity, vì vậy bundle mới phải giữ đúng package/release binding; cần version mới nếu thay binding/nội dung. Import chạy transaction/advisory lock bằng migration credential **chỉ CLI**, insert idempotent, collision từ chối, không sửa current pointers hay lịch sử learner. App runtime vẫn SELECT-only trên global content và FORCE RLS trên 19 bảng riêng.

Migration 007 chỉ mở rộng nhãn review/evidence, không thêm bảng hoặc sửa hàng cũ. Rollback SQL từ chối nếu đã có publication-bound history; code rollback có thể giữ forward schema. Không áp nguyên native baseline lên managed Supabase; cloud baseline/pooler/TLS vẫn cần T009.

Luyện với reviewed key vẫn chưa tự thành independent mastery: `reviewed_practice` giữ exclusion do answerSeen/duration/probe chưa đạt; fixture là unreviewed_fixture. FSRS là lịch nhớ, không tự tăng mastery. Catalog/progress đếm phạm vi release hiện tại, không gọi hai bài là hoàn thành HSK1. Các course HSK2–4 không có nội dung vẫn không mở.

## Công cụ local

```powershell
npm.cmd run content:release -- check
npm.cmd run content:release -- review-template .local-postgres/review-packets/sprint6/F01.1.json .local-postgres/review-packets/F01-worksheet.json
# Sau review thật: operator chuẩn bị package/receipt/evidence, pin review hashes.
npm.cmd run content:release -- transition content/releases candidate.json APPROVED .local-postgres/approved-candidate.json
# Candidate phải bắt đầu REVIEW_PENDING. PUBLISHED cần bước APPROVED trước.
# Pin manifest/hash có thẩm quyền trong registry trước khi check/install/select.
# DATABASE_URL phải là runtime URL của đúng database local; không đưa vào chat/log.
$env:CSH_CONTENT_RELEASE = '<approved-release-id>'
npm.cmd run content:release -- check
npm.cmd run content:release -- install csh_local
```

DRAFT/REVIEW_PENDING cho phép reviews/audio rỗng: không cần bịa người duyệt hoặc ngày duyệt để chuẩn bị candidate. APPROVED/PUBLISHED vẫn phải đạt toàn bộ receipts/rights/media gates.

Commands ở trên mô tả workflow sau evidence, không phải lệnh đã publish trong sprint. Chưa có candidate thật đủ review/audio để chạy. Nếu thiếu receipt/hash/source/license/audio thì giữ review pending, không đổi criteria.

Preview/test có `CSH_CONTENT_TEST_ROOT` chỉ mở khi development build/runtime, Auth mode và database loopback `csh_release_verify_<hex>`. Synthetic review kind/audio TECHNICAL_ONLY không được dùng cho REAL_CONTENT hoặc production. Test artifacts và non-speech WAV ở `.local-postgres/sprint12/`; không có giọng người. Các nhãn legacy HUMAN_REVIEWED trong fixture chỉ là dữ liệu kiểm hợp đồng; kind synthetic và banner luôn phân biệt, không phải human receipt. Không truncate/reset database khi chuẩn bị test; append versions mới, giữ history cũ.

## Review/audio thật

Tiếp tục dùng `.local-postgres/review-packets/sprint11/index.html` và packets Sprint6/7 gốc. Chạy `npm.cmd run review:release` để xuất lại, giữ findings/sign-off. Worksheet là hỗ trợ điền vào record gốc, không phải hệ thống duyệt mới. Hai mapping `g-jiao-pattern` và `g-like-pattern` giữ UNVERIFIED: các mục 动词谓语句/动宾短语 trong pinned source chưa đủ chứng minh diễn giải/đáp án cụ thể. Syllabus không cấp quyền tái phân phối. Không tự đổi phân loại HSK hoặc bỏ tiêu chí audio để vượt gate.

```powershell
npm.cmd run content:release -- audio-template <original-or-licensed.wav> <new-worksheet.json>
# Điền id/target/creator/source/permission/attribution thật trong worksheet.
npm.cmd run content:release -- audio-import <original-or-licensed.wav> <metadata.json> <private-bundle-root>
```

Metadata theo `audioRecord` gồm asset/target/duration/format/hash/creator/source, permission+review file/hash, attribution, linguisticReview, eligible. Import không tự trao review/publication. Asset chưa duyệt có review=null, linguisticReview=UNREVIEWED, eligible=false; permission/consent vẫn bắt buộc trước khi copy. Khi review/metadata thay đổi, dùng asset ID/version mới và giữ record cũ, không ghi đè metadata đã import. Giữ bản gốc/consent riêng; không dùng bản micro pilot trước đây làm giọng mẫu. Chưa có audio human/licensed được duyệt. Browser TTS chưa triển khai; nếu dùng sau này phải có nhãn synthetic và kiểm terms/privacy, không thay giọng mẫu bắt buộc.

Audio REAL_CONTENT phải có dòng attribution công khai trong media của package đã duyệt, khớp metadata release. Người học thấy dòng này cạnh thanh phát; thay credit sẽ làm đổi content hash và cần review lại. Receipts, danh tính riêng tư và tài liệu consent không được đưa vào projection người học. Người duyệt quyền phải xác nhận dòng credit đáp ứng điều kiện giấy phép cụ thể trước khi allowlist release.
