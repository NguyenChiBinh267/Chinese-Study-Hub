# Runbook chuẩn bị V1 — không thực hiện deploy

[Runbook Sprint 10](../sprint10/release-runbook.md) vẫn là nền cấu hình, giữ dữ liệu và managed migration. Các bước dưới bổ sung trình tự nghiệm thu; không tự cấp quyền cloud.

## Cấu hình và Auth trên host tương lai

1. Hoàn tất actual-account T068 và có quyền provision cụ thể. Chỉ dùng plan phí 0 không card/charge/add-on/trial; [register được refresh](../sprint10/free-service-register.md) chưa chứng minh tài khoản thực.
2. Chuẩn bị `CSH_APP_MODE=PRODUCTION_AUTHENTICATED`, canonical HTTPS `CSH_APP_ORIGIN`, HTTPS `CSH_AUTH_URL`, `CSH_AUTH_PUBLISHABLE_KEY`, exact verified `OWNER_USER_ID`, least-privilege TLS `DATABASE_URL` với `sslmode=verify-full`. Runtime không chứa migration/admin/service-role/provider-paid keys hoặc biến server `NEXT_PUBLIC_*`.
3. Xóa `CSH_LOCAL_*` và `CSH_AUTH_TECHNICAL_FIXTURE`; production phải từ chối fixture, development identity, thiếu owner/Auth/TLS. Không sửa NODE_ENV hoặc thêm bypass để chạy production bằng native-development proof.
4. Trong provider được cấp quyền, cấu hình Site URL đúng canonical origin và redirect allowlist chỉ các địa chỉ được phép; password flow hiện không có OAuth/callback công khai. Không wildcard external URLs; app tiếp tục kiểm tra internal return path riêng. Tạo/xác nhận owner ngoài learner UI, ghi UUID đã xác minh; tắt signup/anonymous/phone/social/invite paths không dùng, kiểm thực tế bằng non-owner và signup probes. Không thêm email/SMS trả phí cho reset.
5. Password recovery dùng admin procedure được owner cấp quyền, revoke phiên và kiểm old password/session thất bại; không đổi OWNER_USER_ID để reset và không tự chuyển lịch sử local.

## Migration, RLS và dữ liệu

Không chạy nguyên bootstrap native lên managed Supabase: schema/function `auth` của managed provider đã tồn tại. Chuẩn bị baseline idempotent được review, giữ owners/grants/policies/digests và lịch sử migration; không sửa checksum của sáu migration đã áp dụng. Chưa có baseline cloud được nghiệm thu trong sprint này.

Thứ tự: manual snapshot trước thay đổi → restore/readback vào DB riêng → approved baseline/schema/grants → FORCE RLS/composite ownership → runtime role/pooler/TLS → A/B/claims/connection reuse/rollback/concurrency/key-isolation tests → reviewed production attestation matching database OID/role/migration → live preflight. Runtime `csh_runtime` không owner/superuser/BYPASSRLS/membership; learner command chỉ qua server đã xác thực. Server runtime đọc keys để grading; browser/Data API không được đọc private manifests/keys hoặc claim-setting arbitrary SQL.

Chưa chuyển learning history từ native UID sang Auth UID. Muốn import phải có approval rõ, backup mới, dry-run restore, mapping reviewed, idempotent source+target+snapshot receipt, transaction/conflict rejection và đối chiếu counts/immutable IDs/timestamps/FSRS/mastery. Plan chi tiết đã có trong runbook Sprint 10; sprint này không có lệnh transfer.

## Backup và rollback

Owner giữ manual encrypted pg_dump, media manifest/files và metadata version/hash ngoài Git trên disk hiện có; xác nhận đường giải mã/restore đọc được trước mutation. Free cloud không được mặc định có backup/PITR. Snapshot local Sprint 11 dùng cho proof bảo toàn/restore riêng, không phải tuyên bố cloud backup hoặc encrypted-offsite service.

Deploy tương lai phải pin exact Git SHA/lockfile sau T069 và approval T053. Smoke: startup live preflight, unauthenticated/owner/non-owner, restore/refresh/logout, approved-only lessons, một grade/idempotent retry/review/DB readback, no-store/CSRF/answer isolation và Windows/Android thật. Mất mạng chưa ACK phải báo chưa lưu và retry online; không giả offline queue.

Rollback code về artifact/SHA trước bằng cơ chế host đã benchmark. Không tự down-migrate hoặc restore đè database live: nếu schema tương thích thì giữ dữ liệu; nếu lỗi cần data recovery, chặn writes, snapshot trạng thái lỗi, restore thử riêng, owner duyệt recovery và kiểm lại RLS/history. Không xóa volume, quay lại development adapter hay trả phí để cứu deploy.

T069 phải đo cold/warm starts, latency/auth/SQL claims/pool limits, body/function/runtime/build/rollback trong phiên được cấp quyền. Chưa chọn Vercel/Render; không có số benchmark giả. Free quota hết: maintenance/retry/export/local checks được phê duyệt, không tự mua minutes/compute hoặc đổi provider.
