# Sprint 11 — kết quả nghiệm thu local

**Local checks PASS. PRODUCTION_READY = false.** Trạng thái cuối `SPRINT11_LOCAL_TECH_COMPLETE` chỉ hợp lệ cùng commit sạch và lần chạy Auth `--require-clean` sau commit; SHA/kết quả được ghi trong delivery và `.local-postgres/sprint11/exact-source-auth.json`. Manifest này lưu bản bằng chứng trước documentation commit để các lần chạy sau không ghi đè hash lịch sử.

Branch `feat/v1-release-gates`, base `fd94989a0bb4bd565d7086b1fbef8f7032615a46`; main pin `0dc42253180ef38d1c43f1f87c9f0f675a851341` giữ nguyên. Không push/merge/deploy, provision cloud, billing, chuyển owner hay sửa canonical status/Engineering Loop. Không chạy subagent Reviewer hoặc tự ký duyệt.

## Kết quả đã thực thi trong Sprint 11

| Nhóm | Kết quả |
| --- | --- |
| GoTrue thật | 8 lifecycle checks PASS; không mock identity |
| Browser Auth desktop/360px | 8/8 PASS: owner/non-owner, bad/expired/forged/revoked session, refresh, reload, CSRF/redirect, two-tab logout/request cancellation |
| Full Auth learning trên fixture kỹ thuật | 4/4 PASS: hồ sơ/lịch → Today → course/unit/lesson → server grade → PostgreSQL → reload/resume → FSRS → logout/login → restored data; DRAFT/spoof/mixed-data barriers |
| Unit | 88 PASS |
| PostgreSQL native | 42 PASS, gồm migration/upgrade/rollback và RLS/context/idempotency |
| Database Auth riêng | 6 PASS với runtime SQL thật; 19 FORCE RLS tables, USING/WITH CHECK, A/B, failed transaction/pooled reuse, proof/DML/escalation denial, concurrent idempotent commands |
| Production artifact negative startup | 11/11 cấu hình bị từ chối; gồm fixture trong production và NODE_ENV spoofing |
| Browser artifacts | 34 artifacts PASS trong bounded scan; không phải formal information-flow proof |
| Lint/security lint/Sprint11 lint, typecheck, format, build | PASS |
| Audit | 0 production; 5 high development-chain findings còn mở, [triage](dependency-audit.md) |
| Bảo toàn/restore/restart | 27 bảng gốc giữ mọi hàng; 8 content tables identical; backup restored riêng; native PostgreSQL restart/readback PASS |
| Gói duyệt | 4 bài + 31 notes/26 configurations, 5 links nguồn mở được; chưa human approval |

Tổng browser **94/94 PASS**: 82 native/DEMO regressions và 12 real-Auth browser cases. Không cộng test cũ Sprint10 như PASS mới. Provider lifecycle 8 là nhóm riêng, không gộp thành browser cases. SQL/unit totals là số test case/group của runner, không phải số assertion.

| Native suite | Passed/expected | Failures/errors/skipped |
| --- | --- | --- |
| production | 22/22 | 0/0/0 |
| local | 6/6 | 0/0/0 |
| learning | 4/4 | 0/0/0 |
| content | 6/6 | 0/0/0 |
| sprint5-desktop | 2/2 | 0/0/0 |
| sprint5-mobile | 2/2 | 0/0/0 |
| sprint6-desktop | 2/2 | 0/0/0 |
| sprint6-mobile | 2/2 | 0/0/0 |
| sprint7-desktop | 5/5 | 0/0/0 |
| sprint7-mobile | 5/5 | 0/0/0 |
| sprint8 | 18/18 | 0/0/0 |
| sprint9 | 8/8 | 0/0/0 |

Bản hash/mtime/report archive và source bytes nằm trong [evidence.json](evidence.json). Native matrix chạy trước sửa cuối về cờ fixture khi retry trạng thái Auth; đã chạy lại local persistence và toàn bộ Auth sau sửa. Domain/native behavior không đổi; timestamps và before/after source hash được giữ để không gộp chronology thành một exact-SHA run. Final Auth phải đọc từ proof sau commit.

## Sửa lỗi và evidence không được bỏ qua

GoTrue được khôi phục sau khi preserve hai thư mục socket lỗi. Đây là workaround hiện tại, không phải permanent Docker fix. Xem [resources/diagnosis](docker-recovery.md); container dự án khác không bị xóa/reset.

Lượt acceptance đầu có lỗi module loader trong harness (TLA/CJS và import.meta); những lượt không chạy được case không được tính PASS. Một assertion SQL ban đầu nhầm rằng runtime không được SELECT private content; kiến trúc thực cho trusted grading server đọc keys, còn browser API bị chặn. Assertion được sửa thành publication/admin denial đúng ranh giới, không sửa grants để chạy qua.

Journey thật ban đầu mất feedback sau lưu vì Auth parent unmount player khi snapshot đang tải. Đã giữ subtree qua reload dữ liệu, giữ initial/error states và Auth logout invalidation. Browser reload cố ý tiếp tục câu chưa trả lời, kiểm lại answer đã lưu từ API. Logs/XML lỗi ban đầu được giữ riêng. Một số trace đã bị runner dọn khi bắt đầu suite kế tiếp; không coi trace đã mất là evidence.

Suite Auth cũ cập nhật ba hàng mutable của disposable owner thử trong native DB. Đã phục hồi đúng values từ backup sau khi kiểm không có hàng cũ khác bị thay đổi; không viết lại attempts/events/ownership. Các lượt release Auth sau dùng generated isolated database. Giữ report bảo toàn từng bước, không bỏ failure đầu. Native lost-ACK fault injection có thể ghi aborted/ECONNRESET trong log development; browser assertions vẫn phải PASS, không tuyên bố toàn bộ log không có cảnh báo.

Lượt chạy tiếp ngày 21/10 có 7 Auth browser PASS và 1 FAIL do chạm giới hạn thật 10 lần đăng nhập/phút ở mobile. Giữ nguyên guard; helper test kiểm đúng 429/message, chờ một cửa sổ rồi thử lại một lần. Failure log/XML/trace được lưu riêng; không bỏ lỗi cũ khi lượt sau PASS.

## Ranh giới còn giữ

Fixture chỉ dùng kỹ thuật: hai câu chuỗi ký tự tự soạn, real owner authorization và real SQL/FSRS, không phải Mandarin/key approval. Cờ chỉ mở với development build + database riêng + proof/owner marker; production từ chối. Thẻ/sessions bị giới hạn đúng fixture; mixed DRAFT data khóa snapshot. [Chi tiết](auth-verification-boundary.md).

Bốn lesson packages, năm course, 31 pronunciation notes/26 configurations, recorder/acoustics, FSRS và mastery domain không bị thay nội dung/engine. Không migration mới. Hai mapping ngữ pháp vẫn UNVERIFIED; 26 locators được đọc lại đúng pinned PDF, không cấp quyền tái phân phối hoặc human sign-off.

**Vẫn còn công việc kỹ thuật trước online:** published-content adapter chưa triển khai; Auth thông thường tiếp tục khóa DRAFT. Cần approved immutable release/receipts thật rồi xây và test adapter. Local fixture PASS không thay thế bước này.

Cloud owner/account/no-billing, actual HTTPS, managed migration/role/pooler/RLS, T069 host benchmark/ADR-006 lock và T053 deploy vẫn chưa thực hiện. Không latency/hosting benchmark giả. F0/microphone Windows/Android thật vẫn PARTIAL/HARDWARE_PENDING; nguồn âm tổng hợp trong browser regression không phải hardware proof và không trao mastery.

[Register T068 refreshed](../sprint10/free-service-register.md): PROVIDER_POLICY_VERIFIED cho tài liệu công khai; ACTUAL_ACCOUNT_VERIFIED vẫn UNVERIFIED. [Gói reviewer/audio](review-and-audio.md), [release checklist/owner actions](release-checklist.md), [deployment/rollback runbook](release-runbook.md).

## Chạy local

Dừng Next dev khác, chạy `npm.cmd run auth:local:start`, `npm.cmd run auth:technical:init`, `npm.cmd run test:auth:technical-db`, `npm.cmd run auth:technical:preview`. Mở http://127.0.0.1:3015/login; tài khoản disposable nằm trong file ignored `.local-postgres/sprint10/auth-local/owner-login.txt`, không phải owner online. README giữ lệnh native learning riêng; không chạy cả hai preview cùng checkout.
