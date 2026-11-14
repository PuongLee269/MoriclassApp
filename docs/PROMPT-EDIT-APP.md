# Nhiệm vụ: chỉnh sửa giao diện app quản lý đăng ký lớp học ME.MORI Class

## Bản hiện có
Một trang HTML duy nhất (`apps-script/Index.html`), CSS và JS viết trực tiếp, không dùng framework. Máy chủ nằm ở `apps-script/Code.gs`. Mở trực tiếp file HTML trong trình duyệt thì chạy bằng dữ liệu mẫu (có banner báo rõ), còn khi chạy trong Apps Script thì đọc và ghi Trang tính thật. Giao diện không được tự ghi vào cột A đến H.

## App này làm gì
ME.MORI Class (moriclass.com) là lớp học nghệ thuật kể chuyện, cinematic, quay dựng cho creator. Chủ lớp dùng app một mình, chủ yếu trên điện thoại, để:
1. Nhận đăng ký từ form trên website (thông báo qua email).
2. Chủ động liên hệ học viên qua Zalo, điện thoại hoặc email để tư vấn.
3. Ghi lại nội dung tư vấn, rồi **xác nhận thủ công** học viên vào lớp.
4. Xem lịch học theo tuần và số chỗ còn trống.
Không có thanh toán trực tuyến, không đối soát ngân hàng. Học phí chỉ để hiển thị.

## Trạng thái đăng ký
`new` (Mới) → `contacted` (Đang tư vấn) → `confirmed` (Đã xác nhận). Từ `new` hoặc `contacted` có thể chuyển sang `cancelled` (Đã hủy), và từ `cancelled` có thể mở lại thành `contacted`. Khi chuyển sang `confirmed`, số học viên của buổi học tương ứng tăng thêm 1.

## Màn hình
- **Tổng quan:** 4 số liệu (chờ liên hệ, đang tư vấn, đã xác nhận trong tháng, chỗ còn trống tuần này), danh sách "Cần liên hệ" (đăng ký mới, sắp theo chờ lâu nhất), buổi học hôm nay.
- **Đăng ký:** bảng có lọc theo trạng thái. Bấm một dòng mở ngăn chi tiết bên phải: thông tin học viên, lời nhắn từ form, ba dòng liên hệ (Zalo, SĐT, Email) có nút Chép, nút Mở Zalo (`https://zalo.me/<số điện thoại>`), cách liên hệ ưu tiên của học viên được viền cam, nhật ký tư vấn kèm ô thêm ghi chú, và nút chuyển trạng thái.
- **Lịch học:** lưới tuần 7 ngày, mỗi buổi hiện tên workshop, giờ, phòng, số học viên trên sức chứa. Nút "Thêm buổi học" hiện mới chỉ là chỗ giữ chỗ.
- **Kết nối:** sơ đồ 4 bước, các công tắc thông báo, địa chỉ nhận đăng ký, nút "Giả lập đăng ký mới".

## Dữ liệu mẫu cần giữ cấu trúc
Workshop: `A` Storytelling cho video ngắn (990.000 ₫, 20 chỗ), `B` Tư duy hình ảnh cinematic (1.290.000 ₫, 16 chỗ), `C` Quay dựng cho creator (1.490.000 ₫, 12 chỗ). Một đăng ký gồm: `id`, `name`, `phone`, `email`, `k` (mã workshop), `s` (chỉ số buổi học), `at`, `age` (giờ đã chờ), `pref` (`zalo`, `phone`, `email`), `msg`, `status`, `log` (danh sách {thời gian, nội dung}).

## Ràng buộc thiết kế (giữ nguyên trừ khi được yêu cầu đổi)
- Tông tối, điểm nhấn màu cam hổ phách, phông Bricolage Grotesque cho tiêu đề, Be Vietnam Pro cho nội dung, JetBrains Mono cho mã và số điện thoại. Có cả giao diện sáng và tối, dùng biến CSS, mặc định theo hệ thống.
- Dùng được trên điện thoại (thanh tab dưới cùng) và máy tính (thanh bên). Không cuộn ngang trang.
- Văn bản hiển thị bằng tiếng Việt, ngắn, trực tiếp, nút nói rõ việc nó làm.
- Mọi chữ do học viên nhập (tên, lời nhắn, ghi chú) phải hiển thị như văn bản thuần, không chèn thành HTML.
- Địa chỉ email và số điện thoại hiển thị dạng chữ để chép được, vì liên kết `tel:` và `mailto:` có thể không hoạt động trong trình xem.

## Việc muốn làm tiếp
- <điền việc cần làm>

## Khi làm xong
Giữ nguyên tên các trạng thái và các trường dữ liệu trên, vì sau này app sẽ đọc và ghi vào Google Trang tính với cùng cấu trúc đó. Báo lại những gì đã đổi, và nói rõ chỗ nào chưa kiểm tra trên điện thoại.
