# MORI Admin

App quản lý đăng ký và lịch học cho ME.MORI Class (moriclass.com). Một người dùng, ưu tiên điện thoại.

## Luồng hoạt động

1. Học viên điền form trên moriclass.com.
2. Dữ liệu vào Google Trang tính (tab `DangKy`) và email báo về chủ lớp.
3. Chủ lớp liên hệ qua Zalo, điện thoại hoặc email, ghi nhật ký tư vấn.
4. Chủ lớp xác nhận học viên thủ công trong app.

Không có thanh toán trực tuyến và không đối soát ngân hàng.

## Trạng thái hiện tại

`index.html` là **bản giao diện để duyệt**, dùng dữ liệu mẫu cứng trong mã. Chưa có backend. Mở trực tiếp file trong trình duyệt để xem.

Bước tiếp theo: chuyển thành Google Apps Script gắn vào Trang tính, đọc và ghi cùng cấu trúc dữ liệu dưới đây.

## Cấu trúc Trang tính `DangKy`

`id | createdAt | name | phone | email | workshop | preferredContact | message | status | note | contactLog | confirmedAt | updatedAt`

- Cột A đến H do website ghi (việc của Codex). Cột I đến M do app ghi.
- Cột `phone` phải để định dạng văn bản thuần, nếu không mất số 0 đầu.
- Trạng thái: `new`, `contacted`, `confirmed`, `cancelled`.

## Tài liệu

- [docs/PROMPT-CODEX.md](docs/PROMPT-CODEX.md): giao việc nối form website với Trang tính.
- [docs/PROMPT-EDIT-APP.md](docs/PROMPT-EDIT-APP.md): giao việc chỉnh sửa giao diện app.

## Bảo mật

Không commit khóa, token hay dữ liệu học viên thật vào repo này. Địa chỉ email và cấu hình nhạy cảm đặt trong Script Properties của Apps Script.
