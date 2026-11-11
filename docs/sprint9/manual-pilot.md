# Pilot micro thật — chủ máy thao tác

Trạng thái ban đầu: **SPRINT9_PARTIAL_HARDWARE_PENDING**. Tín hiệu tổng hợp, recorder/decoder/worker chạy thật và micro vật lý là ba loại bằng chứng khác nhau. Độ chính xác đánh giá phát âm vẫn **UNVERIFIED**.

## Windows trước

1. Mở `http://127.0.0.1:3015/learn/pronunciation?pilot=1&target=pron-tone-1-v1` bằng Chrome/Edge Windows, chọn LOCAL DATABASE. Chưa bấm ghi thì app không yêu cầu micro.
2. Điền Windows, tên/phiên bản trình duyệt, micro laptop/tai nghe thực sự đang dùng. Chọn nguồn **Tôi đang nói vào micro vật lý thật**, lưu thiết lập. Chỉ chọn nguồn này khi chính bạn đang nói vào thiết bị; không dùng nguồn ảo/tổng hợp để tạo hardware PASS. Đổi thiết bị/nguồn cần một báo cáo mới; lưu lại thiết lập xóa các lượt trong form.
   Sau báo cáo cả hai bản nghe còn tạp âm nặng, pilot có **Giảm ồn khi thu · trình duyệt xử lý**, bật sẵn. Giữ bật cho lượt thử mới; sau khi dừng, ghi lại dòng **đã yêu cầu / trình duyệt báo**. Bật yêu cầu không chứng minh browser đã bật hoặc âm thanh đã sạch. Đổi chế độ bỏ audio và hai đường cũ, không tự ghi lại. Xem [giới hạn và kết quả follow-up](noise-followup.md).
3. Trong phòng tương đối yên tĩnh, chọn Thanh 1. Bấm ghi và cho phép micro trong trình duyệt; nếu chọn sai thiết bị, sửa trong phần quyền micro của browser. Xem thanh mức tín hiệu; đây là mức âm thanh, không nhận dạng giọng hoặc điểm phát âm. Không có số đo không chứng minh micro hỏng. Không cố nói lớn nếu bản nghe đã rõ.
4. Để khoảng nửa giây đầu yên lặng nếu muốn thử lọc nền. Đọc một âm tiết riêng theo hướng dẫn DRAFT có sẵn rồi dừng. Các nhãn hiện tại là mā · 妈, má · 麻, mǎ · 马, mà · 骂; đây là ví dụ viết đã có, không phải giọng mẫu được cấp quyền hoặc học liệu đã duyệt. Không ép thanh 3 trong câu phải võng xuống rồi bật lên.
5. Nghe hết **bản gốc** rồi mới bấm phân tích; đánh dấu chỉ đọc một âm tiết. Nếu nghe nhỏ/rè/giảm mức bất thường, ghi đúng hiện tượng vào form. Có thể dùng Nghe riêng đoạn đọc để thử cắt/lọc, nhưng phần cao độ vẫn phân tích bản thu gốc theo tùy chọn riêng. Không lấy bản đã lọc thay cho bằng chứng chất lượng gốc.
6. Xem ba phần phản hồi. Dùng Xem cách sửa / Xem khẩu hình để mở đúng note/hình đang chọn. Với thanh, hình là hướng giọng lý tưởng hóa, không phải phép đo môi/lưỡi. Ghi lượt tiếp để nhìn hai đường và nhận xét trung lập; một đường đẹp hoặc lên nhiều hơn chưa chứng minh phát âm tốt hơn.
7. Điền rõ/không rõ, đồ thị khớp/nghi ngờ/chưa biết, nhận xét dễ hiểu/khó hiểu, lỗi runtime/UI và PASS/FAIL/NOT_TESTED. Chọn **Lượt cần ghi nhận** để chỉnh lại lượt trước. Mỗi target tối đa ba lần trong một lần mở pilot; không bắt buộc cố thêm nếu đã mệt hoặc kết quả vẫn không rõ.
8. Lặp cho Thanh 2, 3, 4. Bấm Tải báo cáo pilot JSON khi muốn giữ bản kết quả; chỉ metadata, số khung/mã trạng thái và lời bạn nhập được tải xuống. Không có raw audio, PCM, full F0 curve hoặc file WAV trong báo cáo. Nếu phản hồi trong chat, chỉ cần gửi thiết bị/browser/micro và những dòng kết quả đáng chú ý; không cần gửi giọng thu.

Giữ tab phía trước trong lúc ghi/nghe/phân tích. Chuyển tab/đổi âm/rời trang sẽ bỏ audio tạm và dừng xử lý; form metadata vẫn ở RAM cho đến khi rời/reload trang. Lưu ý tải báo cáo trước khi reload. Nghe hết ở đây là sự kiện phát tới cuối file, không chứng minh người thử đã nghe hiểu; đánh giá rõ/khớp/dễ hiểu vẫn do chủ máy tự ghi.

Chỉ khi bạn đồng ý riêng giữ giọng trên máy để chẩn đoán: mở **Lưu bản gốc để chẩn đoán cục bộ · tùy chọn** dưới **Bản gốc · toàn bộ lần ghi**, rồi bấm **Tải audio gốc về máy**. Nút này tải toàn bộ dữ liệu gốc đang phát, chưa cắt/lọc local; xử lý khi thu của browser nếu bật đã nằm trong dữ liệu. Không lấy file ở “Đoạn đọc đã chọn” thay cho bản gốc. File audio khác với báo cáo JSON chỉ metadata; app không tự tải, không upload và không yêu cầu gửi file lên chat. Các file chủ máy đã cung cấp đủ để tái hiện [giới hạn hiện tại](real-audio-investigation.md); không cần thu thêm để hoàn tất báo cáo này.

`OWNER_REPORTED_PASS` chỉ xuất hiện cho đúng nền tảng tự khai, có tên browser/micro, nguồn vật lý do chủ máy xác nhận, quyền đã cấp, recorder ready, đã phát hết, đo ANALYZED không cảnh báo, và chủ máy chọn rõ/khớp/dễ hiểu/PASS. Đây không phải chứng nhận chuyên gia hoặc xác minh độc lập. Nguồn tổng hợp/không xác nhận không tạo hardware PASS. Một người thử không đại diện cho độ chính xác thuật toán nói chung.

## Android khi có thiết bị

ADB đã được tìm thấy trong Android SDK, nhưng lần kiểm tra đầu Sprint 9 trả về **0 thiết bị sẵn sàng, 0 pending**. Chưa chạy reverse, chưa thử micro Android.

Nếu chủ máy kết nối điện thoại, bật USB debugging và tự xác nhận hộp thoại tin cậy, kiểm tra lại `adb devices -l`. Chỉ khi đúng thiết bị có trạng thái `device`, có thể dùng `adb reverse tcp:3015 tcp:3015` và mở `http://127.0.0.1:3015` trong Chrome trên điện thoại. Loopback là secure context; HTTP qua địa chỉ LAN thông thường có thể bị browser từ chối micro. Không bỏ qua Origin/Host hoặc production lockout để làm Android chạy. Nếu dùng hostname `localhost` thay vì `127.0.0.1`, phải cấu hình `CSH_APP_ORIGIN` khớp hostname đó rồi chạy lại preview; không mở rộng allowlist tùy tiện.

ADB trên máy hiện tại nằm ngoài PATH; dùng PowerShell như sau (chỉ chạy lệnh reverse sau khi đúng một thiết bị của chủ máy đã được xác nhận):

```powershell
$pilotAdbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $pilotAdbPath devices -l
& $pilotAdbPath reverse tcp:3015 tcp:3015
```

Nếu có nhiều thiết bị, chọn đúng serial và dùng `-s <serial>`; không reverse mặc định sang thiết bị chưa xác định.

Điền Android và thông tin thật trong form của điện thoại, thử cùng protocol. Desktop giả lập viewport 360px không phải bằng chứng micro Android vật lý.

## Mẫu phản hồi ngắn

```text
Nền tảng / browser / micro:
Thanh / lượt:
Permission: granted / denied / không rõ
Nghe bản gốc: rõ / nhỏ / rè / bị hạ mức
Phân tích: status / reason / số khung giữ
Đồ thị: có vẻ khớp / nghi ngờ / chưa biết
Nhận xét: dễ hiểu / khó hiểu
Runtime/UI hoặc kết quả nghi ngờ:
Kết luận của người thử: PASS / FAIL / NOT_TESTED
```
