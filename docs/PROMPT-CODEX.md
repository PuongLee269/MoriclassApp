# Nhiệm vụ: kết nối form đăng ký của moriclass.com với Google Trang tính

## Bối cảnh
- Website moriclass.com (repo GitHub) là site tĩnh. Form đăng ký đã có, nhưng chưa gửi dữ liệu về đâu.
- Chủ site dùng một mình tài khoản Google Workspace. Dữ liệu đăng ký lưu trong một Google Trang tính, và app quản lý riêng (chạy trên Apps Script gắn vào chính Trang tính này) sẽ đọc và cập nhật dữ liệu đó.
- Phần của bạn: đưa dữ liệu từ form vào Trang tính và gửi email báo cho chủ site. KHÔNG làm app quản lý, không sửa dữ liệu cũ.

## Việc cần làm
1. Tạo một Google Apps Script (gắn vào Trang tính) có hàm `doPost` nhận đăng ký, ghi một dòng mới vào tab `DangKy`, rồi gửi một email thông báo.
2. Sửa form trên website để gửi dữ liệu tới Apps Script đó.
3. Hướng dẫn chủ site cách triển khai Apps Script (từng bước, ngắn gọn). Chủ site tự triển khai và cấp quyền, bạn không có quyền vào Google của họ.

## Trang tính: tab `DangKy`
Hàng 1 là tiêu đề, đúng từng ký tự, đúng thứ tự:

`id | createdAt | name | phone | email | workshop | preferredContact | message | status | note | contactLog | confirmedAt | updatedAt`

- Cột A đến H: do website ghi.
- Cột I đến M: thuộc về app quản lý. Khi thêm dòng mới, chỉ đặt `status` = `new`, các cột J đến M để trống. Tuyệt đối không sửa, xóa hay ghi đè dòng đã có, chỉ thêm dòng mới ở cuối.
- `id`: định dạng `DK0001`, `DK0002`... tăng dần, không trùng. Dùng `LockService` khi sinh id và thêm dòng để hai đăng ký cùng lúc không trùng id.
- `createdAt`: chuỗi ISO có múi giờ Việt Nam, ví dụ `2026-11-14T10:42:00+07:00`.
- **Cột `phone` phải định dạng văn bản thuần (Plain text) cho cả cột, và ghi giá trị dạng chuỗi.** Nếu không Trang tính sẽ mất số 0 đầu (`0903112458` thành `903112458`). Kiểm tra lại sau khi ghi.
- Chống chèn công thức: nếu giá trị người dùng nhập bắt đầu bằng `=`, `+`, `-`, `@`, thêm dấu `'` phía trước trước khi ghi.

## Dữ liệu form gửi lên (JSON)
```json
{
  "name": "Nguyễn Minh Anh",
  "phone": "0903112458",
  "email": "minhanh@mail.com",
  "workshop": "tu-duy-hinh-anh-cinematic",
  "preferredContact": "zalo",
  "message": "…",
  "website": ""
}
```
- Bắt buộc: `name` (tối đa 100 ký tự), `phone` (số điện thoại Việt Nam, 9 đến 11 chữ số sau khi bỏ khoảng trắng và dấu).
- Tùy chọn: `email` (nếu có thì kiểm tra định dạng), `message` (tối đa 1000 ký tự).
- `workshop` chỉ nhận: `storytelling-video-ngan`, `tu-duy-hinh-anh-cinematic`, `quay-dung-cho-creator`. Nếu website hiện dùng mã khác, báo lại cho chủ site chứ không tự đổi tên trong Trang tính.
- `preferredContact` chỉ nhận `zalo`, `phone`, `email`; mặc định `zalo`.
- `website` là ô ẩn chống bot, luôn để trống. Nếu có giá trị thì bỏ qua đăng ký và vẫn trả về thành công để bot không biết.
- Cắt khoảng trắng đầu cuối mọi trường. Kiểm tra lại toàn bộ ở phía Apps Script, không tin dữ liệu từ trình duyệt.
- Chống trùng: nếu cùng `phone` và cùng `workshop` đã gửi trong 10 phút gần nhất thì không thêm dòng mới.

## Giới hạn của Apps Script cần xử lý
- Web app của Apps Script không trả header CORS cho trình duyệt đọc được. Gửi bằng `fetch` với `mode: 'no-cors'` và `Content-Type: text/plain;charset=utf-8` (hoặc cách tương đương), và coi "gửi xong, không lỗi mạng" là thành công. Form phải:
  - khóa nút gửi trong lúc đang gửi,
  - báo "Đã gửi, ME.MORI sẽ liên hệ bạn sớm" khi xong,
  - báo lỗi mạng và gợi ý liên hệ qua `<EMAIL_LIEN_HE_DU_PHONG>` nếu gửi thất bại.
- Khi triển khai, web app đặt "Execute as: Me", "Who has access: Anyone".

## Email thông báo
- Gửi bằng `MailApp.sendEmail` tới `<EMAIL_CHU_SITE>` mỗi khi có đăng ký mới.
- Tiêu đề: `Đăng ký mới: <name> - <tên workshop>`.
- Nội dung là văn bản thuần, không chèn HTML. Dữ liệu người dùng nhập chỉ hiển thị như văn bản.
- Nội dung gồm: id, họ tên, số điện thoại, email, workshop, cách muốn được liên hệ, lời nhắn, giờ đăng ký, và đường link mở trong app quản lý: `<APP_URL>#dang-ky/<id>`.
- Nếu gửi email lỗi, vẫn giữ dòng đã ghi và ghi lỗi bằng `console.error`, không làm hỏng việc lưu đăng ký.

## Bảo mật (bắt buộc)
- Không đưa khóa, token, mật khẩu hay email cá nhân vào repo. Địa chỉ email nhận thông báo và `APP_URL` đặt trong `PropertiesService.getScriptProperties()`, không viết cứng trong mã.
- Địa chỉ web app Apps Script được phép nằm trong mã của website (nó vốn công khai), nhưng không in ra console hay hiện cho người dùng.
- Không có endpoint nào trả dữ liệu đăng ký ra ngoài. `doGet` chỉ trả `{"ok":true}` hoặc một trang trống.
- Không log số điện thoại hay email vào console.
- Tùy chọn nếu chủ site yêu cầu: Cloudflare Turnstile để chống bot.

## Cách làm việc
- Làm trên một nhánh mới, commit gọn, không push lên `main` khi chưa được chủ site đồng ý.
- Không thay đổi giao diện hay nội dung khác của website ngoài form và đoạn gửi dữ liệu.
- Không đổi tên cột, tên tab hay thứ tự cột của Trang tính. Nếu cần thay đổi cấu trúc, hỏi chủ site trước.

## Khi xong, báo lại cho chủ site
1. Dòng tiêu đề thật của tab `DangKy` và 2 đến 3 dòng mẫu đã ghi thử (che bớt số điện thoại).
2. Tên file mã Apps Script và các bước triển khai.
3. Danh sách mã `workshop` đang dùng trên form.
4. Kết quả thử: gửi một đăng ký thử, đã thấy dòng mới trong Trang tính chưa, số điện thoại còn số 0 đầu không, email có đến không.
5. Những gì chưa làm hoặc chưa kiểm tra được.
