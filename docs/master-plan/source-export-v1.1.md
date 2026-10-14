# Chinese Study Hub — Master Plan v1.1

Ngày lập:13/10/2026 • Revision v1.1: scope online-first \+ hosting benchmark • Trạng thái: kế hoạch đã rà soát, chưa triển khai code

# Mục lục

Mục lục liên kết — cập nhật cùng các headings khi đổi cấu trúc.  
[1\. Executive Summary](#1.-executive-summary)  
[2\. Product Requirements](#2.-product-requirements)  
[3\. Architecture Decision Records](#3.-architecture-decision-records)  
[4\. Technical Architecture](#4.-technical-architecture)  
[5\. Database Design](#5.-database-design)  
[6\. Learning & Curriculum Design](#6.-learning-&-curriculum-design)  
[7\. AI Tutor Design](#7.-ai-tutor-design)  
[8\. UX/UI Specification](#8.-ux/ui-specification)  
[9\. Content & Data Strategy](#9.-content-&-data-strategy)  
[10\. Testing Strategy](#10.-testing-strategy)  
[11\. Implementation Roadmap](#11.-implementation-roadmap)  
[12\. Atomic Task Backlog](#12.-atomic-task-backlog)  
[13\. Risks & Mitigations](#13.-risks-&-mitigations)  
[14\. MVP Acceptance Checklist](#14.-mvp-acceptance-checklist)  
[15\. Hướng dẫn triển khai bằng Codex](#15.-hướng-dẫn-triển-khai-bằng-codex)  
[16\. Sources & Verification Register](#16.-sources-&-verification-register)  
[17\. Bảng tra cứu triển khai](#17.-bảng-tra-cứu-triển-khai)

# 1\. Executive Summary {#1.-executive-summary}

## 1.1. Kết quả sản phẩm và quyết định mặc định

Chinese Study Hub là PWA tự học tiếng Trung giản thể, giọng phổ thông zh-CN, từ số 0 đến HSK 4; ưu tiên Android Chrome và Windows Chrome/Edge. Một màn hình Hôm nay đề xuất việc học tiếp theo dựa trên bằng chứng năng lực và lịch ôn. Đích 6–8 tháng là mục tiêu có điều kiện, không phải cam kết đạt chứng chỉ. Nội dung, chấm bài khách quan, mastery, FSRS và chọn bài tiếp theo hoạt động khi AI bị tắt.  
Mặc định v1.1: Next.js/TypeScript modular monolith, Supabase Free/PostgreSQL/Auth/Storage, FSRS/mastery và weekly planner giữ. Hosting có preferred candidate Vercel Hobby và candidate Render Free; ADR-006 chỉ khóa sau T069 benchmark thực, không chọn từ giá. GitHub Actions Free \+ local checks, Docker optional local hoặc trên Render nếu benchmark chọn; không paid services/trial/credits/billing. v0.1 online; offline tải sẵn chỉ được hứa từ v0.3, không coi cache trình duyệt là offline sync.  
v0.1/M0: online đăng nhập → chọn giờ/tuần → Pinyin F01–F02 → L001/L002 HSK1 có audio/keys duyệt → chấm/ghi nguyên tử → FSRS → progress/today/next block. CI/CD và bảo vệ dữ liệu cơ bản, chưa offline sync/mic/tutor bắt buộc. v0.2/M1: HSK1 đầy đủ \+ AI Tutor chữ/luyện viết; v0.3/M2: PWA offline/sync \+ record/playback/STT nếu free phù hợp; v0.4/M3: HSK2; v0.5/M4: HSK3; v1.0/M5: HSK4 \+ diagnostics/mock đúng phiên bản khi đủ nguồn/quyền. Không quảng cáo một corpus từ vựng là khóa học hoàn chỉnh.

## 1.2. Phân loại độ tin cậy và giả định

\[V\] Verified: nguồn chính thức đã đọc ngày 13/10/2026. \[D\] Design: quyết định thiết kế của dự án. \[A\] Assumption: giả định cần đo trong pilot. \[R\] Risk/Open gate: phải xử lý trước release tương ứng. Những con số mastery, chất lượng AI, ngân sách và tốc độ dưới đây là ngưỡng sản phẩm đề xuất \[D/A\], không phải quy chuẩn HSK hoặc kết luận khoa học đã được thẩm định.  
\[A\] Một người dùng trưởng thành ban đầu; giao diện tiếng Việt; quỹ giờ/tuần do user chọn, 6h/tuần chỉ là gợi ý mặc định có thể sửa trước áp dụng. Có email đăng nhập, Android có micro và Windows browser hiện đại. Không đòi GPU/local LLM. Máy QA di động tham chiếu4GB RAM,360 CSS px; mạng chậm/mất kết nối là tình huống bình thường. Mốc6–8 tháng phải cập nhật theo quỹ giờ và tiến bộ thực, không yêu cầu tất cả user học60–90 phút/ngày.  
\[BẮT BUỘC — user constraint 13/10/2026\] Trước mắt đúng một người học là chủ app; tổng phí dịch vụ mới cho build, dependencies/assets, infra, hosting/domain, deployment, CI/CD, database/storage, backup/monitoring, AI/speech/evaluation phải bằng 0\. Chỉ open-source/free plan không cần trả tiền, không free trial/credits có hạn làm dependency, không nạp tiền/bật billing/liên kết phương thức thanh toán/auto-upgrade/paid fallback. Không dùng free allowances trên một billing-enabled project rồi coi là miễn phí an toàn. Máy/internet hiện có dùng bình thường; không mua phần cứng/GPU/thuê VPS. Không mua sách/dataset/assets/tool/reviewer; nội dung original hoặc miễn phí có quyền dùng, người duyệt competent tình nguyện nếu có; thiếu review giữ beta/gap, không tuyên bố đủ chuẩn. Các budget20+5 USD cũ bị hủy, thay bằng hard0 và quota consumption.

## 1.3. Chuẩn HSK được ưu tiên

\[V, S01–S03\] GF0025-2021 là chuẩn năng lực ban hành năm 2021, hiệu lực 01/07/2021. Đề cương thi HSK PDF chính thức hiện được CTI liên kết có bìa ghi phát hành 2025-11, thực hiện 2026-07; bao gồm nhiệm vụ, chủ đề, từ vựng, chữ Hán, ngữ pháp. Dự án ưu tiên đề cương thi này, mã hsk-exam-2025-11; chuẩn 2021 lưu riêng dưới mã gf0025-2021. Không ánh xạ level bằng tên cấp đơn thuần.  
\[V, S01\] Ranh giới số thứ tự từ vựng trong PDF: cấp 1 đến 300, cấp 2 đến 500, cấp 3 đến 1.000, cấp 4 đến 2.000, là tổng lũy kế. Không gán bộ 500/1.272/2.245/3.245 thường được nhắc với chuẩn 2021 cho bộ đề cương thi 11/2025. Các mục đa nghĩa có cấp trong ngoặc phải lưu thành sense-level mapping; con số đầu mục không bằng số năng lực hoặc số thẻ.  
\[R\] Trang HSK 4 cũ trên cùng website vẫn hiển thị cấu trúc 100 câu/180 trên 300; đây là dấu hiệu nguồn cùng tên khác phiên bản. Không dùng trang đó làm blueprint mới. PDF đề cương không đủ để suy ra mọi thời lượng, cấu trúc thi nói, thang điểm hoặc việc áp dụng tại từng điểm thi. Thông báo động và link mẫu mới chưa đọc được đầy đủ qua công cụ; blueprint nói, thời lượng và ngưỡng đỗ mới giữ trạng thái unverified cho đến task đối chiếu. App phải cho chọn target exam version và nhắc kiểm tra điểm thi thực tế.

# 2\. Product Requirements {#2.-product-requirements}

## 2.1. Người dùng, jobs-to-be-done và phạm vi

Người mới cần biết hôm nay học gì, nghe mẫu rồi luyện đúng, hiểu nghĩa tiếng Việt, dùng được câu trong bối cảnh và nhớ sau nhiều ngày. Người dùng đi học/đi làm cần buổi học 10–20 phút, tiếp tục dở dang và dùng nội dung tải sẵn. Sau cá nhân mới mở invite-only nhiều người; chưa có marketplace, cộng đồng, leaderboard, lớp học hay thanh toán.  
P0 \= điều kiện để vòng học và dữ liệu đáng tin cậy chạy được. P1 \= mở rộng hiệu quả học sau slice. P2 \= tối ưu hoặc nâng cao sau khi có bằng chứng. P1 không đồng nghĩa tùy chọn ở phiên bản đã hứa; task P1 trở thành bắt buộc nếu release scope gồm tính năng đó.  
FR01/FR14/P0-M0: weekly budget và availability → preview khả thi → today một CTA, tự điều chỉnh sau buổi bỏ lỡ trong cap. FR02/P0-M0: Pinyin F01–F02 và audio/tones duyệt cho slice; F03–F05 hoàn thiện ở v0.2. FR03/P0-M0: lesson online \+ nghe/đọc/sắp xếp/nhập ngắn. FR04/P0-M0: server attempts/mastery/progress, idempotency/concurrency/auth errors an toàn. FR05/P0-M0: cards/reviews FSRS. FR06/P1-v0.3: install/downloaded lessons/outbox/lease/conflict; không nằm trong v0.1. Khi mất mạng ở v0.1, UI báo chưa lưu, giữ câu trả lời chưa gửi trong tab nếu được và retry cùng idempotency key khi nối lại; không đánh success trước server ack, không hứa durable offline hoặc background replay.  
FR07/P1-v0.2: Gemini Free tutor giải thích/sửa câu/roleplay chữ và learner memory; đánh giá trước enable, quota hết approved fallback. FR08/P1-v0.2: Hanzi writing/components, không tracing=mastery. FR09/P1-v0.3: record/playback/shadowing và STT chỉ nếu free/capability được kiểm chứng. FR10/P1: unit diagnostics v0.2, level/mock sau đúng coverage/source; FR11/P1: HSK1 rồi2–4 incremental. FR12/P1-v0.2: memory/privacy export-delete cho phần tutor; FR13/P2: voice tutor optional, chấm thanh điệu free chưa validated deferred.  
Out of scope: Hanzii integration, API không chính thức, scraping, sao chép nguyên giáo trình thương mại, dịch toàn bộ web, OCR đa năng, tự phát minh điểm phát âm từ STT, AI tự xuất bản nội dung, chứng chỉ tự cấp, cam kết thi đỗ, translation advanced levels, native Android/Electron ở MVP, social/gamification gây áp lực.

## 2.2. Chỉ số hiệu quả và ràng buộc

Primary success \[A\]: sau pilot 14 ngày, người học hoàn thành ít nhất 8 phiên; làm được nhiệm vụ giao tiếp đã học trên item mới; báo cáo biết việc tiếp theo mà không chọn thủ công. Delayed recall đo bằng item song song sau 2–7 ngày, không dùng lượt bấm thẻ làm năng lực. 80% retention là mục tiêu pilot cần hiệu chỉnh theo độ khó; FSRS desired retention 0,9 là cấu hình scheduling riêng, không phải bảo đảm thực tế.  
Guardrails: 0 mất/nhân đôi kết quả trong bộ test sync; 0 lộ dữ liệu chéo tài khoản; 100% item publish có provenance/license decision/answer review; không ép unlock chỉ vì streak. Daily minutes tính hoạt động thực với idle cap 60 giây, không tính tab mở nền. Completion, independent accuracy, delayed recall và coverage hiển thị tách biệt.

## NFR v1.1: WCAG2.2AA/core focus/keyboard/360px layout; no critical accessibility issue ở core flow. M0 đo mobile load/LCP/INP và warm/cold APIs cho1user, không claim field p75 từ lab nhỏ; mục tiêu LCP≤2,5s/INP≤200ms và warm API p95≤800ms cần report network/CPU/region. T069 cold-openUX target≤10s để ưu tiên Vercel, Render cold start limitation explicit. Full10VU/15min load regression và corpus/performance matrix khi scale/level coverage cần, không M0 prerequisite; không mua compute để pass. Shell JS≤250KB gzip và slice offline≤10MB là budget mục tiêu, offline budget activate v0.3. Tutor timeout20s/p95≤10s mục tiêu từ v0.2, fail graceful.

## 2.3. Coding entry packet — M0 online, fees0, owner-only

v1.1 current release=M0/v0.1. Hard constraint: Monthly recurring cash cost=\$0 và one-time service costs=\$0; build/infra/deploy/CI/CD/AI/speech đều no-billing/no paidfallback. App trước mắt cho đúng owner trên Android/Windows browser. Giữ Next.js/TypeScript/Supabase/FSRS/mastery/weekly planner và content provenance. Chưa khóa hosting: ADR006/T069. Không yêu cầu offline sync, multi-device lease, microphone, AI, full backup automation để dùng bài đầu tiên.  
M0 exact active set34 IDs: T001, T002, T003, T004, T005, T006, T007, T008, T009, T010, T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024, T025, T026, T052, T053, T064, T065, T066, T067, T068, T069. T007/T008 chỉ M0 schema subset; mục5 vẫn long-term full design. T009 runtime proof là security blocker trước core data commands; không mua add-on/bỏ RLS/service\_role để bỏ qua. T069 trước final host lock/T053; T068 trước cloud/provider setup. Content fixture4 micro-lessons F01/F02/L001/L002 đủ slice, không full corpus trước pilot.  
Document preservation: HSK facts/curriculum/mastery/FSRS/AI pedagogy, database design và security giữ. Các chi tiết offline/cache/download/lease/sync và availability fallback trong4–10 chỉ activate v0.3; nếu đoạn cũ viết offline 'P0/MVP', scope gate hiện hành là11/12.6/14. M0 lost network là chưa lưu→explicit error/retry khi online, không durable offline. Lập lịch tuần vẫn algorithm thường, AI không chấm/unlock/planner.  
Cách giao: T001 tạo brief/status nhỏ từ packet này \+11/12.6/14.1, kèm Doc URL/revision. Một task ID/lượt và chỉ sections liên quan; không build future tables/features vì thấy trong master design. Dữ liệu học liệu chưa hoàn chỉnh; mỗi bài có scope/key/audio/license/review trước publish; AI không tự xuất bản. Không scope exception làm mất safety/rights/semantic correctness.

# 3\. Architecture Decision Records {#3.-architecture-decision-records}

## 3.1. ADR-001 — Modular monolith

Accepted \[D\]: Next.js phục vụ UI/BFF/API; domain modules auth, content, curriculum, learning, review, assessment, tutor, speech, sync, operations. UI không gọi SQL/provider trực tiếp; Route Handler chỉ validate/auth/delegate. Domain pure functions không import Next.js hoặc SDK provider. Một deploy giảm chi phí và quản lý transaction; trade-off: cần module boundaries và tránh server handlers phình to. Tách worker khi job dài ảnh hưởng latency, không tách service ngay.

## 3.2. ADR-002 — Database, migrations và bảo vệ tenant

Accepted \[D, revised\]: PostgreSQL/Supabase Free, một project prod; Supabase Auth cho đúng owner, Storage Free chỉ media có quyền và metadata cần thiết. node-postgres \+ SQL typed repositories/Zod; supabase/migrations duy nhất. user\_id ownership/RLS/composite FKs giữ để dữ liệu an toàn và khỏi redesign sau này; hiện không onboarding nhiều user/organization/invite. Staging/integration DB local, optional Supabase CLI/Docker free hoặc PostgreSQL native cho tests; không cần hai paid cloud projects. Custom runtime role/pool phải chạy trong Free, không mua IPv4 addon để nối DB. Dùng pooler endpoint SSL hỗ trợ topology serverless, kiểm tra role/transaction claims và quota kết nối ở T009/T068.  
User data trong schema app\_private không expose qua Data API. Runtime dùng role csh\_runtime không sở hữu bảng, không BYPASSRLS, không quyền SET ROLE quản trị; migrations dùng credential riêng. Sau verify JWT, trong mỗi BEGIN dùng set\_config('request.jwt.claim.sub', verifiedUid, true); policy user\_id \= auth.uid(), FORCE RLS; context LOCAL kết thúc cùng transaction. Không nhận uid từ request body. Content published đọc bằng repository server; answer keys/review drafts không ra public payload. RLS là defense in depth cùng WHERE owner và composite FKs. Pool leakage test là gate P0. Nếu custom role/pool không đáp ứng, phải sửa ADR trước code data layer, không lặng lẽ chuyển mọi request sang service\_role.

## 3.3. ADR-003 — Event evidence, FSRS và mastery

Accepted \[D\]: attempts/review\_logs bất biến làm bằng chứng; skill\_mastery và review\_cards là projections cập nhật cùng transaction. FSRS cho thời điểm nhớ của một card variant; mastery cho năng lực theo concept × skill. Không lấy độ ổn định FSRS làm điểm nói/đọc tổng quát. ts-fsrs có MIT license \[S07\]; adapter pin version và scheduler config. Không tự viết lại thuật toán; optimizer P2 sau đủ logs và holdout.

## 3.4. ADR-004 — Offline có giới hạn

Accepted \[D\]: cache shell \+ signed versioned lesson packages; IndexedDB qua Dexie cho packages/outbox/projections; server là nguồn trạng thái chính. P0 offline lesson và review trên một active learning device; nhiều máy đều đọc online nhưng secondary device không ghi offline review. Lease offline 72 giờ, conflict UI và replay phía server thay vì last-write-wins. Trade-off: giảm hứa hẹn offline để giữ lịch FSRS tin cậy. AI, STT, login mới, đề timed chứng thực yêu cầu online. Không dựa Background Sync như điều kiện bắt buộc.

## 3.5. ADR-005 — AI và speech là adapters bổ trợ

Accepted v1.1 ADR-005: provider-neutral text Tutor contract \+ Gemini Developer API Free adapter; key/no-billing/privacy/allowed model/eval gate giữ, không paid fallback. Candidate model kiểm availability/schema/free quota tại T037/T068; không tuyên bố unlimited. Tutor phục vụ v0.2, không dependency để publish bài HSK1 hay chấm/lập lịch/FSRS. AI không sửa score/mastery/unlock; explain/correct/hint/roleplay/memory kiểm nguồn/Zod/guardrails và report sai. Quota hết/no consent/no provider → approved explanation, core online tiếp tục. Audio đã duyệt/browser TTS trước; record/STT v0.3; scoring phát âm validated free P2. Quy tắc sư phạm và eval mục7 giữ nguyên.

## 3.6. ADR-006 — Hosting và phiên bản nội dung

ADR-006 v1.1 — PROPOSED/PENDING T069; content-versioning decision vẫn Accepted. Preferred candidate Vercel Hobby (native Next.js/serverless), alternative Render Free Node/Docker web service; cùng Supabase Free/runtime role/RLS. Chọn sau bounded benchmark ≤1 phiên2–4h, actual no-payment eligibility trước tạo proof deployment; không setup cloud trong planning. Test cold/warm starts, auth+SQL tx/claims/isolation, retry/idempotency, functions/body/runtime/connection constraints, build/deploy/rollback, Android/Windows audio/latency. T069 phải xong trước T053/final lock hosting; baseline4.5 là candidate profile, không host đã chốt.  
ADR-006 evidence nguồn13/10/2026: [https\://render.com/docs/free](https://render.com/docs/free) — web service Free idle15 phút thì spin down, lần mở lại khoảng1 phút, disk ephemeral; không dùng Render Free Postgres vì hết hạn30 ngày, DB vẫn Supabase Free. Vượt build/bandwidth có thể phát sinh phí khi account có payment method, nên no-payment và quota-suspend là gate bắt buộc. [https\://vercel.com/docs/plans/hobby](https://vercel.com/docs/plans/hobby) — personal/non-commercial/free quotas; Next.js serverless cần pooler/role tested, không Docker image hosted. Không fake keepalive/paid upgrades để thắng benchmark.  
Selection rule \[D\]: cả hai cần hard fees0 \+ RLS/tx/auth/retry correctness \+ free access; một candidate không eligible thì ghi unavailable, không mua quyền thử. Nếu Vercel đạt core cold-open UX≤10s mục tiêu và warm APIs p95≤800ms thì ưu tiên Vercel; Render chỉ chọn nếu thực tế giảm lỗi/complexity hơn và owner hiểu/chấp nhận measured cold-start (app có loading/timeouts phù hợp). Cùng fail thì local free proof \+ ADR blocked, không claim cloud release. Benchmark báo number of runs/network/region và raw results; giá thấp không là correctness/UX evidence. Sau chọn sửa ADR-006/Deployment/T053 config trong SSOT trước triển khai feature host-specific.

## 3.7. Các quyết định phải chốt trước code

Defaults ADR001–005/007 accepted; hosting ADR006 pending T069, immutable content policy giữ. Gate T068 no-fees trước setup; T009 Free role/pool RLS proof trước học modules; T069 trước khóa hosting/T053. Failure không bỏ RLS/service\_role/buy add-on; sửa access architecture có evidence trong SSOT. Content rights/review và exam blueprint giữ; tutorFree/eval/consent v0.2, không gate M0.

## 3.8. ADR-007 — Personal-only / zero paid services

Accepted, bắt buộc theo user13/10/2026: đúng owner học; fees0 cho toàn lifecycle và mọi feature/eval. Các paid defaults20+5USD/OpenAI/Azure/Render/Dockerregistry cũ superseded. Free tiers chỉ khi no-payment và không tự charge; non-commercial personal terms phù hợp current scope. Không trial/credits/paidallowance/cloudbilling/sponsoredtemporarypromo làm dependency; không chuyển provider trả phí nếu free bị giới hạn. App phải degrade downloaded core/approved explanations/localWindows fallback và báo unavailable trung thực. User\_id/isolation giữ, nhiều người/scaleparked. ADR này có ưu tiên hơn bất kỳ hướng dẫn tương lai đề xuất mua dịch vụ; muốn đổi cần user chủ động thay yêu cầu, không xin trả phí chỉ vì đang vượt quota.

# 4\. Technical Architecture {#4.-technical-architecture}

## 4.1. Stack, boundaries và bố cục dự kiến

Frontend: React/Next.js App Router, TypeScript strict, Tailwind, Radix primitives; React Hook Form \+ Zod cho form, Zustand chỉ UI ephemeral nếu thực sự cần, không lưu learning state chính ở global store. Server components cho dashboard online; client player cho audio/recording/IndexedDB. Dùng fetch adapter có retry có điều kiện, chưa cần React Query ở slice. Font Chinese subset/self-host sau license review, lang=zh-Hans và ruby cho pinyin.  
Bố cục dự kiến (chưa tạo file): src/app/(auth), src/app/(study), src/app/api/v1; src/modules/{auth,content,curriculum,learning,review,assessment,tutor,speech,sync,operations}/{domain,application,infrastructure}; src/shared/{contracts,db,errors}; src/components; public/sw.js và manifest; supabase/migrations; content/{sources,staging,published}; tests/{unit,integration,e2e,security,evals}; docs/implementation. ESLint boundary rule cấm infrastructure import vào domain và cấm UI import server secrets.  
Backend Node runtime, không Edge cho SQL. node-postgres SSL verified, pool nhỏ≤2/process khởi điểm và pooler transaction endpoint phù hợp Supabase Free/serverless \[S24\]; test kết nối/thời hạn/connection cap. Mỗi request acquire→BEGIN→claims LOCAL→command→COMMIT/ROLLBACK→release; không giữ DB tx chờ provider. Vercel process cold starts/stateless, không jobs dài/transcode thường trực/LLM local trên function; long imports/media preprocessing chạy thủ công trên Windows hiện có bằng công cụ free, checkpoint resumable. Native dev server/local DB là phương án dự phòng0-phí; không IPv4 paid addon, Redis hay paid worker.

## 4.2. API contracts và luồng dữ liệu

Tất cả /api/v1 dùng HTTPS, JSON camelCase, UUID IDs, ISO UTC timestamps, cursor pagination. Response {data, requestId, meta}; lỗi {error:{code,message,retryable,details},requestId}. Zod schema version; limit body 64 KB trừ upload; không gửi raw stack/SQL. 401 phiên hết hạn; 403 quyền; 409 conflict/content stale; 422 invalid; 429 quota kèm Retry-After; 503 provider unavailable. POST mutations dùng Idempotency-Key UUID, unique theo owner \+ endpoint \+ key, hash payload; cùng key khác payload \=409.  
GET /me: profile/settings; PATCH /me: goal, timezone (không nhận dailyMinutes làm mục tiêu chính). GET /learning/time-preferences và PATCH /learning/time-preferences: weeklyMinutes,availableDays,dayCaps,preferredSessionMinutes,maxSessionMinutes,paused,expectedVersion. GET /learning/weekly-plan?weekStart=YYYY-MM-DD: planVersion,localWeekStart,timezone,budget/spent/plannedRemaining/buffer/unscheduledMinutes,blocks,reviewDebt,reasonCodes,forecast. POST /learning/weekly-plan/replan: expectedVersion,changeReason → plan version mới; idempotent. GET /today: plan entries {kind,targetId,reason,estimatedMinutes,plannedBlockId}, timeBudgetToday,weeklyPlanVersion,engineVersion/asOf. GET /curriculum/releases/:id và /lessons/:versionId: published schema và exercise public projections. POST /sessions: lessonVersionId,plannedBlockId nullable → sessionId, manifest/version. POST /sessions/:id/attempts: exerciseVersionId,response,hintCount,durationMs,eventId → trusted grading, feedback, masteryDelta. POST /sessions/:id/complete: hoàn tất hợp lệ → nextAction. Không chấp nhận score từ client. Các mutations time preferences/replan dùng owner-scoped idempotency/409 stale-version như mục 4.2.  
GET /reviews/due?limit=20: card IDs, dueAt, stateVersion. POST /reviews/:id: rating 1..4, presentedAt, answeredAt, baseVersion,eventId → schedule mới; server kiểm tra card thuộc owner và lock. GET /progress: concept/skill evidence và gap. GET /packages/:lessonVersionId/manifest: checksum/assets/size. POST /sync/batch: leaseId, ordered events ≤100 → applied/duplicate/rejected/conflict theo event. POST /sync/lease và DELETE /sync/lease: active device lease. GET /sync/state: serverVersion/projection/delta cursor.  
POST /tutor/sessions và POST /tutor/sessions/:id/turns: bounded, sanitized lesson question/roleplay không thông tin cá nhân → structured response qua Gemini Free; memory CRUD chỉ owner. /speech/transcriptions và /speech/assessments là reserved contracts disabled mặc định; P1 record/playback/browser optional STT nằm local, không upload raw audio lên server/provider; có capability report route nếu cần, không fake score endpoint. Assessment session/answers/submit/report vẫn server objective keys. POST /data/export và DELETE /me reauth; content publish owner protected, không learner-public.  
Luồng chuẩn: UI gửi response → auth verify → grading từ answer version → transaction insert attempt \+ learning\_event \+ projection \+ cards cần thiết \+ idempotency response → commit → UI feedback. Nếu transaction fail không được ghi nửa kết quả. Tutor dùng read-only snapshot sau commit, không có quyền viết score/due/lesson lock. Speech tạo evidence provisional; mastery chính thức chỉ cập nhật từ rule và nguồn được chấp nhận ở mục 6\.

## 4.3. Authentication, privacy và security

Supabase email/password cho đúng một owner; owner được provision/confirm một lần qua dashboard hoặc local privileged setup khi triển khai, OWNER\_USER\_ID server allowlist. Public signup/invite tắt; valid JWT của bất kỳ ID khác owner cũng bị chặn ở app. Không dependency email OTP/magic-link/SMTP trả phí: password reset ban đầu thao tác owner qua dashboard/local admin runbook, reauthentication trong app giữ. SSR token verify/JWKS, secure/SameSite cookies, origin/CSRF; không chỉ decode/getSession, không token localStorage hoặc admin credential client. Test userA/B synthetic trong local test vẫn bắt buộc; test fixtures không phải mở multi-user product.  
CSP (nonce với inline cần thiết), HSTS, frame-ancestors none, MIME checks, signed URLs short-lived cho raw audio, private buckets, sanitize structured rich text (không HTML tùy ý), size limits, per-user/IP throttling và quota. Không log transcript/audio/token/password; request IDs và redacted metadata đủ debug. Admin membership do migration/admin quản lý, không nằm trong profile có thể sửa. Cross-owner IDs mặc định 404; tests phủ mọi route/signed object.

## 4.4. PWA, caching và offline sync contract

Service worker explicit cache allowlist: shell/static immutable assets cache-first; published package checksum assets cache-first; authenticated APIs network-only, never cache login/auth/answer keys/tutor responses. Package gồm public exercise và local grading keys chỉ cho practice offline, không có item mock bí mật; key integrity không chống người tự xem source, chỉ là practice. Timed readiness test online dùng kho item giữ server; offline practice không được gắn nhãn secure exam.  
IndexedDB phân namespace theo uid/device, xóa caches riêng khi logout và trước đổi tài khoản; nút xóa tải xuống. Packages atomic install với hash/check total size; thiếu một asset báo incomplete, không silently thiếu audio. Storage quota mặc định 100 MB, hiển thị dung lượng, LRU bỏ package đã sync; outbox chưa ack không tự xóa. Download audio ≤10 MB/slice, Wi-Fi optional, có text-only mode. Update SW chỉ khi phiên học kết thúc hoặc user đồng ý.  
Outbox event gồm eventId,deviceId,clientSeq,schemaVersion,contentVersion,kind,payload,baseStateVersion,occurredAt,receivedAt(server),leaseId. Single active learning device lease lấy khi online, duration 72h; server từ chối ghi học ở secondary device khi lease còn hiệu lực trừ explicit takeover. Không thể khóa thiết bị offline vật lý: takeover làm events của lease cũ thành conflict, giữ local để review. Offline hết lease: vẫn đọc/làm practice local nhưng không hứa apply official review.  
Sync gửi FIFO từng device, server idempotent và khóa owner/card; không reorder cross-device bằng timestamp client. Validate time range (không tương lai, không trước review gần nhất), version/payload; stale base \= conflict, chưa đổi FSRS. App cho chọn discard schedule event và làm lại review; giữ attempts dạng practice\_unverified nếu đủ content version nhưng không tự unlock. Status pending/acked/conflict visible; crash after commit retry trả response cũ. Core online và sync dùng cùng command service.  
Offline preview FSRS dùng adapter/version giống server, đề rõ tạm tính. Server replay review hợp lệ theo thứ tự lease tại accepted occurredAt đã kiểm tra; bad clock chuyển sang practice \+ yêu cầu review online thay vì âm thầm đổi ngày. Nếu content bị thu hồi sau tải xuống, chặn graded sync và hướng dẫn tải bản mới, không xóa bằng chứng. Không sync user-submitted AI feedback thành verified mastery.

## 4.5. Free-only deployment profile và giới hạn cá nhân

\[V, kiểm tra 13/10/2026\] Vercel Hobby miễn phí cho dự án cá nhân phi thương mại; vượt quota có thể tạm ngưng đến khi reset \[S19\]. Supabase Free có 500 MB database, 1 GB file storage, 5 GB egress và 5 GB cached egress; project có thể pause sau một tuần không hoạt động \[S20\]. GitHub Free private repo có 2.000 phút standard Actions/tháng và 500 MB artifacts \[S21A\]. T068 phải kiểm lại giới hạn và dung lượng còn lại của tài khoản thực tế; không giả định app được dành riêng toàn quota hoặc tạo nhiều tài khoản để né giới hạn.  
Mặc định: GitHub Free private repo → CI Ubuntu tiêu chuẩn có giới hạn → staging local → Vercel Hobby (\*.vercel.app) \+ một Supabase Free production project. Không cần domain riêng, Vercel Pro, paid Storage/AI Gateway, Supabase IPv4/PITR/compute/log drains. PostgreSQL native hoặc Docker Desktop Personal khi đủ điều kiện giấy phép dùng cho test local \[S26\]. Không cần VPS, GPU server hay container registry.  
Vercel build từ commit SHA/lockfile, không chạy Docker image. Functions là stateless; kiểm runtime/memory/body limits ở T068, giữ handlers ngắn và dùng pooler PostgreSQL. Không chạy ffmpeg/Whisper/model weights hoặc worker lâu dài trong function. Import, backup và xử lý media dài chạy trên Windows hiện có bằng công cụ miễn phí. Preview chỉ dùng synthetic data, không ghi production DB; owner allowlist và RLS giữ nguyên.  
Capacity targets \[D\]: database app ≤100 MB; media đã xuất bản ≤200 MB ban đầu; egress cho một user khoảng ≤1 GB/tháng, cần đo lại trước mở rộng HSK4. Cảnh báo ở 70–80% quota thực, cache bài/audio và không lưu cloud raw recordings mặc định. CI mục tiêu ≤300 phút Linux/tháng, artifacts ≤100 MB với TTL3 ngày; full suite/device test ưu tiên local. Đây là envelope thiết kế, chưa phải đo đạc và không được xóa evidence/outbox để giảm dung lượng.  
Chặn phí: FREE\_ONLY=true, serviceFeeBudget=0, provider/model allowlist đã kiểm Free; không paid API keys/routes/features/add-ons. Tier và trạng thái không bật billing cần readback hoặc owner attestation vì API key không tự chứng minh được billing state. GitHub budget0 \+ Stop usage nếu hỗ trợ, không larger runners/paid storage. Hết quota thì dừng job/request và chạy local checks/manual free deploy hoặc bài tải sẵn. Alert chi phí trên một account trả phí không đủ bảo đảm zero-cost.  
AI mặc định: Gemini API project Free không linked Cloud Billing; candidate gemini-2.5-flash-lite cho text theo S21–S23. Không dùng quyền subscription ChatGPT/Gemini như API quota. Kiểm access/rate/schema trước enable; giới hạn có thể đổi và không có free SLA cam kết. Không bật grounding/search/maps/file-search/context caching làm mặc định. Retrieval từ content đã duyệt; mọi live evaluation dùng cùng free quota. Hết quota/eval fail → approved explanation; không nâng model trả phí.  
Privacy: Gemini Unpaid Services có thể dùng input/output để cải thiện sản phẩm và human review \[S22\]. Chỉ gửi câu hỏi/ngữ cảnh giáo dục không định danh và roleplay giả định; không gửi họ tên/email/địa chỉ thực/private learner preferences/raw audio. Có consent trước bật và lựa chọn không gửi AI. Chưa có free access hoặc user không đồng ý thì dùng explanation đã duyệt; không tự chọn paid service để thay đổi privacy policy.  
Speech: licensed free audio đã kiểm tra \+ browser TTS; ghi âm/phát lại/shadowing local và typed transcript. Browser STT tùy chọn phụ thuộc support/network/consent \[S25\]; whisper.cpp trên Windows chỉ cân nhắc sau benchmark/license \[S27\], không ép cài model/GPU để hoàn thành MVP. Chưa có free tone assessment đã kiểm chứng thì hiển thị unavailable và để sau; không lấy transcript hoặc pitch làm điểm chuẩn. T057–T058 không chặn personal HSK1–4 release.  
Content/design/eval: thư viện UI và fonts đúng license, original exercises và audio miễn phí có quyền dùng. Không mua template/font/dataset/audio/sách/reviewer hoặc LLM judge. PDF HSK chính thức chỉ làm nguồn scope, không tự cấp quyền sao chép. Review dùng người có chuyên môn tình nguyện hoặc nội dung nguồn đã được duyệt có quyền sử dụng; thiếu thì giữ draft/beta và nêu gaps. Build dùng công cụ hiện có; không yêu cầu mua coding assistant hoặc API credits mới.  
Backup/availability: DB dump, learning export và media files mã hóa trên disk hiện có; schema/source metadata trong git. Hiển thị thời gian backup thực, test restore local. PC tắt thì không có local scheduled backup; có manual export. Không hứa managed daily backup/PITR/24h RPO/free uptime SLA. Cloud pause/quota hết → banner, downloaded lesson/review outbox theo lease; lease hết chỉ practice, không mất outbox. Không tạo traffic giả để tránh provider inactivity policy.  
Fallback: core trên Windows bằng Node \+ PostgreSQL native \+ licensed local media, truy cập localhost. Phone giữ PWA packages đã tải; đồng bộ/đăng nhập mới cần backend online. Local HTTPS/LAN cho Android cần setup riêng được kiểm chứng, không hứa localhost của PC tự truy cập được trên phone. Kiểm free eligibility ở deployment thực; không bảo đảm provider miễn phí mãi, nhưng constraint không trả phí vẫn giữ khi provider đổi chính sách.

# 5\. Database Design {#5.-database-design}

## 5.1. Quy ước và nhóm dữ liệu

PostgreSQL UUID PK; timestamptz UTC; profile.timezone IANA mặc định Asia/Ho\_Chi\_Minh để tính ngày học, không để timezone server quyết định lịch. IDs stable UUID không sinh lại khi import; slug unique trong namespace/version. JSONB chỉ cho exercise payload/structured model report/scheduler snapshot có schemaVersion, không thay mọi relational link bằng JSON. created\_at/updated\_at; optimistic version bigint cho projections; score numeric với CHECK 0..1; enum/check cho trạng thái.  
Identity: profiles(user\_id PK FK auth.users, display\_name, timezone, target\_level 1..4, ai\_enabled, audio\_retention\_days); bỏ daily\_minutes làm input authoritative. learner\_settings(user\_id PK, desired\_retention 0.7..0.95, new\_card\_cap, accessibility JSONB). Time preferences dùng entities mục 6.6; daily allocation là kết quả từ lịch tuần. admin\_memberships(user\_id PK,role) protected. Một user có nhiều devices; devices(id,user\_id,label,last\_seen\_at); device\_leases(user\_id UNIQUE,device\_id,lease\_id,expires\_at,generation). Không cần tenant\_id khi user chính là tenant; organization mở rộng bằng ADR mới.  
Provenance: sources(id,title,url,publisher,source\_version,accessed\_at,checksum,license\_id,status); licenses(id,name,terms\_url,commercial\_status allowed/restricted/unknown,attribution,redistribution,reviewed\_by,reviewed\_at,evidence); asset\_sources(asset\_id,source\_id,locator); content\_sources(content\_version\_id,source\_id,locator). sources lưu metadata và trích dẫn cần thiết; không tự tải toàn bộ nguồn nếu quyền chưa rõ.  
Curriculum: syllabus\_versions(id,code UNIQUE,published\_month,effective\_month,source\_id,status,checksum); curriculum\_releases(id,syllabus\_id,version UNIQUE,manifest\_hash,state draft/review/published/retired); level\_specs(id,syllabus\_id,level,requirements JSONB,verified\_by); communication\_tasks(id,syllabus\_id,level,official\_locator,summary); topics(id,syllabus\_id,level,key,title); task\_concepts(task\_id,concept\_id); topic\_concepts(topic\_id,concept\_id). Composite UNIQUE(syllabus\_id,level); mọi mapping kiểm cùng syllabus/release.  
Knowledge: concepts(id,type vocab/grammar/character/pinyin/component,stable\_key UNIQUE); concept\_versions(id,concept\_id,version,payload,review\_state); syllabus\_concepts(syllabus\_id,concept\_id,sense\_id nullable,first\_level,recognition\_required,production\_required,locator). vocab\_entries(id,concept\_id,headword\_simplified); vocab\_senses(id,vocab\_id,pinyin\_numeric,pinyin\_display,part\_of\_speech,meaning\_vi,usage\_note); vocabulary level áp dụng sense nếu đa âm/đa nghĩa; không dedup chỉ theo headword. grammar\_points(id,concept\_id,pattern,explanation\_vi); characters(id,concept\_id,glyph UNIQUE,unicode\_codepoint); character\_readings(character\_id,sense\_id); components(id,concept\_id,glyph,label\_vi); character\_components(character\_id,component\_id,position,function\_tag,reviewed\_note). Bộ thủ tra cứu và thành phần cấu tạo là hai thuộc tính riêng; không gán câu chuyện ghi nhớ là nguồn gốc chữ.  
Prerequisite: concept\_prerequisites(concept\_id,prerequisite\_id,required\_skill,min\_evidence,kind hard/soft); lesson\_prerequisites(lesson\_version\_id,concept\_id,skill,required\_state). CHECK concept≠prerequisite; cycle detection trong publish pipeline với transaction, không thể chỉ FK ngăn chu trình. DAG riêng release, references content versions nằm trong cùng manifest. Skills là nghe/đọc/production\_vocab/grammar\_use/writing/speaking/pinyin\_discrimination; typing không tự được điểm handwriting.  
Teaching content: courses(id,release\_id,level,title); units(id,course\_id,ordinal); lessons(id,unit\_id,stable\_key); lesson\_versions(id,lesson\_id,version,release\_id,objectives,duration\_minutes,blocks JSONB,state); lesson\_concepts(lesson\_version\_id,concept\_id,skill,role); exercises(id,stable\_key); exercise\_versions(id,exercise\_id,version,type,public\_payload,answer\_key\_id,difficulty,normalizer\_version,review\_state); lesson\_exercises(lesson\_version\_id,exercise\_version\_id,ordinal); exercise\_concepts(exercise\_version\_id,concept\_id,skill,weight CHECK\>0). answer\_keys(id,accepted\_forms JSONB,rubric,explanation\_vi,reviewers,version) server-private. media\_assets(id,object\_key,mime,bytes,sha256,locale,voice,provenance\_state); exercise\_media/lesson\_media join.  
Learning: enrollments(user\_id,release\_id,target\_level,start\_at,state); learning\_sessions(id,user\_id,lesson\_version\_id,state,current\_step,started\_at,completed\_at); attempts(id,user\_id,session\_id,exercise\_version\_id,response JSONB,score,hint\_count,assistance,grading\_source verified\_key/human/ai\_provisional/self,occurred\_at,received\_at,event\_id UNIQUE per user); learning\_events(id,user\_id,event\_id,kind,payload\_version,payload,engine\_version,occurred\_at) append-only. skill\_mastery(user\_id,concept\_id,skill,evidence\_count,independent\_correct\_count,recent\_window JSONB,status,last\_verified\_at,engine\_version,version); lesson\_progress(user\_id,lesson\_version\_id,state,completion\_ratio,last\_session\_id). Events là nguồn replay; projection không tự sửa thủ công để lên cấp.  
Review: review\_templates(id,concept\_id,variant recognition/listening/recall/typing/handwriting,content\_version\_id,public\_prompt,answer\_spec); review\_cards(id,user\_id,template\_id,state, due\_at,stability,difficulty,elapsed\_days,scheduled\_days,reps,lapses,learning\_steps,last\_review\_at,fsrs\_state JSONB,scheduler\_version,config\_id,version); scheduler\_configs(id,user\_id,algorithm,library\_version,desired\_retention,parameters JSONB,effective\_at); review\_logs(id,user\_id,card\_id,event\_id,rating CHECK1..4,before\_state,after\_state,reviewed\_at,duration\_ms,config\_id). UNIQUE(user\_id,template\_id); CHECK stability/difficulty valid theo adapter; không ép range phụ thuộc phiên bản thư viện bằng giả định.  
Sync: sync\_events(user\_id,event\_id UNIQUE,device\_id,client\_seq,lease\_id,kind,content\_version,base\_version,payload\_hash,status,result\_json,received\_at); UNIQUE(user\_id,device\_id,client\_seq); api\_idempotency(user\_id,endpoint,key UNIQUE scoped,payload\_hash,status,response\_json,expires\_at). sync\_states(user\_id PK, cursor bigint, last\_acked\_at, snapshot\_version) giữ cursor tăng đơn điệu theo owner; learning\_events thêm owner\_seq bigint UNIQUE(user\_id,owner\_seq), không dùng UUID random như sequence. Event replay giữ ít nhất 90 ngày; review\_logs giữ đến xóa user để optimizer; retry horizon outbox 30 ngày, vượt hạn yêu cầu reconcile thay vì coi key mới.  
Assessment: exam\_blueprints(id,syllabus\_id,level,version,state unverified/verified,sections JSONB,scoring\_version,source\_id,verified\_by); assessment\_items(id,exercise\_version\_id,blueprint\_id,section\_id,skill,is\_secure,exposure\_count); assessment\_sessions(id,user\_id,blueprint\_id,blueprint\_version,started\_at,deadline\_at,state,selection\_seed); assessment\_answers(id,user\_id,assessment\_session\_id,item\_id,response,score\_source,score,submitted\_at); assessment\_reports(id,user\_id,assessment\_session\_id,skill\_scores,evidence\_n,coverage,confidence\_label,readiness\_label,rubric\_version). Raw practice score không tự là điểm thi chính thức.  
AI/speech: tutor\_sessions(id,user\_id,mode,context\_release\_id,consent\_version,state); tutor\_turns(id,user\_id,session\_id,input\_redacted,response JSONB,provider,model,prompt\_version,schema\_version,token\_usage,cost\_estimate,status); learner\_memories(id,user\_id,kind,value,origin evidence/self\_declared/ai\_suggested,source\_event\_ids,confirmed,expires\_at); speech\_attempts(id,user\_id,reference\_version\_id,asset\_id nullable,provider,locale,transcript,report JSONB,quality\_status,assessment\_version,consent\_at,expires\_at). Audio mặc định không upload lưu lâu, reference ID đủ truy vết; AI memory sai không thành fact chỉ vì model nói.  
Operations: provider\_usage\_reservations(id,user\_id,feature,request\_id UNIQUE,period,request\_units\_reserved,token\_units\_reserved,status,expires\_at); usage\_ledger(id,user\_id,feature,provider,units,estimated\_tokens,actual\_tokens,service\_fee CHECK=0,tier\_verified\_at,request\_id). Chuyển reservation từ tiền sang free request/token quota; không dollar budget ledger ở personal build. content\_reviews/jobs/audit\_logs giữ mục đích cũ, chỉ local scheduled/foreground maintenance và owner admin; không paid worker. Credential-free metadata ledger không chứa prompt/raw transcripts.

## 5.2. Relationships, constraints và isolation

Chuỗi nội dung: syllabus → release → course → unit → lesson → lesson\_version → lesson\_exercises → exercise\_version → answer\_key; concept nối xuyên lesson/exercise/syllabus và prerequisites. User → session → attempt → evidence projection; user → card → review\_logs; card gắn template không gắn literal word duy nhất. User → assessment\_session → answers/report; user → tutor\_session → turns/memory. Nội dung dùng chung chỉ published; dữ liệu học thuộc owner.  
Mỗi parent user-owned có UNIQUE(user\_id,id); child FK(user\_id,parent\_id) REFERENCES parent(user\_id,id), tránh gắn attempt vào phiên của user khác. RLS SELECT/INSERT/UPDATE/DELETE dùng cả USING và WITH CHECK; query views security\_invoker hoặc không expose. Private schemas/revoke grants tới anon/authenticated bảo vệ answer keys/admin. Runtime chỉ có quyền cần thiết; policies không dựa vào user-editable metadata. JWT claims set transaction LOCAL với verified uid, không string interpolation SQL.  
UNIQUE(course\_id,ordinal), UNIQUE(unit\_id,stable\_key), UNIQUE(lesson\_id,version), UNIQUE(exercise\_id,version), UNIQUE(user\_id,concept\_id,skill). Ordinal CHECK≥0; duration≥0 với cap hợp lý; state machine session/assessment không cho submit hai lần. published content cấm UPDATE/DELETE qua runtime, revoke direct mutable privilege; migration/import publisher có transaction và audit. Retire giữ reference để replay; xóa user cascade user-owned evidence và jobs, provenance/content giữ. Xóa level/release bị RESTRICT nếu đã có attempt.

## 5.3. Indexes, migrations và maintenance

Indexes: review\_cards(user\_id,due\_at) partial active/non-suspended; attempts(user\_id,occurred\_at DESC), (user\_id,session\_id); review\_logs(user\_id,card\_id,reviewed\_at); skill\_mastery(user\_id,status,skill); lesson\_progress(user\_id,state); sync\_events(user\_id,status,received\_at); learning\_events(user\_id,id); tutor\_turns(user\_id,session\_id,created\_at); jobs(state,next\_run\_at) partial queued; reservations(user\_id,period,status); FK columns và mappings reverse concept\_id. PostgreSQL B-tree mặc định; GIN JSONB chỉ sau query thật và EXPLAIN; full-text search nhỏ có pg\_trgm P1 nếu cần, chưa pgvector/partition.  
SQL migrations thứ tự identity → content → learning/review → RLS/grants → sync → assessment/tutor/operations. Expand–migrate–contract: add nullable field, backfill idempotent theo batch, deploy đọc hai dạng, enforce constraint sau validate; không DROP cột đang dùng cùng deploy. Migrations chạy một job privileged trước rollout có lock, không chạy mỗi request. Fresh DB và upgrade từ release trước đều phải test. Supabase generated types là output; schema thực không thay bằng TypeScript.  
Projection rebuild chạy bằng user-scoped replay với engine/config versions gốc; dry-run diff trước apply và audit. Không tính lại due của mọi card khi đổi desired retention tự động: config mới áp dụng review tiếp, bulk reschedule riêng có preview/confirmation sau này. Backup schema/data/auth phù hợp và Storage objects riêng; restore test phải tái tạo một user, attempt, card và audio package.

# 6\. Learning & Curriculum Design {#6.-learning-&-curriculum-design}

## 6.1. Curriculum engine và foundation

Curriculum manifest schemaVersion 1: releaseId,syllabusVersion,course/unit/lesson IDs,communication task/topic references,concept versions,prerequisite edges,exercise versions,media hashes,attributions. Publish validator kiểm DAG, coverage, missing refs, audio/transcript match, license, answer review. Một lesson 10–20 phút, 1 nhiệm vụ giao tiếp, 3–6 từ/senses mới, 1 pattern, 3–5 exercise independent; có segment lý thuyết ≤3 phút xen retrieval. Không unlock bằng đọc hết slide.  
Foundation F01: âm tiết \+ pinyin \+ nghe phân biệt; F02: thanh 1–4/thanh nhẹ với audio chuẩn; F03: âm đầu khó và vần, j/q/x, zh/ch/sh/r, ü và dấu nháy; F04: biến điệu thanh 3, 一/不 trong ngữ cảnh; F05: pinyin input, basic strokes, giản thể, cách đọc ví dụ. HSK 0 là mã nội bộ foundation, không là cấp thi chính thức. Pinyin dictionary form và spoken form có fields riêng để không ghi tone sandhi thành từ điển.  
Vertical slice L001 tự giới thiệu/chào hỏi: prerequisites F01–F02; giải thích tiếng Việt, 6 senses bản gốc được duyệt, mẫu người bản ngữ hoặc TTS duyệt, 1 mini-dialogue, discrimination tones, nghe-chọn, đọc-hiểu, arrange, short recall; 2–4 characters cho recognition, handwriting ở P1. L002 sở thích/câu hỏi đơn giản mở khi prerequisites có evidence hoặc cho practice có nhãn. Nội dung mẫu phải tự tác giả và review, không lấy nguyên bài sách.  
HSK 1 dự kiến 35–50 micro-lessons \+ foundation, nhóm sinh hoạt/gia đình/thời gian/địa điểm/ăn uống/mua sắm/học tập theo topic coverage; số lesson là ước tính \[A\], do content audit quyết định. HSK 2 mở rộng 25–40 bài; HSK 3 50–70; HSK 4 70–100 với reading dài hơn, listening tự nhiên hơn, nói/viết theo rubric. Không đặt level chỉ bằng lượng từ; một item có thể củng cố nhiều skill nhưng không phát mastery không được quan sát.

## 6.2. Bằng chứng năng lực và mastery rule v1

Mỗi exercise\_concepts chỉ rõ skill được đo và weight; assisted/hinted/repeated-within-session không độc lập. Score objective chuẩn hóa 0..1; retry sau khi hiện đáp án chỉ ghi practice. Evidence independent hợp lệ nếu answer key verified/human reviewed, chưa xem đáp án/hint, không cùng item trong 24h, duration không phi lý theo rule. Số lượt đủ không đồng nghĩa mastery nếu chỉ là một câu memorized.  
Deterministic trạng thái: unseen (0 evidence), learning (có evidence), practicing (≥3 independent attempts), secure (≥5 independent attempts trên ≥3 item khác, ≥2 ngày; gần nhất 5 weighted accuracy ≥0,8; delayed probe ≥48h đúng ≥0,8), needs\_review khi gần nhất 3 independent weighted accuracy \<0,6 hoặc evidence quá cũ \>30 ngày. Các ngưỡng \[D/A\] pin engineVersion, phải hiệu chỉnh pilot. Không tự hạ secure vì calendar một ngày, chỉ gắn stale flag khi thiếu evidence gần.  
Recognition/listening secure không unlock writing/speaking mastery; AI chấm open response là provisional và hiển thị riêng. Self-rated thẻ dùng FSRS, không đủ một mình thành secure. Handwriting practice stroke tolerance tạo evidence luyện nét, free recall có rubric/human sample mới nâng writing. Speaking self replay là participation; pronunciation provider chưa validated là provisional. Không phát điểm thành thạo thanh điệu từ transcript đúng.  
Unlock lesson hard prereqs yêu cầu practicing (foundation tối thiểu 3 independent discrimination items và ≥0,8 score); không buộc secure toàn bộ từ trước để tránh đứng yên. Unit exit yêu cầu ≥80% core objectives secure hoặc practice đủ \+ diagnostic bổ sung đã duyệt cho skill khó đo. Có “học trước” mềm với cảnh báo, không mark prereq secure; remediation 5 phút nếu 2 lần fail; repeat item khác. Production skill thiếu reviewer vẫn ghi unknown, không xếp “thành thạo cả 4 kỹ năng”.

## 6.3. FSRS flow và chống card overload

Template per concept/skill cần thiết: thường recognition \+ listening \+ recall, không tự tạo 6 cards/từ. Sibling bury trong cùng ngày để tránh leakage; default new cards ≤10/ngày, review target 15–25 phút. Rating Again=quên/sai; Hard=nhớ với khó khăn; Good=nhớ đúng; Easy=nhớ ngay. Hard không dùng để né Again; UI giải thích và cho chọn sau reveal. Hints trong card thì gợi ý Again/Hard, vẫn user quyết rating, log assistance.  
Khởi tạo ts-fsrs card defaults qua adapter, retention=0,9, cấu hình/library version lưu; dự đoán các rating trước answer chỉ UI, mutation sau answer lock SELECT FOR UPDATE card, đọc version, scheduler.next tại timestamp chuẩn, ghi log và card trong cùng transaction. Duplicate event trả state cũ đã commit; stale version 409 không apply lần hai. UTC dueAt, daily grouping theo profile timezone. Null last\_review/new card và daylight/timezone change có golden tests.  
Leech \= ≥8 lapses \[D\], gợi ý chỉnh template/minimal pair/học lại, không spam schedule. Daily plan không xóa nợ khi user quá tải: ưu tiên relearning \+ overdue, giảm new cards về 0 nếu estimated reviews \>daily budget; offer 10 phút và resume. Personal FSRS optimization P2 chỉ sau ≥1.000 reviews qua ≥60 ngày \[D\], holdout time split, so log-loss/retention-workload với default; rollback config nếu kém.

## 6.4. Adaptive selection và pacing 6–8 tháng

Rule priority deterministic trong time budget của block/ngày/tuần: due relearning/overdue trước, rồi resume phù hợp prerequisite, remediation weakest eligible concept, next unlocked lesson, optional speaking/writing. Weekly planner mục 6.6 cấp ngân sách; daily planner không tự tạo thêm giờ. Khởi tạo allocation khi review load chưa đủ dữ liệu: 40% review, 40% new lesson, 20% skill practice trên phần ngân sách dùng được, chỉ là heuristic \[D/A\], không tỷ lệ khoa học phổ quát. Có review overdue hoặc workload tăng thì ưu tiên review và giảm bài mới; không cố giữ 40/40/20. Tie-break stable priority/unit ordinal/ID; reason và estimatedMinutes rõ, không gọi LLM chia lịch.  
Adaptive micro-exercises chọn mục tiêu yếu, không dùng item đã hiện đáp án gần; khó hơn khi last 5 independent \>0,8, dễ hơn/remediation nếu \<0,6; min coverage skill. Personalization có cooldown tránh lặp cùng concept; user có thể chỉnh weekly budget, lịch rảnh/cap buổi hoặc pause; phần chưa hoàn thành được replan và không sửa bằng chứng đã học. Offline dùng snapshot weekly plan \+ prerequisite evidence downloaded; thay weekly settings cần online, không mở nội dung chưa tải. Streak không tác động unlock.  
Kịch bản minh họa \[A\], không phải calendar bắt buộc: foundation → HSK1 → HSK2 → HSK3 → HSK4 theo prerequisite/mastery. Quỹ giờ mỗi tuần do user chọn và có thể đổi. Ví dụ 6 giờ/tuần trong 26–35 tuần là 156–210 giờ; 9 giờ/tuần là 234–315 giờ, đều không đủ căn cứ bảo đảm HSK4. Lịch 6–8 tháng chỉ là target có điều kiện; user chọn ít giờ hoặc learning pace chậm thì forecast kéo dài. Hằng 2 tuần đo delayed recall/workload/transfer; forecast mục 6.6 dựa trên giờ thực học và tốc độ đạt objectives, hiển thị khoảng, không ép thêm giờ để giữ mốc.

## 6.5. Assessment và readiness

Diagnostic khi mới bắt đầu có “tôi chưa biết gì” skip; không bắt người mới thi dài. Lesson checks formative, unit tests holdout không trùng exact practice; cấp test coverage tất cả task/topic/core concepts và skill, có parallel forms. Objective items chấm deterministic; nhập tiếng Trung normalize NFC, trim/whitespace/punctuation theo policy từng loại; không đổi tone/ü/sense hay dùng fuzzy matching chung cho câu ngữ pháp. Accepted alternatives explicit; ambiguous answer bị quarantine.  
Mock blueprint version có sections, item counts, durations, audio replay rules, scoring rubric, spoken/written requirements, source locators và date verified; state unverified không xuất hiện như “đề chuẩn”. Pilot v0.2 chỉ unit diagnostics nội bộ; “official-format practice” chỉ sau đối chiếu được mẫu/blueprint chính thức và quyền tái sử dụng. Có thể tạo original questions theo cấu trúc, không sao chép audio/câu đề mẫu mặc định.  
Readiness v1 \= chưa đủ bằng chứng / cần củng cố / có bằng chứng sẵn sàng luyện thi; không xác suất đỗ nếu chưa có dữ liệu calibration. Nhãn cao nhất cần ≥90% target objective coverage đã đo, ≥80% secure trong core nghe/đọc, hai holdout mocks đúng version trên ngày khác nhau đạt target do blueprint verified định nghĩa, writing/speaking rubric samples được human/provider đã validate xác nhận. Nếu pass threshold mới chưa verified thì chỉ internal readiness và không claim official pass. Report n, recency, weakest skills, source of grading, gaps, uncertainty.  
Timed test lưu deadline server, refresh tiếp tục, auto-submit khi hết, answer autosave idempotent; pause chỉ practice, không timed. Không cần anti-cheat nặng cho cá nhân nhưng secure item keys chỉ server và không cache. Item QA: 1 đáp án chính xác hoặc accepted set; distractors plausible và không lỗi grammar; explanation/source; kiểm tra audio không phát đáp án ngoài ý muốn. Analytics discrimination/P-value chỉ dùng khi đủ ≥50 attempts/item từ nhiều users \[D\], với cá nhân chủ yếu manual review.

## 6.6. Weekly Time Budget Planner — chia lịch theo quỹ giờ/tuần

Mục tiêu \[D\]: user chọn tổng thời gian có thể học mỗi tuần; app tự đề xuất lịch ôn, bài mới, luyện kỹ năng và diagnostic theo lịch rảnh \+ prerequisite \+ review load \+ năng lực. Weekly budget là mức tối đa user dự định dành ra, không phải số phút phải học bằng mọi giá; không filler để lấp đủ giờ. P0 có ngay vertical slice. AI không quyết lịch hoặc forecast. User xem/đổi/khóa ngày và pause, còn app chịu trách nhiệm điều phối.  
Cơ sở \[V, S17–S18\]: nghiên cứu về distributed practice hỗ trợ giãn việc học thay vì dồn và cho thấy khoảng cách phù hợp phụ thuộc mục tiêu giữ kiến thức; nghiên cứu retrieval practice hỗ trợ tự nhớ lại/kiểm tra thay cho chỉ đọc lại. Đây là bằng chứng cho hướng thiết kế, chưa chứng minh lịch cụ thể tối ưu cho mọi người học tiếng Trung/HSK. Block 10–25 phút, buffer 10%, tỷ lệ 40/40/20, review caps và forecast dưới đây là heuristics \[D/A\] phải đo bằng delayed recall, transfer và workload.  
Inputs v1: weeklyMinutes integer 30..1260 khi active, 0 khi paused (engineering bounds \[D\], không chuẩn sư phạm); availableDays ISO weekday 1..7, nonempty khi active; dayCaps map phút 0..180/ngày, ngày không chọn cap0; preferredSessionMinutes 10..25 mặc định20, maxSessionMinutes 5..45 mặc định25 và preferred≤max; optional unavailableDates/local preferred time windows P1. Nếu chỉ nhập giờ/tuần, đề xuất 6 ngày, cap90/ngày và block≤25 phút, user được sửa. Hiển thị 3/6/9/12h presets và nhập custom. Không bắt điền giờ trong ngày/P0 calendar integration.  
Capacity: C=sum(dayCaps của ngày available còn lại trong local week, trừ completed/active time đã dùng cùng ngày); B=weeklyMinutes cho toàn tuần; remainingBudget=max(0,B−actualActiveMinutesInWeek). Khi new settings B\<spent: không đổi history, remaining=0, giữ due queue và nêu budget đã vượt do học trước khi đổi. Khi B\>capacity tuần đầy đủ, preview hiển thị targetMinutes/feasibleMinutes/unscheduledMinutes và options thêm ngày, tăng cap, hoặc chấp nhận lịch ít giờ hơn; không tự sửa input. Expected planned minutes chưa phải thời gian thực học.  
Tuần theo timezone profile, bắt đầu thứ Hai 00:00 local, dates date-only; planned blocks có localDate/ordinal/estimatedMinutes/kind/target IDs thay vì hứa một giờ chính xác. P0 replan cần online, tại onboarding/app foreground, đổi settings, complete session/review hoặc missed block khi mở lại. Completed/in-progress blocks giữ nguyên; replan chỉ phần chưa làm, version+reason visible. App không cần background daemon hay gửi calendar invitations để sinh kế hoạch.  
Algorithm v1 deterministic: (1) freeze completed/active blocks, đọc budget/cap/timezone và snapshot evidence/cards; (2) còn capacity dùng được U=min(remainingBudget,remainingCapacity), reserve buffer=min(round(0,1×U),remainingCapacity) cho tuần mới, chỉ là slack trong budget; khi review debt cần thì được dùng buffer nhưng total không vượt U; (3) gom due/overdue FSRS cards trong horizon 7 ngày, estimate review phút từ median cá nhân 14 ngày, ít dữ liệu fallback30s/card \[A\]; reserve review/relearning trước bài mới; nếu review cần hơn U, new=0 và hiện debt; (4) phần còn lại chọn remediation/new lesson/skill theo prerequisites và evidence, cold-start dùng 40/40/20 mềm rồi reallocate theo nhu cầu; (5) đặt block trên eligible dates, spread exposures theo due windows/avoid cùng concept học dồn, tie-break earliest eligible date, priority, unit ordinal, stable ID; (6) trả plan \+ reasons \+ unscheduled/review debt \+ forecast. Không tạo attempts/reviews tương lai giả để 'đặt lịch'.  
FSRS due\_at vẫn là timestamp tính từ lần review thực; planner chọn ngày khả dụng sớm nhất tại/sau due, không sửa due\_at để vừa thời khóa biểu. Review overdue hiện overdue; nghỉ ngày đó không làm FSRS mất nợ. Bài mới không đặt trước hard prerequisite; nếu việc học unlock ngày sau chưa chắc đạt, block mới chỉ tentative và today recheck; prerequisite fail→remediation cùng cap. No new concept repetition chỉ để lấp slot; review cost tương lai từ card mẫu chỉ estimate và daily cap/new\_card\_cap cùng áp dụng. User chỉ rảnh cuối tuần được tôn trọng; app nêu khoảng cách dài có thể cần giảm bài mới, gợi ý tùy chọn micro-review có tính trong budget, không ép thêm ngày.  
Block/session: một lesson 15 phút hoặc checkpoint segment 5–10 phút; không cắt giữa listening/answer attempt hay timed test. Max contiguous focus maxSessionMinutes; ngày 60 phút chia vài block ngắn, nghỉ giữa block không tính active study. Nếu không đủ slot cho atomic activity, defer hoặc chọn review ngắn, ghi unusedMinutes; không phá rubric để fit. Có nút 'hôm nay chỉ có 10 phút' giảm day override trong budget; tăng ngoài kế hoạch cần user chủ động, hiển thị overtime, không hứa tổng actual không bao giờ vượt do user tự học thêm.  
Missed session không tạo học bù bắt buộc: reschedule pending vào ngày còn capacity, giữ review ưu tiên, giảm new nếu thiếu, phần dư sang tuần sau dưới dạng learning/review backlog chứ không cộng nợ phút vào weekly budget mới. Nợ ôn không tự reset ở tuần mới. Completed minutes từ authenticated active-time intervals với idle cap60s, unique eventId và không cộng hai tab/overlapping intervals trên active device; đó là telemetry, không bằng chứng mastery. Offline ack giữ occurredAt/overlap policy, tới sau thì replan nếu vượt actual budget; không xóa thành quả chỉ để lịch trông đúng.  
Data additions \[D\]: learning\_time\_preferences(user\_id PK FK auth.users,weekly\_minutes,available\_days,day\_caps JSONB validated,preferred\_session\_minutes,max\_session\_minutes,paused,version,updated\_at); weekly\_learning\_plans(id UUID,user\_id,local\_week\_start date,timezone\_snapshot,preferences\_version,version,status,requested\_minutes,feasible\_minutes,buffer\_minutes,actual\_minutes,unallocated\_minutes,forecast JSONB,planner\_version,created\_at), UNIQUE(user\_id,local\_week\_start,version), one active via partial index; planned\_learning\_blocks(id,user\_id,plan\_id,local\_date,ordinal,kind,target\_refs JSONB,estimated\_minutes,status tentative/ready/in\_progress/completed/skipped/superseded,reason\_code), UNIQUE(plan\_id,local\_date,ordinal); learning\_time\_events(id,user\_id,event\_id,session\_id nullable,device\_id,started\_at,ended\_at,active\_seconds,source online/offline), UNIQUE(user\_id,event\_id). Composite owner FKs/RLS/private grants như mục5; indexes (user\_id,local\_week\_start,status), (user\_id,local\_date,status), (user\_id,started\_at). learning\_sessions.planned\_block\_id nullable FK owner; không bỏ data vì user học tự do.  
Consistency: command PATCH preferences và replan khóa owner/current plan, optimistic expectedVersion, idempotency; insert new plan \+ supersede pending old blocks \+ active pointer trong một transaction. Check budget/cap/blocked prerequisites trước commit; không SET config trong session pooled; runtime RLS không bypass. Grading/review transaction ghi time evidence eligible/delta, còn planner recompute từ committed snapshot sau transaction; plan revision conflict retry đọc bản mới, không giữ DB tx chờ UI/provider. GET /today revalidate tentative blocks. Constraints aggregate (sum block phút/day cap) do validator \+ owner lock, không giả định CHECK một row giải quyết được tổng. Nếu user giảm cap/budget trong buổi đang chạy, freeze evidence đã có, đề xuất dừng ở checkpoint; phần pending không được xếp quá ngân sách mới. Nếu user chủ động tiếp tục vượt mức thì hiện overtime/remaining0, không tự claim planned budget invariant bao gồm thời gian tự học thêm.  
Forecast: sau ≥14 ngày và ≥6 completed sessions \[D\], lấy rolling mastered objectives/active hour × achieved attendance/weekly budget, trừ dự kiến review \+ skill practice khi estimate new-objective throughput. Phải tránh trừ review hai lần: throughput tính trên tổng giờ active thì dùng toàn effective weekly active hours, hoặc throughput trên new-study hours thì dùng allocation new hours; ghi denominator trong forecast model. Báo khoảng dựa lower/upper recent throughput \+ coverage uncertainty; chưa đủ data hiện 'chưa đủ dữ liệu', không giả một ngày thi. User tăng/giảm giờ → preview forecast mới, không đổi target syllabus hoặc mastery. Tăng giờ không được giả định tốc độ tăng tuyến tính vô hạn.  
Ví dụ \[D/A\]: user chọn 6h=360 phút/tuần, 6 ngày cap60. Initial kế hoạch tối đa324 phút hoạt động \+36 phút buffer; một ngày mẫu54 phút \=24 ôn \+20 bài mới \+10 nghe/nói/viết theo lesson skill, chia 3 block. Phân bổ thật thay đổi theo card due/năng lực; không hứa mọi ngày bằng nhau. Nếu chỉ rảnh 3 ngày cap90 thì capacity270 phút: preview nói còn90 phút không xếp được, xin user chọn tăng capacity hoặc giữ 6h target với lịch270; không tự xếp120 phút/ngày. Bỏ lỡ một ngày không làm hôm sau120 phút; plan giảm bài mới/forecast lùi.  
Acceptance \[P0\]: sum estimated remaining blocks \+ buffer≤remaining weekly budget/capacity; mỗi ngày≤day cap; block≤maxSession; cap mới dưới actual không overwrite history; nghỉ/paused không schedule; due\_at/progress lịch sử bất biến khi replan; offline dùng snapshot; concurrent replan exactly one active version, no cross-user data. Property tests random budgets/availability/daycaps, week/timezone boundaries, impossible target, all overdue, sparse data forecast, late offline intervals, missed day và user edit giữa tuần. Pilot đo adherence/retention/card workload, không tối ưu riêng số phút học.

# 7\. AI Tutor Design {#7.-ai-tutor-design}

## 7.1. Sư phạm và modes

Modes: explain (tiếng Việt ngắn \+ 1–2 ví dụ cùng level), hint (gợi từng bước chưa lộ đáp án), correct (chỉ 1–2 lỗi ưu tiên, nguyên nhân, thử lại), roleplay (nhiệm vụ giao tiếp có target concepts), recap (retrieval trước tổng kết). State: diagnose → prompt learner → observe → hint → learner retries → explain → transfer question → recap. Max 6–10 turns/micro-session; không nói thay người học hết lượt, không đẩy nhiều từ vượt level. Chữ/pinyin visibility giảm theo progress nhưng bật lại được.  
Tutor không là encyclopedia chung, không thay giảng viên review và không tự quyết người học đã đỗ. Retrieval P1 bằng IDs/tag \+ PostgreSQL queries từ published content, tối đa 3 snippets được duyệt có source IDs; không web browsing tự do. Câu hỏi ngoài curriculum: nói chưa có nguồn, cho lời giải hạn chế có nhãn hoặc chuyển học nội dung đã duyệt. Không xây RAG embeddings khi kho nhỏ truy được theo concept.

## 7.2. Structured contract và validation

TutorResponse schema v1 (Zod \+ JSON Schema): schemaVersion,mode,state,messageVi,segments\[{hanzi,pinyin,meaningVi}\],corrections\[{original,revised,errorType,explanationVi,conceptIds,confidence}\],hintLevel,nextPrompt,sourceIds,unknowns\[\],suggestedPracticeIds\[\],memorySuggestions\[\]. additionalProperties=false; max 3 segments, max 2 corrections, message ≤1.500 chars. Explicit refusal/provider timeout không ép JSON thành câu trả lời học. Structured outputs bảo đảm dạng dữ liệu ở mức API, không bảo đảm câu trả lời đúng \[S10\].  
Server validate JSON Schema/Zod, concept/practice/source allowlist, version/caps/pinyin-lexicon; không render HTML. Gemini structured output support \[S23\] không bảo đảm correct feedback; model confidence không calibrated. No userId/name/email/actual-address/sensitive memory/raw audio gửi Gemini Unpaid Services; prompt chỉ approved snippets và educational errors/context không định danh. Free terms có thể dùng input/output cải thiện sản phẩm và human review \[S22\], consent trước enable, user chọn approved explanations nếu không muốn gửi. Input detector/block PII và fictitious roleplay examples; không hứa sanitizer tuyệt đối. Grade/due/mastery không đổi bằng model.  
Một repair retry tối đa khi schema invalid, không tự retry semantic error nhiều lượt; sau lỗi trả explanation approved và nhãn “tutor chưa phản hồi được”. Critical feedback sai (đổi nghĩa câu, dạy sai thanh/ngữ pháp) phải report, quarantine prompt/content case và chạy eval hồi quy; không chỉnh khóa đáp án theo majority LLM.

## 7.3. Learner memory và tối ưu token

Evidence memory lấy từ DB: level/release, 3 lỗi recent, weakest concepts, current task, daily preference. Personal memory user-declared đã xác nhận: mục tiêu, sở thích roleplay, cách giải thích; AI-suggested memory cần xác nhận trước lưu. Không nhớ thông tin nhạy cảm không liên quan. TTL 30 ngày cho lỗi recent, preferences đến user xóa; review/edit/delete từng memory. Audio/transcript chỉ dùng khi consent; không trộn giữa users.  
Budget một request chữ \[D\]: system700tokens, lesson snippets800, anonymized educational context≤300,4recent sanitized turns800,input400≈3.000input,output≤700. Tất cả hoạt động chỉ dùng verified Gemini Free. Summary≤300tokens nếu cần và cũng tính free quotas; truncate giữ objectives/source IDs khi quota ít. Cache explanation approved theo contentVersion/locale/mode, không personalized cache xuyên owner. Context caching/cloud file search/grounding/extra tool không mặc định bật vì có thể paid hoặc không Free; không phụ thuộc cache discount. Không gửi identity/actual contact/private memory vào Unpaid Services.  
Hard service budget0; tutor personal default max20 calls/ngày và throttle1 request/5s \[D\], đồng thời≤free RPM/TPM/RPD thực tại project; chưa hardcode provider quota chung. DB atomic reserve request/token units rồi settle actualusage; capped input/output và tối đa1 repair retry; 429/unknown quota/quota0→disabled/reset time nếu provider có, approved fallback. Circuit breaker3fails/5min→10min pause. Free account/model verified allowlist; paid routes/billing-enabled configs blocked bằng deployment checks và owner attestation, không ledger dollar cap5 USD. Không hứa free unlimited/forever; account terms cần kiểm lại trước enable.

## 7.4. Evals và rollout

Golden eval suite 120 cases tự tác giả/licensed: 30 grammar/meaning, 25 pronunciation/pinyin explanation, 25 Socratic hints, 20 level-bounded roleplays, 10 unknown/misleading requests, 10 privacy/prompt injection. Human rubric 0–2 mỗi tiêu chí correctness, pedagogical usefulness, Vietnamese clarity, level fit, groundedness. Critical cases 0 error, tổng ≥90% cases đạt ≥8/10; schema ≥99%; correct source references ≥98%; unmet threshold tắt mode, không hạ tiêu chuẩn để bật.  
Chạy 3 lần/case với pinned model/prompt/schema; báo mean \+ worst và consistency, không chỉ một lần đẹp. Dùng deterministic validators và human review critical outputs; LLM judge chỉ phụ trợ có agreement sample, không làm sole gate. Evaluate timeout/429/refusal/invalid JSON/unsupported schema/fake source/user override request. Small 20-case offline mock suite CI mỗi PR; full live eval trước đổi model/prompt và trước release có budget gate. Provider change cập nhật ADR/source/cost và giữ output version.

## 7.5. Speech system

TTS foundation: audio miễn phí có giấy phép và quality review; nếu chưa có native-speaker review hợp lệ thì pronunciation foundation chưa đủ gate, không thuê/mua audio. Browser speechSynthesis với giọng zh-CN khả dụng, user nghe trước để chọn; voice local/network availability tùy OS/browser, không hứa offline; downloaded approved recordings mới là offline reference. Giọng synthetic có nhãn, không là ground-truth tone. Normal/slow playback có nhãn, hash/locale/text/voice/rights version lưu. Không Azure TTS; Gemini TTS free preview chỉ candidate tùy chọn sau verified rights/privacy/quota, không dependency P0/P1.  
STT P1: record≤30s → playback local → so với mẫu → user tự sửa typed transcript; browser SpeechRecognition nếu hỗ trợ zh-CN và user consent (có thể dùng remote browser service, availability/offline không guaranteed \[S25\]), không cần paid API key. P2 whisper.cpp local Windows model nhỏ đa ngôn ngữ khi license/memory/latency đạt benchmark, user bật, PC phải online để phone dùng service local; không ép cài local AI hay GPU. MIME detect WebM/MP4, local playback không cloud transcode/upload. Server STT adapter mặc định disabled; nói tự kiểm/typing không được đánh mastery nói/tone tự động.  
Pronunciation assessment P2/free-only: hiện chưa chọn được dịch vụ miễn phí bền vững và validated để chấm tone zh-CN, nên deferred; Azure paid capability ở S09 chỉ reference lịch sử, không implementation default. Free/local candidate sau này cần ≥100 clips/≥5 speakers và human double rating tình nguyện/rights/consent, noise/abstention và thresholds giữ. Không đủ free reviewer/data/capability thì report unavailable và record/playback, không buy API hoặc tự lấy pitch/STT làm điểm chuẩn. Tone/prosody chỉ hiển thị nếu dimension đo được/validated; cơ chế này không prerequisite để cá nhân học HSK1–4.  
Voice conversation P2/free-only: record/browser STT optional hoặc type→user confirm→Gemini Free text→browser TTS; tất cả quota/consent/eval gate. Không realtime/full-duplex trả phí, không cloud raw-audio archive mặc định. Browser unsupported/networkfail/quota exhausted có typed+approved-content fallback. Local recordings private và user xóa; nếu sau này owner opt-in backup raw audio vào Free storage thì TTL7days/sizecap/consent. Tutor turns≤30days; không audio/transcript logs hoặc cross-owner cache.

# 8\. UX/UI Specification {#8.-ux/ui-specification}

## 8.1. Sitemap và navigation

Public: /login, /reset-password, /privacy. Authenticated: /today (default), /learn (curriculum), /learn/:lessonVersionId (player), /reviews, /practice (skills), /tutor, /assessments, /progress, /downloads, /settings, /settings/memory, /settings/data. Admin content review chỉ P1 và role riêng. Mobile bottom nav 4 items Hôm nay/Học/Ôn/Tiến độ; tutor là action trong bài và practice, settings/avatar; không 7 tabs gây quá tải. Desktop sidebar cùng taxonomy, không đổi model khi mở Windows.

## 8.2. Mô tả màn hình và states

Onboarding: target HSK4, starting level0; chọn 3/6/9/12 giờ mỗi tuần hoặc nhập tùy ý; tùy chọn ngày rảnh và thời lượng tối đa mỗi ngày/buổi. Nếu không chọn ngày, mặc định đề xuất 6 ngày/tuần với cap ngày 90 phút và block 10–25 phút, cho sửa trước áp dụng. Preview tuần gồm tổng giờ/giờ dự phòng, ôn/bài mới/kỹ năng và ngày nghỉ; nếu quỹ giờ vượt khả năng lịch rảnh thì giải thích capacity và đề xuất sửa, không âm thầm tăng ngày/cap hoặc đổi giờ. Privacy consent tách mic/AI/storage; có skip diagnostic. Hôm nay có CTA “Bắt đầu 15 phút”, việc tiếp theo, quỹ giờ còn lại và lý do; settings mở preview/replan. Offline chỉ dùng snapshot có timestamp.  
Curriculum: level → unit → lesson, locked/unlocked/practicing/secure state \+ vì sao khóa; coverage học và kiểm chứng tách. Player: progress nhỏ, 1 mục tiêu/lần, hanzi lớn 24–32px, pinyin ruby 14–16px bật/tắt, nghĩa Việt, play normal/slow, replay; footer sticky thao tác tiếp, không auto-play chưa tương tác. Pause/close resume currentStep; xem transcript trước listening answer có nhãn assisted. Bài sai: đúng/sai \+ explanation \+ thử item mới, không chỉ màu.  
Review: prompt trước, reveal sau, 4 ratings với diễn giải và interval tạm tính; audio không autoplay hỗn loạn; footer thumb zone, undo chỉ command đảo cuối cùng nếu chưa event tiếp theo (P2, không P0). Empty queue đưa next lesson; overload đưa phiên 10 phút. Progress: theo skill, secure objectives, delayed probes, recent errors, evidence count và last assessed; không “level 80%” vô nghĩa.  
Tutor panel: chọn explain/hint/correct/roleplay với mục tiêu, text input, quota state, source links, report wrong, memory notice; không mở chat vô hạn làm màn chính. Speaking: mic permission just-in-time, record timer, play own/sample, consent trước gửi, transcript edit, quality warning; denied/no mic chuyển text/shadowing. Writing: stroke demonstration, tracing, hide mẫu rồi recall; touch canvas không khóa scroll toàn trang.  
Assessment: title \+ đúng version \+ thời lượng \+ skill \+ nội bộ/chính thức-format label; readiness gaps trước bắt đầu; timer server, autosave states, confirm submit; report giải thích giới hạn grading. Downloads: package size, assets ready/incomplete, delete/LRU pin, pending events count. Sync conflict: “kết quả giữ trên máy nhưng chưa áp dụng lịch ôn”, xem loại conflict/làm lại; không nút “đồng bộ thành công” khi partial.

## 8.3. User flows và accessibility

Flow A online: login → onboarding weekly budget → preview khả thi → áp dụng → today → F01 → answer → feedback → complete → reviews → next planned block/eligible lesson. Flow B interrupted: player step3 → close/crash → resume, duplicate retry không score/thời gian hai lần. Flow C offline: download \+ lease \+ weekly snapshot → học/review → pending → reconnect ack/conflict; không thay weekly settings offline. Flow D tutor down: fallback approved explanation → học tiếp. Flow E missed/reduced budget: bỏ lỡ buổi hoặc giảm giờ → review chưa xong được ưu tiên trong slots còn lại, phần vượt capacity thành backlog/forecast kéo dài, không dồn bù quá cap.  
Design tokens \[D\]: spacing 4/8/12/16/24/32; radius 8/12; font body 16px/line 1,5; touch targets ≥44×44 CSS px; background neutral, primary indigo/blue, success/error có icon và text; contrast ≥4,5:1 body/3:1 large. Max content width mobile 100%, desktop reading 720px, dashboard 1.120px; mobile keyboard không che input/submit. Dark mode P2; light mode AA trước.  
Accessibility: keyboard/tab order/focus visible; screen-reader labels Việt \+ lang zh-Hans cho segments; ruby vẫn có text equivalent; audio transcript/subtitles sau answer; reduced motion; tone màu kèm số/dấu; không chỉ màu phân biệt mastery. Canvas luyện nét có alternative stroke-order steps/text và không bắt canvas để đi tiếp. Zoom 200%, width 320–360px không scroll ngang, timer polite announcements không mỗi giây. Screen reader/manual Android TalkBack và Windows NVDA là release evidence.

## 8.4. Design validation

Paper/low-fidelity flow trước UI: người mới tự tìm học tiếp trong ≤10s, chấm/review hiểu ratings, pending sync hiểu. Pilot 1 user đủ kiểm usability cá nhân, không suy rộng; nhiều users cần ≥5 người mới và telemetry consent. Các states loading/empty/error/offline/permission-denied/quota/conflict phải có component spec và E2E, không chỉ happy path.

# 9\. Content & Data Strategy {#9.-content-&-data-strategy}

## 9.1. Source register và quyền sử dụng

S01 PDF đề cương thi CTI 2025-11 là chuẩn scope/coverage, không coi public download là license dataset hay license audio. S02 website CTI tổng quan; S03 Bộ Giáo dục Trung Quốc GF0025-2021 làm background/framework, không nhầm exam syllabus. Giáo trình, ví dụ Việt, dialogues và exercises tự tác giả với review; quyền sở hữu rõ theo contributor agreement khi nhiều người. Official sample exams dùng tham chiếu format bằng link; chỉ tái phân phối khi có quyền rõ.  
Nguồn candidate chữ: Hanzi Writer code MIT, hanzi-writer-data có license riêng Arphic Public License \[S08\], phải giữ attribution/terms theo đúng file upstream; không kết luận toàn repo Make Me a Hanzi cùng license. Nguồn từ điển như CC-CEDICT là candidate cần đọc license đúng snapshot/ShareAlike obligations trước dùng; v1 mặc định gloss Việt original-reviewed, không phụ thuộc CC-CEDICT. IPA/minimal pair/audio/fonts/illustrations cũng cần source record; không scrape Hanzii và không tích hợp Hanzii trong scope.  
Commercial status unknown → không publish/redistribute; cá nhân vẫn tuân rights. Licensing review không thay legal opinion; task cụ thể là ghi terms/evidence/attribution và chọn nội dung original nếu không chắc. Không giữ full protected source trong git hoặc package vì “để AI đọc”; model-generated draft không tự có provenance verified và vẫn cần kiểm tra.

## 9.2. Pipeline từ nguồn đến release

Bước 1 register source/version/url/access date/checksum \+ license decision. Bước 2 authorized import/export hoặc manual mapping có source page/row; không unofficial API/scraping. Bước 3 normalize Unicode NFC, simplified/pinyin numeric+display, tone 5 neutral, ü canonical, sense IDs/POS, Chinese punctuation; preserve original source keys. Bước 4 validate duplicates, number ranges/levels, DAG, missing media/rubric/license. Bước 5 author original Vietnamese explanations/exercises/audio. Bước 6 subject review \+ answer/audio review. Bước 7 publish immutable manifest và coverage diff. Bước 8 feedback → quarantine → new version → regression checks.  
Import staging không ghi trực tiếp active tables; dry-run báo added/changed/removed/conflicts; merge trên stable\_key+sense/source\_version, không natural word string đơn lẻ. Reimport cùng snapshot idempotent. HSK count report đếm distinct official sequence IDs và separate senses; không tự ép dataset bằng sửa/lược mục để khớp 300/500/1000/2000. Diacritics/多音字/variant/level ngoặc phải manual review sample hoặc toàn bộ conflict. Automated count khớp là cần nhưng không đủ đúng.  
Quy trình review: draft→automated\_validated→language\_reviewed→answer\_reviewed→rights\_approved→published. Dùng competent reviewer tình nguyện/nguồn free đã reviewed nếu có; không thuê/mua dịch vụ nội dung. User chưa đủ chuyên môn thì giữ nội dung beta/chưa xác minh, không tự claim giáo trình chuẩn. AI chỉ draft/check; second review cho test keys/rubrics ưu tiên người competent không phí; thiếu review block chất lượng claim, không block biên soạn bản draft. Free-only không cho phép bỏ qua bản quyền hay correctness.  
Quality checklist lesson: objective rõ; scope mới nhỏ; prerequisite đủ; câu tự nhiên; pinyin/tone/gloss khớp; audio đúng text/tone/speed; grammar examples đúng level; accepted variants đầy đủ; distractor không ambiguous; explanations Việt dễ hiểu; accessibility equivalent; content license known. Character decomposition semantic/phonetic hiện đại tách etymology; mnemonic đánh nhãn “mẹo nhớ”. Pinyin sandhi có giải thích spoken form, không tự đổi canonical reading.

## 9.3. Versioning, coverage và correction policy

Code semver tách content release semver; syllabusVersion hsk-exam-2025-11 nguồn PDF hiện linked filename 1219, vì file tên có thể cập nhật, snapshot checksum/source access date là định danh chính xác hơn tháng. Chưa xác minh ngày revision nội bộ 1219, không gọi là một chuẩn mới khác chỉ từ filename. Manifest immutable gồm source hash, engine compatible range, exercise/normalizer versions. Package checksum invalid rollback last valid, không dùng nội dung nửa bản.  
Coverage matrix theo level × task/topic/concept × skill × lesson × assessment có 4 states unmapped/taught/practiced/verified\_assessed và source locator. “100% vocab” không bằng “100% curriculum”. Mỗi release có gaps list; đóng HSK 1 trước authoring HSK 2 full. Nếu lỗi answer key đã publish: retire item, flag historical attempts affected, publish corrected version, gửi in-app correction; regrade deterministic bằng migration có preview/audit, giữ score original và corrected, không xóa review logs.  
License revocation: deactivate impacted package online, không xóa dữ liệu evidence cá nhân; offline package flagged ở next sync, khuyến nghị delete, enforce no new verified submissions. Giữ checksum/attribution metadata phục vụ audit, không tiếp tục distribute asset. Content export chỉ source licensed và own authored; user learning export không kèm protected answer corpus.

# 10\. Testing Strategy {#10.-testing-strategy}

## 10.1. Test pyramid và evidence

Unit Vitest: grading/DAG/mastery/weekly planner/FSRS/schema/zero-cost quotas. Integration real PostgreSQL local \+ Supabase Auth fixtures free: RLS/pool transactions/duplicate/stale/migrations/publish. Playwright mobile-sized Chromium/desktop: học/review/offline/resume/quota/media-denied. GitHub CI Linux standard runner trong free quota, heavyweight/device tests chạy local, không mock DB thay transaction tests. Free hosted cold starts/quota là operational states phải có UI; performance lab thresholds vẫn đo nhưng không mua capacity để đạt enterprise SLO.  
Golden grading matrix: NFC Chinese, leading/trailing spaces, accepted punctuation, ü/v convention chỉ pinyin-input mode, neutral tone, wrong tone, homograph wrong sense, fullwidth allowed only explicit rule, blank/null/oversized response. Mastery tests same-item repeat/assisted/AI source excluded, delayed probe and time boundaries, insufficient production unknown. FSRS use supplied fixed clock/config expected snapshots from trusted library version, not test duplicating custom algorithm.  
Security: user A attempts/session/card/memory/report/object không truy cập user B; forged userId ignored, expired/revoked JWT, pool A→B→unauthenticated leakage, RLS USING/WITH CHECK, unauthorized admin publish; exposed Data API blocked; XSS through lesson/tutor segments, CSRF, signed URL expires, secrets not in build/logs. Dependency audit và SAST patch critical/high reachable before release; document false positives evidence, không tự dismiss.  
Sync chaos tests: airplane mode, process close after enqueue, commit response lost, retry 3 lần, two tabs same device, secondary device takeover, expired lease, old engine/content, corrupt package, bad future clock, partial batch rejects, quota storage full. Expected invariant exactly one mutation/event, monotonic card version, outbox never dropped unacked, deterministic replay same order. Test on real Android once; emulation không chứng minh install/media behavior.  
Performance: 10 VUs/15 phút core via k6 hoặc equivalent, fixed dataset ≥1.000 cards/10.000 events synthetic; EXPLAIN due/progress queries; mobile network throttle defined 4× CPU and Slow 4G lab, report p95 server and lab vs field distinction. Audio download memory, long list virtualized khi \>200 rows. Không optimize mọi module khi chưa đo. Large corpus import dry-run memory/time bounded and restart safe.

## 10.2. AI, speech và content verification

AI mock failures CI; live eval suite mục 7, versioned cases/human scores, rerun only model/prompt/contract changes hoặc release relevant. Speech benchmark silent/clip/noise, wrong tone/right transcript, Vietnamese accent, gender/device variation; provider fail không mark mastery. Character stroke practice tolerances test trên touch và mouse, gọi là feedback nét thay vì handwriting recognition.  
Content automated validations \+ qualified reviewer; golden lesson assets hash/transcript alignment; unit/mocks accepted-set correctness và no answer leak. End-to-end acceptance một user học L001, recall delayed sau ít nhất 48h và làm L002; automated fake clock chỉ kiểm rule, pilot elapsed real time kiểm hiệu quả. Claim pedagogical improvement chỉ từ pilot, không suy từ passing tests.

## 10.3. Definition of Done chung và release gates

DoD chung cho mọi atomic task: deliverable đúng scope; acceptance/tests riêng có evidence; lint/typecheck/build và targeted regression pass khi có code; không secret/cross-user leakage; migrations nếu có test fresh/upgrade; docs/API/type contracts cập nhật; dependency IDs done; SSOT task status có ngày/evidence và quyết định phát sinh; không blocker severity critical/high unresolved. Task planning/research không chạy test code vô nghĩa: thay bằng evidence/source/readback. Bất kỳ ngoại lệ phải ghi lý do/risk/release gate trong SSOT.  
Không task nào done chỉ vì Codex mô tả đã viết. E2E fixtures tự tác giả tránh quyền nguồn. Minimum domain branch coverage 80% ở grading/mastery/sync commands và explicit edge case list; coverage số không thay quality. Phần UI thay đổi nhỏ không viết snapshot tests chỉ mirror markup. Accessibility và device UAT có kiểm chứng người dùng, không chỉ static lint.

## 10.4. Deployment & Operations

v0.1 Deployment: một free host được T069 chọn \+ một Supabase Free project prod; local dev/testing, không yêu cầu hệ staging cloud độc lập. Build commit SHA/lockfile; Vercel native hoặc Render Node/Docker theo evidence, không thiết kế hai production pipelines. GitHub Free standard Ubuntu chạy lint/types/unit+targeted DB/RLS và build; smoke E2E nhỏ local/pre-deploy. Checks xanh trước promote commit (manual miễn phí nếu auto gating free không đủ). Secrets server-only, OWNER\_USER\_ID, signup off. CI hết quota: same local checks+evidence→manual free deploy; không mua minutes.  
v0.1 Operations tối thiểu: runtime role khác migration credential; idempotency/transaction rollback/RLS/pool leakage tests; lỗi ghi có requestId/ack rõ; health+free logs và quota state. Backup/export DB+media cơ bản trước mutation schema/destructive changes; một thử đọc/khôi phục snapshot slice local để biết dữ liệu có thể lấy lại, không phải hệ backup automation/retention/monitoring enterprise. T053 giới hạn phần này. T070(P1-v0.3) mới tăng scheduled backups/retention/restore drills/deletion tombstones/alerts; không để ops đầy đủ chặn buổi học đầu.  
Backup scope v1.1: manual encrypted pg\_dump/schema+learning snapshot+media manifest trên disk hiện có, timestamp và recovery runbook; no paid backup/PITR. Trước migration destructive có snapshot, check một restore/readback nhỏ ở T053; giữ metadata content/version để khớp cards/attempts. T070 mở rộng cadence/retention/automatic validation/storage-copy/deletion reapply và measured RPO/RTO ở v0.3. Không hứa24h RPO khi PC tắt; chưa T070 thì checklist ghi manual/cadence thực. Mất mạng/cloud pause ở v0.1 cần reconnect để ghi; chỉ từ v0.3 mới có durable downloaded/outbox/lease recovery.  
Cost policy: fees0 trên mọi stage; capacity register ghi tier/no-billing evidence/quota/usage/reset/what stops/backup path. Alerts50/80% usage, near limit giảm tải/disable AI, không auto paid fallback. Vercel/Supabase/GitHub/Gemini free-tier ceilings kiểm lại ở T068 và trước deploy. Core corpus/media compact, cache packages/audio, raw recordingslocal, build cache/short artifacts/cancel obsolete CI, eval batches qua nhiều ngày. Database/storage nearing full → local export/prune telemetry an toàn trước outbox/log evidence; không xóa dữ liệu học chưa backup. Trial/studentpromo/gift credits/paidallowance không là dependency của bản0-phí.  
Scale gates hiện deferred: app cho đúng owner, không mục tiêu100DAU/multi-instance workers. Thấy chậm thì profile/query/index/cache và client package trước; job lâu chạy trên Windows hiện có. Không thuê worker/VPS/Redis/upgrade/cloud GPU. T062 multi-user pilot và T063 hosting scale parked, cần yêu cầu scope mới của user và vẫn free-only cho đến khi user chủ động thay constraint. user\_id/schema/API boundaries giữ khả năng mở rộng, không build management/team features bây giờ.

# 11\. Implementation Roadmap {#11.-implementation-roadmap}

## 11.1. Phạm vi giao code và release sequence v1.1

PH0 decisions/rights/free audit: T001–T005,T068; PH1 scaffold/auth/DB proof: T006–T012,T069 benchmark host. PH2/M0 v0.1 online: T013–T026,T064–T067,T052–T053. Chính xác34 Task IDs là M0 activation set ở12.6; task families vẫn chia bài/batch nhỏ. Không gọi toàn backlog là MVP. T069 host-specific proof sau scaffold/RLS/auth, trước final lock ADR006/T053. T009 feasibility trước user-data APIs; giữ least privilege/RLS, không service\_role fast path.  
PH3/M1 v0.2: T032–T039,T041–T045,T061 → foundation F01–F05, HSK1 curriculum có coverage+review, luyện viết, tutor explain/correct/text roleplay/memory/consent/evals, unit diagnostic và pilot. Corpus authoring không chờ tutor để publish; M1 release mới cần evaluation/provider flags rõ. Không T027–031/T040 prerequisite. Tutor quota0 không chặn các chức năng core, không hạ chuẩn đáp án/eval.  
PH4/M2 v0.3: T027–T031,T040,T070 → PWA install/download/offline/outbox/lease/conflicts, record/playback; STT nếu actual free capability phù hợp, thiếu thì self-record+typed fallback. Multi-device scheduling contract giữ ở ADR004/4.4 và chỉ triển khai lúc này, không tự mở đồng bộ ghi đồng thời nhiều thiết bị hơn spec. T059 voice tutor P2 optional; T057/T058 pronunciation scoring deferred đến có validated free evidence.  
PH5/M3 v0.4: T046–T048 HSK2; PH6/M4 v0.5: T049–T051 HSK3; PH7/M5 v1.0: T054–T056 HSK4. HSK1 quality gate trước full levels cao; mapping/authoring sau M1 có thể chuẩn bị song song với offline, release HSK2 sau M2 theo T048. Official-format exam/readiness cần verified blueprint/rights, thiếu thì internal practice labels. T060 optimizer P2; T062–T063 multi-user/hosting-scale ngoài current personal scope.

## 11.2. Dependencies và work lanes

M0 critical path rút gọn: T001→T002/T068→T003→T006→T007/T008→T009→T010/T011→core grade/evidence/review→weekly planner→T026→T052→T053. T069 chạy sau T006/T009/T010/T011/T068, cần hoàn tất trước T053. Exact dependencies nằm ở mỗi task; parser audit M0 transitive closure không chứa T027–031/T040 hoặc tasks M1+.  
Song song khi contracts freeze: T007/T008 migration ownership phối hợp; content T014/T016 với UI T012/T017; pure T019/mastery và T022/FSRS; T069 host benchmark với content/UI online nếu không đổi DB contract. Tuần tự: role/RLS proof trước core data commands; reviewed keys trước grading; FSRS tx trước scheduling; HSK1 pilot trước higher-level full corpus; model eval trước tutor modes enable. Không parallel edits cùng migration/contract mà thiếu owner/merge review.

## 11.3. Milestones, estimates và release gates

M0 chạy thử: user mở online Android/Windows, chọn quỹ giờ, F01/F02/L001/L002, nghe/làm bài/chấm, đóng-mở lại vẫn đúng attempts/progress/cards, ôn FSRS/next action và basic free deploy. Không cần app install, offline, microphone, AI hoặc enterprise monitoring. Release safety giữ idempotency/auth/RLS/transaction/keys/license/basic CI và snapshot trước migrations; test mobile/desktop online thực.  
M1: complete reviewed HSK1 \+ learning pilot và tutor text evaluated/free privacy; M2: offline/sync chaos/device UAT \+ recordings/free STT capability và ops T070; M3/M4/M5: từng level coverage/holdout/skill grading/evidence và regression suite theo scope. Không mark bộ từ vựng/migrations hoàn thành như toàn khóa học hoàn thành; từng published lesson có reviewers/rights/answer/audio evidence.  
Ước lượng \[A\] sau đo throughput: PH0–PH1 khoảng3–7 ngày; PH2 khoảng1–2 tuần; PH3 khoảng3–6 tuần do content/review; PH4 khoảng1–2 tuần; HSK2/3/4 authoring cần estimate theo actual lesson throughput. Không deadline/cam kết, lịch build khác lịch học6–8 tháng. Nếu task\>6h chia instance trước làm; tránh giải quyết thêm future schema/ops để 'xong cả spec' trong M0.  
Source precedence v1.1: activation/criteria ở2.3,11,12.6,14 quyết định release scope. Các thiết kế chi tiết offline/PWA/speech/ops trong4–10 là long-term specification, không đồng nghĩa P0-M0. Những ngưỡng an toàn/bản quyền/độ đúng/RLS/FSRS/mastery không được giảm khi thu scope.

# 12\. Atomic Task Backlog {#12.-atomic-task-backlog}

## 12.1. Cách đọc và giới hạn atomic task

Backlog v1.1 gồm70 Task IDs, giữ IDs cũ và thêm T069 hosting benchmark, T070 ops mở rộng. Task chưa làm pending; deferred theo labels. M0 chỉ active34 task entries/families trong12.6; mọi dependency phải nằm trong M0 closure. Phần còn lại là backlog dài hạn, không giao toàn bộ cho coding agent. Chi tiết architecture/data/curriculum/security giữ; phiên bản kích hoạt mục11/12.6/14 có ưu tiên hơn mô tả 'P0/offline' cũ trong các specifications future.  
Content tasks là family có bounded instances (mỗi bài tối đa 6 senses/8 items, audio/review tối đa 10 assets/batch). Mỗi instance được materialize trong SSOT trước triển khai với ID Txxx-Lnn hoặc Txxx-Bnn; kế thừa đầy đủ mục tiêu/module/bước/AC/tests/DoD của family, ghi chính xác lesson/content IDs, nguồn, reviewer, deps instance trước; gate family chỉ xong khi mọi required instance done. Các bài cao hơn chưa được bịa trước HSK1 pilot; manifest coverage quyết số instance. Đây là phân rã công việc bắt buộc, không cho Codex nhận 'xây toàn bộ HSK2' như một task.

## 12.2. PH0–PH3: nền tảng và vertical slice

### T001 — Handoff SSOT và decision register \[P0/PH0\]

Mục tiêu/phạm vi: Đóng gói brief triển khai trỏ đúng Doc này; không thiết kế mới.  
Module/file dự kiến: docs/implementation/brief.md; docs/implementation/status.md; AGENTS.md (tương lai). Phụ thuộc: Không.  
Bước triển khai: Đọc mục 1–4,10–15; ghi version/revision/source URL; liệt kê accepted/open gates; tạo task index có trạng thái pending.  
Acceptance criteria: SSOT v1.1 link/revision,7 ADR(status ADR006 pending benchmark), owner-only/fees0,70IDs và exact34 M0 active tasks; brief có defer list, không copy cả Doc vào AGENTS.  
Test cases: Đối chiếu task IDs/links; stale-revision scenario phát hiện; đọc brief trong phiên mới hiểu scope.  
Definition of Done: DoD chung \+ handoff ≤1.200 tokens, không mất ràng buộc; cập nhật Doc sau khi tạo khi được phép.  
Trạng thái T001: done — 13/10/2026 (Asia/Saigon). Evidence local tại workspace D:\\Chinese-Study-Hub: AGENTS.md; docs/implementation/brief.md; docs/implementation/status.md. Kiểm chứng: đọc SSOT v1.1 hiện tại; 7 ADR đúng trạng thái (hosting ADR-006 pending T069, content-versioning Accepted); M0 đúng 34 IDs, dependency closure trong M0; activation buckets bao phủ 70 IDs duy nhất, không thiếu/trùng; owner-only/phí một lần và định kỳ 0; tutor chữ v0.2, offline/sync/ghi âm v0.3; cache có URL/revision/thời điểm và quy tắc refresh khi revision đổi; luồng đọc AGENTS → brief → status rõ scope; không secrets/logs dài. Giới hạn: chưa đo chính xác tokens bằng tokenizer; không có code/app/runtime/device/cloud benchmark trong T001, các gate tương ứng vẫn pending/unverified. Next ready: T002 hoặc T004 (chỉ phụ thuộc T001); T068 cần thêm T002. Không bắt đầu task tiếp theo.

### T002 — Source và license register \[P0/PH0\]

Mục tiêu/phạm vi: Xác minh S01/S03 và một nguồn audio/chữ candidate; không import corpus.  
Module/file dự kiến: content/sources/register.json; docs/implementation/rights.md. Phụ thuộc: T001.  
Bước triển khai: Đọc nguồn primary; ghi source/version/date/locator; đọc đúng license snapshot; chọn original-reviewed nếu unknown; ghi attribution và reviewer gate.  
Acceptance criteria: Mọi candidate có allowed/restricted/unknown và evidence; unknown không thành published; tách code/data licenses.  
Test cases: Public PDF không license test; missing terms blocked; Hanzii không xuất hiện như API/source sao chép.  
Definition of Done: DoD chung \+ source table trong SSOT cập nhật, chưa hứa commercial rights.  
Trạng thái T002: done — 13/10/2026 (Asia/Saigon). Evidence tại D:\\Chinese-Study-Hub: content/sources/register.json (7 metadata records), docs/implementation/rights.md; docs/implementation/status.md cập nhật. Đã đối chiếu CTI overview/Legal Notice; PDF riêng S01-VOCAB bìa trang 1 ghi 2025-11 phát hành/2026-07 áp dụng, không thay exact S01 1219.pdf còn lỗi đọc trực tiếp. S03 tên/mã GF0025-2021, ngày thông báo 2021-03-31, hiệu lực 2021-07-01 và mục đích framework qua chỉ mục nguồn MOE; HTML/attachment đầy đủ và URL S03 thứ hai unverified. Không trộn framework với exam syllabus hoặc suy blueprint/counts. Audio Yoyo Chinese Pinyin Chart quảng bá Free nhưng quyền reuse app/PWA, attribution/derivatives/commercial và chất lượng chưa xác minh: reference-only/unknown. S08-code MIT; S08-data Arphic Public License riêng, allowed có điều kiện notices/derivatives, chưa pin/import/review/publish. JSON/metadata/unique IDs/evidence refs/URL syntax/unknown-rights gates/code-data license separation kiểm tra pass; checksum/reviewer approvals null, AGENTS.md và brief.md giữ nguyên SHA-256. Phí 0; không corpus/lessons/dependencies/accounts/resources/AI calls. T002 register complete; downstream gates T005 exact sources/blueprint, T014 mapping/provenance/rights, T016 original free audio \+ competent review, T068 actual eligibility/quota/no-billing vẫn pending. Next ready: T005 (T002), T068 (T001+T002), T004 (T001); chưa bắt đầu task khác. Chỉ thêm trạng thái T002, không sửa ADR/roadmap/release hoặc task khác.

### T003 — Contract freeze v1 \[P0/PH0\]

Mục tiêu/phạm vi: Freeze contracts cho M0 online và DB/security boundaries; future offline contracts tham chiếu, không triển khai.  
Module/file dự kiến: docs/implementation/contracts.md; src/shared/contracts (spec). Phụ thuộc: T001,T068.  
Bước triển khai: Chốt owner/IDs/content/grade/FSRS/weekly APIs/idempotency/errors; runtime role/tx claims prototype criteria trước learning endpoints. Hosting host-specific options pending T069; nếu role Free không chạy, sửa data-access ADR và test trước modules, tuyệt đối không service\_role bypass.  
Acceptance criteria: API mục 4 khớp entities mục 5; không đường cho client ghi score; runtime không BYPASSRLS.  
Test cases: Walkthrough attempt/review/conflict; forged owner và pool reuse được mô tả; chưa code cần không gọi provider.  
Definition of Done: DoD chung \+ nếu role không khả thi ghi ADR sửa trước T009.

### T004 — UX flow slice \[P0/PH0\]

Mục tiêu/phạm vi: Đặc tả wireframe/state bằng tài liệu, không yêu cầu Figma riêng.  
Module/file dự kiến: docs/implementation/ux-slice.md. Phụ thuộc: T001.  
Bước triển khai: Mô tả weekly budget/availability/preview và today/player/review/resume/conflict; tokens/a11y; rà 360px/keyboard; labels Việt.  
Acceptance criteria: Mỗi màn có loading/empty/error/offline; một CTA học tiếp; không action cần AI để qua bài.  
Test cases: Walkthrough người mới chọn next trong ≤10s; ratings hiểu; denied audio vẫn tiếp tục.  
Definition of Done: DoD chung \+ flow A–D trace được vào backlog.

### T005 — Exam version evidence gate \[P0/PH0\]

Mục tiêu/phạm vi: Đối chiếu đề cương và blueprint 11/2025; xác định phần chưa xác minh.  
Module/file dự kiến: content/sources/exam-register.json; docs/implementation/exam-gaps.md. Phụ thuộc: T002.  
Bước triển khai: Đọc PDF bìa/mục lục và official samples/thông báo; tách old page; ghi counts/duration/scoring có locators; thiếu thì state unverified.  
Acceptance criteria: hsk-exam-2025-11 khác gf0025-2021; sample chưa đọc không bịa; official mock chưa bật nếu thiếu evidence.  
Test cases: Conflict 100-question old HSK4 không override new blueprint; source changed checksum flagged.  
Definition of Done: DoD chung \+ facts/open gates trong SSOT; unverified được chấp nhận cho slice.

### T006 — Project scaffold & CI baseline \[P0/PH1\]

Mục tiêu/phạm vi: Khởi tạo app tối thiểu khi bước sang triển khai; không học engine ở task này.  
Module/file dự kiến: package.json; lockfile; tsconfig; eslint; src/app; .github/workflows/check.yml. Phụ thuộc: T003,T004,T068.  
Bước triển khai: Supported OSS versions/strict TS/boundaries; env no-billing/free-only profile; GitHub Ubuntu standard CI cap/cancel/artifact TTL; local commands parity; không dùng premium registry/build tool.  
Acceptance criteria: Build sạch, module imports đúng, env missing báo rõ không in secret; lockfile duy nhất.  
Test cases: CI wrong import/invalid env fail; clean checkout build; landing smoke.  
Definition of Done: DoD chung \+ pin versions/runtime và README setup, không credential plaintext.

### T007 — Content schema migration \[P0/PH1\]

Mục tiêu/phạm vi: M0 migration subset cho source/license/syllabus/release/concepts, F01–F02/L001–L002 lesson/exercise/answer/media chains. Không migrate toàn bộ long-term catalog ở mục5 ngay.  
Module/file dự kiến: supabase/migrations/\*\_content.sql; src/shared/db/types.ts. Phụ thuộc: T006,T002.  
Bước triển khai: Chỉ tables/columns/FKs/index cần phục vụ slice; frozen schema design mục5 giữ; full course/topic/grammar/character catalog khi T043/T032 cần. Private answer keys/published read/immutability/source review vẫn bắt buộc. Sinh types từ schema thực; no artificial dummy tables để đủ toàn spec.  
Acceptance criteria: Fresh DB có chain version immutable và source refs; FK/unique đúng; runtime chưa đọc keys tùy ý.  
Test cases: Duplicate stable version fail; invalid release refs fail; delete attempted version restrict.  
Definition of Done: DoD chung \+ fresh/upgrade/constraints/types subset evidence; T007 done nghĩa M0 baseline, không toàn database mục5 đã được xây.

### T008 — Learner/review schema migration \[P0/PH1\]

Mục tiêu/phạm vi: M0 owner/profile/session/attempt/events/mastery/card/log/idempotency schema; chưa device lease/outbox/tutor/exam/jobs/organization.  
Module/file dự kiến: supabase/migrations/\*\_learning.sql; src/shared/db/types.ts. Phụ thuộc: T006.  
Bước triển khai: Core learner/review tables \+ owner\_seq/composite FKs/ratings/scores/version/indexes; time planner extension T064. Device identity tối thiểu nếu time event cần; lease/sync\_events chỉ T029/v0.3.  
Acceptance criteria: Cross-owner session/card links bị DB reject; due index có; append-only evidence privileges.  
Test cases: A attempt→B session reject; rating0/5 reject; duplicate event/card template reject.  
Definition of Done: DoD chung \+ synthetic test fixtures và migration pass.

### T009 — RLS runtime role & scoped transaction \[P0/PH1\]

Mục tiêu/phạm vi: Áp RLS private schema, least privilege và context isolation.  
Module/file dự kiến: supabase/migrations/\*\_roles\_rls.sql; src/shared/db/transaction.ts; tests/security/rls. Phụ thuộc: T007,T008,T003.  
Bước triển khai: Tạo role không owner/BYPASSRLS; grants private; verify uid rồi SET LOCAL via set\_config; FORCE RLS; revoke exposed write; test pool reuse.  
Acceptance criteria: A/B/unauth không cross-read/write; claims clear after commit/rollback; runtime không tạo admin.  
Test cases: Pool A→B và failure→B; WITH CHECK spoof uid; exposed Data API blocked; admin credential không runtime.  
Definition of Done: DoD chung \+ P0 security gate evidence; không service\_role workaround.

### T010 — Owner-only auth & profile \[P0/PH1\]

Mục tiêu/phạm vi: Login/logout một owner, server-validated; reset qua admin runbook miễn phí, không email-service dependency.  
Module/file dự kiến: src/modules/auth/\*; src/app/(auth)/\*; /api/v1/me. Phụ thuộc: T009.  
Bước triển khai: Provision owner một lần qua dashboard/local admin; OWNER\_USER\_ID allowlist; Supabase SSR verify; signup/invites tắt; profile init/origin/CSRF; password-reset runbook không phí.  
Acceptance criteria: Owner vào today; ID khác dù valid JWT blocked; signup off; invalid401; timezone valid; logout clean; không SMTP/OTP trả phí.  
Test cases: Wrong password/admin reset/expired JWT/forged uid/non-owner valid JWT/two-account cache; no unexpected email/API charge.  
Definition of Done: DoD chung \+ cookie/config documented và secret scanning pass.

### T011 — API boundaries & idempotency primitive \[P0/PH1\]

Mục tiêu/phạm vi: Zod contracts, errors, requestId và idempotency repository.  
Module/file dự kiến: src/shared/contracts; src/shared/errors; src/modules/operations/idempotency. Phụ thuộc: T009,T010.  
Bước triển khai: Validate request/error schema; payload hash; unique scoped key; response store trong command transaction; throttle primitive.  
Acceptance criteria: Cùng key/payload trả outcome cũ; key khác payload409; lỗi không stack/secret; endpoint owner authenticated.  
Test cases: Concurrent same key; crash-after-commit retry; malformed/large body422; wrong origin blocked.  
Definition of Done: DoD chung \+ API tests và contracts match mục4.

### T012 — UI shell & accessible components \[P0/PH1\]

Mục tiêu/phạm vi: Today layout/nav/player controls chưa chứa logic học.  
Module/file dự kiến: src/components; src/app/(study)/layout.tsx; theme tokens. Phụ thuộc: T006,T004.  
Bước triển khai: Tokens/Radix; mobile bottom nav/desktop sidebar; error/pending primitives; lang/ruby/audio controls.  
Acceptance criteria: 360px/200% zoom không horizontal overflow; 44px targets; keyboard visible focus.  
Test cases: Axe critical0, tab order, empty/loading/error, mobile keyboard sticky CTA.  
Definition of Done: DoD chung \+ manual focus/contrast evidence.

### T013 — Lesson/exercise package validators \[P0/PH2\]

Mục tiêu/phạm vi: Schema v1 và DAG/reference/license validators.  
Module/file dự kiến: src/modules/content/domain; src/modules/curriculum/domain; tests/unit/content. Phụ thuộc: T007,T003.  
Bước triển khai: Zod manifest/lesson/exercise schemas; allowed types; references/versions; DAG; media hashes; publish readiness report.  
Acceptance criteria: Invalid/missing refs/license/DAG bị chặn; public projection không private rubric secure item.  
Test cases: Cycle/self-edge, unknown concept, missing media/answer review, stale content hash.  
Definition of Done: DoD chung \+ valid synthetic package fixture dùng được cho API.

### T014 — HSK source mapping proof \[P0/PH2\]

Mục tiêu/phạm vi: Import dry-run một bounded mẫu ≤50 official entries, không toàn kho.  
Module/file dự kiến: content/staging/hsk-2025-11; src/modules/content/infrastructure/import. Phụ thuộc: T002,T005,T013.  
Bước triển khai: Authorized/manual mapping có locators; NFC/pinyin/sense normalization; diff+duplicate report; dry-run không publish.  
Acceptance criteria: Entry giữ official sequence/version/sense; reimport cùng snapshot no-op; count tách từ/senses.  
Test cases: Polyphonic/level-parentheses, ü/neutral tone, duplicate word different sense, checksum drift.  
Definition of Done: DoD chung \+ mapping review và source report trong SSOT.

### T015 — Session command & content read API \[P0/PH2\]

Mục tiêu/phạm vi: Mở/resume/complete session và serve published public payload.  
Module/file dự kiến: src/modules/learning/application/session; src/modules/content/repository; api lessons/sessions. Phụ thuộc: T011,T013.  
Bước triển khai: Create session bằng content version; ownership; resume currentStep; complete state guard; expose only published.  
Acceptance criteria: Draft không truy cập learner; keys không leak; resume same session; invalid completion blocked.  
Test cases: B user session404; stale/retired content; complete duplicate; draft lesson404.  
Definition of Done: DoD chung \+ integration contract evidence.

### T016 — Author slice F01–F02/L001/L002 \[P0/PH2\]

Mục tiêu/phạm vi: Task family: mỗi instance chỉ 1 micro-lesson ≤6 senses, ≤8 items.  
Module/file dự kiến: content/staging/slice/\<lesson-key\>; content\_reviews; media sources. Phụ thuộc: T014,T013.  
Bước triển khai: Instance T016-F01/F02/L001/L002: scope/references explicit; original Vietnamese draft/audio; language/answer/rights review; publish via validator.  
Acceptance criteria: Mỗi bài có objective, prerequisite, approved audio/key/provenance; L001→L002 path đầy đủ.  
Test cases: Peer review pinyin/tone/gloss; audio match; ambiguous item reject; no source copying.  
Definition of Done: DoD chung \+ tất cả 4 instances approved; family gate xong khi 4 done.

### T017 — Lesson player rendering \[P0/PH2\]

Mục tiêu/phạm vi: Render schema content, audio/transcript/controls và resume UI.  
Module/file dự kiến: src/modules/learning/ui/player; src/app/(study)/learn/\[id\]. Phụ thuộc: T012,T013,T015,T016.  
Bước triển khai: Render allowed blocks; one exercise view; transcript assisted flag; local draft/currentStep; fetch error state.  
Acceptance criteria: F01/L001 học được mobile; paused step resume; no autoplay violation; transcript access ghi assistance.  
Test cases: No audio, wrong package version, keyboard input, refresh midway, XSS payload sanitized.  
Definition of Done: DoD chung \+ Playwright player smoke.

### T018 — Deterministic grading v1 \[P0/PH2\]

Mục tiêu/phạm vi: Chấm chọn/sắp xếp/nhập ngắn/listening từ reviewed keys.  
Module/file dự kiến: src/modules/assessment/domain/grading; normalizers; tests/unit/grading. Phụ thuộc: T013,T016.  
Bước triển khai: Type-specific normalization; accepted alternatives; answer explanation; score0..1; hint/reveal flags.  
Acceptance criteria: Wrong tone/sense không normalize thành đúng; no LLM call; key version pinned.  
Test cases: NFC/blank/punctuation/ü/wrong tone/word order/accepted set matrix; invalid type rejected.  
Definition of Done: DoD chung \+ all golden cases pass, documented normalization version.

### T019 — Mastery projection rules v1 \[P0/PH2\]

Mục tiêu/phạm vi: Pure evidence eligibility/status transitions mục6.  
Module/file dự kiến: src/modules/learning/domain/mastery; tests/unit/mastery. Phụ thuộc: T018,T008.  
Bước triển khai: Concept×skill updates; independent filter; ≥5 independent attempts/≥3 distinct items/≥2 ngày/delayed thresholds; stale flag; engine version.  
Acceptance criteria: Assisted/AI/self thẻ không secure; skills independent; deterministic replay.  
Test cases: Same item twice/hint/retry excluded; 48h boundary; 3 errors needs\_review; speaking unknown.  
Definition of Done: DoD chung \+ golden transition tables và config version.

### T020 — Persist attempt atomically \[P0/PH2\]

Mục tiêu/phạm vi: Command grade→attempt/event/mastery/cards candidates trong một transaction.  
Module/file dự kiến: src/modules/learning/application/submit-attempt; api sessions/\[id\]/attempts. Phụ thuộc: T015,T018,T019,T011.  
Bước triển khai: Lock session; validate exercise membership; grade server; insert evidence/projections; idempotency; completion update.  
Acceptance criteria: Commit hoặc rollback toàn bộ; forged score ignored; duplicate exactly once; returned feedback có correct version.  
Test cases: Failure after attempt insert rolls back projection; concurrent duplicate; cross-user/item session reject.  
Definition of Done: DoD chung \+ integration rollback/concurrency evidence.

### T021 — Feedback & lesson completion UX \[P0/PH2\]

Mục tiêu/phạm vi: Nối player đến submit command, feedback và nextAction placeholder.  
Module/file dự kiến: src/modules/learning/ui/feedback; src/app/(study)/learn/\[id\]. Phụ thuộc: T017,T020.  
Bước triển khai: Pending states; disabled double submit; feedback/hints; complete summary skills evidence; retry when safe.  
Acceptance criteria: Không hiện success trước ack; bài sai explanation rõ; offline state sẽ hookup PH3.  
Test cases: Response lost/retry; submit twice; 422/401; completion partial; screen reader feedback.  
Definition of Done: DoD chung \+ online learn→complete Playwright pass.

### T022 — FSRS adapter versioned \[P0/PH2\]

Mục tiêu/phạm vi: Wrapper ts-fsrs pure và golden fixtures.  
Module/file dự kiến: src/modules/review/domain/fsrs-adapter; tests/unit/fsrs. Phụ thuộc: T006,T008.  
Bước triển khai: Pin library; defaults/retention config; mapping ratings; new/learning/review/relearning transitions; fixed clock.  
Acceptance criteria: Card snapshot roundtrip không mất field; scheduler.next đúng supported version; no manual formula.  
Test cases: Again/Hard/Good/Easy; null lastReview; overdue; timezone; config change; supplied golden states.  
Definition of Done: DoD chung \+ adapter/type doc và tests locked version.

### T023 — Cards & review transaction \[P0/PH2\]

Mục tiêu/phạm vi: Tạo limited templates/cards, due query và review mutation.  
Module/file dự kiến: src/modules/review/application; api reviews; repositories. Phụ thuộc: T020,T022,T011.  
Bước triển khai: Eligible card creation UNIQUE; max new cap; due query; lock card/version; append log+projection+idempotency response.  
Acceptance criteria: Exactly once review, stale409; before/after config persisted; ownership enforced.  
Test cases: Two concurrent ratings, duplicate retry, create sibling duplicate, rollback after log insert, due index plan.  
Definition of Done: DoD chung \+ integration/fresh migrations match FSRS.

### T024 — Daily planner v1 \[P0/PH2\]

Mục tiêu/phạm vi: Resume/overdue/remediation/next eligible deterministic plan.  
Module/file dự kiến: src/modules/learning/domain/planner; api today/progress. Phụ thuộc: T019,T023,T015,T065.  
Bước triển khai: Consume weekly plan blocks/budget còn lại; ưu tiên due reviews; prereq/card caps; stable tie-break; reason codes; asOf; no LLM; không tự tăng ngân sách.  
Acceptance criteria: Today không vượt cap ngày/quỹ tuần còn lại; nhiều ôn giảm new=0; L002 khi eligible; unknown skill không claim ready; closed/rest day không tự thêm lesson.  
Test cases: No data→F01, overdue storm, locked prerequisite, budget spent/paused/rest day, stale plan, AI disabled same plan.  
Definition of Done: DoD chung \+ golden plan cases \+ API timings.

### T025 — Review & progress screens \[P0/PH2\]

Mục tiêu/phạm vi: Ratings/due/empty/overload và evidence dashboard.  
Module/file dự kiến: src/modules/review/ui; src/app/(study)/reviews; progress/today. Phụ thuộc: T012,T023,T024.  
Bước triển khai: Prompt/reveal/rating; display intervals; sibling bury UX; distinct secure/completed; one today CTA.  
Acceptance criteria: User hiểu Again/Hard; progress không gộp AI provisional; no due shows next lesson.  
Test cases: Double rating/version409/empty queue/audio fail; color-independent labels; keyboard controls.  
Definition of Done: DoD chung \+ review end-to-end and a11y pass.

### T026 — Online slice UAT gate \[P0/PH2\]

Mục tiêu/phạm vi: Kiểm toàn vòng học với 2 bài; chưa mở rộng corpus.  
Module/file dự kiến: tests/e2e/slice-online; docs/implementation/uat-M0-online. Phụ thuộc: T021,T025,T016,T067.  
Bước triển khai: Fresh user chọn 3/6/9h tuần và preview; F01/F02/L001; attempts/cards/time usage; next block; simulated delayed rule; real usability walkthrough.  
Acceptance criteria: Learn→exercise→record→review→continue works, no critical issue; pilot feedback logged.  
Test cases: Crash/relogin, duplicate network response, userB isolation, next day due, no AI provider.  
Definition of Done: M0 online learning+weekly UAT evidence; không chờ PH4/offline. V0.1 không thể test durable offline vì chưa có tính năng này.

### T027 — Installable PWA shell \[P1/PH4 — v0.3\]

Mục tiêu/phạm vi: Manifest/SW static allowlist và update UX.  
Module/file dự kiến: src/app/manifest.ts; public/sw.js; icons; PWA components. Phụ thuộc: T026.  
Bước triển khai: Install metadata/icons; HTTPS; cache shell immutable; APIs network-only; update defer during lesson.  
Acceptance criteria: Android/Windows install; offline shell opens; auth/private endpoints not cached.  
Test cases: SW upgrade mid-session, offline reload, logout cached state not exposed, cache inspection.  
Definition of Done: DoD chung \+ real device install evidence, no broad catch-all cache.

### T028 — Offline lesson package storage \[P1/PH4 — v0.3\]

Mục tiêu/phạm vi: Versioned downloads và IndexedDB package install.  
Module/file dự kiến: src/modules/sync/infrastructure/idb; content package API; downloads UI. Phụ thuộc: T027,T013,T016.  
Bước triển khai: Dexie schema per uid; checksums/assets sizes; atomic complete; quota/LRU; local practice grade.  
Acceptance criteria: Downloaded slice ready all assets, corrupt/incomplete not ready, unacked outbox untouched.  
Test cases: Quota exceeded, download interrupted, wrong hash, account switch, missing audio, old schema migration.  
Definition of Done: DoD chung \+ ≤10MB sample and offline player practice.

### T029 — Active-device lease & outbox \[P1/PH4 — v0.3\]

Mục tiêu/phạm vi: Leases/events serialization, no FSRS multi-device merge.  
Module/file dự kiến: supabase/migrations/\*\_sync.sql; src/modules/sync/domain; api sync/lease. Phụ thuộc: T028,T011,T009.  
Bước triển khai: 72h lease/generation; explicit takeover; UUID event/clientSeq; FIFO durable enqueue; local preview version.  
Acceptance criteria: Secondary writes blocked during lease; unacked events durable; expired lease practice label.  
Test cases: Two tabs seq collision, device takeover offline stale lease, reload after enqueue, logout pending notice.  
Definition of Done: DoD chung \+ lease/outbox tests and user message clear.

### T030 — Sync server replay & reconciliation \[P1/PH4 — v0.3\]

Mục tiêu/phạm vi: Batch ack/duplicate/reject/conflict qua cùng commands.  
Module/file dự kiến: src/modules/sync/application; api sync/batch/state; conflict UI. Phụ thuộc: T029,T023,T020,T022.  
Bước triển khai: ≤100 events, per-owner ordering/locks; validate timestamps/content/base version; commands reuse; rebase confirmed projections.  
Acceptance criteria: Retry exactly once; stale/bad-clock events không mutate schedule; partial conflict giữ local.  
Test cases: Commit lost response, invalid future time, retired content, lease generation change, baseVersion mismatch.  
Definition of Done: DoD chung \+ rollback/chaos integration and informative UI.

### T031 — Offline chaos & recovery gate \[P1/PH4 — v0.3\]

Mục tiêu/phạm vi: Acceptance chạy device thực trước v0.1.  
Module/file dự kiến: tests/e2e/offline; tests/integration/sync-chaos; docs/implementation/offline-UAT. Phụ thuộc: T030,T027,T028.  
Bước triển khai: Airplane mode lesson+review; crash/reopen; reconnect foreground; account swap/update; compare DB invariants.  
Acceptance criteria: 0 lost/duplicate mutations toàn scenarios; pending/conflict truthful; core offline version matches.  
Test cases: Mục10 sync chaos; 3 retries lost response; takeover/storage full; weekly-plan snapshot/rest day; settings offline không sửa; late offline time intervals/duplicate overlap không double-count; reconnect replan khi budget giảm, không đổi mastery/FSRS vì calendar.  
Definition of Done: DoD chung \+ Android/Windows evidence, fixes traced task IDs.

## 12.3. PH4–PH8: HSK 1 chất lượng, HSK 2–4 và mở rộng

T061 thuộc P1/PH4, bắt buộc trước v0.2 và trước nhiều người dùng; thực hiện sau T036/T040/T041/T053, trước T045. P/phase là thứ tự ưu tiên mặc định, dependency/release gate là quyết định cuối. T052/T053 là P0 vận hành đặt cuối PH3 để v0.1 có điều kiện phát hành rõ. Content/AI failures tạo fix task riêng, không mark required checks done.

### T032 — Character/component data rights & adapter \[P1/PH3 — v0.2\]

Mục tiêu/phạm vi: Chỉ 10 chữ slice/batch; license/data separate.  
Module/file dự kiến: content/staging/characters; src/modules/content/character-loader. Phụ thuộc: T002,T026.  
Bước triển khai: Đọc Arphic terms đúng snapshot; lưu attribution; map glyph/readings/components; preload qua own package; fallback missing glyph.  
Acceptance criteria: 10 glyph có reviewed strokes/readings, no etymology invented, offline data license known.  
Test cases: Polyphonic/missing strokes/mnemonic label/attributions; loading failure fallback. Offline package integration kích hoạt T028/v0.3.  
Definition of Done: DoD chung \+ license evidence và 10-char golden set.

### T033 — Writing practice component \[P1/PH3 — v0.2\]

Mục tiêu/phạm vi: Animation/tracing/free-recall UI, không OCR general.  
Module/file dự kiến: src/modules/learning/ui/writing; character exercise type. Phụ thuộc: T032,T013,T019.  
Bước triển khai: Hanzi Writer adapter; touch/mouse; stroke order steps; hints/reveal labels; evidence source practice separate.  
Acceptance criteria: Tracing không secure handwriting; touch scroll không bị khóa; missing glyph có alternative.  
Test cases: Touch/mouse tolerance, redraw, hidden model, wrong order, keyboard/text alternative, offline.  
Definition of Done: DoD chung \+ Android/Windows canvas UAT và truthful progress.

### T034 — Foundation complete by lesson \[P1/PH3 — v0.2\]

Mục tiêu/phạm vi: Family T034-F03/F04/F05, mỗi instance 1 bài nhỏ.  
Module/file dự kiến: content/staging/foundation; tests/content/foundation. Phụ thuộc: T016,T026.  
Bước triển khai: Author original minimal pairs/sandhi/input/strokes; review audio/pinyin; approved prereqs; publish individually.  
Acceptance criteria: F01–F05 đủ mục6; sandhi tách canonical/spoken; assessed discrimination và ability evidence.  
Test cases: Wrong tone vs written pinyin; j/q/x/ü; 一/不/context; input mode; native-speaker audio review.  
Definition of Done: DoD chung \+ 3 required instances published with coverage.

### T035 — Tutor schemas & pedagogical state machine \[P1/PH3 — v0.2\]

Mục tiêu/phạm vi: Contract/state/retrieval allowlist, chưa live provider.  
Module/file dự kiến: src/modules/tutor/domain; src/shared/contracts/tutor. Phụ thuộc: T003,T019,T026.  
Bước triển khai: Zod/JSON schema; mode states; lookup published snippets via concept IDs; caps/sources; unknown handling.  
Acceptance criteria: Không function viết mastery/score; invalid source/concept rejected; bounded hints.  
Test cases: Fake source, arbitrary tool instructions, level overflow, unsupported schema field, lesson retired.  
Definition of Done: DoD chung \+ deterministic tutor validator tests, versioned prompts spec.

### T036 — Learner memory consent & CRUD \[P1/PH3 — v0.2\]

Mục tiêu/phạm vi: Evidence snapshot, explicit memory confirmation and deletion.  
Module/file dự kiến: supabase/migrations/\*\_tutor\_memory.sql; src/modules/tutor/memory; settings/memory. Phụ thuộc: T035,T009,T010.  
Bước triển khai: Tables/RLS/compact evidence; confirmed memory CRUD/TTL/export; private preferences ở DB, không gửi identity/sensitive memory lên Gemini Free; consent/data minimization.  
Acceptance criteria: Không lưu AI guess như fact; user B không read A; expired memory excluded; no sensitive auto memory.  
Test cases: Injection memory/useredit/delete/TTL, identity/contact string blocked from outbound prompt, non-owner access, consent withdrawn.  
Definition of Done: DoD chung \+ privacy UX and memory export contract.

### T037 — Gemini Free adapter & atomic quota \[P1/PH3 — v0.2\]

Mục tiêu/phạm vi: Tutor text Gemini API Free có schema/eval/consent, zero-fee/quota fallback; không OpenAI paid adapter.  
Module/file dự kiến: src/modules/tutor/infrastructure/gemini-free; operations quotas/ledger; migrations usage. Phụ thuộc: T035,T036,T011,T068.  
Bước triển khai: Verify actual account Free/no billing/allowedmodel; @google/genai schema; sanitize approved educational input; reserve/settle request/token units; timeout/429/circuit; paid providers disabled; no DBtx waiting.  
Acceptance criteria: service\_fee=0; paid-enabled account không được dùng; no key/quota0 graceful fallback; PII not outbound; API key server-only; concurrency cap enforced.  
Test cases: Paidconfig rejected; missing free eligibility/429/timeout/refusal/schemafail; quota reserve concurrency; fullcontext cap/PII block/consent disabled; no paid fallback endpoint.  
Definition of Done: DoD chung \+ free eligibility evidence/date/terms/privacy/quotas \+ mock tests; only no-billing free calls at authorized implementation, never top-up.

### T038 — Tutor UI integration \[P1/PH3 — v0.2\]

Mục tiêu/phạm vi: Explain/hint/correct/roleplay context, report errors.  
Module/file dự kiến: src/modules/tutor/ui; /tutor; lesson drawer; tutor API handlers. Phụ thuộc: T037,T012,T021.  
Bước triển khai: Structured render; sources/confidence limits; current task; user retry; quota banner; fallback approved text.  
Acceptance criteria: Tutor off never blocks learning; max segments/corrections; hints not answer dumping; no HTML rendering.  
Test cases: Quota exhausted/provider failed/user cancels/fake response/keyboard; report wrong pipeline.  
Definition of Done: DoD chung \+ tutor mock E2E/a11y, production flag remains off until T039.

### T039 — Tutor eval & enable gate \[P1/PH3 — v0.2\]

Mục tiêu/phạm vi: 120 versioned cases/human rubric, bounded eval batches ≤20.  
Module/file dự kiến: tests/evals/tutor; docs/implementation/tutor-eval; feature flags. Phụ thuộc: T038,T037,T002.  
Bước triển khai: Rights-safe120cases;3runs/case chia≤20cases/batch theo free quota/ngày; deterministic+competent volunteer critical review; model/prompt versions; fee0 report; localmock CI.  
Acceptance criteria: Thresholds mục7.4; critical0/schema≥99%; failing mode off; results include worst run.  
Test cases: Injection, fabricated grammar/source, tone explanation, unknown/refusal/semantic mistakes, cross-user leak.  
Definition of Done: DoD chung \+ free-tier eval evidence,0 fees, onlypassing modes enabled; quota insufficient kéo dài eval hoặc disabledmode, không mua lượt/công cụ/reviewer.

### T040 — Local recording & free speech practice \[P1/PH4\]

Mục tiêu/phạm vi: ≤30s input, typed fallback; no pronunciation score.  
Module/file dự kiến: src/modules/speech/\*; recording UI; local storage/cleanup; capability contract. Phụ thuộc: T031,T012,T068.  
Bước triển khai: MediaRecorder MIME detect; local record/playback; downloaded reference/browser TTS; optional browser zh-CN STT consent, typed corrections; no Azure API/no cloudtranscode.  
Acceptance criteria: No mic/voice/STT/network vẫn text/reference; no rawaudio uploaded mặc định; transcript not pronunciation mastery; no fees.  
Test cases: Android/Windows WebM/MP4 playback, silence/noise/permission/cancel, missing zh-CNvoice/STTunsupported/offline/privacy, local recordings cleanup.  
Definition of Done: DoD chung \+ real-device capability/free mode report; record/playback works, missingautomatic STT explicitly unavailable; no tone score.

### T041 — Assessment schema & internal blueprint \[P1/PH3 — v0.2\]

Mục tiêu/phạm vi: Tables/versioned unit blueprint/holdout selection.  
Module/file dự kiến: supabase/migrations/\*\_assessment.sql; src/modules/assessment/domain/blueprint. Phụ thuộc: T005,T018,T009,T026.  
Bước triển khai: Create owner/FKs/keys; original internal blueprint; held-out item refs; timer/scoring contracts; secure keys server only.  
Acceptance criteria: Unverified official blueprint hidden; unit held-out differs practice; attempt pins blueprint/rubric.  
Test cases: Wrong owner, version mix, duplicate item set, secure key leak, missing scoring fields.  
Definition of Done: DoD chung \+ RLS/migration and blueprint validator tests.

### T042 — Assessment session/report vertical slice \[P1/PH3 — v0.2\]

Mục tiêu/phạm vi: Một unit test đầy đủ autosave/timer/report, không full mocks.  
Module/file dự kiến: src/modules/assessment/application/ui; assessments routes/API. Phụ thuộc: T041,T019,T021.  
Bước triển khai: Start seeded selection; server deadline; autosave idempotent; deterministic grades; evidence/gaps report.  
Acceptance criteria: Refresh resume; timed no arbitrary pause; report shows internal/provisional labels and n.  
Test cases: Deadline/time spoof, network retry, partial submit, duplicate finalization, key leak, AI grading withheld.  
Definition of Done: DoD chung \+ timed session E2E và report contract consistent.

### T043 — HSK 1 coverage manifest \[P1/PH3 — v0.2\]

Mục tiêu/phạm vi: Full level1 mapping audit; no authoring entire course.  
Module/file dự kiến: content/staging/hsk1/manifest; coverage report; supabase/migrations/\*\_catalog\_extension.sql khi topics/tasks/grammar/characters thực sự cần. Phụ thuộc: T014,T034,T026.  
Bước triển khai: Authorized entries batches ≤50 (T043-Bnn); task/topic/grammar/character IDs; map objectives/skills; DAG; identify content gaps.  
Acceptance criteria: Official sequence counts reconciled; coverage states not inflated; next micro-lesson list exact IDs.  
Test cases: Count/sense mismatch, unmapped task, wrong standard list, multi-reading, DAG missing prereq.  
Definition of Done: DoD chung \+ all bounded mapping instances reviewed and gaps in SSOT.

### T044 — HSK 1 content release by micro-lesson \[P1/PH3 — v0.2\]

Mục tiêu/phạm vi: Family T044-Lnn/Ann: 1 lesson or ≤10 audio assets, not whole level/task.  
Module/file dự kiến: content/staging/hsk1; content\_reviews; published manifests. Phụ thuộc: T043,T042,T033,T002.  
Bước triển khai: Materialize lesson IDs/objectives; original author; language+key/audio+rights reviews; verify exercise types; publish bounded batches; coverage diff.  
Acceptance criteria: Mỗi lesson ≤6 senses/8items được reviewed; family gate complete HSK1 objectives after all required instances; no unknown rights.  
Test cases: Per-instance golden answers/audio match/accessibility; item alternatives; delayed-transfer item reviewed.  
Definition of Done: DoD chung \+ qualified review/versioned manifest/coverage; content xuất bản không phụ thuộc tutor provider/eval. Offline packaging sau v0.3; AI không auto publish.

### T045 — 14-day HSK1 pilot & M1 gate \[P1/PH3 — v0.2\]

Mục tiêu/phạm vi: Validate learning effectiveness/workload và make targeted fixes.  
Module/file dự kiến: docs/implementation/pilot-M1; analytics summaries; tests/e2e/regression. Phụ thuộc: T044,T039,T042,T052,T053,T061.  
Bước triển khai: Pilot sessions; real delayed 48h/7d probes; record confusion/workload/cost; adaptive rule diff; replay regressions.  
Acceptance criteria: ≥8 sessions \+ transfer evidence, no blocked daily flow; failed goals create fixes or shrink release claim; n=1 limitation explicit.  
Test cases: Delayed recall/new transfer; card load; online reconnect/retry; AI down/quota0; wrong source/schema; chưa offline sync/microphone requirement.  
Definition of Done: DoD chung \+ v0.2 decision with raw evidence references/privacy safe, not guaranteed HSK pass.

### T046 — HSK 2 mappings and prerequisite diff \[P1/PH5\]

Mục tiêu/phạm vi: Family bounded 50-source-entry audit batches; no full lessons.  
Module/file dự kiến: content/staging/hsk2/manifest; syllabus mappings. Phụ thuộc: T045,T005.  
Bước triển khai: Audit incremental level2/task/grammar/characters; prerequisite inherited level1; define micro-lesson slots; rights checks.  
Acceptance criteria: Separate cumulative/introduced counts; no hidden level1 gap; exact family IDs before authoring.  
Test cases: Sense level changes, missing prerequisites, count differences, no level1 content mutation.  
Definition of Done: DoD chung \+ all mapping instances reviewed and T047 instances enumerated.

### T047 — HSK 2 lesson/assessment author instances \[P1/PH5\]

Mục tiêu/phạm vi: 1 micro-lesson or 1 unit holdout ≤8items each child.  
Module/file dự kiến: content/staging/hsk2; media; answer keys/reviews. Phụ thuộc: T046,T044,T042.  
Bước triển khai: T047-Lnn/Unn: author task/senses/pattern; progressive pinyin; audio/answer reviews; publish/check coverage; retain package size.  
Acceptance criteria: Per-child quality checklist, complete syllabus coverage as family gate; no shadow writing-as-typing mastery.  
Test cases: New pattern accepted variants, audio normal/slow, holdout item no leakage, offline package validated.  
Definition of Done: DoD chung \+ each child tests/reviewer and coverage diff in SSOT.

### T048 — HSK 2 M2 gate \[P1/PH5\]

Mục tiêu/phạm vi: Learner diagnostics/retention/cost after approved content.  
Module/file dự kiến: docs/implementation/release-M3; tests/e2e/hsk2. Phụ thuộc: T047,T045,T031.  
Bước triển khai: Run unit forms, delayed tests, planner workload; inspect weak skills; full security/sync smoke; release notes gap labels.  
Acceptance criteria: HSK2 content taught/practiced/assessed trace; unknown production explicit; P0 invariants/SLO/cost pass.  
Test cases: New user catch-up/returning old version; delayed transfer; score provenance; disabled AI.  
Definition of Done: DoD chung \+ v0.4/M3 go/no-go evidence, HSK1 quality gate và v0.3 offline invariants trước release.

### T049 — HSK 3 blueprint & speaking/writing rubric \[P1/PH6\]

Mục tiêu/phạm vi: Verified exam format gate separate internal skills; author rubric small.  
Module/file dự kiến: content/sources/hsk3-blueprint; assessment rubrics; schema migrations if needed. Phụ thuộc: T048,T005,T041.  
Bước triển khai: Re-open official sources at implementation; pin counts/time/speaking/scoring; define reviewed production rubric/examples; keep unknown labeled.  
Acceptance criteria: No old blueprint; written/spoken tests pinned; human rubric independent of LLM score.  
Test cases: Format conflict, missing speaking evidence, two raters disagree, AI response ungrounded.  
Definition of Done: DoD chung \+ verified source register or unverified block official mock.

### T050 — HSK 3 content bounded families \[P1/PH6\]

Mục tiêu/phạm vi: T050-Bnn ≤50 mapping, Lnn 1 lesson, Unn 1 unit assessment.  
Module/file dự kiến: content/staging/hsk3; reviewed rubrics/media/coverage. Phụ thuộc: T049,T046,T047.  
Bước triển khai: Audit level3 mappings before authoring; dependency per lesson; author original longer input; production exercises reviewed; publish versions.  
Acceptance criteria: Coverage all required components before family gate; more Chinese exposure with support; core pipeline unchanged.  
Test cases: Longer listening/audio data, vocabulary level/sense, rubric accepted range, offline bounded packages.  
Definition of Done: DoD chung \+ every instance materialized and reviewed; original content rights.

### T051 — HSK 3 production evidence & M3 \[P1/PH6\]

Mục tiêu/phạm vi: Capture rubric review results and readiness without inflated claims.  
Module/file dự kiến: src/modules/assessment/production; progress report; docs/release-M3. Phụ thuộc: T050,T049,T042,T040.  
Bước triển khai: Store human/provisional assessments source/version; report skill gaps; two equivalent test forms; throughput/retention UAT.  
Acceptance criteria: Writing/speaking secure only accepted evidence; unvalidated provider report provisional; mock label matches blueprint state.  
Test cases: AI-vs-human disagreement, insufficient n, stale grade, practice tracing distinction, two forms.  
Definition of Done: DoD chung \+ v0.5/M4 gates và RLS/API/schema/backlog consistency review.

### T052 — M0 core security/data/UX gate \[P0/PH2\]

Mục tiêu/phạm vi: Gate dùng lại trước mỗi release, bounded fixes split riêng.  
Module/file dự kiến: tests/security; core integration/E2E; docs/quality/M0. Phụ thuộc: T026,T009.  
Bước triển khai: Auth/owner/RLS/pool reuse/CSRF/XSS/no secrets; rollback/duplicate/concurrent review; core learn/review/weekly smoke Android/Windows; accessibility core; measure one-user warm/cold latency. Offline chaos sau T031/v0.3,10VU/full perf matrix không M0 blocker.  
Acceptance criteria: 0 wrong/duplicate/missing acknowledged writes,0 owner leak/critical reachable security issue; usable core mobile/desktop; performance measured/honest, không mua compute để đạt targets.  
Test cases: Pool leakage, signed objects, slow network, expired auth, mobile keyboard, wrong owner all endpoints.  
Definition of Done: DoD chung \+ M0 evidence; rerun relevant changed modules each later release.

### T053 — M0 free deploy & minimal recovery \[P0/PH2\]

Mục tiêu/phạm vi: Future deployment only after implementation authorization; no infra created now.  
Module/file dự kiến: selected-host config/basic CI; env policy; manual export/recovery runbook. Phụ thuộc: T052,T006,T068,T069.  
Bước triển khai: Host selected byT069; free/no billing config; basic CI/local checks; owner Auth/Supabase pooler; release tested commit; manual encrypted DB/media snapshot và một small read/restore test; rollback/redeploy. Không full staging stack/backup automation/offline sync.  
Acceptance criteria: Owner mở online học/review đúng; fees0; deployment uses evaluated host; basic failure/rollback/snapshot recover verified; không claim durable offline hoặc managed dailybackup.  
Test cases: Wrong paid config rejected; auth/token expiry; hostcoldstart/loaderror; lost write response retry; migration failure; freequota exhausted→online unavailable, no false ack; restore sample attempts/cards.  
Definition of Done: M0 targeted tests/host report/checks/free deployment evidence khi user cho phép triển khai; T070 và T027–031 không dependencies. Không infra/code created inplanning.

### T054 — HSK 4 source/blueprint/coverage audit \[P1/PH7\]

Mục tiêu/phạm vi: T054-Bnn ≤50 entries; new official verification before readiness.  
Module/file dự kiến: content/staging/hsk4/manifest; exam blueprint v4. Phụ thuộc: T051,T049,T005.  
Bước triển khai: Verify official current syllabus/format and target test version; audit level4 tasks/senses/grammar/characters; plan required bounded lessons/forms.  
Acceptance criteria: New HSK4 ≠ old 100Q page; cumulative mapping reconciled; scoring pass target verified or blocked.  
Test cases: Wrong source/version, current revision changed, missing skill/topic, allowed license unknown.  
Definition of Done: DoD chung \+ exact T055 instances and open exam gates in SSOT.

### T055 — HSK 4 lessons and holdout instances \[P1/PH7\]

Mục tiêu/phạm vi: One lesson or one section ≤8 items/child, original licensed audio.  
Module/file dự kiến: content/staging/hsk4; assessment forms; media/reviews. Phụ thuộc: T054,T050,T042.  
Bước triển khai: Materialize Lnn/Snn; author authentic task contexts; review grammar/meaning/audio/keys; publish incremental; complete coverage diff.  
Acceptance criteria: Per-instance checks; full level4 gate requires reviewed task/topic/grammar/character objectives, not just 2.000 words.  
Test cases: HSK4 reading/listening distractors, multiple valid writing variants, production rubric, no practice-test leak.  
Definition of Done: DoD chung \+ reviewed content and every child evidence trace.

### T056 — HSK 4 readiness and M4 release \[P1/PH7\]

Mục tiêu/phạm vi: Readiness labels plus full 1–4 regression/cost/ops.  
Module/file dự kiến: src/modules/assessment/readiness; docs/release-M4; tests/e2e/hsk4. Phụ thuộc: T055,T051,T045,T052,T053.  
Bước triển khai: Implement evidence thresholds mục6.5; two holdout days; gaps/uncertainty; benchmark storage/workload; verify sources; final go/no-go.  
Acceptance criteria: No probability/pass guarantee; official claims only verified blueprint; unknown speaking/writing explicit; P0 invariants remain.  
Test cases: Coverage90% boundary, secure80%, stale/insufficient evidence, mock version mismatch, provisional AI excluded.  
Definition of Done: DoD chung \+ v1.0/M5 matrix/qualified rubric assessment; cập nhật SSOT, không probability đỗ giả.

### T057 — Free pronunciation research gate \[P2/DEFERRED\]

Mục tiêu/phạm vi: Chỉ nghiên cứu free/local validated candidate nếu có; hiện deferred, không Azure paid assessment.  
Module/file dự kiến: tests/evals/speech; src/modules/speech/assessment adapter; docs/speech-capabilities. Phụ thuộc: T040,T039,T051.  
Bước triển khai: Verify free/license/hardware capability trước benchmark;100clips/5speakers/humanvolunteerreview nếu có; nofee data/model; abstain nếu thiếu nguồn/reviewer.  
Acceptance criteria: Only validated dimensions enabled; tone unsupported or low agreement hidden; noisy audio abstain.  
Test cases: Correct transcript wrong tone, silence/clipping, accent/gender/device, repeated phrase, missing provider field.  
Definition of Done: DoD chung \+ go/no-go fee0 report; không available candidate ghi deferred/unavailable, không mark chấm phát âm delivered hoặc mua API.

### T058 — Free pronunciation UI gated rollout \[P2/DEFERRED\]

Mục tiêu/phạm vi: Report calibrated dimensions and limitations, no official grade.  
Module/file dự kiến: speech UI/report APIs; progress evidence rules. Phụ thuộc: T057,T040.  
Bước triển khai: Expose quality gate/results with explainable actionable feedback; uncertainty/retry; gradual flag; cap usage.  
Acceptance criteria: False negative≤10% and useful≥80% benchmark target or feature off; no falsely secure speaking.  
Test cases: Bad mic/noise/provider disagreement/no tone available/expiry; user report wrong; accessibility.  
Definition of Done: DoD chung \+ fee0 benchmark/qualifiedreview evidence; không cóvalidatedfreecandidate thì unavailable, record/playback và no-score label; không prerequisite HSK1–4 personal release.

### T059 — Push-to-talk voice tutor \[P2/PH8\]

Mục tiêu/phạm vi: Sequential STT-confirm→tutor→TTS, not realtime duplex.  
Module/file dự kiến: src/modules/speech/voice; tutor UI; usage quotas. Phụ thuộc: T040,T039,T038.  
Bước triển khai: Browser STT optional/type-confirm → GeminiFreetext → browser/downloaded TTS, quotas/consent/statecancel; local STT chỉ nếuuserbật/freebenchmark; no paidrealtime.  
Acceptance criteria: Typed fallback always; no unauthorized recording; quality unchanged vs text tutor; total quota enforced.  
Test cases: Record cancel/provider timeout/overlapping turns/denied mic/quota exhaustion/background tab.  
Definition of Done: DoD chung \+ fee0/device/latency evidence; unsupportedSTT/missingvoice có typedfallback, không bổ sung cloudpaid API.

### T060 — Personal FSRS parameter optimization \[P2/PH8\]

Mục tiêu/phạm vi: Optional after sufficient logs, not core prerequisite.  
Module/file dự kiến: src/modules/review/optimizer job; scheduler configs; evaluation. Phụ thuộc: T056,T023.  
Bước triển khai: Check ≥1.000 logs/≥60d; privacy-safe export; optimize pinned binding; temporal holdout; compare workload/retention; config preview/rollback.  
Acceptance criteria: Không optimize sparse user; logs immutable; config affects future reviews; no bulk reschedule silently.  
Test cases: Small dataset abort; bad fit/NaN; holdout worse defaults; changed timezone; rollback config.  
Definition of Done: DoD chung \+ holdout evidence and explicit config activation policy.

### T061 — User data export/delete and retention automation \[P1/PH3 — v0.2\]

Mục tiêu/phạm vi: Full privacy lifecycle; slice manual cleanup until this task.  
Module/file dự kiến: operations/privacy; settings/data; local/foreground TTL maintenance; tombstone schema. Phụ thuộc: T036,T041,T053.  
Bước triển khai: Own evidence export/reauth delete; memory/turn TTL purge; no paid cron/no raw audio cloud requirement. Tombstones retained for future restore T070; audio cleanup cases bổ sung T040/v0.3, không dependency để bật tutor chữ.  
Acceptance criteria: Cross-user export impossible; deleted account sessions revoked; storage/derived memory purged; restored backups reapply deletes.  
Test cases: Cancel export, expired reauth, partial storage purge retry, backup restore deleted user, A/B export.  
Definition of Done: DoD chung \+ privacy acceptance trước v0.2 tutor promotion; no offline/speech requirement. Backup restore tombstone regression ở T070 khi advanced restore activated.

### T062 — Multi-user pilot \[P2/DEFERRED: ngoài scope cá nhân\]

Mục tiêu/phạm vi: Parked, không mời thêm người trong personal scope. Chỉ xét lại khi user yêu cầu multi-user, constraint0phí vẫn giữ.  
Module/file dự kiến: auth invite admin; monitoring; usage dashboards; tests/load. Phụ thuộc: T056,T061,T052,T053.  
Bước triển khai: Invite 5 adults; per-user quota/data isolation; monitor workload/cost; accessibility feedback; abuse limits; actual DAU scaling decision.  
Acceptance criteria: No data crossover; cap aggregate budget; release has delete/export; access/roles auditable.  
Test cases: Parallel users/card collisions, shared device logout, unauthorized invite/admin, quotas concurrent.  
Definition of Done: Hiện không làm và không là releasegate; sau scope mới phải kiểm free-license/limits/terms/rights và ownership trước pilot, không paid migration.

### T063 — Hosting/worker scale \[P2/DEFERRED: ngoài scope cá nhân\]

Mục tiêu/phạm vi: Parked, không worker/cloudGPU/VPS/Redis trả phí cho một user.  
Module/file dự kiến: src/modules/operations/jobs; worker entry; deploy config; ADR updates. Phụ thuộc: T062,T053.  
Bước triển khai: Nếu scope mới thật sự cần, profile→query/cache→localfreejobs trước; freehosting eligibility/quotas; ADR cập nhật; không paid scale.  
Acceptance criteria: No speculative Redis/service split; job idempotent; p95 meets measured target; costs tracked.  
Test cases: Worker crash lease expiry, duplicate job, max retries, deployment old/new schema compatibility.  
Definition of Done: Hiện parked/non-releasegate; chỉ activate sau user scope mới và chứng minhfee0; không tự đổi constraint để tối ưu.

## 12.4. Weekly planner — P0 bổ sung trước M0

Giữ các Task IDs cũ; T064–T067 thuộc PH2: T065 trước T024, T066 sau T024, T067 trước T026. T031 có offline snapshot/time interval sync cases. Thêm T068(PH0) trong free-only revision, tổng68 IDs hiện tại; task pending/deferred như12.5. Không có dependency cycle.

### T064 — Weekly time-preferences schema/API \[P0/PH2\]

Mục tiêu/phạm vi: Lưu ngân sách giờ/tuần, available days, day/session caps; chuẩn bị plan/block/time tables.  
Module/file dự kiến: supabase/migrations/\*\_weekly\_planner.sql; src/modules/learning/time-preferences; /api/v1/learning/time-preferences. Phụ thuộc: T008,T009,T010,T011.  
Bước triển khai: Typed schemas/constraints/FKs/RLS mục6.6; PATCH optimistic version/idempotency; preview capacity; expose default6h đề xuất; loại dailyMinutes input authoritative.  
Acceptance criteria: Owner-only; active weekly30..1260/paused0; daycap≤180/session≤45; impossible budget trả requested/feasible/gap không tự tăng cap.  
Test cases: Invalid values/empty active days, paused, userA/B, concurrent samekey/version conflict, budget dưới giờ đã học giữ history.  
Definition of Done: DoD chung \+ migration fresh/upgrade/types/API tests; contracts/profile không còn daily\_minutes primary.

### T065 — Weekly allocation engine v1 \[P0/PH2\]

Mục tiêu/phạm vi: Pure deterministic planner từ budget/availability, cards/evidence/time snapshot; không AI.  
Module/file dự kiến: src/modules/learning/domain/weekly-planner; /api/v1/learning/weekly-plan/replan; plan repositories. Phụ thuộc: T064,T019,T023,T015.  
Bước triển khai: Reserve review và buffer; constrain day/block budgets; tentative lesson prereqs; ordered tie-break; missed/replan active version atomic; forecast denominator explicit.  
Acceptance criteria: Budget/day/block invariants; all overdue giảm new0; due\_at/history không đổi; exactly1 active version; sparse-data no false forecast.  
Test cases: Property random inputs;270min capacity vs360budget; paused/rest; active/completed frozen; missed day; timezone/week; concurrent replan; no model call.  
Definition of Done: DoD chung \+ golden/property/integration evidence, plannerVersion and reason codes; T024 consume plan after this task.

### T066 — Weekly budget onboarding/preview/settings \[P0/PH2\]

Mục tiêu/phạm vi: User chọn tổng giờ/tuần và tùy chọn ngày; xem/sửa kế hoạch trước áp dụng; one-click today.  
Module/file dự kiến: src/modules/learning/ui/weekly-plan; onboarding/settings; today components. Phụ thuộc: T065,T024,T012.  
Bước triển khai: 3/6/9/12h \+ custom; availability/daycap/block inputs; requested/feasible/buffer preview; optional accept lower-capacity plan; budget change/missed UI; online-only settings.  
Acceptance criteria: Mở app rõ next block; không ép tăng giờ; overtime/unscheduled/debt truthful; mobile/a11y; offline snapshot state.  
Test cases: 360px/keyboard/screen-reader; impossible request; midweek reduce belowspent; no dataforecast; restday;401/409/offline edit disabled.  
Definition of Done: DoD chung \+ UX tests, source contracts/labels match6.6, approved snapshot ready for package cache.

### T067 — Weekly planner acceptance gate \[P0/PH2\]

Mục tiêu/phạm vi: Online budget→plan→learn→time→replan UAT trước M0; bổ sung offline cases vào T031.  
Module/file dự kiến: tests/e2e/weekly-planner; tests/integration/time-accounting; docs/implementation/weekly-UAT. Phụ thuộc: T066,T021,T025,T016.  
Bước triển khai: Test 3/6/9h/custom; active-time dedup overlap/idlecap; skip/reduce/increase; replan forecasts/costfree; userB isolation; compare plan/card/history.  
Acceptance criteria: 0 overscheduled planned minutes/0 doubletime/0 data crossover in suite; no FSRS due change by calendar; skipped không dồn quá cap; task allfields evidence.  
Test cases: 6h/6days;6h/3×90 impossible; completed100min→budget60; two tabs duplicate interval; timezone Monday; overdue; zero forecastdata; concurrency/retry.  
Definition of Done: DoD chung \+ measured edge cases; M0 checklist/traceability/backlog updated; offline regression inherited T031, không chờ PH4.

## 12.5. Zero-cost personal profile — P0 gate trước code/deploy

T068 bổ sung, tổng 68 Task IDs. T003/T006/T037/T040/T053 phụ thuộc T068; IDs cũ giữ. T057–T058 chấm phát âm và T062–T063 nhiều người/scale deferred, không chặn owner học. Hiện có 7 ADR; các task pending/deferred như ghi, chưa code/deploy trong phiên planning.

### T068 — Free-only service/license/capacity register \[P0/PH0\]

Mục tiêu/phạm vi: Chốt one-owner fees0 profile trên mọi stage; kiểm freeplan eligibility/quota/no-billing/terms cho từng service trước implementation, không tạo account hay infra trong planning.  
Module/file dự kiến: docs/implementation/free-services.md; config/free-only policy schema; env.example placeholders; CI limits spec. Phụ thuộc: T001,T002.  
Bước triển khai: Register Vercel Hobby/Render Free candidates, Supabase Free/GitHub Free/Gemini Unpaid/OSS licenses; actual account no-billing/no-payment/remaining quota/terms. T068 khóa fees0 và eligibility, không final host. T069 dùng baseline proof quyết ADR006; không paid add-on/trial/GPU. Content rights/free reviewer path và fallbacks documented.  
Acceptance criteria: Mỗiservice có0fee evidence/date/owneraccounttier/no-billing attestation, limits/reset/memoryruntime/whatstops/fallback. Khôngservice bắtpayment/requirespaidaddon; impossiblefree setup chọnlocal/deferred thaymua. Non-commercial personal restriction documented; one-owner scope consistent UI/auth/backlog.  
Test cases: Paidproject key/defaultmodel/trialcredits/Prodomain/SMTP/CIpaidrunner/mandatoryGPU rejected; quota0/servicepause choosefallback; providertermschanged→disable candidate; APIkey alone notaccepted billingproof; freeUI/font/data license separate rights.  
Definition of Done: DoD chung \+ service table và ADR007 khớpSSOT; fees0 releasechecklist, accountlimits cósource; no secrets/charges/newinfrastructure duringplanning. T068 chưaverified account thực thì khôngclaim deployment đãzero-cost.

## 12.6. Activation index v1.1 — read this before taking a task

M0 ACTIVE34: T001, T002, T003, T004, T005, T006, T007, T008, T009, T010, T011, T012, T013, T014, T015, T016, T017, T018, T019, T020, T021, T022, T023, T024, T025, T026, T052, T053, T064, T065, T066, T067, T068, T069. Phụ thuộc bắc cầu của set này phải nằm trong chính set; nếu task M0 vô tình cần offline/tutor/advanced ops thì sửa dependency trong SSOT trước giao code. T007/T008 có staged subset, không đổi design dữ liệu mục5; task done theo release footprint ghi rõ.  
M1/v0.2 ACTIVE14: T032–T039 (8), T041–T045 (5), T061 (1); M0 prerequisite. Không T040/T027–031. Tutor chữ và HSK1 không chờ offline; content publish vẫn independent of provider.  
M2/v0.3 ACTIVE7: T027,T028,T029,T030,T031,T040,T070. M3/v0.4: T046–T048. M4/v0.5: T049–T051. M5/v1.0: T054–T056. OPTIONAL/DEFERRED: T057,T058,T059,T060,T062,T063. Cộng34+14+7+3+3+3+6=70; mỗi ID đúng một activation bucket, không duplicate hoặc omitted.  
Dependency correction v1.1: bỏ T031 khỏi T032/T034/T035/T041/T052/T053; bỏ T040 khỏi T045/T061. T052 là core online security/data/UX; T053 deploy/basic snapshot, phần ops nâng cao T070. T044 content không phụ thuộc T039 AI. T048 gate version chuyển v0.4; T051 v0.5; T056 v1.0. Priority là P0-M0 hoặc P1-required-for-specific-release, không auto implement cả master backlog.

### T069 — Free hosting benchmark & ADR-006 lock \[P0/PH1\]

Mục tiêu/phạm vi: Một proof nhỏ ≤2–4h so Vercel Hobby và Render Free nếu actual no-payment eligible; không full app/deploy pipeline hoặc paid service.  
Module/file dự kiến: tests/bench/hosting-proof; docs/implementation/hosting-benchmark.md; candidate host config; ADR006 evidence. Phụ thuộc: T006,T009,T010,T011,T068.  
Bước triển khai: Eligibility/quota/no-payment precheck; deploy minimal samecommit route auth+one read/idempotent SQLtx vào synthetic/isolated testdata; ≥5 cold-like opens/≥20 warm requests mỗi eligible host, Android/Windows/audio smoke; record network/region/latency/failure/body/runtime/pool role; test lost response retry/logout/migration+rollback flow; remove unneeded proof resources after evidence khi authorized; select rule ADR006.  
Acceptance criteria: Fee0 và auth/RLS/tx/claims cleanup/idempotency0errors bắt buộc. Actual timings \+ limitations đủ quyết host; Render cold start/loading measured, Vercel cold function/pool verified. Unavailable host có reason, không fake successful benchmark. Final ADR006 accepted \+ selected config trước T053; both fail localfree/blocked.  
Test cases: Sleeping Render cold start/ephemeral disk, Vercel DB role/connection limits, JWTnonowner/expired, A→B pool context locally, duplicate mutation/lost ack, networkslow, no card/free-tier quota suspension. Không paid Render Postgres/IPv4/keepalive để nâng kết quả.  
Definition of Done: Short benchmark report/raw results/source/tier evidence \+ chosen host/trade-off/ADR006 update; no full CI/staging/features. Trong planning chỉ task spec, chưa benchmark hoặc cloud setup.

### T070 — Free backup/restore/operations extension \[P1/PH4 — v0.3\]

Mục tiêu/phạm vi: Sau bản học online, thêm cadence/retention/restore validation/tombstones/log alerts; không trở thành dependency của M0 hoặc tutor chữ.  
Module/file dự kiến: local backup/restore scripts; ops settings/runbooks; tests/integration/restore; deletion tombstone replay. Phụ thuộc: T053,T061,T031.  
Bước triển khai: Encrypted DB+media copy free/local khi PC bật; actual lastBackupAt/cadence/retentionbounded; restore isolated schema+attempt/card/content versions; reapply deleted user/tutor TTL; preserve acknowledged evidence/outbox; quota/health logs không transcript; local/foreground scheduling, no paid cron/vendor.  
Acceptance criteria: Backup bytes/checksums+full sample restore exact; deletion không resurrect; RPO/RTO measured thực không uptime guarantee; restore không auto overwrite prod; fees0. Offline package/outbox semantics được kiểm khi activated.  
Test cases: Partial dump/corrupt media/wrong keys/old schema/no PC running; duplicate restore/conflicting card versions; userdelete before backup restore; data+Storage metadata match; raw audio privacy cleanup nếu có.  
Definition of Done: Free runbook \+ restore test evidence/versioned settings; failsafe/owner confirmation cho destructive restore; required v0.3 gate, không M0. Không tool/script cài/chạy trong planning.

# 13\. Risks & Mitigations {#13.-risks-&-mitigations}

R01/P0 — Trộn chuẩn 2021, HSK cũ và đề cương 11/2025. Owner: content lead. Trigger: count/format khác nguồn. Mitigation: source/version/checksum và locator; T002/T005/T014; block official-format mock đến verified blueprint. Không dùng old HSK4 180/300 làm target mặc định cho bản mới.  
R02/P0 — Không đủ quyền nguồn/reviewer. Owner: product/content. Mitigation: original-reviewed material, provenance/terms lưu, unknown blocked publish T002/T016/T044; nếu chưa tìm được reviewer giữ beta và chưa claim giáo trình chuẩn. Public PDF không tự cấp quyền thương mại.  
R03/P0 — Mất/nhân đôi review khi offline, two devices, clock sai. Owner: learning/sync. Mitigation: lease/version/idempotency/transaction, ordered replay, explicit conflicts; T022–T031; không last-write-wins scheduler state. Offline expired lease chỉ practice.  
R04/P0 — Data cross-user hoặc admin key lộ. Owner: backend/security. Mitigation: private schema, least-privileged runtime, transaction-local claims, FORCE RLS, composite FK, A/B pool tests T009/T052. Failure \= release blocker; không nhờ LLM nhắc server kiểm owner.  
R05/P1 — AI dạy sai, lời giải mâu thuẫn hoặc prompt injection. Owner: tutor/content. Mitigation: reviewed retrieval, structured allowlist, no grade mutation, human-critical eval T035–T039; report/quarantine/fallback approved. Structured schema không là correctness guarantee.  
R06/P1 — STT đúng nhưng âm/thanh sai, provider capability khác locale. Owner: speech. Mitigation: self replay/human samples ở P1, benchmark zh-CN capabilities trước score T040/T057/T058; abstain nếu noise hoặc dimensions unsupported. Không giả định TTS mọi tone sandhi chuẩn.  
R07/P1 — Quá tải thẻ, progress đẹp nhưng không dùng được. Owner: pedagogy. Mitigation: new caps/review budget, distinct concept-skill evidence/holdout delayed tasks, leech remediation, 14-day pilot T019/T024/T045; thay lesson/cards nếu transfer thất bại.  
R08/P1 — Học 6–8 tháng không khả thi với thời gian thực tế. Owner: learner/product. Mitigation: duration assumptions và forecast intervals, 2-week reassessment; giảm mục tiêu new material khi nợ ôn, kéo dài lịch; không fake secure để đạt calendar.  
R09/P0 — Free tier đổi terms/quota hoặc account đang billing-enabled. Owner: operations. Mitigation: T068 free-only inventory, no card/no billing/no trial/no paidfallback; quota alerts, compact media/outbox/backup; T037 limits/T053 hosting; khi free unavailable core downloaded packages/Windows local free tiếp tục, cloud paused; không nâng gói để chữa sự cố. Gemini free terms/privacy/eval phải accepted; no free AI không ngăn lesson/review.  
R10/P1 — Nội dung HSK1–4 tốn công hơn code. Owner: content. Mitigation: bounded lesson instances, content throughput đo sau slice, HSK1 gate trước levels cao, không AI auto-publish; estimate theo reviewer và số objectives.  
R11/P1 — PWA media/install/offline khác browser. Owner: frontend. Mitigation: explicit supported Android Chrome/Windows Chrome/Edge, real device tests, capability detection/MIME transcode, foreground sync; no mandatory Background Sync T027/T031/T040.  
R12/P1 — Restore thiếu Storage hoặc resurrect user bị xóa. Owner: operations/privacy. Mitigation: independent asset backup/tombstones/restore drill T053/T061. Chỉ claim RPO/RTO sau measurement.

# 14\. MVP Acceptance Checklist {#14.-mvp-acceptance-checklist}

## 14.1. M0/v0.1 — Online learning acceptance

\[ \] Active34 M0 IDs ở12.6 done đúng subset, dependency closure sạch future/offline. \[ \] T068 hardfees0/no trial/billing/paid fallback và owner-only. \[ \] T069 actual free host benchmark+T009 custom role/RLS/pool proof, ADR006 final selection recorded trước T053.  
\[ \] F01/F02/L001/L002 có objective/prerequisite/source/rights/review/audio/accepted answers. \[ \] Owner login → chọn giờ/tuần/preview → today → lesson/listen/exercise → server grade → immutable attempts/mastery → cards/FSRS → next block/dashboard. \[ \] Missing AI không chặn flow; corpus chưa full HSK1 hiển thị slice.  
\[ \] Review/attempt writes nguyên tử, duplicate retry/same key/concurrent version/crash-after-commit không mất/nhân đôi dữ liệu đã ack; client không quyết score; pool context clear; RLS/owner/CSRF/XSS/secret tests pass. \[ \] Lost network: chưa ack không báo saved, retry khi online, không claim durable offline.  
\[ \] Weekly budget/cap/skip-day invariants; time events không cộng trùng; sparse data không giả forecast; skill mastery khác card recall. \[ \] Android/Windows browser online audio/input/layout/core a11y, reopen progress đúng; basic local/CI checks+build/smoke pass.  
\[ \] Deploy commit/lockfile trên free host đã chọn; migrations credential tách runtime, manual encrypted snapshot \+ small read/restore test, rollback/redeploy hướng dẫn. \[ \] Không yêu cầu cloud staging riêng, automated retention/uptime dashboard, full performance matrix, mic/STT, package/outbox/lease/conflict. Những phần đó không là nguyên nhân trì hoãn M0.

## 14.2. M1/v0.2 — HSK1 \+ text tutor

\[ \] T032–039,T041–045,T061 done; F01–F05/HSK1 task/topic/word/grammar/character coverage reviewed. \[ \] Writing state không tracing=mastery; unit diagnostics held-out/answer quality; 14-day delayed-transfer pilot có evidence. \[ \] Tutor explain/correct/roleplay tiếng Việt/memory consent \+ GeminiFree source/schema/eval; paid routes off, quota0 approved fallback. Nếu chưa free/eval thì feature disabled rõ, không quảng cáo đã có validated Tutor.  
\[ \] Core grading/mastery/unlock/planner/FSRS independent of AI. \[ \] Export/delete/turn/memory TTL và privacy tested. \[ \] Không T027–031/T040 dependency; nội dung HSK1 có thể publish trước tutor, M1 scope release có gate riêng. Không offline/speech checks để chặn text tutor.

## 14.3. M2/v0.3 — Offline và speaking practice

\[ \] T027–031,T040,T070 done, basic M0/M1 regression giữ. \[ \] Install/download/checksum/outbox/72h lease/conflict/replay clock/version/duplicates và real-device chaos tested; auth cache logout không leak. \[ \] Mic/record/playback/missing voice/STT availability/privacy; free STT optional labeled, transcript không tone score. \[ \] Backup/restore version/evidence/tombstones và measured cadence theo T070.

## 14.4. M3–M5 — HSK2 đến HSK4

\[ \] v0.4/M3 T046–048; v0.5/M4 T049–051; v1.0/M5 T054–056. Mỗi level full published lesson coverage+review+holdout/rubrics, không chỉ vocab count. Official mock/readiness cần đúng version/rights/verified blueprint; AI provisional không được xếp secure/pass. Speaking/writing thiếu evidence hiện unknown.  
\[ \] Owner-only/free-only vẫn giữ; relevant CI/security/data/UX/regression pass mỗi release. T057/T058 automated tone scoring chỉ activate sau validated free candidate; T059/T060 optional, T062/T063 deferred. Mục tiêu HSK4 là evidence/learning-based, không guarantee từ ngày/giờ.

# 15\. Hướng dẫn triển khai bằng Codex {#15.-hướng-dẫn-triển-khai-bằng-codex}

## 15.1. SSOT và tiết kiệm context

Doc này là SSOT cho scope, architecture, schema/API/engine contracts và thứ tự. Repo về sau chỉ chứa implementation artifacts và bản tóm tắt/cache có source Doc URL \+ revision/lastSyncedAt; không tự biến docs/plan.md thành plan authoritative khác. AGENTS.md ≤600 tokens: SSOT URL, module boundaries, required checks, task handoff policy. Brief ≤1.200 tokens: stack/ADRs/M0 scope/open gates. Status nhỏ: current task, done IDs, evidence link, next dependencies.  
Phiên Codex đầu chỉ đọc entry packet2.3, ADR005/006/007, roadmap11, active index12.6, checklist14.1 và task T001; dữ liệu/learning/security đọc thêm sections cần cho task cụ thể. Không yêu cầu mọi phiên nạp toàn tài liệu. Brief≤1.200tokens \+ status cache≤600tokens, links/SSOT revision và activeRelease=M0. Task data đọc5/ADR002; learning6/4.2; tutor7/privacy; offline4.4 chỉ khi v0.3 được kích hoạt. Revision changed→đọc change log/affected sections trước tin cache.  
Connector Docs availability khác nhau giữa Work/Codex sessions. Nếu phiên triển khai không có Docs connector: owner cung cấp approved export/snapshot với revision, dùng cache read-only để code task; thay đổi kế hoạch giữ pending proposal, không claim đã sửa SSOT. Phiên có connector phải reconcile và cập nhật Doc trước architecture/scope change được coi accepted. Không yêu cầu Claude/Codex đọc Google Docs bằng scraping hoặc unofficial endpoints.

## 15.2. Task execution protocol

Nhận một Task ID và kiểm dependencies done \+ release/version. Đọc đúng phần SSOT/contracts; inspected repo state không reset user edits. Tạo implementation plan ngắn, làm trong scope; test targeted required; report changed files/evidence/risk. Nếu dependency chưa đạt, làm phần không phụ thuộc hoặc chọn task ready; không lén thiết kế lại. Nếu code cần schema/API/engine change: ghi proposal impact \+ tests \+ updated ADR/task scope, sửa SSOT khi đã authorized rồi triển khai.  
Cuối task cập nhật status trong Doc: ID, trạng thái done/blocked/in-progress, ngày, commit/artifact, test evidence, residual risks, next ready IDs. Nhánh/repo nhỏ có implementation status cache để tránh mỗi phiên đọc toàn Doc; cache liên kết nguồn và không ghi kiến trúc trái plan. Mỗi task có checkpoint giới hạn vài bullet, không đưa full logs vào brief. Hai task cùng schema/API merge tuần tự; content lane có owner và bounded instances.

## 15.3. Task đầu tiên nên giao

Task đầu vẫn T001: tạo brief/status/AGENTS từ v1.1 chỉ chứa M0 active34 IDs, future70-ID index bằng links và gates. Sau T001→T002/T068/T004/T005→T003; code scaffold T006 và DB proof T009 trước học modules; T069 sau minimal scaffold/auth/RLS, trước khóa host/T053. Không giao toàn bộ backlog70 IDs. Đây là hướng dẫn tương lai, chưa tạo repo/code ở phiên sửa plan.  
Prompt: “Dùng Master Plan v1.1 tại Doc này làm SSOT. Chỉ T001: brief≤1.200tokens, AGENTS≤600tokens, status currentRelease=M0/34 active IDs ở12.6 và gates T068/T009/T069; links tới70-ID future backlog. Không code feature/offline/paid API/billing/hosting setup; ADR006 pending benchmark. Đọc scope/checklist/revision/task sections cần, không auto triển khai future tasks. Update SSOT status khi được authorized và connector available.”

## 15.4. Final consistency review và change log

Review ngày 13/10/2026: schema/API/backlog cùng stable IDs \+ immutable versions; attempt/review/sync dùng owner+idempotency và chung command; mastery tách FSRS/AI/provisional; nextAction deterministic; offline public practice keys không leak secure mock keys; tutor chỉ read-only evidence; quota ledger/reservation có entities và task; rights/source publish gates trước content; HSK1 trước HSK2–4; backup bao gồm Storage.  
Điều chỉnh trong review: T061 privacy được kéo vào M1 gate thay vì chờ PH8; PH4 roadmap bao gồm T061 trước promotion. T005 done có thể là hồ sơ verified/unverified rõ, không ép bịa blueprint; T039 done là evaluation+mode gating, không imply failing modes enabled. Content family instances materialize trước làm, bounded scope, không nhận toàn level một task. Không có cycle giữa T061 và T045 sau dependency cập nhật.  
Change log v1.0/13-10-2026: net-new plan, 6 ADR, 9 phases PH0–PH8, 63 backlog entries/families, source evidence; status all pending. Open gates: nguồn/quyền cụ thể khi import; qualified reviewer; new exam blueprint/scoring/speaking details; actual provider price/access/region; runtime-role pool compatibility; real device/pilot measurements. Các gate có owner/task rõ, không chặn việc lập kế hoạch.  
Change log v1.0 — weekly-planner revision/13-10-2026: user yêu cầu tự chia theo giờ học/tuần. FR01/FR14, profiles/API, UX, daily planner và forecast chuyển sang weekly budget. Bổ sung6.6, T064–T067(P0/PH2), gate M0 và S17–S18; total67 entries. Giữ IDs cũ và6 ADR; thay daily\_minutes bằng weekly preferences, thêm plan/block/time evidence schema. History change log63 entries là trạng thái bản gốc, không task count hiện tại.  
Change log v1.0 — free-only personal revision,13/10/2026: owner-only và phí0 toàn build/infra/deploy/CI/CD/features. Hủy budget20+5USD; sửa ADR002/005/006, thêm ADR007/4.5/T068. Defaults Vercel Hobby/Supabase Free/GitHub Free/Gemini Unpaid; speech local/browser, chấm thanh điệu deferred. Tổng68 IDs/7 ADR; logs63/67 là lịch sử. Quota ledger dùng request/token/service\_fee=0, auth owner allowlist/no paid SMTP, staging/backup local. OpenAI/Azure/Render references lịch sử, không implementation hiện hành. Terms/limits kiểm lại trước triển khai.  
Change log v1.1/13-10-2026: cập nhật review online-first. Rename cùng Google Doc/SSOT từ v1.0→v1.1, không tạo plan duplicate. M0 online34 IDs, offline/speaking v0.3; host ADR006 pending actual T069 benchmark; T070 advanced ops sau M0. Hardfees0/GeminiFree/owner-only từ revision trước giữ. Tổng70 task IDs và7 ADR; core HSK/database/learning/security/AI pedagogy giữ nguyên. Đã sửa dependency M0/M1 để không kéo T027–031/T040/T070 vào release sớm; task/code/benchmark/cloud chưa thực hiện.

# 16\. Sources & Verification Register {#16.-sources-&-verification-register}

Tất cả URLs dưới đây đã được tra cứu/đọc ngày 13/10/2026 trừ mục nêu read limitation; trích dẫn trong prose dùng Sxx. Sources chỉ hỗ trợ facts gần nội dung liên quan; phần thuật toán/thresholds/UX/roadmap là quyết định thiết kế \[D/A\]. Không source nào được tự coi cấp quyền thương mại.  
S01 — CTI official HSK exam syllabus PDF: [https\://hsk.cn-bj.ufileos.com/3.0/%E6%96%B0%E7%89%88HSK%E8%80%83%E8%AF%95%E5%A4%A7%E7%BA%B21219.pdf](https://hsk.cn-bj.ufileos.com/3.0/%E6%96%B0%E7%89%88HSK%E8%80%83%E8%AF%95%E5%A4%A7%E7%BA%B21219.pdf) — verified bìa PDF p1 ghi 2025-11/2026-07; mục lục p2–3; vocabulary boundaries p86/p91/p103/p128 (PDF pages, page printed khác 2). Hỗ trợ syllabus version/5 components/count boundaries; không license/scoring claim. SHA256 snapshot chưa tính vì không tải trong planning; task T002/T014 phải lưu hash khi authorized import.  
S02 — CTI overview [https\://www\.chinesetest.cn/hsk](https://www.chinesetest.cn/hsk) — 3 stages/9 levels, 5 components; old page [https\://www\.chinesetest.cn/HSK/4](https://www.chinesetest.cn/HSK/4) hiển thị legacy format, chỉ dùng làm conflict evidence. New sample link từ official overview không đọc được bằng web tool; [https\://www\.chinesetest.cn/news/51336883](https://www.chinesetest.cn/news/51336883) phần nội dung động chưa fetch đủ. Không coi đó là verified detailed format.  
S03 — Ministry of Education: [https\://www\.moe.gov.cn/jyb\_xwfb/gzdt\_gzdt/s5987/202103/t20210329\_523304.html](https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202103/t20210329_523304.html) và [https\://www\.moe.gov.cn/jyb\_xwfb/gzdt\_gzdt/s5987/202104/t20210422\_527601.html](https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202104/t20210422_527601.html) — GF0025-2021 phát hành 2021, hiệu lực 1/7/2021. Thông báo 2021 là framework năng lực, không blueprint thi 2025\.  
S04 — Next.js PWA official guide: [https\://nextjs.org/docs/app/guides/progressive-web-apps](https://nextjs.org/docs/app/guides/progressive-web-apps) — manifest/PWA/server headers; offline grading/sync ở plan là thiết kế riêng, không functionality Next.js tự cung cấp.  
S05 — Supabase/PostgreSQL security: [https\://supabase.com/docs/guides/database/postgres/row-level-security](https://supabase.com/docs/guides/database/postgres/row-level-security) ; [https\://www\.postgresql.org/docs/current/ddl-rowsecurity.html](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) ; [https\://supabase.com/docs/guides/auth/server-side/nextjs](https://supabase.com/docs/guides/auth/server-side/nextjs) — RLS/owner bypass/FORCE và SSR token verification. Transaction scope dự án dùng verified uid và role least privilege; feasibility test task T009.  
S06 — Supabase backups: [https\://supabase.com/docs/guides/platform/backups](https://supabase.com/docs/guides/platform/backups) — free-tier off-site export và Storage objects không gồm trong database backup. Retention/RPO/RTO trong plan là targets riêng.  
S07 — FSRS official implementation: [https\://github.com/open-spaced-repetition/ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) ; [https\://open-spaced-repetition.github.io/ts-fsrs/](https://open-spaced-repetition.github.io/ts-fsrs/) — supported scheduler/optimizer tách, MIT source code; library version/config pin at T022. Desired retention/optimization data thresholds trong plan là defaults proposed.  
S08 — Hanzi Writer code/data: [https\://github.com/chanind/hanzi-writer](https://github.com/chanind/hanzi-writer) ; [https\://hanziwriter.org/docs.html](https://hanziwriter.org/docs.html) ; [https\://github.com/chanind/hanzi-writer-data/blob/master/README.md](https://github.com/chanind/hanzi-writer-data/blob/master/README.md) — code/data license separate, Arphic Public License cho character data theo README. Full terms cần đọc snapshot ở T032; không gán MIT cho data.  
S09 — Reference lịch sử, superseded cho implementation: [https\://learn.microsoft.com/en-us/azure/ai-services/Speech-Service/language-support](https://learn.microsoft.com/en-us/azure/ai-services/Speech-Service/language-support) ; [https\://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment) . Tài liệu cũ về zh-CN capability; free-only revision không dùng Azure API, T057 deferred và chỉ xét free/local candidates.  
S10/S11 — References lịch sử, không active provider: [https\://developers.openai.com/api/docs/guides/structured-outputs](https://developers.openai.com/api/docs/guides/structured-outputs) ; [https\://developers.openai.com/api/docs/models/gpt-4.1-mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) . Baseline OpenAI đã superseded bởi Gemini Free S21–S23; không API OpenAI trả phí hoặc giả định ChatGPT subscription cho free API usage.  
S12 — Reference lịch sử: [https\://render.com/docs/deploy-nextjs-app](https://render.com/docs/deploy-nextjs-app) . Render deployment default đã superseded bởi Vercel Hobby/local-free theo S19/ADR007; không cần pricing/paid plan của Render để làm T053.  
S13 — node-postgres transactions: [https\://node-postgres.com/features/transactions](https://node-postgres.com/features/transactions) — transaction cùng client connection, không pool.query nhiều connection. S14 — Dexie [https\://dexie.org/docs](https://dexie.org/docs) — IndexedDB adapter candidate; lease/conflict/idempotency là domain contract riêng.  
S15 — W3C [https\://www\.w3.org/TR/WCAG22/](https://www.w3.org/TR/WCAG22/) — accessibility target AA; touch target 44px trong plan là design choice cao hơn minimum AA criterion chứ không gán 44px là WCAG2.2 AA bắt buộc. S16 — Vitest [https\://vitest.dev/guide/](https://vitest.dev/guide/) — unit tooling; Playwright [https\://playwright.dev/docs/test-intro](https://playwright.dev/docs/test-intro) link candidate không fetch đầy đủ trong planning, availability/version phải verify T006.  
Không dùng bài tổng hợp/Wikipedia/community làm chuẩn cho exam counts/scoring; không dùng benchmark có copyrighted textbooks làm dữ liệu tutor mặc định. Chưa có quyền dùng corpus thương mại, chỉ có chiến lược rights-first và original-reviewed authoring.  
S17 — Cepeda et al. (2006), Distributed practice in verbal recall tasks: A review and quantitative synthesis, Psychological Bulletin 132(3),354–380, DOI [https\://doi.org/10.1037/0033-2909.132.3.354](https://doi.org/10.1037/0033-2909.132.3.354) ; author abstract [https\://www\.yorku.ca/ncepeda/publications/CPVWR2006.html](https://www.yorku.ca/ncepeda/publications/CPVWR2006.html) ; record [https\://pubmed.ncbi.nlm.nih.gov/16719566/](https://pubmed.ncbi.nlm.nih.gov/16719566/) — supporting distributed practice/retention-dependent spacing; author abstract đã đối chiếu13/10/2026, full text chưa đọc trong revision này. Không nguồn xác định một tỷ lệ/độ dài buổi HSK tối ưu.  
S18 — Roediger & Karpicke (2006), Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention, Psychological Science17(3),249–255, DOI [https\://doi.org/10.1111/j.1467-9280.2006.01693.x](https://doi.org/10.1111/j.1467-9280.2006.01693.x) ; publisher abstract [https\://www\.psychologicalscience.org/journals/psychological-science/j.1467-9280.2006.01693.x/](https://www.psychologicalscience.org/journals/psychological-science/j.1467-9280.2006.01693.x/) đã đọc13/10/2026 — hỗ trợ retrieval practice cho delayed retention; không thử nghiệm app này hay chứng minh đạt HSK4 trong6–8 tháng.  
S19 — Vercel Hobby [https\://vercel.com/docs/plans/hobby](https://vercel.com/docs/plans/hobby) ; Git deployment [https\://vercel.com/docs/git](https://vercel.com/docs/git) — kiểm13/10/2026: free personal/non-commercial, quota overage có thể pause/reset; tài khoản thực kiểm ở T068. S20 — Supabase [https\://supabase.com/pricing](https://supabase.com/pricing) ; [https\://supabase.com/docs/guides/platform/billing-on-supabase](https://supabase.com/docs/guides/platform/billing-on-supabase) — Free0USD, database500MB/storage1GB, egress/project/inactivity limits; không guaranteed always-on.  
S21A — GitHub [https\://docs.github.com/en/billing/concepts/product-billing/github-actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions) ; [https\://docs.github.com/en/billing/concepts/budgets-and-alerts](https://docs.github.com/en/billing/concepts/budgets-and-alerts) — free standard minutes/artifact limits và Stop usage budgets. Kiểm paid usage blocked; không premium/larger runner. Quota toàn account có thể dùng chung với repo khác.  
S21 — Gemini pricing [https\://ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) ; billing [https\://ai.google.dev/gemini-api/docs/billing](https://ai.google.dev/gemini-api/docs/billing) ; rate limits [https\://ai.google.dev/gemini-api/docs/rate-limits](https://ai.google.dev/gemini-api/docs/rate-limits) — kiểm13/10/2026 có free text I/O cho gemini-2.5-flash-lite. T037/T068 kiểm account/project eligibility/quota, không Cloud Billing/paid tools. Consumer subscription khác API access; không unlimited hoặc free forever guarantee.  
S22 — Gemini Unpaid terms [https\://ai.google.dev/gemini-api/terms](https://ai.google.dev/gemini-api/terms) — input/output có thể được dùng cải thiện sản phẩm/human review; không gửi thông tin cá nhân/bí mật. Consent \+ educational context không định danh bắt buộc. S23 — Gemini structured outputs [https\://ai.google.dev/gemini-api/docs/structured-output](https://ai.google.dev/gemini-api/docs/structured-output) — JSON Schema/Zod support; vẫn kiểm model/schema thực và semantic correctness.  
S24 — PostgreSQL connections [https\://supabase.com/docs/guides/database/connecting-to-postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) — direct/session/transaction pooler; T009/T068 kiểm SSL/custom role/network và không cần IPv4 paid add-on. Transaction-local claims không được giả định sống qua pooled session.  
S25 — Browser speech [https\://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) ; [https\://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) — voice/capability khác nhau, recognition có thể dùng server, không guaranteed offline/tone scoring. S26 — Docker license [https\://docs.docker.com/subscription-billing/desktop-license/](https://docs.docker.com/subscription-billing/desktop-license/) — personal use miễn phí khi eligible; Docker optional.  
S27 — whisper.cpp [https\://github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) — local STT candidate; kiểm code/model license và latency trên máy thật trước chọn. Không cloud fee hoặc tone assessment guarantee; không cài/build model trong planning.

# 17\. Bảng tra cứu triển khai {#17.-bảng-tra-cứu-triển-khai}

## 17.1. Quyết định kiến trúc

Bảng tóm tắt ADR; nội dung đầy đủ và trade-off ở mục3.

| ADR | Mặc định | Trade-off / gate |
| :---- | :---- | :---- |
| 001 | Next.js modular monolith | Một deploy; giữ module boundaries |
| 002 | Supabase Free; SQL; owner-only | Free pooler/role \+ RLS tests |
| 003 | FSRS riêng mastery skill | Không suy skill từ card recall |
| 004 | Downloaded packages; 1 active lease | Multi-device offline conflict rõ |
| 005 | Gemini Free; browser/local speech | No billing; eval/privacy/quota |
| 006 | Vercel/Render Free candidates | T069 benchmark before lock |
| 007 | Owner-only; hard fees0 | No trial/billing/paid fallback |

## 17.2. Milestone và release gates

| Milestone | Scope | Required gate |
| :---- | :---- | :---- |
| M0 / v0.1 | Online slice \+ weekly planner | T001–026,T052–053,T064–069 |
| M1 / v0.2 | HSK1 \+ text tutor/writing | T032–039,T041–045,T061 |
| M2 / v0.3 | Offline \+ recording \+ ops | T027–031,T040,T070 |
| M3 / v0.4 | HSK2 | T046–048 |
| M4 / v0.5 | HSK3 | T049–051 |
| M5 / v1.0 | HSK4/readiness | T054–056 |

## 17.3. Traceability: requirement → schema → API → task

| Requirement | Schema | API | Tasks |
| :---- | :---- | :---- | :---- |
| Học/chấm | sessions, attempts | sessions/attempts | T015–021 |
| Mastery/next/lịch tuần | skill\_mastery, weekly plans | today/progress, weekly-plan | T019,T024,T064–067 |
| FSRS | cards, review\_logs | reviews | T022–025 |
| Offline (v0.3) | leases, sync\_events | sync/batch/state | T027–031 |
| Tutor (v0.2) | turns, memories | tutor/turns/memory | T035–039 |
| Speech (v0.3/P2) | speech\_attempts | local/browser; reserved API | T040,T057–059 |
| Assessment | blueprints, reports | assessment/\* | T041–042,T049–056 |
| Rights/privacy | sources, tombstones | publish/data | T002,T013,T061,T068–070 |

Kết thúc Master Plan v1.1 — 70 IDs, current M0 online34; tasks pending/deferred, chưa triển khai code. Scope/release activation và phí0 có ưu tiên; update cùng schema/API/backlog khi accepted change.  
