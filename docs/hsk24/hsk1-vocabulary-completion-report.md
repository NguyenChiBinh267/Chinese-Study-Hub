# HSK1 — mốc hoàn tất từ vựng DRAFT

1. **Trạng thái:** `HSK1_VOCABULARY_COMPLETE / HSK1_CURRICULUM_PARTIAL`. Đủ từ vựng có dạy và luyện; chưa đủ bằng chứng gọi toàn bộ chương trình hoàn tất.

2. **Nhánh và bản kiểm chứng:** `feat/hsk24-curriculum`; bản nội dung `fc3d7ad6ca443c331bf755c948be6225511082a2`, bản kiểm chứng `3c3a8089eb72e306537049951248ae8ac1ec47d1`. SHA cuối sau commit báo cáo được ghi trong phản hồi bàn giao. Baseline được phép: `bbd8aa6b6a739e7f30bb3864e86e6b45b041d6d5`.

3. **Các đợt:** 14 đợt L101–L170; hai đợt đầu 25 từ/đợt, đợt 3 có 22, 11 đợt sau 20. Tổng 292 từ mới + 8 từ đã có. Mỗi đợt có validation/import, SQL, so sánh lịch sử và commit local.

4. **Đơn vị/bài:** 14 unit HSK1 mới với 70 bài giới thiệu, 14 bài ôn và 4 chẩn đoán; thêm 3 unit/bài Foundation F03–F05. Tổng 91 hoạt động mới. HSK1 hiện có 72 bài giới thiệu và 90 hoạt động; kèm Foundation thành 95 hoạt động.

5. **Từ vựng:** 300/300 ordinal chính thức có khối dạy chữ/pinyin/nghĩa/giải thích và câu luyện gắn đúng khái niệm trong bài giới thiệu hiện hành. Không tính chỉ vì xuất hiện trong tag hoặc bài ôn. Danh sách thiếu rỗng; xem [ma trận bằng chứng](hsk1-learning-evidence.json). Nguồn PDF 406 trang, SHA `ec74ce0439e837bbb15154be13e747ae798903b2fd3a331629df6c3b45504941`.

6. **Ngữ pháp:** mẫu số 70 hàng vật lý; 45 hàng có tham chiếu trực tiếp và 3 nhãn cũ chưa hòa giải đúng hàng. Đây là tham chiếu một phần: mỗi hàng có thể gồm nhiều cách dùng. 25 hàng chưa được gắn được liệt kê trong JSON; chưa tuyên bố hoàn tất 45 hàng đã gắn.

7. **Chữ Hán:** 246/246 glyph được liên kết nguồn trong từ, 83 glyph có câu nhận diện riêng có gợi ý. 163 glyph chưa có đích luyện riêng. Không đồng nhất với nhớ độc lập. Danh sách 100 chữ viết dùng chung HSK1–2: 0 chữ được đánh giá viết tay; không tự chế tập con riêng HSK1.

8. **Chủ đề:** 27/30 nhánh lá có metadata tương ứng, cùng 1 nhãn cha cũ. Thiếu tham chiếu `课后活动`, `工作评价`, `传统饮品`. 27 nhánh đã gắn vẫn cần kiểm tra tình huống/độ bao phủ, không được coi là 27 tình huống hoàn chỉnh.

9. **Nhiệm vụ giao tiếp:** 15/15 đề mục cha có tham chiếu; mẫu số 59 bullet vật lý. Các hội thoại viết không chứng minh đủ mọi bullet hoặc năng lực nghe/nói.

10. **Foundation và luồng người mới:** giữ nguyên F01/F02/L001/L002; thêm F03 ghép âm đầu/vần, F04 vần/ü/quy tắc viết âm tiết, F05 chữ Hán/cấu trúc câu/nhập đáp án. Dùng lại 31 ghi chú, 26 sơ đồ phát âm và TTS tổng hợp tùy chọn chưa duyệt. Hướng dẫn đi theo Foundation→HSK1 và ưu tiên phiên chưa xong đúng phiên bản; hoàn tất nháp không tự cấp prerequisite/mastery.

11. **Ôn/chẩn đoán:** L181–L194 là 14 bài ôn unit; L196–L199 là 4 chẩn đoán chọn mẫu, có ngữ cảnh gốc mới, đọc hiểu và xếp câu. Không phải đề thi HSK chính thức. 108 liên kết nguồn ở 18 hoạt động trỏ đúng phiên bản/hash/khái niệm bài giới thiệu hiện hành và dùng lại danh tính thẻ FSRS.

12. **Bài tập:** 728 câu mới hiện hành, gồm 704 HSK1 + 24 Foundation. 102 phiên bản mới khai báo tổng 816 câu theo phiên bản: 728 hiện hành và 88 ở các bản cũ giữ lại, không phải 816 câu độc lập mới. HSK1 hiện 716 câu; Foundation 38; tổng 754. Toàn bộ 5 khóa hiện 479 hoạt động/3826 câu; 624 phiên bản bất biến được đăng ký trong sandbox. Không cộng phiên bản cũ vào số câu hiện hành.

13. **Điều tra trình duyệt cũ:** aggregate HSK4 `18 PASS /2 FAIL /9 chưa chạy` được giữ nguyên. Một ca ở lại `/schedule` quá 15 giây; một ca tiếp tục chạy khi DB đã offline. Ở mốc HSK1 trước còn ghi nhận POST lạnh bị hủy gần 14,99 giây và một GET 503 `LOCAL_DB_UNAVAILABLE`. Sửa lỗi kiểm tra nút Start chưa kịp render và lỗi đọc cursor trước khi xác nhận HTTP/session; không nâng timeout hoặc tự retry. Ở matrix 300 từ, 5 PASS/1 FAIL/10 chưa chạy: L199 mở đúng URL unit nhưng hai GET curriculum bị hủy gần 14992 ms; ca này không ghi nhận 503. Lượt mobile đầu 0 PASS/1 FAIL/2 chưa chạy: test rời onboarding 7,7 ms sau click trước khi chọn chế độ được xác nhận, rồi thấy DEMO; POST mode bị hủy gần 20 giây. Test đã sửa để đợi điều hướng `/schedule` sau xác nhận, tách khởi tạo route development bằng GET chỉ đọc. Không coi bản sửa test là chứng minh sửa gốc mọi lỗi cold/503. Gate vẫn **OPEN**.

14. **Kết quả cuối:** unit 134/134; SQL 120/120 = Foundation 9 +HSK1 95 +HSK2 6 +HSK3 5 +HSK4 5, 0 FAIL/0 SKIP. Typecheck/lint/lint bổ sung/build production PASS. Trình duyệt cuối: matrix `5 PASS / 1 FAIL / 10 không chạy`; mobile HSK1 `3 PASS / 0 FAIL / 0 không chạy`; navigation/lịch/Today `8 PASS / 0 FAIL / 0 không chạy`; beginner `2 PASS / 0 FAIL / 0 không chạy`; hồi quy HSK4 mobile `1 PASS / 0 FAIL / 0 không chạy`. Kết quả từng ca/những ca không chạy nằm trong JSON, không cộng các lượt chạy độc lập thành một suite sạch. Review kỹ thuật độc lập PASS ở bản nội dung và các delta kiểm tra; không phải duyệt ngôn ngữ có chuyên môn. Quét 33 JS/maps production, 968995 byte toàn bộ tập tệp, 4974 mã key/624 phiên bản: 0 hit; đây không phải kích thước tải đầu tiên hay chứng minh tuyệt đối không rò rỉ. Native Today: lần đầu 221,5 ms, sau làm nóng 83,8–88,9 ms; 23 SQL/lượt, 0 full source package/DB manifest, 1 kết nối vật lý. Không phải SLA HTTP.

15. **Bảo toàn dữ liệu:** đúng sandbox `csh_hsk24_bf294b6506c1` tại localhost:5447; ban đầu 522 package bindings/4540 attempts/1999 sessions/3228 cards. Sau mỗi đợt và sau kiểm tra cuối, mọi hàng baseline ở 19 bảng và mọi package binding cũ giữ nguyên. 526 tệp nội dung bất biến cũ cũng giữ nguyên Git blob theo review độc lập. Số tăng thêm là dữ liệu chủ thử nghiệm mới; không xóa hoặc thay sandbox đã có dữ liệu.

16. **Giới hạn ngôn ngữ/nguồn:** toàn bộ nội dung thêm là DRAFT; 0 bản được người có chuyên môn duyệt, 0 bản phát hành, 0 mastery được cấp bởi báo cáo. Mapping nguồn được kiểm tra kỹ thuật, bản dịch/cách dạy/audio chưa có chứng nhận chuyên môn. Các sửa là phiên bản bổ sung, giữ bản cũ; 谁 chấp nhận đúng hai biến thể shéi/shuí theo nguồn đã ghim.

17. **Checkpoint tiếp:** không còn ordinal từ vựng thiếu. Tiếp tục 25 hàng ngữ pháp chưa gắn và các tiểu mẫu còn thiếu; 163 đích nhận diện chữ; 3 nhánh chủ đề; kiểm tra đủ 59 nhiệm vụ theo kỹ năng; viết tay/nghe/nói và duyệt của người có chuyên môn; xử lý cold HTTP/503. Danh sách cụ thể và trạng thái không suy diễn nằm trong [JSON báo cáo](hsk1-vocabulary-completion-report.json).

18. **Bản xem thử:** [HSK1 local](http://127.0.0.1:3037/learn/courses/HSK1). UI đã tăng chữ chức năng lên 14px, đoạn thông báo 16px/65ch, ghi chú sidebar 16px; giữ tên trang hiện tại ở 360px và cho sidebar cuộn khi màn hình thấp. [Ảnh desktop](../../.local-postgres/hsk24/hsk1-300-ui-desktop.png) và [ảnh 360px](../../.local-postgres/hsk24/hsk1-300-ui-mobile360.png) được chụp lại ở mốc này. Bản owner đang host không được triển khai thay đổi trong công việc này.

19. **Git:** toàn bộ thay đổi thuộc nhiệm vụ được commit local khi bàn giao; `graphify-out/` chưa theo dõi có sẵn được giữ nguyên. Không push, merge, deploy, sửa Master Plan/task-status hay ghi cloud. Bằng chứng chi tiết ở các tệp `.local-postgres/hsk24/hsk1-*`; checksum những tệp chốt nằm trong JSON đi kèm.
