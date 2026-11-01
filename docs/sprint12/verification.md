# Sprint 12 — bằng chứng local release code

**Local precommit checks PASS; PRODUCTION_READY = false.** `SPRINT12_LOCAL_RELEASE_CODE_COMPLETE` chỉ hợp lệ khi đi kèm commit sạch và proof Auth sau commit: `.local-postgres/sprint12/exact-commit-auth.json`, với completed/sourceUnchanged/cleanAtStart/cleanAtEnd=true và commit=HEAD giao cuối. SHA được báo trong delivery; không sửa canonical task-status.

Branch `feat/v1-content-release`; base `ab6654dea66bf6879c3b6f30d27c91ba0be0198f`. Không push/merge/deploy/provision/billing/Engineering Loop hoặc subagent Reviewer.

| Nhóm                                                  | Kết quả                                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Unit                                                  | 102/102 PASS                                                                                                |
| Native/DEMO browser regressions                       | 82/82 PASS desktop/360px                                                                                    |
| Publication SQL                                       | 8/8 PASS; real runtime/RLS, grading/bindings, FSRS, selection rollback, withdrawal, schema rollback refusal |
| Native SQL                                            | 42 PASS; migration fresh/upgrade/rollback và identity/isolation                                             |
| Reflow targeted                                       | 2/2 PASS; CSS zoom 200%, PNG width khớp viewport 1440/360, keyboard/axe checks                              |
| Production artifact startup                           | 14/14 unsafe configurations refused                                                                         |
| Browser artifact scan                                 | 32 files, no checked private markers/values; bounded scan, not formal proof                                 |
| Lint/security/Sprint12 lint, typecheck, format, build | PASS                                                                                                        |
| Audit                                                 | 0 production; 5 high development findings retained; see Sprint11 triage                                     |
| Native history                                        | 27 original tables retain rows, 8 content/catalog tables identical; backup/restore/restart PASS             |
| Final Auth required after commit                      | GoTrue8 + Auth8 + token4 + publication8 browser + SQL6×3 + publicationSQL8                                  |

Final completed delivery totals **102 browser cases** = 82 native + 20 final real-Auth browser cases. SQL **68 group executions** = 42 native + 8 publication + 6 repeated on each of 3 fresh Auth/token databases. These are runner groups, not assertion counts or 68 distinct security properties. Final proof governs Auth totals; precommit screenshots/logs are not substituted for it. No existing fixture database is truncated in this final workflow; token projects use newly created private databases and keep history.

| Native suite    | Pass/expected | Failure/error/skipped |
| --------------- | ------------- | --------------------- |
| production      | 22/22         | 0/0/0                 |
| local           | 6/6           | 0/0/0                 |
| learning        | 4/4           | 0/0/0                 |
| content         | 6/6           | 0/0/0                 |
| sprint5-desktop | 2/2           | 0/0/0                 |
| sprint5-mobile  | 2/2           | 0/0/0                 |
| sprint6-desktop | 2/2           | 0/0/0                 |
| sprint6-mobile  | 2/2           | 0/0/0                 |
| sprint7-desktop | 5/5           | 0/0/0                 |
| sprint7-mobile  | 5/5           | 0/0/0                 |
| sprint8         | 18/18         | 0/0/0                 |
| sprint9         | 8/8           | 0/0/0                 |

## App và giới hạn

Adapter dùng deployment allowlist/hash/receipts, current immutable version, private server keys, existing grading/PostgreSQL/FSRS/planner, explicit previous-release selection and withdrawal. Missing/untrusted metadata fails closed. Account/logout remain usable when content is unavailable. Published APIs and UI do not use the draft catalog to activate content. [Trust/workflow](publication.md).

Bốn bản thật giữ nguyên **REVIEW_PENDING / DRAFT_UNREVIEWED / BLOCKED**, rights ORIGINAL_REVIEW_PENDING, audio assets **0**. Chưa có người duyệt ngôn ngữ/keys/mapping/audio hoặc permission phát hành. Synthetic non-speech WAV và synthetic reviewer records chỉ kiểm kỹ thuật, không phải audio hoặc review thật. Hai mapping g-jiao-pattern/g-like-pattern còn UNVERIFIED.

Luyện được lưu không tự là mastery độc lập; self-rating chỉ lên lịch FSRS. Evidence/progression gates vẫn giữ; không bổ sung independent assessment corpus/protocol hoặc tuyên bố hoàn tất HSK. Gói được duyệt phải còn đáp ứng evidence prerequisites, không chỉ sửa nhãn review.

## Chronology cần giữ

Các lỗi selector teaching/feedback và thiếu chờ completion ACK trong test được giữ trong logs/traces. Một full run trước sửa ACK có 7 PASS/1 FAIL. Ảnh zoom ban đầu phát hiện horizontal overflow dù phép so innerWidth cũ báo PASS; test mới đo PNG full-page CSS width và CSS wrapping đã sửa. Không coi kết quả reflow cũ là bằng chứng hợp lệ. Initial Sprint5 mobile config failure chạy 0 case; đã sửa runner, chạy lại matrix. Các fault-injection suites có thể log aborted/ECONNRESET có chủ ý; không tuyên bố log hoàn toàn sạch cảnh báo.

[evidence.json](evidence.json) pin hashes/reports trước commit; exact proof sau commit lưu riêng để không tạo vòng SHA. `.local-postgres/sprint12/` chứa logs/XML, private original failures/screenshots, backup và receipts. Build code có thay đổi sau build đầu về error UX/reflow nên native matrix đã chạy lại; các chỉnh Auth-only về metadata SQL và workflow được kiểm lại bằng build/static và final Auth trên commit sạch; các mốc cũ không được dùng làm final PASS.

## Review và cloud gates

Gói riêng tư vẫn là `.local-postgres/review-packets/sprint11/index.html`, packets Sprint6/7 gốc và worksheets chưa ký; 4 lessons, 31 pronunciation notes/26 SVG configurations, 5 nguồn links đã kiểm local lại. Không tạo review store mới hoặc ký thay người. [Audio import và review](publication.md), [owner actions](owner-actions.md), [T009/T069/T053 runbook](release-runbook.md).

T068: official public policies rechecked 21/10/2026; actual account/billing/capacity UNVERIFIED. Managed baseline/least-privilege/TLS/pooler và T009 cloud chưa kiểm. T069 chưa benchmark/chọn host, T053 chưa được phép deploy. Windows/Android microphone/F0 accuracy vẫn PARTIAL; browser synthetic regression không phải hardware proof.

## Chạy lại

Xem [README](../../README.md) cho native setup và Auth technical preview. Sau init/proof, `npm.cmd run content:release:preview`, mở http://127.0.0.1:3015/login; disposable credentials ở file ignored `.local-postgres/sprint10/auth-local/owner-login.txt`. Không chạy đồng thời Next dev khác. `npm.cmd run test:release:auth -- --require-clean` tự tạo fixtures riêng, không cấp quyền cloud hay duyệt bốn bài.
