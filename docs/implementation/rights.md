# Source và License Register — T002

Phạm vi: metadata/quyền, không corpus hoặc bài học. SSOT: [Master Plan v1.1, §9.1–9.2](https://docs.google.com/document/d/1frjm6ZWnrBzLV9tZ4xiCQmiF83-QhMu322ntpmJRn30#heading=h.r45gzxiobc1f). Đối chiếu nguồn công khai ngày **2026-10-13 (Asia/Saigon)**. Registry có cấu trúc: [register.json](../../content/sources/register.json). `checksum = null`: chưa lưu snapshot bytes của nguồn. Không có reviewer approval.

## Nguồn HSK chính thức — đã đối chiếu và giới hạn

| ID | Bằng chứng thực đọc | Quyền dùng lại / quyết định |
|---|---|---|
| S01 | URL `1219.pdf` đúng nguồn SSOT; có kết quả chỉ mục tại hosting chính thức. Đọc trực tiếp lỗi timeout/Internal Error, nên bìa/mục lục/ranh giới từ vựng **unverified trong T002** | License dataset/PDF `unknown`; chỉ tham khảo, chưa import/phân phối |
| S01-VOCAB | PDF riêng trên cùng hosting, bìa trang PDF 1 ghi tên HSK考试大纲, issuer CLEC, phát hành **2025-11**, áp dụng **2026-07**; mục lục trang 2 có các cấp HSK1–4 | Chứng cứ bổ sung, không thay S01; quyền dùng lại `unknown` |
| S02 | CTI overview và Legal Notice đọc trực tiếp; năm thành phần syllabus và tổ chức CTI được xác nhận | Website có điều kiện/hạn chế (`restricted`), không open dataset; chỉ link/summary có nguồn |
| S03 | Nội dung trang thông báo Bộ Giáo dục qua chỉ mục tìm kiếm của URL chính thức: tên/mã GF0025-2021, thông báo **2021-03-31**, hiệu lực **2021-07-01**, mục đích chuẩn năng lực | Metadata đối chiếu được qua chỉ mục; HTML/attachment đầy đủ chưa đọc; quyền copy/data `unknown`, chỉ tham khảo |

**Fact / locator.** [CTI overview](https://www.chinesetest.cn/hsk), “About HSK / About the New HSK”: CTI tổ chức HSK, HSK mới theo khung Chinese Proficiency Grading Standards; syllabus gồm nhiệm vụ, chủ đề, từ vựng, ngữ pháp, chữ Hán. Không từ đó suy ra số câu, thời lượng, điểm đỗ hoặc áp dụng tại mọi điểm thi.

[S01 đúng URL SSOT](https://hsk.cn-bj.ufileos.com/3.0/%E6%96%B0%E7%89%88HSK%E8%80%83%E8%AF%95%E5%A4%A7%E7%BA%B21219.pdf) và [S01-VOCAB, PDF riêng](https://hsk.cn-bj.ufileos.com/3.0/%E6%96%B0%E7%89%88HSK%E8%80%83%E8%AF%95%E5%A4%A7%E7%BA%B2%EF%BC%88%E8%AF%8D%E6%B1%87%E3%80%81%E6%B1%89%E5%AD%97%E3%80%81%E8%AF%AD%E6%B3%95%EF%BC%89.pdf) có filename/scope khác nhau. Ngày tháng đọc ở bìa file sau không được gán là đã đọc bìa file đầu. Không lưu bytes, không hash giả, không ghi số lượng từ vựng từ cache. `hsk-exam-2025-11` là mã phiên bản dự án; publisher metadata phải trace đúng file.

[S03 thông báo](https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202103/t20210329_523304.html), heading/date và đoạn đầu/nêu mục đích, xác nhận chuẩn do Bộ Giáo dục và Ủy ban Ngôn ngữ Quốc gia ban hành, phục vụ học/dạy/kiểm tra/đánh giá. Ngày 2021-03-31 là ngày thông báo hiển thị, không suy ngày phát hành chuẩn từ URL `20210329`. [Thông báo tiếng Anh MOE](https://en.moe.gov.cn/news/press_releases/202104/t20210428_528917.html) qua chỉ mục xác nhận ban hành tháng 3, hiệu lực 1/7/2021. Đọc trực tiếp các trang này lỗi; [URL S03 thứ hai](https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202104/t20210422_527601.html) còn **unverified**. Không giữ attachment hoặc danh sách từ chuẩn. **Kết luận sử dụng:** GF0025-2021 là framework; syllabus 2025 là tài liệu scope thi khác phiên bản. Không tự ánh xạ level, hợp nhất danh sách hoặc coi framework là blueprint 2025.

**Terms đã đọc / quyết định.** [CTI Legal Notice](https://www.chinesetest.cn/legal-notice) §3–7 yêu cầu attribution, có loại nội dung bị loại trừ, giới hạn mục đích trích/tái bản, và nhắc thù lao tác giả bài ký tên. Link/tham khảo CTI ghi **Source: www.chinesetest.cn**; nội dung trích/tái bản còn cần nguồn Chinese Test Service Website theo §6. Đây không là grant chung cho PDF ở host khác, corpus, audio hoặc bản phái sinh. Không suy public PDF/government page/owner-only thành public domain. Vì chưa đủ căn cứ, quyền tải/lưu vào project, đưa vào app và phân phối S01/S01-VOCAB/S03 để `unknown`; chỉ dùng metadata, link, diễn giải fact có nguồn. Không có protected source bytes trong project.

## Nguồn audio/chữ khảo sát

| Source ID | Publisher / phiên bản quan sát | License / commercialStatus | Cá nhân, app và phân phối | Quyết định |
|---|---|---|---|---|
| AUDIO-001 | Yoyo Chinese Inc.; chart/terms không thấy version/date | Không thấy grant dùng lại audio; `unknown` | Chart được giới thiệu miễn phí để học trên site; app/PWA, lưu, sửa, tái phân phối chưa rõ quyền | Chỉ tham khảo nguồn gốc; chưa được dùng audio trong app |
| S08-code | David Chanin / chanind; `master/package.json` ghi 3.0.0; docs dùng ví dụ 3.5 | MIT; `allowed` | Code cho phép dùng/copy/sửa/phân phối/bán khi giữ notice | Đủ bằng chứng quyền có điều kiện; chưa tích hợp |
| S08-data | chanind; dữ liệu từ Make Me A Hanzi → font Arphic; `master/package.json` ghi 2.0.1 | Arphic Public License (1999); `allowed` có điều kiện | Data có license riêng; không kế thừa MIT của code | Ứng viên có quyền có điều kiện; chưa import/publish |

Version trên nhánh `master` là metadata đã thấy, không khẳng định release mới nhất hoặc đã khóa bản triển khai. Chưa ghi commit SHA; trước khi dùng phải pin đúng artifact/version và kiểm lại license đi kèm.

**Audio.** [Chart chính thức](https://yoyochinese.com/chinese-learning-tools/Mandarin-Chinese-pronunciation-lesson/pinyin-chart-table) nêu audio/video Mandarin/Pinyin; [Pricing — Free](https://yoyochinese.com/pricing) gồm toàn bộ chart và hướng tới tài khoản miễn phí. Chart yêu cầu signup để xem mọi video; chưa kiểm thử playback, đăng ký hoặc yêu cầu thẻ. Chưa nghe audio: độ sạch, thanh điệu, giọng phổ thông và phù hợp F01/F02/L001/L002 **unverified**, không suy ra từ quảng cáo. [Terms](https://yoyochinese.com/terms), mở đầu/§1/§7/§14: quy định dịch vụ và code nguồn mở không phải grant dùng lại audio; chưa thấy license/version cho audio, attribution/derivatives/redistribution/commercial đều unknown. Không tải, hotlink, sửa hay đóng gói audio vào PWA khi chưa có grant rõ; ghi nguồn không tự tạo quyền.

**Code.** [MIT LICENSE](https://github.com/chanind/hanzi-writer/blob/master/LICENSE) yêu cầu giữ copyright David Chanin và permission notice trong bản sao/phần đáng kể. [Package metadata](https://github.com/chanind/hanzi-writer/blob/master/package.json) và [docs](https://hanziwriter.org/docs.html) là vị trí version; không cài dependency trong T002.

**Data.** [README — License](https://github.com/chanind/hanzi-writer-data/blob/master/README.md) xác nhận tách license và provenance; [package metadata](https://github.com/chanind/hanzi-writer-data/blob/master/package.json). [APL](https://raw.githubusercontent.com/chanind/hanzi-writer-data/master/ARPHICPL.TXT) §0/1/2/5: giữ nguyên ARPHICPL.TXT; sửa phải ghi cách/ngày trong mỗi file, cung cấp toàn bộ bản sửa theo APL, không thêm hạn chế quyền người nhận. §2(c) có notice tương tác nếu điều kiện áp dụng; phần độc lập không tự chịu APL. Không thấy số version license: để null, không gán APL 1.0. Miễn phí/account-free trên public repo không chứng minh điều kiện CDN; kiểm T068 trước dependency dịch vụ.

## Phương án học liệu gốc miễn phí

Nếu thiếu audio có grant rõ: đề xuất người đủ chuyên môn Mandarin tự viết câu ngắn và thu âm tình nguyện bằng thiết bị sẵn có, không dùng nền nhạc/trích đoạn sách. Chưa có người nhận hoặc bản thu. Trước sử dụng cần văn bản consent/grant miễn phí của tác giả/người đọc cho lưu, phát trong app, cắt/chỉnh và phân phối; chốt attribution và phạm vi thương mại, ghi provenance/version. Không tạo audio/pipeline trong T002; không coi bản AI là chuyên gia duyệt.

## Gates và handoff (chưa thực hiện)

- **T005:** giữ nguồn syllabus và chuẩn năng lực tách biệt; exam blueprint/counts chỉ dùng khi có locator/version đúng.
- **T014:** mỗi asset/exercise phải trace source/version/locator, xác nhận quyền cho cách dùng thực tế, đáp án và rubric; unknown rights không nhập/publish. Nếu sửa APL data, chuẩn bị notice/license và cách cung cấp bản sửa.
- **T016:** reviewer đủ chuyên môn kiểm chữ/Pinyin/đáp án và nghe từng audio cho giọng phổ thông, thanh điệu, chất lượng, khớp transcript; lưu người/ngày/kết quả sửa và approval thực tế. Chưa có reviewer thì giữ gap/beta theo SSOT, không tự approved.
- **T068:** xác minh điều kiện miễn phí/quota/account/no-billing thực tế trước provider/CDN/cloud setup; audio website miễn phí không phải dependency được duyệt. Không trial/credits/paid fallback.

Blockers: exact S01 PDF/S03 full attachment chưa đọc trực tiếp; exam blueprint và quyền reuse chính thức chưa chốt; chưa có quyền tái dùng AUDIO-001/nghe/duyệt audio; chưa pin artifact S08 hoặc kiểm đủ đóng gói APL. Đây là gates downstream, không giấu bằng cách đánh dấu nguồn approved. Owner-only không thay quyền copy/redistribute. Quyết định license không đồng nghĩa nội dung được xuất bản; tất cả còn qua review và task gates.

## Quy tắc bổ sung record và validation

Mỗi record giữ ID ổn định, publisher/URL/type/version, ngày nguồn nếu biết, accessedAt riêng, evidence ID + URL + page/section + cách đọc + status. Chỉ tính checksum khi thật sự có authorized snapshot bytes; bản branch master hiện tại chưa có commit pin. License id/name/version/url tách terms URL; unknown/null không đổi thành allowed vì có free plan hoặc attribution. `commercialStatus` chỉ nói quyền của nguồn, không mở commercial scope sản phẩm.

`permitted_with_conditions` cho code/data là kết luận grant có điều kiện, không reviewer approval hoặc published. Muốn dùng phải kiểm đúng artifact/terms và fulfill notices; mọi nguồn qua source→validation→language/answer/audio review→rights gate→immutable release theo §9.2, ở task tương ứng. Trong T002 chỉ JSON/evidence/link validation; phí 0, không accounts/import/lessons/dependencies.
