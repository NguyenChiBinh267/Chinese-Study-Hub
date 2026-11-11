# V1 release gates — chưa cho phép triển khai

Đây là checklist thực thi, không phải cập nhật task-status.json hoặc quyết định chọn host. Không có tài nguyên cloud, billing, push, merge hay deploy trong Sprint 11.

## Cổng kỹ thuật và nội dung

| Gate | Bằng chứng cần có | Ai / hành động còn lại |
| --- | --- | --- |
| Auth local | GoTrue thật, owner/non-owner, refresh/revoke, cookies, CSRF, restore và logout; exact final source và SQL runtime | Chạy lại bằng các scripts/tests Sprint 11; giữ riêng local proof với cloud proof. |
| Nội dung thật | Bốn immutable versions có competent Mandarin/key review, mapping/rights/audio decisions | Người có chuyên môn duyệt [gói riêng tư](review-and-audio.md); không ký bằng AI hoặc chỉ vì browser tests PASS. |
| Published-content adapter | Hiện Auth mặc định vẫn khóa toàn bộ DRAFT và chưa có published learner catalog/player adapter. Fixture chỉ chứng minh luồng kỹ thuật riêng | Sau khi có manifest/review receipts đủ bằng chứng, triển khai adapter cho approved immutable release và chạy lại E2E thực. Không dùng cờ fixture làm bản production. |
| T068 actual account | Account/team/org, Free/Hobby thật, no-card/no-charge, quota đang dùng/còn lại/reset, không add-on/trial | Owner cung cấp bằng chứng từ tài khoản; [register hiện có](../sprint10/free-service-register.md) chỉ xác nhận policy công khai. |
| T009 hosted | Least-privilege custom role trên topology Free thực, verified TLS/pooler, migration-bound proof, FORCE RLS/claims/A-B/context cleanup, private Data API schemas | Chỉ làm sau quyền provision rõ ràng và T068; local native proof không thay thế. |
| T069 | Phiên benchmark bounded 2–4 giờ được cấp quyền, cold/warm/auth+SQL/retry/pool/runtime/body/build/rollback/latency và browser Windows/Android | Không benchmark hoặc chọn host trong sprint này. Ghi kết quả thật trước ADR-006 lock; không điền số ước đoán. |
| T053 | Chấp thuận deploy cụ thể, đủ gates trước đó, exact SHA/lockfile, migration/backup/restore, smoke/rollback | Owner cấp quyền riêng sau khi xem kết quả. |
| Thiết bị | Windows/Android thật: input/layout/audio, history và Auth | Owner thực hiện checklist dưới; Chromium 360px không thay thế thiết bị thật. |

`SPRINT11_LOCAL_TECH_COMPLETE`, nếu được ghi trong verification, chỉ có nghĩa các tiêu chí thử nghiệm local của sprint đạt trên fixture được phép thử kỹ thuật. Nó không xóa bất kỳ gate nào trong bảng và không có nghĩa đã hoàn tất adapter học liệu published hoặc sẵn sàng online.

## Những việc cần chính owner hoặc người có thẩm quyền

1. Xác nhận tài khoản/tổ chức dự kiến dùng là Free/Hobby thật; ghi bằng chứng plan, payment-method/automatic-charge/add-ons/trial, usage/reset và điều kiện personal/noncommercial. Không cung cấp mật khẩu/token qua chat. Chưa tạo project hoặc nhập thẻ.
2. Nhờ người có năng lực tiếng Trung/phát âm duyệt đúng bốn version/hash, đáp án, hai mapping chưa chắc và các notes/hình; lưu danh tính, năng lực, ngày, findings, decision thật trong packet gốc.
3. Xin riêng quyền/consent bản thu giọng mẫu và quyền redistribution/edit/attribution; chốt transcript và nghe duyệt. Consent phân tích micro của owner trước đây không phải giấy phép phát hành voice.
4. Thử Windows Chrome/Edge với micro vật lý: ghi → nghe bản gốc → nghe đoạn chọn → xem F0 → đọc nhận xét; ghi rõ clipping/ồn/đồ thị rời rạc/thông báo khó hiểu. Không cần gửi audio; consent raw voice vẫn riêng.
5. Thử Android thật trên secure origin được cấp quyền (HTTPS; HTTP tới IP LAN thường không có micro): permission, ghi/dừng/phát lại/xóa, đổi trang/chuyển nền; kiểm tra F0 và trường hợp im lặng/ồn/tín hiệu yếu phải từ chối nhận xét. Phát âm vẫn thử nghiệm, không tạo mastery.
6. Sau khi xem đủ bằng chứng, cấp quyền riêng cho provision/benchmark miễn phí và cuối cùng deploy. Không mặc định có quyền từ việc hoàn tất sprint local.

Không để pilot micro chặn công việc Auth/RLS độc lập. Nếu owner chưa thể thử thiết bị, ghi HARDWARE_PENDING; không tự ghi PASS hoặc bịa Android/latency.

## Đường nhỏ nhất tới bản online

Chốt review/rights/audio của bốn bài và actual-account T068 → triển khai/test adapter approved-content với receipts thật → provision được cấp quyền và baseline tương thích managed Auth → T009 thực trên Free pooler/HTTPS → T069 đo host rồi khóa ADR-006 → owner duyệt T053 → deploy/smoke/rollback theo runbook. Giữ scope một owner, không thêm HSK level, AI, offline hay hạ ngưỡng bảo mật để vượt gate.
