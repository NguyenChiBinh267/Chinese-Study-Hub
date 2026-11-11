# Chinese Study Hub — private learning preview

Bốn bài DRAFT có thể luyện trong preview riêng tư local, qua owner được GoTrue xác nhận trên server. Có lưu tiến độ/FSRS và TTS zh-CN tùy chọn; chưa có qualified human approval và không tự tạo verified mastery/unlock. Online activation vẫn bị khóa. [Cách chạy, giới hạn và bằng chứng](docs/private-preview/README.md) · [chính sách đề xuất để owner duyệt](docs/private-preview/policy.md) · [audit ngôn ngữ](docs/private-preview/linguistic-audit.md).

## Content release adapter (retained)

Adapter publication đã thêm vào luồng Auth, dùng allowlist/hash/review/rights/audio ở server và repository chấm/lưu/FSRS/planner hiện có. Registry thật rỗng; bốn bài vẫn REVIEW_PENDING / DRAFT_UNREVIEWED / BLOCKED, chưa có audio giọng mẫu được duyệt. Preview dưới chỉ dùng fixture tổng hợp trong DB riêng; không phải phát hành học liệu thật.

Chuẩn bị lần đầu trên máy hiện tại (Node >=22, Docker/native PostgreSQL sẵn có; dừng preview cũ trước):

```powershell
cd D:\Chinese-Study-Hub
npm.cmd ci
npm.cmd run db:start
npm.cmd run db:migrate
npm.cmd run test:db
npm.cmd run auth:local:start
npm.cmd run content:release:test-init
npm.cmd run test:release:db
npm.cmd run content:release:preview
```

Mở [preview](http://127.0.0.1:3015/login); tài khoản thử ở `.local-postgres/sprint10/auth-local/owner-login.txt` (ignored). Khởi động lại cùng fixture chỉ cần DB/Auth đang chạy và `npm.cmd run content:release:preview`; chạy lại test-init tạo phiên bản tổng hợp mới, không xóa lịch sử cũ. Giữ bản học native và các lệnh cũ bên dưới. Chỉ một Next dev trong checkout.

[Kết quả Sprint 12](docs/sprint12/verification.md) · [Publication/review/audio workflow](docs/sprint12/publication.md) · [Owner actions](docs/sprint12/owner-actions.md) · [Runbook T009/T069/T053](docs/sprint12/release-runbook.md). `npm.cmd run test:release:auth -- --require-clean` kiểm GoTrue thật, Auth, token regressions trên DB mới không truncate, publication/SQL trên đúng commit sạch. Không có cloud/push/merge/deploy.

## Sprint 11 — checkpoint trước adapter

## Sprint 11 — kiểm chứng Auth thật và luồng học kỹ thuật

Docker đã khởi động lại sau khi giữ riêng hai thư mục socket lỗi; không reset/xóa volume. Luồng Auth dùng GoTrue thật và PostgreSQL runtime role, kiểm thử trong database sinh riêng, không chuyển lịch sử học native. Bài chuỗi ký tự tổng hợp chỉ xác minh kỹ thuật: **không phải bốn bài được duyệt hoặc bản production**.

Chạy preview Auth có fixture kỹ thuật, với Node >=22 và Docker/native PostgreSQL sẵn có. Dừng Next dev cũ của cùng checkout trước:

```powershell
cd D:\Chinese-Study-Hub
npm.cmd ci
npm.cmd run db:start
npm.cmd run auth:local:start
npm.cmd run auth:technical:init
npm.cmd run test:auth:technical-db
npm.cmd run auth:technical:preview
```

Mở [đăng nhập local](http://127.0.0.1:3015/login). Tài khoản thử nằm trong `.local-postgres/sprint10/auth-local/owner-login.txt` bị Git ignore, không phải owner cloud. Sau đăng nhập: hồ sơ/lịch → Today → khóa kỹ thuật → unit → hai câu → chấm/lưu → ôn FSRS → tiến độ → logout/login. DRAFT HSK/phát âm vẫn khóa trong Auth. Bản học native với bốn bài giữ lệnh ở phần “Chạy trên máy hiện tại”.

`npm.cmd run test:auth:release -- --require-clean` kiểm chứng Auth trên commit sạch: provider thật, SQL RLS riêng, browser security và luồng học desktop/360px. Lệnh reset **chỉ các hàng fixture tổng hợp trong database riêng** trước khi chạy; không giữ kết quả thử trên preview kỹ thuật qua các lượt test. Không chạy cùng Next dev khác.

[Kết quả và giới hạn Sprint 11](docs/sprint11/verification.md) · [Checklist release và việc cần người thực hiện](docs/sprint11/release-checklist.md) · [Runbook](docs/sprint11/release-runbook.md) · [Gói duyệt/audio](docs/sprint11/review-and-audio.md) · [Khôi phục Docker](docs/sprint11/docker-recovery.md).

## Sprint 10 — đăng nhập owner và ranh giới production

**SPRINT10_PARTIAL — checkpoint lịch sử.** Khi giao Sprint 10, mã xác thực chưa được kiểm lại trên mã cuối vì Docker lỗi đổi tên `sailor-ingest.sock`. Sprint 11 tiếp tục kiểm chứng sau sửa runtime socket; xem kết quả mới phía trên. [Bằng chứng Sprint 10 giữ nguyên](docs/sprint10/verification.md).

Bản học native dùng PostgreSQL và không cần Docker; có thể thay preview Auth bằng các lệnh ở phần “Chạy trên máy hiện tại”. Chỉ chạy một Next dev mỗi checkout.

Đã thêm đăng nhập Supabase SSR trên server, allowlist UUID owner, khôi phục/refresh phiên, đăng xuất giữa các tab, hồ sơ và lịch có lưu theo danh tính đã xác thực. Có dịch vụ **Supabase Auth/GoTrue thật chạy cục bộ** để kiểm thử; đây không phải tài khoản Supabase cloud hoặc owner online đã được cấp quyền. Bộ hồ sơ production, cloud RLS, phí 0 thực tế, duyệt nội dung và triển khai vẫn có gate riêng.

Ba chế độ tách biệt: `DEMO`, `LOCAL_DATABASE_DEV`, `PRODUCTION_AUTHENTICATED`. Artifact production mặc định yêu cầu Auth, không dùng development adapter. API authenticated chặn học liệu DRAFT; đăng nhập không tự xuất bản bài hay chuyển lịch sử local sang tài khoản mới. Luồng học/chấm/FSRS hiện có được giữ trong local development.

Chạy preview đăng nhập cục bộ bằng Node >=22, native PostgreSQL và Docker đang chạy; dừng Next dev cũ của cùng checkout trước:

```powershell
cd D:\Chinese-Study-Hub
npm.cmd ci
npm.cmd run db:start
npm.cmd run db:migrate
npm.cmd run test:db
npm.cmd run auth:local:start
npm.cmd run auth:local:preview
```

Mở [đăng nhập thử](http://127.0.0.1:3015/login). Tài khoản **chỉ dành cho kiểm thử local** nằm trong `.local-postgres/sprint10/auth-local/owner-login.txt`, bị Git ignore; không dùng cho production. Script chỉ quản lý các container Sprint10 có tên riêng và loopback, không sửa container của dự án khác. Ctrl+C dừng preview/gateway; `npm.cmd run auth:local:stop` dừng riêng provider thử. Chạy lại ứng dụng local gốc bằng lệnh ở phần tiếp theo, hoặc theo [runbook](docs/sprint10/release-runbook.md).

[Kiến trúc và giới hạn](docs/sprint10/architecture.md) · [Register dịch vụ miễn phí và bằng chứng còn thiếu](docs/sprint10/free-service-register.md) · [Cấu hình, bảo toàn dữ liệu và release runbook](docs/sprint10/release-runbook.md).

## Sprint 9 — pilot micro thật

Mở [pilot 4 thanh](http://127.0.0.1:3015/learn/pronunciation?pilot=1&target=pron-tone-1-v1), chọn LOCAL DATABASE. Điền browser/micro/nguồn thật, ghi một âm, xem mức tín hiệu, nghe hết bản gốc rồi phân tích. Mỗi thanh tối đa ba lần trong lần mở pilot; dùng form ghi rõ/không rõ, đồ thị khớp/nghi ngờ, nhận xét dễ hiểu và lỗi. Có thể sửa kết quả lượt trước và tải JSON chỉ chứa metadata. App không upload hoặc tự lưu audio; pilot có nút tùy chọn tải bản gốc về máy khi bạn chủ động bấm. Hai đường đo chỉ để quan sát, không tăng điểm/mastery.

**SPRINT9_PARTIAL — còn lỗi theo dõi cao độ trên bản thu thật.** Đã phân tích cục bộ cặp bản gốc 2,76 giây / đoạn cắt 1,30 giây sau khi chủ máy đồng ý riêng. Bật lọc nền local chỉ tăng từ 18 lên 21 khung được giữ trên 268 khung; chưa khắc phục đồ thị rời rạc. Chưa có hardware PASS hoặc đánh giá phát âm được hiệu chuẩn. [Kết quả và giới hạn mới nhất](docs/sprint9/real-audio-investigation.md) · [Protocol ngắn](docs/sprint9/manual-pilot.md) · [Bằng chứng trước đó](docs/sprint9/verification.md).

Chủ máy đã báo **FAIL: cả bản gốc và đoạn cắt còn tạp âm nặng, đồ thị không khớp**; browser/micro và trạng thái lọc chưa rõ. Pilot hiện bật sẵn **Giảm ồn khi thu · trình duyệt xử lý** cho bản ghi mới; yêu cầu AGC/AEC vẫn tắt. Dòng trạng thái phân biệt đã yêu cầu với trình duyệt thực sự báo Bật/Tắt/Không có thông tin. Chưa xác nhận khắc phục trên phần cứng. [Thay đổi, kiểm thử và cách thử lại](docs/sprint9/noise-followup.md).

Sau `a6d635a`, chủ máy báo NS **Bật/Bật**, tạp âm **giảm rất nhiều nhưng còn**. Phân tích vẫn `INSUFFICIENT_SIGNAL`: giữ 33/166 khung, 330 ms và 37% khung có năng lượng. Chưa đạt pilot PASS; không nới ngưỡng để lấy nhận xét. [Số liệu và bước đối chiếu cùng bản thu](docs/sprint9/owner-pilot-observations.json).

```powershell
npm.cmd run test:pilot:unit
npm.cmd run test:sprint9:browser
```

Ứng dụng Next.js/TypeScript strict có sáu màn hình, lịch tuần, bài học và ôn tập. **F01/F02/L001/L002 có phần giảng tự soạn, bài tập được server chấm và tiến độ lưu PostgreSQL**. L001/L002 v2 có hội thoại, sắp xếp câu, nhập chữ Hán và Pinyin; mapping HSK1 vẫn PARTIAL. Today chọn một việc tiếp theo từ planner thật, thẻ FSRS đến hạn và checkpoint đã lưu. Không phải bản production hoặc học liệu được duyệt; không hoàn tất task nào trong SSOT.

## Chạy trên máy hiện tại

Từ `D:\Chinese-Study-Hub`, dùng Node.js 22+ và PostgreSQL native miễn phí. Máy hiện tại có PostgreSQL18; luồng local development dưới đây không cần Docker hoặc cloud. Docker chỉ cần cho bộ tích hợp Auth cục bộ phía trên.

```powershell
npm.cmd ci
npm.cmd run db:start
npm.cmd run db:migrate
npm.cmd run db:content
npm.cmd run db:curriculum
npm.cmd run test:db
$env:CSH_APP_ORIGIN = 'http://127.0.0.1:3015'
$env:CSH_APP_MODE = 'LOCAL_DATABASE_DEV'
npm.cmd run dev -- --port 3015
```

Mở [ứng dụng](http://127.0.0.1:3015/), chọn **Bắt đầu học có lưu**, lưu quỹ giờ/ngày rảnh và đến Today. Theo CTA chính để luyện F01 → ôn thẻ đến hạn → F02 → L001 → L002. Khi đã có cấu hình và cookie local, trang gốc đưa vào Today. Đọc phần giảng, chọn/gõ/sắp xếp câu trả lời và nhận phản hồi thật từ server. Reload đọc lại câu trả lời và bước đã lưu. **Ôn tập** dùng FSRS lưu PostgreSQL; **Tiến độ** phân biệt luyện tập chưa duyệt với bằng chứng độc lập (hiện bằng 0).

Cài máy mới: chạy `npm.cmd run db:init` thay cho `db:start`/`db:migrate` lần đầu, sau đó `db:content`, `db:curriculum` và `test:db`. `db:init` tạo cluster riêng `.local-postgres/data`, nghe `127.0.0.1:5447`, database `csh_local`; không sửa database khác. Nếu PostgreSQL ở nơi khác, đặt `CSH_PG_BIN` trỏ đến `bin`. Thiếu binary thì cần cài PostgreSQL OSS; script không tải phần mềm hay tạo dịch vụ trả phí.

Credentials sinh riêng và nằm trong `.env.local`/`.local-postgres/credentials.json` bị Git ignore; không chia sẻ các file này. Credential runtime và migration tách biệt. `db:stop` chỉ dừng cluster dự án. Migration/seed chạy lại không sửa phiên bản đã đăng ký; hash khác với ID cũ sẽ bị từ chối. **Không dùng `db:rollback` trên dữ liệu cần giữ**: lệnh đó xóa schema local và yêu cầu `--confirm-local-data-loss`.

## Quan sát cao độ local — Sprint 8

**SPRINT8_PARTIAL:** luồng recorder/decoder/F0 local đã kiểm bằng nguồn âm thanh tổng hợp. Chủ app báo v2 đã có đồ thị nhưng vẫn có lời nhắc chưa đủ tín hiệu; panel gửi sau đó là NOT_ANALYZED, chưa biết lý do từ chối chính xác. V3 đang chờ thử giọng thật. Chưa hoàn tất protocol Windows/Android thật hoặc hiệu chuẩn phát âm.

Policy hiện tại là **v3**: giữ lọc Gaussian của v2 và thêm **Lọc tiếng nền đều · thử nghiệm**, mặc định tắt. Khi bật, bấm ghi rồi giữ im lặng khoảng nửa giây trước khi đọc một tiếng; app lấy 0,3 giây đầu làm mẫu nền cho spectral subtraction trên bản sao phân tích. Không đủ mẫu phù hợp thì bỏ qua và báo rõ. Có thể bật/tắt rồi phân tích lại cùng bản thu. Bản nghe lại giữ nguyên; ngưỡng tuần hoàn 0,9 vẫn giữ, đoạn khai báo làm mẫu nền tách khỏi khung giọng. Đồ thị một phần chưa đủ điều kiện nhận xét và đường của lần trước được ghi rõ. Chưa kết luận tạp âm là nguyên nhân ca micro thật.

**Nghe riêng đoạn đọc:** ghi bản mới (im lặng nửa giây đầu rồi đọc một âm), trong phần cùng tên đánh dấu đã để khoảng nền và bấm **Tách đoạn đọc**. Nghe bản đã cắt, sửa đầu/cuối nếu cần; có thể tắt/bật giảm nền trong đúng đoạn chọn. Bản gốc vẫn ở phía trên để đối chiếu. Sau follow-up Sprint 9, NS theo lựa chọn **Giảm ồn khi thu**; AGC/AEC vẫn được yêu cầu tắt. Yêu cầu có thể bị thiết bị bỏ qua; trạng thái trình duyệt báo lại hiển thị riêng. Chưa xác nhận sửa hiện tượng giọng nhỏ dần trên máy thật. Tách theo thời gian không xác minh người nói hoặc tách được tiếng người khác chồng lên. Không tự tăng âm lượng cả bản thu. [Cơ chế, giới hạn và kiểm chứng](docs/sprint8/utterance-playback.md).

Mở [Luyện phát âm](http://127.0.0.1:3015/learn/pronunciation), chọn LOCAL DATABASE → một thanh 1–4. Đánh dấu chỉ đọc **một âm tiết riêng**, bấm Ghi âm, dừng/nghe lại rồi **Phân tích cao độ**. Âm thanh thực từ recorder được trình duyệt giải mã và `pitchy@4.1.0` (McLeod Pitch Method, MIT) xử lý trong worker local. Biểu đồ dùng mốc thời gian thật, F0 ước lượng và cao độ tương đối của chính bản thu, giữ khoảng trống ở khung không đo được. Đây là **quan sát cao độ thử nghiệm**, chưa hiệu chuẩn hoặc chứng minh phát âm Mandarin đúng.

Nhận xét gồm hướng giọng đo được, một cách thử luyện và thử lại; chi tiết kỹ thuật thu gọn. Im lặng, quá nhỏ, clipping, tín hiệu yếu, nghi vấn quãng tám hoặc phân đoạn không rõ sẽ từ chối nhận xét. Chọn **Ghi lần tiếp · giữ đường để so** để xem hai lần gần nhất; không có điểm phần trăm hoặc kết luận tiến bộ. Raw audio cũ bị bỏ khi ghi lại; chỉ một bản thu hiện tại và tối đa hai đường số đo nằm trong RAM của tab. Xóa bản thu sẽ xóa cả các đường. Không upload, không speech API, không lưu audio vào database/localStorage/IndexedDB; riêng pilot cho phép bạn chủ động tải file gốc về máy. Không chấm âm vị/bật hơi/môi/lưỡi và không tạo speaking/listening mastery.

Các hướng dẫn b/p, d/t, g/k, j/q/x, zh/ch/sh, z/c/s, u/ü vẫn dùng được; chưa có phân tích âm học cho chúng. Thanh nhẹ, thanh 3 trong câu và 你好 không dùng luật một âm tiết; không ép mọi thanh 3 phải võng xuống rồi lên. Không có giọng mẫu được cấp quyền và duyệt. Thuật toán/threshold là heuristic chưa hiệu chuẩn, có thể nhầm tiếng nền tuần hoàn hoặc bỏ sót giọng khàn/nhỏ; không nhận dạng được hai âm liền không có khoảng nghỉ.

```powershell
npm.cmd run test:acoustic:unit
npm.cmd run test:sprint8:browser
```

[Bằng chứng và giới hạn Sprint 8](docs/sprint8/verification.md) · [Thuật toán và policy v3](docs/sprint8/acoustic-policy-v3.md) · [Protocol micro Windows/Android thật](docs/sprint8/manual-microphone-protocol.md) · [Gate đánh giá tương lai](docs/sprint8/evaluation-gate.md). Kiểm thử browser dùng nguồn âm thanh tổng hợp qua recorder/decoder/worker thật; không tính thành PASS phần cứng hoặc độ chính xác phát âm. Sprint 8 dùng hai dependency OSS pitchy/fft.js (v3 chỉ khai báo trực tiếp fft.js đã có), không thêm migration.

## Nền tảng hướng dẫn phát âm — Sprint 7, được giữ lại

Mở `/learn/courses/FOUNDATION` → **Luyện khẩu hình và thanh điệu · draft**, hoặc `/learn/pronunciation`. F01/F02 có panel **Cách phát âm · luyện tùy chọn, không tính điểm** ngay trong player. Mở panel tạm dừng telemetry thời gian của bài chữ; không cần luyện âm để hoàn tất bài. Today, lịch tuần và ưu tiên FSRS giữ nguyên.

Có **31 notes có phiên bản**: b/p, d/t, g/k; j/q/x, zh/ch/sh, z/c/s, r; u/ü và quy ước ju/qu/xu/yu; thanh 1–4, thanh nhẹ, thanh 3 trong câu và 你好. Bốn cặp đối chiếu và một note về nhầm Pinyin với chữ Việt nằm trong tổng 31. **26 cấu hình SVG tự vẽ** phân biệt nơi lưỡi làm việc, chặn/thả hơi, khe xát, môi tròn/dàn và đường thanh. Notes/SVG đều DRAFT chưa duyệt chuyên môn, không theo tỷ lệ giải phẫu, không phải học liệu HSK chính thức.

Giao diện có mẹo một câu, bước thực hành, lỗi dễ nhầm/tự kiểm và phần kỹ thuật/nguồn thu gọn. Mẹo sửa là gợi ý có điều kiện, không chẩn đoán âm thanh. Sprint 7 chưa có ước lượng F0; Sprint 8 bổ sung phép đo giới hạn như phần trên. Vẫn không có ASR, chấm phát âm, giọng mẫu được duyệt hay TTS. Không sinh listening/speaking mastery, không đổi grading/FSRS và không lưu activity phát âm vào database.

**Ghi âm chỉ sau khi bấm nút**: một âm/cụm ngắn, tối đa 12 giây / 2 MB, nghe lại, xóa hoặc ghi lại. Âm thanh nằm trong RAM của tab và Blob URL; không upload, không lưu file/database/localStorage/IndexedDB, không log audio. Đổi âm, đóng panel, rời trang hoặc chuyển nền sẽ tắt track và bỏ bản thu. Không hỗ trợ micro/định dạng/quyền vẫn xem được toàn bộ hướng dẫn. HTTPS hoặc localhost là điều kiện trình duyệt; HTTP từ Android tới IP LAN của máy tính thường không có micro. Kiểm tra Chromium với nguồn âm thanh tổng hợp **không chứng minh micro vật lý hoặc Android thật**.

```powershell
npm.cmd run test:pronunciation:unit
npm.cmd run test:sprint7:browser
$env:CSH_SPRINT7_VIEWPORT = 'mobile'
npm.cmd run test:sprint7:browser
Remove-Item Env:CSH_SPRINT7_VIEWPORT
npm.cmd run review:pronunciation
```

Notes và pin: `content/pronunciation/release.v1.json`, `release-pin.json`. Code/schema/SVG/recorder: `src/modules/pronunciation/`. API đọc `/api/local/pronunciation` giữ development identity/owner/loopback gates, chặn production và origin khác; không có endpoint upload hoặc publisher. Không có migration mới. Packet riêng và SVG reviewer: `.local-postgres/review-packets/sprint7/final/`, các trường người duyệt để trống. Không ghi đè manifest hoặc packet Sprint 6.

[Bằng chứng và giới hạn Sprint 7](docs/sprint7/verification.md) · [Readiness cho người duyệt](docs/sprint7/review-readiness.md).

## Khóa học và unit

Mở `/learn` ở LOCAL DATABASE: **Nền tảng tiếng Trung → HSK1 → HSK2 → HSK3 → HSK4**.

| Khóa               | Unit và bài có thực                                                  | Trạng thái                                        |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------------- |
| FOUNDATION         | Pinyin: F01; Thanh điệu: F02                                         | Chỉ luyện draft local; không phải cấp thi HSK     |
| HSK1               | Chào hỏi và giới thiệu: L001v2; Sở thích và câu hỏi đơn giản: L002v2 | Mapping PARTIAL; chỉ luyện draft                  |
| HSK2 / HSK3 / HSK4 | 0 unit, 0 bài                                                        | Chưa phát hành học liệu; HSK4 là mục tiêu dài hạn |

`/learn/courses/FOUNDATION`, `/learn/courses/HSK1`, … mở khóa; `/learn/courses/HSK1/units/greetings` mở unit. Mỗi bài có đường về đúng khóa/unit. Các liên kết truy cập nhanh bốn draft và DEMO cũ được giữ.

Tiến độ từ PostgreSQL tách số bài bắt đầu/đã có attempt/hoàn tất luyện, bằng chứng hợp lệ, học liệu chưa duyệt và thẻ đến hạn. “2/2 bài hiện có” không phải 100% HSK1; mẫu số toàn cấp chưa được xác minh. Hoạt động L001/L002v1 vẫn giữ riêng, không chuyển thành hoàn tất v2.

Prerequisite kỹ năng dùng projection từ engine mastery hiện có, có kiểm tra evidence và stale; số phút, lật slide, draft completion và FSRS rating không thay thế điều kiện. Hiện không có khóa/bài nào đạt publication approval. Local cho phép luyện draft tùy chọn với giải thích thiếu bằng chứng. Planner vẫn chỉ gợi ý bài tiếp theo sau các prerequisite practice đã hoàn tất, ưu tiên ôn đến hạn và tôn trọng lịch; không xếp HSK2–4.

Metadata có một nguồn `content/curriculum/catalog.v1.json`, được validate rồi seed vào sáu bảng catalog của PostgreSQL. Không sửa manifest cũ để đổi khóa/unit. Các `packages` / `exercise_versions` đã có tiếp tục là version bindings bất biến. Thêm bài tương lai qua package/version và metadata có review; không tạo placeholder để đủ số lượng. Đổi current version đã đăng ký cần migration có chủ đích, không seed đè.

## Chuẩn bị duyệt học liệu

```powershell
npm.cmd run review:packets
```

Bốn packet JSON và tờ ghi nhận Markdown nằm ở **`.local-postgres/review-packets/sprint6/`**, bị Git ignore và không được server phục vụ. JSON chứa Chinese/Pinyin/Vietnamese, bài tập, đáp án riêng/accepted alternatives, locators, quyền và câu hỏi chưa giải quyết. Các trường reviewer/decision để trống. Chạy lại giữ nguyên nhận xét đã điền; script không nhập quyết định vào app hoặc cấp publication. Không đưa thư mục này vào public/Git/cloud. [Bảng readiness công khai không chứa đáp án](docs/sprint6/review-readiness.md).

## Nội dung và hai chế độ

| Chế độ / đường dẫn                                       | Hành vi                                                                                                                                                                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEMO, `/learn/F01`…                                      | Bốn fixture preview cũ, state React trong tab; reload reset. Không đưa vào PostgreSQL.                                                                                                                                  |
| LOCAL DATABASE, `/learn/draft/F01`, `/learn/draft/F02`   | Package v1 tự soạn, phần giảng + choice/Pinyin, server grading, immutable attempts, resume/completion và duration telemetry lưu PostgreSQL.                                                                             |
| LOCAL DATABASE, `/learn/draft/L001`, `/learn/draft/L002` | Package v2 tự soạn: mỗi bài 6 concepts, 6 bài tập, 3 phần giảng; mapping PARTIAL có locator. v1 cũ vẫn đọc được bằng query `?version=l001-draft-v1` hoặc `l002-draft-v1`. Practice tùy chọn, không tuyên bố đã mở khóa. |
| LOCAL DATABASE, `/learn/local-foundation-v1`             | Fixture nhận diện chuỗi Phase3 được giữ để tương thích và hồi quy.                                                                                                                                                      |

Onboarding lưu lựa chọn zero/some cùng cấu hình lịch; đây là lựa chọn xuất phát, chưa phải placement test. Planner deterministic lưu version/asOf/reason, day caps, timezone, paused và ngoại lệ nghỉ/10 phút trong PostgreSQL. Phần chưa học được xếp lại khi cấu hình, ngày hoặc dữ liệu học thay đổi; completed/in-progress giữ lịch sử. Không dồn phút đã lỡ, không đổi due_at FSRS, không tạo bài lặp để lấp quỹ giờ. Nợ ôn quá tải được hiển thị, số phút dự kiến tách khỏi interval thực đã ACK. Feasible cả tuần tính từ ngân sách và cap cấu hình; remaining capacity chỉ tính ngày còn lại. Dự phòng 10%; ưu tiên ôn có thể dùng phần dự phòng trong giới hạn. Lộ trình draft tùy chọn sau prerequisite đã luyện không phải mở khóa mastery. Forecast HSK hiện chưa đủ dữ liệu. Không tự fallback DEMO hoặc báo đã lưu khi chưa được server xác nhận. Mất phản hồi sau commit có thể retry cùng idempotency key trong tab; reload đọc lại kết quả đã commit. Không có durable offline queue.

F01/F02 chỉ đánh giá ký hiệu viết/Pinyin. Không có audio/TTS được bật; nghe và phát âm **CHƯA ĐÁNH GIÁ**. Dự kiến 15 phút là mục tiêu thiết kế, chưa có pilot xác nhận thời lượng. Mọi package mới đều `REVIEW_PENDING / DRAFT_UNREVIEWED / publication BLOCKED`. Quyền nguồn, review tiếng Trung/đáp án và publication chưa được cấp. Đối chiếu chính xác 26 locator từ syllabus 2025-11 không biến nội dung thành bài HSK chính thức.

`ts-fsrs@5.4.2` giữ nguyên config, dùng đồng hồ server, lưu card/review log đầy đủ. Card từ concept nháp được ghi rõ chưa duyệt, tối đa 10 card mới/ngày UTC, một card/concept. Hai template fixture cũ giữ nguyên. Self-rating không tăng mastery. Rule engine mastery v1 giữ nguyên; các attempt nháp, key chưa duyệt và duration client đều không trở thành bằng chứng độc lập hoặc secure/unlock.

## Giới hạn an toàn

UI → Route Handler + development identity/Zod → repository → PostgreSQL transaction. Runtime `csh_runtime` không sở hữu bảng, không superuser/BYPASSRLS/membership; 18 bảng owner dùng FORCE RLS. Catalog global chỉ SELECT với runtime, không publisher adapter. Private key không có trong list/exercise fetch/React props. API local chỉ hoạt động ở development, loopback, Host/Origin hợp lệ, cookie HMAC và owner allowlist; đây không phải đăng nhập production.

`test:db` ghi runtime proof sau kiểm tra RLS/transaction thật; migration thay đổi sẽ vô hiệu proof và khóa learning writes cho đến khi kiểm tra lại. Production khóa API local dù env còn flag. Không tạo Supabase/Vercel/Render, không deploy/push/merge/status DONE. T009/T068/T069 và content gates giữ nguyên.

Duration đo interval foreground có focus, idle cap 60 giây, bỏ background/overlap, một lease/owner và event ID chống replay. Server phân loại tính nhất quán; đây vẫn là client-observed telemetry, không chứng minh thời gian học độc lập. Chỉ interval đã ACK được hiển thị là đã lưu; reload/unload/network có thể bỏ mất phần chưa ACK.

## Kiểm chứng và tài liệu

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run format:check
npm.cmd run test:learning:unit
npm.cmd run test:content:unit
npm.cmd run test:weekly:unit
npm.cmd run test:curriculum:unit
npm.cmd run test:db
npm.cmd run test:local
npm.cmd run test:learning:browser
npm.cmd run test:content:browser
npm.cmd run test:sprint5:browser
$env:CSH_SPRINT5_VIEWPORT = 'mobile'
npm.cmd run test:sprint5:browser
Remove-Item Env:CSH_SPRINT5_VIEWPORT
npm.cmd run test:sprint6:browser
$env:CSH_SPRINT6_VIEWPORT = 'mobile'
npm.cmd run test:sprint6:browser
Remove-Item Env:CSH_SPRINT6_VIEWPORT
npm.cmd run build
npx.cmd playwright test --config playwright.persistence-demo.config.ts
```

Các browser suite tự chạy server riêng; dừng preview trước khi chạy để tránh trùng port 3015 hoặc khóa `.next/dev`. Chromium cần cài sẵn (`npx.cmd playwright install chromium` nếu thiếu). Suite dùng owner development tạm, không xóa lịch sử của owner hiện tại. Hai viewport Sprint5 chạy hai lần riêng để có owner mới và tránh hai Next dev cùng giữ lock. Evidence mới ở `docs/sprint6/`; DB logs/backup/source PDF ở `.local-postgres/` bị ignore.

- [Báo cáo Sprint6: khóa HSK, version binding, review packets và bằng chứng](docs/sprint6/verification.md).
- [Báo cáo Sprint5, planner, backup và kết quả E2E](docs/sprint5/verification.md).
- [Báo cáo Phase4, nguồn, migration và giới hạn kiểm chứng](docs/phase4/verification.md).
- [Quy tắc package/provenance v1](content/staging/slice/README.md).
- [Báo cáo Phase3 lịch sử](docs/local-learning/verification.md), [Phase2 lịch sử](docs/local-persistence/verification.md).

Đọc PDF là đối chiếu nguồn, không phải giấy phép tái phân phối. PDF và page renders không nằm trong Git/app assets. Kiểm tra file media thực tế chỉ thuộc CLI authoring/seed; runtime Phase4 từ chối package có media cho đến khi có adapter và quyền/review phù hợp.
