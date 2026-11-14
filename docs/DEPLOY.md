# Triển khai MORI Admin

Chủ lớp tự làm các bước này trong tài khoản Google của mình. Mã không có quyền vào Google của bạn và repo không chứa khóa nào.

## Quyền Google sẽ xin (cần chủ lớp đồng ý)

| Quyền | Dùng để |
|---|---|
| Xem, chỉnh sửa và xóa **mọi** Trang tính trong Google Drive của bạn (`spreadsheets`) | Mở Trang tính theo ID rồi đọc tab DangKy và ghi cột I đến M. Mã chỉ mở đúng một ID, nhưng quyền Google cấp là cho mọi Trang tính (script độc lập không xin được quyền hẹp hơn) |
| Xem địa chỉ email của bạn (`userinfo.email`) | Kiểm tra người truy cập là chủ lớp |

App không xin quyền gửi email.

## Các bước

1. Vào https://script.google.com, chọn **Dự án mới**. Đặt tên `MORI Admin`.
   **Không dùng lại** dự án nhận đăng ký công khai. Dự án đó triển khai cho "Bất kỳ ai", còn app này phải riêng.
2. Dán `apps-script/Code.gs` vào `Code.gs`.
3. Thêm tệp HTML: dấu `+` cạnh Tệp, chọn HTML, đặt tên `Index` (không đuôi), dán `apps-script/Index.html`.
4. Cài đặt dự án, bật **Hiện tệp kê khai `appsscript.json`**. Dán nội dung `apps-script/appsscript.json` vào đó.
5. Cài đặt dự án, mục **Thuộc tính tập lệnh**, thêm:
   - `SPREADSHEET_ID` = ID Trang tính (đoạn giữa `/d/` và `/edit` trong địa chỉ Trang tính).
   - `OWNER_EMAIL` = email Google của chủ lớp.
6. Trong trình soạn thảo, chọn hàm `apiLoad` rồi **Chạy**. Google hỏi cấp quyền, kiểm tra hai quyền ở bảng trên rồi chấp nhận. Kết quả chạy phải là `ok: true`.
7. **Triển khai**, **Tùy chọn triển khai mới**, loại **Ứng dụng web**:
   - Thực thi bằng: **Tôi**
   - Người có quyền truy cập: **Chỉ mình tôi**
8. Mở địa chỉ `/exec` trên điện thoại, đăng nhập đúng tài khoản chủ lớp. Chọn "Thêm vào Màn hình chính".
9. Gửi địa chỉ `/exec` cho bên phụ trách website để đặt `APP_URL` trong script nhận đăng ký. Email sẽ mở `<APP_URL>#dang-ky/<id>`.
10. Mỗi lần sửa mã: **Quản lý tùy chọn triển khai**, **Sửa**, **Phiên bản mới**, **Triển khai**. Địa chỉ `/exec` giữ nguyên.

## Kiểm tra trên Trang tính thật

Đánh dấu mỗi mục sau khi tự xem. Không dùng học viên thật để thử ghi.

- [ ] Mở địa chỉ bằng tài khoản Google khác (hoặc cửa sổ ẩn danh): bị từ chối, không thấy dữ liệu.
- [ ] Mở bằng tài khoản chủ lớp: thấy DK0001 đến DK0004, số điện thoại còn số 0 đầu, nhãn "Kiểm tra", thống kê không đếm bốn dòng này.
- [ ] Để thử ghi, thêm một dòng thử (tên bắt đầu bằng `[KIỂM TRA HỆ THỐNG]`) qua form website hoặc nhập tay. Thử `new`, `contacted`, `confirmed`, `cancelled`.
- [ ] Mở Trang tính: chỉ cột I đến M của dòng thử đổi. A đến H và các dòng khác giữ nguyên. `confirmedAt` và `updatedAt` có giờ +07:00.
- [ ] Nhập ghi chú bắt đầu bằng `=1+1`: trong Trang tính hiện đúng chữ `=1+1`, không thành công thức.
- [ ] Mở cùng một đăng ký trên hai thiết bị, lưu ở thiết bị A rồi lưu ở thiết bị B: B nhận thông báo xung đột và thấy bản mới.
- [ ] Tắt mạng rồi bấm lưu: có thông báo lỗi mạng, không báo thành công.
- [ ] Bấm liên kết trong email có `#dang-ky/<id>` và `?id=<id>`: mở đúng đăng ký. (Chưa kiểm chứng được ngoài Google: nếu không mở được bằng `#`, báo lại để chuyển hẳn sang `?id=`.)
- [ ] Không thấy email thông báo đăng ký bị gửi lại khi app đọc hoặc cập nhật.
