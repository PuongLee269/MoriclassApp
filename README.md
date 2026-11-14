# MORI Admin

App quản lý đăng ký cho ME.MORI Class (moriclass.com). Một người dùng (chủ lớp), ưu tiên điện thoại.

## Luồng hoạt động

```
Form moriclass.com ─▶ Apps Script nhận đăng ký (đã có, ở repo website)
                         ├─ thêm dòng vào Google Trang tính, tab DangKy (status = new)
                         └─ gửi email báo cho chủ lớp
App này (Apps Script riêng, chỉ chủ lớp) ─▶ đọc tab DangKy, cập nhật cột I đến M
```

Chủ lớp liên hệ học viên qua Zalo, điện thoại hoặc email, ghi nhật ký tư vấn, rồi xác nhận thủ công. Không có thanh toán trực tuyến, không đối soát ngân hàng.

## Cấu trúc repo

| Đường dẫn | Nội dung |
|---|---|
| `apps-script/Code.gs` | Máy chủ: xác thực chủ lớp, đọc và ghi Trang tính |
| `apps-script/Index.html` | Giao diện (một file). Mở trực tiếp trong trình duyệt để xem thử bằng dữ liệu mẫu |
| `apps-script/appsscript.json` | Manifest: múi giờ, quyền, chế độ triển khai |
| `test/code.test.mjs` | Kiểm thử logic với Trang tính giả (`node --test test/code.test.mjs`) |
| `docs/DEPLOY.md` | Các bước triển khai và kiểm tra trên Trang tính thật |
| `docs/PROMPT-*.md` | Prompt giao việc |

## Dữ liệu: tab `DangKy`

Hàng 1, cột A đến M, đúng thứ tự (app dừng lại nếu tiêu đề khác):

`id | createdAt | name | phone | email | workshop | preferredContact | message | status | note | contactLog | confirmedAt | updatedAt`

- Website ghi A đến H và đặt `status` = `new`. **App không bao giờ sửa A đến H.**
- App chỉ ghi I đến M của đúng một dòng, tìm theo `id`: `status`, `note`, `contactLog`, `confirmedAt`, `updatedAt`.
- Trạng thái hợp lệ: `new`, `contacted`, `confirmed`, `cancelled`.
- Form hiện đăng ký cho lớp F2 (`workshop = F2`). App hiện mã lạ nguyên văn, không tự đặt tên.
- Cột `phone` là văn bản thuần nên giữ số 0 đầu. App đọc theo giá trị hiển thị.
- Bốn dòng `[KIỂM TRA HỆ THỐNG]` (DK0001 đến DK0004) vẫn hiện trong danh sách, có nhãn "Kiểm tra", nhưng **không tính vào thống kê**. Không có thao tác xóa trong app.

### Định dạng `contactLog`

Văn bản thuần, mỗi mục một dòng, chỉ nối thêm vào cuối:

```
2026-11-14 10:42 | Đã gọi, hẹn 17h
2026-11-14 10:43 | Trạng thái: Mới → Đang tư vấn
```

Chọn định dạng này vì đọc được ngay trong Trang tính và nối thêm không cần đọc lại cả ô. Dữ liệu cũ không bị chuyển đổi: nếu ô đã có nội dung khác định dạng, app giữ nguyên và nối mục mới xuống dưới; khi hiển thị, dòng không theo mẫu hiện không kèm giờ. Giờ là giờ Việt Nam. Mỗi mục tối đa 1.000 ký tự, cả ô tối đa 45.000 ký tự.

`confirmedAt` được ghi khi chuyển sang `confirmed`. Nếu sau đó hủy, `confirmedAt` giữ nguyên làm lịch sử, thống kê chỉ đếm theo `status`. `updatedAt` đổi sau mỗi lần ghi và dùng làm "phiên bản" để phát hiện xung đột.

## Bảo mật

- Không có API công khai. App là một Apps Script **riêng**, triển khai `Execute as: Me`, `Who has access: Only myself`.
- Mọi hàm đọc và ghi (`apiLoad`, `apiUpdate`) kiểm tra ở máy chủ: email người dùng phải trùng `OWNER_EMAIL`. Thiếu cấu hình hoặc không xác định được email thì từ chối. Ẩn nút ở giao diện không phải là biện pháp bảo vệ.
- Cấu hình (`SPREADSHEET_ID`, `OWNER_EMAIL`) nằm trong Script Properties, không trong mã.
- Ghi: dùng `LockService`, tìm dòng theo `id` và kiểm tra lại `id` ngay trước khi ghi, so `updatedAt` để phát hiện hai phiên ghi chồng nhau (trả lỗi xung đột kèm bản mới nhất, không ghi đè), ép ô ghi về định dạng văn bản thuần để `=...` không thành công thức, rồi đọc lại để xác nhận A đến H không đổi và I đến M đúng giá trị.
- Nội dung do học viên nhập luôn được escape khi hiển thị.
- App không gửi email, không đụng endpoint nhận đăng ký công khai.
- Lưu ý: hai Apps Script khác nhau không dùng chung khóa. Website chỉ thêm dòng ở cuối, app chỉ ghi vào một dòng đã có, và app kiểm tra lại `id` trước khi ghi, nên hai bên không đè nhau.

## Chưa làm: lịch học và số chỗ trống

Tab `DangKy` không có buổi học, sức chứa hay quan hệ học viên với buổi. Vì vậy màn "Lịch học" hiện trạng thái trống và app không tính chỗ còn trống. Đề xuất (chưa tạo, cần chủ lớp đồng ý):

- Tab `BuoiHoc`: `sessionId | workshop | startAt | endAt | room | capacity`.
- Tab `GhiDanh`: `registrationId | sessionId | confirmedAt`, do app ghi khi xác nhận. Tách riêng để không đổi tiêu đề `DangKy` (script website kiểm tra nghiêm 13 cột).
- Số chỗ đã giữ chỉ đếm các dòng `GhiDanh` có đăng ký đang `confirmed`, không đếm `new`.

## Kiểm thử

- `node --test test/code.test.mjs`: 19 kiểm thử logic với Trang tính giả (quyền, đọc, chuyển trạng thái, A đến H không đổi, xung đột, công thức, nhật ký, đầu vào sai). Đây là mô phỏng dịch vụ Google, **không thay thế** kiểm tra trên Trang tính thật.
- Danh sách kiểm tra trên Trang tính thật: `docs/DEPLOY.md`.
