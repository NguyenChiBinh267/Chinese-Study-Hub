# T004 — UX flow slice M0/v0.1

Ngày rà: 2026-10-16 (Asia/Saigon). Trạng thái artifact: **draft để review**, không phải ứng dụng đã chạy hoặc task đã done.

## Nguồn và phạm vi

Nguồn đặc tả: [Master Plan v1.1](../master-plan/master-plan-v1.1.md), **main `3813bda55be7b77108344de6e5cc6bd74c51f034`**; §2.3, §4.2, §6.1–6.4/6.6, §8, §10.3, §11, T004, §12.6, §14.1 và §15. Manifest ghi SHA-256 đặc tả `0984cfc38e4b91c5ed214c8e6003434536d9904072164f28f4e0ffd48c8bf47e`. [Task status](../master-plan/task-status.json) trên commit này: T001 done, T004 pending; dependency duy nhất của T004 đã đạt. [Brief](brief.md) dùng để định hướng, không thay status trên Git. Các câu “PR #3 chưa merge” trong handoff/manifest là prose lịch sử: các artifact đã có trên main được fetch; không sửa handoff trong T004.

Đây là wireframe chữ và hợp đồng trạng thái cho đúng một task, không tạo UI, API, database, nội dung học hay dịch vụ. Các tên màn, message và hành vi dưới đây là thiết kế cần triển khai ở task tương ứng; chưa phải bằng chứng runtime/cloud. Ví dụ phút/phiên là dữ liệu giấy có ghi giả định, không phải telemetry hoặc cam kết lịch cá nhân.

- Người dùng: đúng owner, trình duyệt Android/Windows; UI tiếng Việt. Mục tiêu HSK4 là nguyện vọng, không hứa đỗ thi hoặc ngày hoàn thành.
- Slice chỉ tham chiếu ID F01/F02/L001/L002. Chưa có package/keys/audio/rights/reviewer được duyệt thì màn rỗng giải thích rõ; không tự tạo bài, đáp án, audio hoặc nhãn “đề chuẩn HSK”.
- M0 cần mạng để đọc trạng thái mới, lập lịch và ghi kết quả. Không có tải bài, outbox, lease, ghi âm, đồng bộ nền hay cam kết giữ bản nháp sau crash. Những phần đó thuộc v0.3. Tutor thuộc v0.2; không action học nào phụ thuộc AI.
- T068 trước tạo dịch vụ; T009 trước ghi dữ liệu học; T069 trước chọn host/deploy; content/rights/competent-review gates vẫn giữ. T004 không xác nhận chúng đã đạt, không tạo cloud và không chọn hosting.

## Cấu trúc, tokens và accessibility

Mobile: bốn mục **Hôm nay / Học / Ôn / Tiến độ**, Cài đặt ở phần đầu. Desktop giữ cùng taxonomy qua sidebar; nội dung đọc tối đa 720px, dashboard 1.120px. M0 không hiện tab Tutor/Tải xuống/Ghi âm dẫn vào tính năng chưa bật. T004 đặc tả màn S01–S09 bên dưới; các màn Học/Tiến độ đầy đủ thuộc backlog, không được coi đã thiết kế xong ở đây.

| Thành phần | Quy tắc áp dụng |
| --- | --- |
| Khung 360px | Padding trái/phải 16px, vùng nội dung 328px; một cột, không carousel hoặc thao tác hover bắt buộc. 320px còn 288px; label wrap, không cắt nội dung bằng ellipsis bắt buộc đọc. |
| Tokens | Spacing 4/8/12/16/24/32px; radius 8/12px; body 16px, line-height 1,5; chữ Hán 24–32px; pinyin 14–16px, có text equivalent. |
| Màu đề xuất | Nền `#F8FAFC`, surface `#FFFFFF`, chữ `#0F172A`, primary `#1D4ED8` với chữ trắng, lỗi `#B91C1C` trên trắng; focus `#0F172A` 2px với khoảng hở trắng 2px. Đo contrast khi triển khai: body ≥4,5:1; chữ lớn ≥3:1; focus/control ≥3:1. Không coi bảng màu là chứng nhận WCAG. |
| Touch / zoom | Target ≥44×44 CSS px; các lựa chọn ratings xếp 2×2 trên 360px, label wrap. Zoom 200% và reflow 320px vẫn tiếp cận hết controls; cần kiểm trên UI sau này. |
| Keyboard | Skip link “Đến nội dung”; thứ tự DOM theo thứ tự đọc; Tab/Shift+Tab không bẫy, focus rõ; Enter kích hoạt button, Space chọn radio/checkbox, arrow keys theo native radio. Không dùng shortcut chữ cái toàn trang hoặc bắt kéo thả. |
| Form | Label Việt gắn input; đơn vị hiện cạnh trường; fieldset/legend cho ngày và rating; lỗi gắn `aria-describedby`, invalid state và error summary focus sau submit lỗi. Giữ input khi validate thất bại. |
| Ngôn ngữ / âm thanh | `lang=vi`; đoạn tiếng Trung `lang=zh-Hans`, ruby có equivalent; tone có số/dấu, không chỉ màu. Audio chỉ phát sau thao tác; không dùng audio làm cách duy nhất hiểu thông báo. |
| Phản hồi / focus | Loading dùng `aria-busy`, skeleton không tabbable; kết quả lưu thông báo polite một lần; lỗi gửi focus vào summary. Chuyển step đưa focus tới tiêu đề mới; không đọc timer mỗi giây. Tôn trọng reduced motion. |
| Footer | Một CTA chính cho bước hiện tại; link phụ không tranh màu primary. Sticky footer phải chừa padding cho nội dung và safe area. Khi bàn phím ảo mở, footer trở về luồng nếu che input/submit; focus được scroll vào view. |

Các quy tắc này là yêu cầu cho T012/T017/T025/T066 và device UAT, chưa phải kết quả test TalkBack/NVDA, trình duyệt hay đo contrast thực tế.

## Quy tắc CTA, dữ liệu và trạng thái chung

**Một CTA học tiếp**: Hôm nay chỉ hiển thị một primary tương ứng `nextAction` hợp lệ, không bắt người dùng so sánh nhiều bài. Due/relearning/overdue ưu tiên trước resume phù hợp, remediation và bài mới theo §6.4; UI không tự chọn khác planner, không sửa prerequisite. Chỉ đổi label theo action: “Ôn 10 phút”, “Tiếp tục · bước 3/5”, “Bắt đầu 15 phút”. Số phút phải lấy từ block thực đủ ngân sách, không hardcode 15 phút cho mọi người. Link “Xem lịch tuần” là phụ.

Trước khi có `nextAction`, CTA hướng đúng bước cần giải quyết: “Thiết lập thời gian”, “Thử lại”, “Đăng nhập lại” hoặc “Về Hôm nay”; không hiển thị nút học đang bấm được nhưng không có lesson hợp lệ. Ratings là lựa chọn radio; chỉ một nút xác nhận, không bốn nút primary tranh nhau. Audio/replay là control phụ.

- **loading**: chờ dữ liệu/ack, nói đang làm gì; không hiển thị số 0 thay unknown, không fake saved. Chặn double-submit nhưng giữ focus và tên action. Tác vụ mạng bị chậm không để spinner vô hạn: sau 10s hiện “Chưa nhận được phản hồi” cùng cách đọc lại/thử lại an toàn; đây là ngưỡng thông báo UX, không khẳng định backend đã hủy hoặc mục tiêu performance đã đạt.
- **empty**: phân biệt “chưa có dữ liệu”, “không có việc hợp lệ”, “hôm nay nghỉ”, “đã hết quỹ giờ” và “chưa có nội dung được duyệt”. Không thay unknown bằng “đã hoàn thành”.
- **error**: message Việt, requestId nếu server có; không raw SQL/stack. 401 đăng nhập lại; 403 báo không có quyền, không thử tài khoản khác; 422 giữ form và chỉ field lỗi; 409 đọc bản server trước khi quyết định; 429 nêu thời điểm thử lại nếu có, không mua quota; 503/chưa cấu hình dịch vụ báo chưa thể dùng, không giả cloud đã sẵn sàng.
- **offline**: banner “Mất kết nối — chưa thể lưu thay đổi”. Nếu còn dữ liệu trong tab thì ghi “Bản đã tải lúc …, có thể đã cũ”; không biến nó thành lịch mới hoặc nguồn quyền. Tab mới không có dữ liệu thì không hiển thị bài/lịch giả. Disable mutations; không tiếp tục chuỗi bài chấm điểm, không auto-replay khi có mạng. Kết nối lại: đọc trạng thái mới và cho người dùng retry có kiểm soát.
- **ack / retry**: gửi lại cùng thao tác và payload dùng lại idempotency key/eventId gốc; không tạo lượt mới để “sửa lỗi mạng”. Chưa ack thì “Chưa xác nhận đã lưu”, không cộng điểm, thời gian hay đổi dueAt phía client. Với response bị mất, đọc lại kết quả trước; không xác định được thì giữ trạng thái chưa xác nhận.
- **bản nháp**: có thể giữ input trong RAM của tab; trước rời tab khi còn dữ liệu chưa ack, cảnh báo nguy cơ mất và cho “Ở lại”. Không hứa browser luôn hiện beforeunload hoặc khôi phục input sau đóng/crash. Resume đáng tin cậy dùng checkpoint đã được server xác nhận.

## S01 — Onboarding

Entry sau xác thực owner (T010 sẽ triển khai). Header “Bắt đầu với thời gian bạn có”; mục tiêu HSK4, điểm xuất phát “Tôi chưa biết gì” / mức đã học tự khai, không gắn nhãn mastery. M0 không ép làm diagnostic dài; có đường tiếp tục thẳng sang thiết lập thời gian. Không yêu cầu mic, AI hoặc quyền lưu offline để qua onboarding.

Thứ tự focus: tiêu đề → lựa chọn điểm xuất phát → link Quyền riêng tư → primary **“Chọn thời gian học”**. Mục tiêu không phải kỳ thi đã được xác minh; không nhập ngày thi để sinh forecast thiếu dữ liệu. Sau ghi onboarding được ack mới đánh dấu hoàn tất phần đó; weekly settings vẫn chờ bước xác nhận riêng.

- loading: “Đang kiểm tra thiết lập…”; khóa primary cho đến khi biết có cần onboarding.
- empty: owner mới chưa có profile → hiện form mặc định có thể sửa, không giả đã lưu lựa chọn.
- error: 401 → “Đăng nhập lại”; lỗi đọc/lưu → “Thử lại”, giữ form trong tab, không bỏ qua xác thực.
- offline: thông báo cần kết nối để thiết lập; primary disabled; không tạo profile local làm nguồn chính.

## S02 — Weekly budget: chọn thời gian học/tuần

Header “Bạn muốn dành tối đa bao nhiêu thời gian mỗi tuần?”. Radio presets **3 / 6 / 9 / 12 giờ**, input tùy chỉnh **giờ và phút**, không preselect như đã đồng ý. Đổi sang số phút nguyên khi xác nhận: active 30..1260 phút/tuần; 0 chỉ khi chọn riêng “Tạm dừng lịch học”. Số âm, rỗng, lẻ phút hoặc ngoài khoảng có lỗi ngay cạnh trường; không tự clamp input. Chú thích “Đây là giới hạn dự định, không phải số phút buộc phải học đủ”.

Primary **“Chọn ngày rảnh”** chỉ chuyển bước và giữ bản nháp; chưa áp dụng kế hoạch. Phụ: Quay lại. Đổi settings từ Hôm nay dùng cùng form với giá trị đang được server xác nhận; rời form khi có sửa chưa lưu phải cảnh báo.

- loading: đọc preferences có sẵn, chưa biết thì không hiện preset đã lưu giả.
- empty: chưa từng chọn → gợi ý presets, yêu cầu chọn trước tiếp tục.
- error: lỗi nhập → giữ nguyên, focus field; lỗi tải settings → “Thử lại”, không ghi đè bản server bằng default.
- offline: bản đã tải chỉ xem; không đổi settings hoặc replan. “Cần kết nối để đổi thời gian học”.

## S03 — Availability: lịch rảnh và giới hạn buổi

Các ngày Thứ Hai–Chủ nhật có checkbox và cap phút/ngày, xếp dọc trên mobile. Khi chưa tùy chỉnh, **đề xuất** Thứ Hai–Thứ Bảy, 90 phút/ngày; Chủ nhật nghỉ. Người dùng xem/sửa trước áp dụng. Ngày không chọn có cap0; active cần ít nhất một ngày có capacity dương. Cap mỗi ngày 0..180 phút; không tự bật ngày nghỉ khi quỹ giờ quá cao.

“Buổi học mong muốn”: 10..25 phút, đề xuất20; “Tối đa mỗi buổi”: 5..45 phút, đề xuất25; mong muốn phải ≤tối đa. Không ép nhập giờ trong ngày hoặc kết nối calendar. Timezone profile hiển thị, ví dụ Asia/Saigon; tuần bắt đầu Thứ Hai theo timezone đó. T004 không bổ sung tính năng đổi timezone giữa buổi.

Primary **“Xem lịch đề xuất”**. Phụ Quay lại sửa quỹ giờ. Đây là preview online, chưa ghi lịch active.

- loading: “Đang đọc lịch rảnh…”; giữ nguyên input vừa nhập, khóa tạo preview.
- empty: bỏ chọn hết ngày/cap0 → nêu “Chọn ít nhất một ngày có thời gian, hoặc tạm dừng lịch”; không sinh block.
- error: đánh dấu cap/quan hệ thời lượng sai; lỗi preview giữ draft và “Thử lại”.
- offline: disable preview/apply; lịch cũ nếu có gắn timestamp, không tính lại tại client.

## S04 — Preview và lịch học cá nhân

Một cột: **quỹ giờ yêu cầu → khả năng xếp → phút chưa xếp → dự phòng → danh sách ngày**. Mỗi ngày có nhãn nghỉ hoặc các block Ôn/Bài mới/Luyện kỹ năng, phút ước tính và lý do; không hứa giờ bắt đầu chính xác. Phút dự kiến ≠ phút đã học. Hiển thị planVersion, “cập nhật lúc”, timezone và lý do replan; completed/in-progress được giữ, chỉ pending được đổi. Nội dung chưa unlock ghi “Dự kiến — cần đạt điều kiện”, không CTA mở khóa sớm.

Ví dụ giấy theo §6.6: 6h=360 phút, 6 ngày×60 phút=360 capacity, không có phút đã học → buffer36, tổng block ban đầu **không quá324**. Chưa có due card thì không tạo thẻ/phiên ôn giả để lấp tỷ lệ; chưa đủ nội dung hợp lệ thì để trống có lý do. Các số này minh họa giới hạn, không giả kết quả planner hiện có.

Trường hợp 360 phút nhưng chỉ 3 ngày×90=270 capacity: “Chưa xếp được 90 phút trong lịch rảnh”; không tự tăng lên120/ngày. Các hướng phụ: sửa ngày/cap hoặc sửa quỹ giờ. Nếu giữ yêu cầu360, người dùng phải chọn rõ “Giữ mục tiêu 6 giờ, chấp nhận lịch tối đa 270 phút”; primary **“Áp dụng lịch ít giờ hơn”**. Preview kế hoạch đầu tuần có thể dành27 phút buffer trong270, block≤243; phần 90 là thiếu capacity, không cộng lẫn với27 buffer. Chấp nhận không làm đổi quỹ giờ đã chọn.

Lịch khả thi dùng primary **“Áp dụng lịch”**; khi ack thành công chuyển Hôm nay, không thêm màn thành công đòi thêm lần bấm. Preview chưa apply không đổi version active. Không có forecast khi chưa ≥14 ngày và ≥6 phiên hoàn tất: “Chưa đủ dữ liệu để ước tính”; không ngày thi/tiến độ tuyến tính theo số giờ.

Khi sửa giữa tuần xuống dưới thời gian đã học (đã học100 phút, đổi60): hiển thị “Bạn đã học100 phút trước khi đổi; quỹ giờ còn lại0”; không xóa lịch sử, không xếp thêm block. Pause giữ due debt/lịch sử, không xếp lịch mới; quay lại tuần sau không xóa thẻ đến hạn. Bỏ lỡ buổi chỉ replan vào capacity còn lại, giảm bài mới, phần dư thành backlog, không bắt học bù quá cap.

- loading: preview “Đang xếp lịch…”; khi apply “Đang áp dụng…” disabled, không coi đã lưu trước ack.
- empty: không có block vì pause/capacity0/hết ngân sách/nội dung chưa duyệt → lý do cụ thể và primary phù hợp “Về Hôm nay” hoặc “Sửa lịch”; không thêm filler.
- error: 409 → S09; 422 → trường liên quan; timeout/response mất → “Chưa xác nhận lịch đã lưu”, đọc lại version trước retry cùng request; không áp dụng hai lần.
- offline: không thay quỹ giờ, apply hay replan. Lịch trong tab chỉ đọc, gắn timestamp; nếu mất mạng lúc apply thì chưa xác nhận, không tự chuyển sang success.

## S05 — Today / Hôm nay

Wireframe chữ ở viewport360, các dòng dưới là label ví dụ, dữ liệu thật phải từ server:

```text
Hôm nay                       Cài đặt
Lịch tuần · cập nhật lúc …
Quỹ giờ còn lại: … phút

Việc tiếp theo
[mục tiêu / loại block đã hợp lệ]
Vì sao: …       Khoảng … phút
[       Bắt đầu 15 phút       ]
Xem lịch tuần

Hôm nay | Học | Ôn | Tiến độ
```

Hero và primary nằm trước chi tiết phụ; tên CTA nói rõ hành động và thời lượng. Không đặt danh sách khóa học, câu chào dài, streak hay chart trước CTA. Lịch đọc lại phải xác minh pending block/prerequisite trước start. Nếu overdue vượt ngân sách, bài mới0 và gợi ý **“Ôn 10 phút”** chỉ khi còn đủ10; ít hơn thì chọn block ngắn hợp lệ hoặc giải thích chưa đủ slot, không vượt cap. Cho chọn “Hôm nay chỉ có10 phút” trong chỉnh lịch nếu không vượt ngân sách; không tăng mặc định ngoài kế hoạch.

“Đã học xong bài” khác “Có bằng chứng vững theo kỹ năng”; UI không gọi vài phút học hoặc rating tự báo là thành thạo. Coverage hiện là slice, không full HSK1. Nếu xem từ hai tab, nextAction được đọc lại, không tự tạo hai phiên đang học.

- loading: skeleton hero, “Đang tìm việc tiếp theo”; CTA disabled, không quyết định từ cache cũ.
- empty: chưa có thời gian → “Thiết lập thời gian”; ngày nghỉ/paused/hết budget → nêu rõ, primary “Xem lịch tuần”; không có nội dung được duyệt → thông báo, không đưa bài bịa; hết due nhưng có lesson hợp lệ → primary của lesson đó.
- error: không lấy được today → primary “Thử lại”; lỗi quyền → thông báo quyền; không hiển thị số phút/điểm mới bịa.
- offline: “Cần kết nối để bắt đầu hoặc tiếp tục phiên”; CTA học disabled, đọc bản đã tải nếu còn trong tab, có timestamp. Không tạo attempts từ snapshot.

## S06 — Lesson player

Header tên bài/phiên và “Bước3/5”; một mục tiêu/câu hỏi mỗi view, nội dung text wrap, chữ Hán/pinyin/nghĩa Việt theo tokens. Control phụ **Nghe mẫu / Nghe chậm / Nghe lại**, pinyin toggle có trạng thái accessible. Không autoplay; replay không tự đổi câu trả lời. Mọi text/audio/key phải đến từ package đã duyệt và lessonVersionId cố định, không sinh học liệu trong T004.

Input và primary **“Gửi câu trả lời”** → chờ ack → feedback đúng/sai bằng icon+chữ, giải thích đã duyệt → **“Tiếp tục”** với item kế hợp lệ. Không dùng màu đơn lẻ; không gửi score từ UI. Submit lặp dùng cùng request, không tăng điểm/thời gian hai lần. Cuối bài: tóm tắt completion và evidence theo skill, primary từ nextAction đã xác nhận (ôn hoặc block tiếp theo); unknown skill vẫn “Chưa đủ bằng chứng”. Không chặn qua bài vì thiếu AI.

Denied audio / lỗi thiết bị: hiện “Chưa phát được âm thanh”; phụ “Thử phát lại” và “Xem bản chữ đã duyệt”. Với câu nghe, transcript chỉ mở sau khi nộp trả lời nếu nghe được. Khi không nghe được mà cần xem transcript trước answer, ghi **“Có hỗ trợ — không tính bằng chứng nghe độc lập”** và gửi assistance; không tính như đã nghe đúng. Nếu asset thực sự thiếu/không có transcript được duyệt, nêu bài lỗi và về Hôm nay để chọn hoạt động khác hợp lệ, không tự tạo transcript hoặc cho qua tiêu chí nghe. Không cần xin mic; không suy permission denied của autoplay thành quyền microphone.

Pause tại checkpoint đã ack; “Tạm dừng” là phụ. Không cắt atomic listening/answer đang gửi để ép vừa block. Khi đạt max buổi, gợi ý nghỉ tại checkpoint; tiếp tục vượt mức chỉ do user chủ động và gắn overtime, không tự kéo dài lịch. Đóng tab chỉ hứa checkpoint server; bản nháp chưa gửi có thể mất.

- loading: tải package/step/submit ghi rõ loại chờ; không render đáp án trước lượt; submit disabled khi đang gửi.
- empty: thiếu package/bước/exercise hợp lệ → “Bài học chưa sẵn sàng”, primary “Về Hôm nay”; không đánh complete.
- error: audio theo fallback trên; 409 phiên/version → S09; 401 → đăng nhập lại; response mất → chưa xác nhận, đọc lại attempt rồi retry nguyên key nếu cần; không tạo câu trả lời mới âm thầm.
- offline: dừng gửi/qua bước chấm điểm, giữ draft trong tab nếu có; “Câu trả lời chưa được xác nhận đã lưu”; khi online đọc checkpoint rồi người dùng mới retry. Không có outbox hay lưu offline bền vững.

## S07 — Review / Ôn

Trước reveal: chỉ prompt, control audio chủ động; primary **“Hiện đáp án”**. Sau reveal: đáp án đã duyệt, assistance nếu có; fieldset **“Bạn nhớ ở mức nào?”**, radio không preselect, kèm khoảng hẹn ôn *tạm tính do adapter cung cấp*; chưa có dữ liệu interval thì “Chưa có ước tính”, không tự đặt số ngày.

| Giá trị | Label Việt | Cách chọn |
| --- | --- | --- |
| 1 · Again | **Quên / trả lời sai** | Không nhớ hoặc trả lời sai. Không dùng Khó chỉ để tránh Quên. |
| 2 · Hard | **Nhớ nhưng khó** | Tự nhớ đúng nhưng cần nhiều cố gắng. |
| 3 · Good | **Nhớ đúng** | Tự nhớ đúng với cố gắng bình thường. |
| 4 · Easy | **Nhớ ngay** | Tự nhớ đúng ngay, dễ. |

Đã xem gợi ý thì nêu assistance và gợi ý Quên/Khó theo §6.3, user vẫn quyết rating; không biến self-rating/assisted thành mastery secure. Primary **“Xác nhận mức nhớ”** chỉ enable sau chọn; không auto-submit khi arrow key đổi radio. Trong khi chờ ack disable rating/confirm; sau ack mới hiện lịch ôn server và card tiếp theo. Không có Undo M0; không giả undo đã được chấp nhận.

- loading: đọc queue/card hoặc “Đang lưu lượt ôn…”; giữ card hiện tại trong lúc gửi, không nhảy trước ack.
- empty: “Chưa có thẻ đến hạn”; nếu có next lesson hợp lệ, primary “Học bài tiếp theo · … phút”, nếu không thì “Về Hôm nay”. Không nói “Đã thuộc hết”. Overload nêu nợ ôn, cho phiên ngắn trong cap; không reset dueAt.
- error: 409 rating cũ → S09, không tự apply lên version mới; lỗi audio có bản chữ/assistance như S06; lỗi gửi giữ selection nhưng không gọi saved, cùng key cho retry chưa đổi payload.
- offline: không reveal một queue mới hoặc gửi rating; prompt/đáp án đã mở trong tab chỉ xem, ghi chưa lưu. Nối lại đọc card/version/ack trước khi tiếp tục.

## S08 — Resume / Tiếp tục phiên

Entry từ Hôm nay hoặc mở lại lesson. Tóm tắt “Đã lưu đến bước2/5 lúc …; tiếp theo bước3”, có version và mục tiêu; primary **“Tiếp tục bước3”** sau kiểm tra online. Nếu lesson đang dở nhưng due review ưu tiên hơn, Hôm nay chỉ có primary Ôn; phiên dở vẫn truy cập qua Học, không tự xóa. Không bắt chọn lại bài hay làm lại bước đã ack.

- loading: “Đang kiểm tra điểm đã lưu…”, khóa resume đến khi server xác nhận session/version/prerequisite.
- empty: không có checkpoint → nói rõ; nếu có lesson hợp lệ thì “Bắt đầu bài”, không giả “Tiếp tục bước3”. Draft trước crash không tồn tại thì không dựng lại câu trả lời.
- error: session/version stale → S09; request cũ chưa biết đã commit → đọc attempt/event trước, không tạo lượt mới. Đăng nhập lại vẫn phải xác minh đúng owner.
- offline: chỉ tóm tắt checkpoint đã có trong tab và timestamp, primary resume disabled. Sau crash tab mới không có snapshot: cần online để lấy checkpoint, không hứa học offline.

## S09 — Conflict / Chưa xác nhận và đọc lại

M0 chỉ xử lý online concurrency/version/request uncertainty; **không** triển khai conflict từ sync/lease v0.3. Surface dùng thông báo ngay trong màn bị lỗi, không ép đi qua một trang riêng. Headline “Dữ liệu đã đổi — cần đọc bản mới” hoặc “Chưa xác nhận đã lưu”; nêu thao tác, thời điểm đã xác nhận cuối cùng và requestId nếu có.

Primary **“Đọc trạng thái mới”** là thao tác đọc, không ghi đè. Nếu response xác nhận request gốc đã lưu thì hiển thị kết quả đó đúng một lần. Nếu chưa apply và retry còn hợp lệ, cho xác nhận gửi nguyên request/key; payload/key conflict thì dừng, không đổi key để vượt409. Nếu phải chọn lại do stateVersion đổi, user đọc bản mới và xác nhận một thao tác mới rõ ràng; không replay rating cũ lên card mới. Lịch server khác bản draft: hiển thị thay đổi, yêu cầu xem preview lại trước apply; không silently overwrite.

- loading: “Đang đối chiếu trạng thái…”, không có nút ghi cạnh tranh.
- empty: server không tìm thấy request/checkpoint → “Chưa có xác nhận cho thao tác này”; retry có kiểm soát nếu xác minh hợp lệ, nếu không thì về màn nguồn giữ cảnh báo.
- error: không đọc được → “Thử đọc lại”; 403 → dừng với thông báo quyền; không xóa bản nháp và không đánh resolved.
- offline: “Kết nối lại để đối chiếu”; primary disabled. Không có nút “Đồng bộ thành công”, “Ghi đè server” hay cam kết kết quả đã bền vững trên máy.

## Flow A–D và trace vào backlog

| Flow trong §8.3 | Chuỗi màn / điểm quan sát | Backlog thực hiện sau T004 |
| --- | --- | --- |
| **A — Online** | owner login → S01 → S02 → S03 → S04 ack → S05 → S06 answer/ack/feedback/complete → S07 → nextAction. Không AI, không nội dung chưa duyệt. | T010; T064–T066; T024; T012/T017/T021; T013/T015/T016/T018–T020; T022/T023/T025; UAT T026/T067. |
| **B — Interrupted** | S06 bước3 đang chờ/đã ack → đóng/crash → S08 đọc checkpoint → S09 nếu chưa biết ack → bước chưa hoàn tất. Không cộng điểm/time hai lần. | T015/T017/T020/T021; T011 idempotency; T023 khi gián đoạn rating; T064–T067 thời gian/lịch; T026. |
| **C — Offline (future gated)** | Mô tả gốc download→lease→snapshot→pending→ack/conflict **chưa activate M0**. M0 dùng S06/S07 offline → giữ draft tab nếu còn → S09 online readback → S08. Không đổi weekly settings offline. | M0 error/ack: T017/T021/T025/T066/T026. Download/outbox/lease/sync và durable resume: T027–T031 ở v0.3; không phụ thuộc chúng để giao T004/M0. |
| **D — Tutor down** | M0 không có tutor: S06 feedback/giải thích đã duyệt vẫn học tiếp. Tương lai tutor unavailable: đóng panel bổ trợ, trở lại cùng checkpoint, dùng giải thích được duyệt; không sinh fallback chưa duyệt. | M0 T016/T017/T018/T021; tutor/fallback T035/T037–T039 ở v0.2, không triển khai trong T004. |

Flow E bổ trợ tuần: bỏ lỡ/giảm budget → S04 online replan → S05; lịch sử frozen, nợ ôn giữ nguyên, không dồn quá cap. Trace T064–T067/T024. Bảng trace chỉ chỉ ra nơi triển khai; không mở, thực hiện hoặc đánh done các task đó.

## Walkthrough đã thực hiện trên tài liệu

Phương pháp: tác giả đi từng bước trên wireframe chữ và các nhánh trạng thái, đối chiếu lại SSOT tại commit nguồn ở đầu file. Dữ liệu dưới đây là **fixture giấy**, không có request thật, không tạo attempt/card hoặc gọi service/model. Kết quả “khớp trên giấy” là quan sát cấu trúc/logic, **không** là independent Reviewer PASS, đo usability người mới, device UAT hay test backend. Các case tham chiếu chính xác S01–S09 để reviewer lặp lại.

| Case / điều kiện đầu | Bước đã đi / quan sát cụ thể | Kết quả và giới hạn |
| --- | --- | --- |
| **W01 · T004: người mới chọn next ≤10s**; owner mới, online, giả định đã có package được duyệt và block15 phút đủ budget | S01 chọn “Tôi chưa biết gì” → S02 chọn6h → S03 sửa6 ngày×60, max25 → S04 thấy360/36/≤324 và áp dụng → S05. S05 có đúng1 primary “Bắt đầu15 phút”, ở hero trước navigation/chart; từ S05 tới action chỉ1 lần kích hoạt, không chọn khóa/bài. | Tìm thấy đường next không mơ hồ **trên giấy**. **Chưa đo ≤10s với người mới**; không suy số giây từ số lần bấm. Ngưỡng áp dụng từ lúc S05 sẵn sàng nhìn/thao tác; đo cả từ mở app riêng để không che thời gian chờ. |
| **W02 · T004: hiểu ratings**; card đã reveal, không hỗ trợ | S07 thử tình huống trả lời sai → label1 Quên; nhớ đúng nhưng khó → label2; nhớ đúng bình thường →3; nhớ ngay →4. Arrow key chỉ đổi selection, sau đó1 nút Xác nhận. Interval unavailable hiện chưa có ước tính; không tự chèn số ngày. | Bốn nhánh ánh xạ khớp §6.3, không preselect và không lẫn “khó” với trả lời sai. Chưa có người dùng diễn giải lại hoặc screen reader thật. |
| **W03 · T004: denied audio vẫn tiếp tục**; có transcript/key đã duyệt, thiết bị không phát được | S06 bấm Nghe → lỗi → Xem bản chữ → thấy nhãn Có hỗ trợ → trả lời → feedback/ack → bước hợp lệ tiếp. Listening evidence không độc lập; không mở mic hoặc gọi AI. Nhánh transcript chưa duyệt → bài chưa sẵn sàng, Về Hôm nay, không sinh transcript. | Có đường tiếp tục học hợp lệ trên giấy; không nâng mastery nghe hoặc tự pass tiêu chí nghe. Chưa kiểm browser/audio permission. |
| **W04 · 360px / keyboard** | 360−2×16=328px, một cột. S02 presets wrap2×2; S03 ngày xếp dọc; S07 rating2×2: (328−8)/2=160px mỗi ô, target≥44px. Truy vết skip link→heading→input/radio→primary→nav; submit sai về error summary, sang bước mới focus heading, có đường Shift+Tab. | Hình học và thứ tự thiết kế khớp; không đo overflow/contrast/keyboard trên DOM vì chưa có UI. Zoom200%, TalkBack/NVDA và bàn phím ảo còn cần thực nghiệm. |
| **W05 · bất khả thi / pause / giảm budget** | S02 360; S03 3×90; S04 thấy270 capacity,90 chưa xếp, ví dụ27 buffer/≤243 block; không có ngày120. Chọn chấp nhận lịch ít giờ hơn hoặc quay lại. Đã học100 rồi đổi60 → remaining0; pause không xếp mới. | Số học và nhánh xác nhận khớp §6.6; không xóa history, không giả planner đã chạy. |
| **W06 · response mất và crash** | S06 gửi bước3, không có ack → pending, không cộng kết quả; mất mạng → giữ draft nếu tab sống; crash → S08 chỉ lấy checkpoint server. Nếu request đã commit → S09 đọc về kết quả; chưa apply/hợp lệ → retry nguyên key;409 → đọc bản mới, không áp lại cũ. | Không có transition UI nào tự biến unknown thành saved hoặc replay mù. Đây là walkthrough, chưa chứng minh exactly-once bằng integration test. |
| **W07 · màn rỗng / nghỉ / review overload / mất dịch vụ** | S05 thiếu published lesson → lý do, không sinh bài; S07 hết due → next lesson hợp lệ hoặc về Hôm nay; overdue cao → new0, phiên10 nếu đủ cap; rest/paused → xem lịch. S01 dịch vụ chưa sẵn sàng → chưa thể thiết lập, không giả đã login. | Bốn loại empty tách nhau; unavailable không mở paid fallback/cloud. |
| **W08 · A–D, AI off và offline** | Đi lại A/B theo bảng trace; C kết thúc ở reconnect/readback M0 thay vì download/lease; D dùng giải thích T016, không có tutor call. Kiểm mỗi S01–S09 đều có bốn nhánh loading/empty/error/offline và action phục hồi. | Flow A–D có màn và task đích; không kéo v0.2/v0.3 thành prerequisite M0. Không Engineering Loop, smoke, bootstrap, subagent hay paid API. |

### Protocol kiểm chứng người dùng khi có bản tương tác

Đây là checklist chưa thực hiện, không giao thêm task trong phiên T004:

1. Người mới dùng UI Việt ở360px, không chỉ điểm CTA; đưa mục tiêu “bắt đầu việc học tiếp theo”. Đo từ S05 interactive đến kích hoạt đúng CTA, đạt≤10s; ghi thêm cold-open riêng, thiết bị/browser/zoom/network, số lần chọn sai và thời gian quan sát thực. Không lấy thời gian tác giả tự đọc làm số liệu người mới. Lần đầu onboarding đo riêng vì nhập quỹ giờ không nằm trong thao tác next ở S05.
2. Cho người dùng tự giải thích Quên/Khó/Nhớ đúng/Nhớ ngay sau reveal; đưa cả ca sai nhưng thấy khó. Ghi lựa chọn và lời giải thích, không gợi ý đáp án trước; hiểu sai cần sửa copy rồi thử lại, không tự đánh PASS.
3. Chặn playback thực, xác minh fallback bản chữ/assistance/đường học tiếp và nhánh thiếu asset; keyboard-only Windows/NVDA, Android/TalkBack, zoom200% và bàn phím ảo không che submit. Ghi actual observed focus/overflow/audio, không dùng walkthrough thay UAT.

## Acceptance readback và phần còn chờ review

| Tiêu chí T004 | Evidence trong artifact | Mức kiểm chứng |
| --- | --- | --- |
| Weekly budget/availability/preview và lịch cá nhân | S02–S04, W01/W05; presets/custom/cap/buffer/unscheduled/paused/missed | Đã mô tả và đối chiếu số học, chưa triển khai T064–T066. |
| Today/player/review/resume/conflict; một CTA | S05–S09, W01/W02/W06/W07 | Walkthrough tài liệu; không runtime. |
| Mỗi màn loading/empty/error/offline | S01–S09, quy tắc chung, W08 | 9/9 màn có bốn nhánh và hành động; không claim E2E. |
| Labels Việt, mobile360px, tokens/a11y | Tokens, wireframe S05, W04 | Rà thiết kế; chưa device/screen-reader UAT. |
| Next≤10s, ratings hiểu, denied audio học tiếp | W01/W02/W03 và protocol người dùng | Đã đi nhánh trên giấy; số đo người mới/thiết bị **chưa có**. |
| Không cần AI, không giả nội dung/ack/cloud | Phạm vi, S06/S09, W03/W06/W08 | Ràng buộc rõ; chưa tạo app/service/học liệu. |
| Flow A–D trace được vào backlog | Bảng Flow A–D; C/D ghi release gate | Chỉ trace, không thực hiện task liên quan. |

Không chạy lint/typecheck/build của ứng dụng vì T004 chỉ thêm tài liệu, chưa có application scaffold; §10.3 yêu cầu evidence phù hợp planning thay vì code test vô nghĩa. T004 vẫn pending trong SSOT: còn chờ review đúng scope và bằng chứng usability thực theo protocol; không có independent PASS hoặc owner acceptance được ngầm cấp bởi tài liệu này. Không merge, không sửa status/spec/ADRs/handoff và không bắt đầu task kế tiếp.
