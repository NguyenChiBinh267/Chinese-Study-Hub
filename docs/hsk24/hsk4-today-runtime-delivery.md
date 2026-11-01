# HSK4 — sửa luồng lưu lịch và Today (2026-10-29)

Đã sửa việc form lịch local bị unmount trong lúc refresh snapshot sau khi server xác nhận lưu. Planner dùng lại cùng một tập package đã xác thực trong yêu cầu và dựng chỉ mục nhãn khái niệm một lần. Kiểm tra hash được siết thêm: hash tính từ body, hash DB, `packageHash` trong manifest và hash nguồn phải cùng khớp.

Mã nguồn: `9a38ca84d79ea28a483ab97c70ce2fa62234c024`, sau mốc `f80064364caa2bb4e1488a5a3158d5b3d2ea1553`. Review độc lập chỉ đọc xác nhận sửa chức năng trong phạm vi: **VERIFIED_SCOPED_FUNCTIONAL_REPAIR / FULL_CORPUS_AND_COLD_INITIALIZATION_GATES_OPEN**. [Receipt](hsk4-today-runtime-technical-review.json); toàn bộ epic chưa hoàn tất. [Bằng chứng và hash artifact](hsk4-today-runtime-verification.json).

Kiểm tra mới: **8 native SQL PASS, 18 unit PASS; mobile 360px 2 PASS / 0 FAIL / 0 SKIP, retries 0**. Hai ca mobile kiểm tra giữ form khi cố ý giữ chậm snapshot, và L492 → Today → đúng URL phiên bản → giữ cursor sau reload. Lần cuối có warmup biên dịch route dev trong setup; assert chức năng vẫn 15 giây, timeout ứng dụng/API/SQL giữ nguyên. Typecheck, lint và production build exit 0.

Số lượt đọc file package trong một preview giảm từ **702 xuống 351**, vẫn là cùng 351 phiên bản. Đây là giảm công việc lặp; **Today/NextLesson chưa độc lập với corpus**: vẫn đọc một catalog nguồn đầy đủ và toàn bộ DB manifest trong owner transaction. Thời gian đo có tác vụ Next chạy đồng thời; không suy ra phần trăm tăng tốc hoặc latency SLA.

Các lần FAIL được giữ nguyên: lần cold đầu chưa tới form; lần tái hiện có PATCH200 rồi form biến mất khi snapshot bị giữ, đồng thời có một preview503 chưa rõ nguyên nhân chính xác. Sau sửa, run trung gian 1 PASS / 1 FAIL đã qua lưu lịch nhưng timeout ở heading L492 khi status còn pending. Giả thuyết là khởi tạo/biên dịch route dev chậm; trace chưa chứng minh nguyên nhân duy nhất. Run warm cuối 2/0 vẫn có log aborted/ECONNRESET thoáng qua. Không nhận là cold-start/transport/performance đã PASS. Reviewer đầu không đủ điều kiện chỉ đọc vì lệnh unit tạo8artifact tạm; chỉ kết luận của reviewer mới được dùng cho review cuối.

Database vẫn là `csh_hsk24_bf294b6506c1`: mọi hash ở mốc trước của **351 package bindings, 2.337 attempts, 1.179 sessions và 1.650 cards** giữ nguyên; sau test có thêm một session L492. Toàn bộ351DB manifest khớp phiên bản nguồn. Đây không phải bản backup/restore toàn DB. Bundle production32file và snapshot dev78file đã đóng băng có0hit khi quét2.760IDkhóa đáp án; đây là kiểm tra marker có giới hạn, không phải chứng minh không thể rò rỉ.

**HSK4 vẫn504/1000 từ,96hoạt động nháp; chưa thêm batch22.** Gate tiếp theo là metadata cho Today/NextLesson có giới hạn và kiểm tra contention/cold initialization, sau đó hỗ trợ ID L4001–L4004 trước khi soạn batch22. Human review, quyền phát hành và mastery vẫn bị chặn. Package, Auth/RLS, migrations, allowlist, SSOT và Engineering Loop không thay đổi; không push/merge/deploy.

Preview local: http://127.0.0.1:3037/learn/courses/HSK4 — chỉ development, không phải bằng chứng đăng nhập owner thật. Readback HTML/status được ghi riêng; không thay thế kiểm tra tương tác.
