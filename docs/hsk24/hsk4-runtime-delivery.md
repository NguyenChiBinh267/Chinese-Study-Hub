# HSK4 — runtime và batch 22–27

Đã thêm **144 mục từ, 24 bài dạy, 4 bài ôn và 224 bài tập**. HSK4 đạt **648/1000**, còn 352 mục từ. Tổng hiện có: 108 bài dạy + 16 bài ôn = 124 hoạt động, 992 bài tập. Tất cả vẫn là DRAFT_UNREVIEWED; xuất bản BLOCKED, chưa cấp mastery.

1. **Phiên bản:** branch `feat/hsk24-curriculum`; runtime và nội dung được đóng băng tại `f9607b2e9587ffeb16efdae061171b1e1c31fa8a`. Các commit sau bổ sung test hoặc tài liệu. HEAD bàn giao cuối được ghi trong câu trả lời của chat; không gán ngược kết quả đo cho commit tài liệu.
2. **Nguyên nhân Today chậm:** mỗi lần lập lịch đọc và phân tích toàn bộ 351 gói nguồn cùng 351 manifest DB đầy đủ trong giao dịch có khóa chủ sở hữu. Nay dùng chỉ mục metadata có hash/pin, quan hệ prerequisite và truy vấn metadata theo trang; nội dung đầy đủ chỉ tải cho bài được mở. Việc nhập offline dựng lại chỉ mục; yêu cầu Today thông thường không dựng lại nó.
3. **Đo trước/sau tại lớp repository:** gói nguồn đầy đủ 351 → 0; body DB 351 → 0; thao tác filesystem được đếm 365 → 14; SQL 34 → 23. Lần đầu 1089,5 → 99,3 ms; các lần sau từ 707,9–996,2 xuống 32,3–33,7 ms. Cùng DB và chủ sở hữu đo, nhưng dữ liệu đã được bổ sung giữa hai ảnh chụp. Index 1.319.365 byte vẫn được đọc/parse mỗi yêu cầu; không phải O(1). Mỗi trang 16 dòng, giữ tối đa 7 ứng viên mới và 7 resume; nhiều dòng bị loại có thể làm tăng số trang.
4. **Khởi động lạnh:** tiến trình Next mới, cache biên dịch đã chuyển sang kho lưu; không xóa cache PostgreSQL/hệ điều hành. HTTP status đầu 6,99 giây, Today đầu 385,6 ms, các lần sau 53,5–53,8 ms. Cả 5 yêu cầu trả 200; lượt đo này không có timeout, 503 hay retry. Đây là quan sát local, không phải SLA.
5. **Kết nối:** lần kết nối đầu khoảng 35,8 ms; dùng lại một kết nối. Pool về 0 sau đóng; kết nối ứng dụng về 0 sau dừng tiến trình đo. Pool tối đa 3, statement timeout 5 giây và giới hạn fetch 15/20 giây giữ nguyên. Log browser vẫn có aborted/ECONNRESET và Unexpected end of JSON input quanh điều hướng; chưa đủ dữ kiện kết luận chính xác nguyên nhân hoặc độ ổn định tổng quát.
6. **ID:** ID local hỗ trợ 3–6 chữ số; UUID, version và hash cũ giữ nguyên. Sắp xếp theo ordinal course/unit/lesson. Đã tái hiện và sửa guard nâng version còn giới hạn ba chữ số, kèm kiểm tra từ chối downgrade, đổi nghĩa, sai cấp và trạng thái duyệt. Cột DB là text, không cần migration. Allowlist của owner preview online không đổi.
7. **Batch hoàn thành:** 22–27, giữ nguyên đúng 24 ordinal đã lưu cho batch 22. Bài dạy L4001–L4024; bài ôn L49001–L49004 dùng lại sense/version/thẻ nguồn.
8. **Từ vựng:** 504 → 648/1000, tăng 144 mục duy nhất. Các bài ôn không được tính thêm từ mới.
9. **Nội dung:** thêm 24 bài dạy, 4 bài ôn và 224 bài tập. Ba bản v2 và một bản v3 sửa câu chữ/tham chiếu được thêm riêng, không ghi đè bản cũ. Tổng toàn hệ thống có 383 version phía server, gồm 377 version expansion; 314 expansion đang current và 63 bản lịch sử.
10. **Năm chiều:** bảng dưới chỉ thể hiện ánh xạ và luyện nháp. Không có hàng ngữ pháp hoặc bullet nhiệm vụ được chấp nhận hoàn toàn; competent human review vẫn thiếu.

| Chiều | Trước | Sau |
|---|---:|---:|
| Từ vựng nháp | 504/1000 | 648/1000 |
| Hàng ngữ pháp có ánh xạ | 67/95 | 90/95 |
| Tiểu mẫu ngữ pháp có dạy/luyện | 64 | 87 |
| Chữ có tham chiếu | 248/441 | 314/441 |
| Chữ được luyện nhận diện có gợi ý | 103 | 135 |
| Câu luyện nhận diện | 118 | 155 |
| Lá chủ đề có cảnh viết | 52/77 | 66/77 |
| Đầu nhiệm vụ có tham chiếu | 19/30 | 24/30 |

11. **Kiểm chứng:** unit 29 PASS / 0 FAIL / 0 SKIP; SQL/native 116 lượt PASS trên các bộ được liệt kê riêng; browser 17 lượt PASS trên 16 ca khác nhau, gồm cả hai nhánh Today. Typecheck, lint, helper lint và build exit 0. 3.046 ID khóa đáp án không xuất hiện trong các artifact client đã lưu: 123 file dev và 32 file production; đây là phép quét có giới hạn, không phải chứng minh hình thức. Trên cùng `csh_hsk24_bf294b6506c1`, giữ nguyên từng hash của 351 binding, 2.337 attempt, 1.180 session và 1.650 card cũ. Sau kiểm tra: 383/2.978/1.315/2.100; phần tăng thuộc dữ liệu kiểm tra mới. Cả 383 manifest khớp nguồn, 7 migration và 19 bảng FORCE RLS giữ nguyên. Phạm vi này không phải full backup/restore.
12. **Mốc tiếp:** batch 28, `content/hsk24/batch58.authoring.json`, L4025–L4028; 24 ordinal cụ thể nằm trong [checkpoint](hsk4-production-next-checkpoint.json). Không chạy lại finalizer của mốc 504. Các khoảng trống nghe, nói, viết tay, tự luận và nội dung HSK1–3 vẫn còn.
13. **Preview:** [HSK4 local](http://127.0.0.1:3037/learn/courses/HSK4), dùng đúng DB hiện tại. Không push, merge, deploy, cloud write hay tài nguyên trả phí; owner preview online không được thay đổi.
14. **Bàn giao:** các thay đổi được commit cục bộ; cây làm việc được kiểm tra sau commit báo cáo và receipt. Review AI chỉ đọc không thay cho duyệt ngôn ngữ, quyền xuất bản hoặc mastery. Epic vẫn PARTIAL.

Hai lượt lỗi được giữ riêng: (a) 7 PASS / 1 FAIL / 8 chưa chạy vì fixture cũ bắt resume vượt thẻ FSRS đến hạn; fixture mới kiểm tra đúng ưu tiên, không xóa lịch sử; (b) mobile dùng lại cache dev có 0 PASS / 1 FAIL / 7 chưa chạy do TypeError ở bộ nạp chunk Webpack. Đã lưu cache/trace và kiểm tra lại cùng mã với cache biên dịch mới, đạt 8/8. Kết quả này chưa chứng minh chính xác nguyên nhân; độ ổn định khi dùng lại cache dev còn mở.

[Bằng chứng có hash](hsk4-runtime-verification.json) · [Browser](hsk4-runtime-browser-evidence.json) · [AI content review](hsk4-runtime-content-review.json) · [AI source review](hsk4-runtime-source-review.json) · [Review packet cuối](hsk4-runtime-final-technical-review.json).
