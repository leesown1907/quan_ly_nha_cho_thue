# Phần mềm Quản lý Nhà cho thuê — Nhà 57 Giảng Võ

Hệ thống web quản lý nhà trọ / chung cư mini xây dựng theo báo cáo môn học (Nhóm 43 — ĐHBK Hà Nội).

## 1. Công nghệ sử dụng

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | ReactJS 19, Vite 6, Tailwind CSS 4, React Router 7, Recharts, Lucide Icons |
| Backend | Node.js, Express 5, JWT, bcryptjs |
| Cơ sở dữ liệu | PostgreSQL (`pg` kết nối PostgreSQL Server **hoặc** PostgreSQL nhúng `@electric-sql/pglite` chạy ngay không cần cài đặt) |

## 2. Cấu trúc thư mục

```text
f:\project
├── backend/
│   ├── src/
│   │   ├── db/            # schema.sql, kết nối PostgreSQL/PGlite, dữ liệu mẫu (seed)
│   │   ├── middleware/    # Xác thực JWT, phân quyền vai trò (401/403), xử lý lỗi
│   │   ├── routes/        # REST API: auth, users, rooms, tenants, contracts, fees, readings, invoices, payments, incidents, notifications, stats
│   │   ├── services/      # Logic tổng hợp và xuất hóa đơn hàng kỳ
│   │   └── utils/         # Kiểm tra dữ liệu, gửi thông báo tự động
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/    # Layout, thanh điều hướng, chuông thông báo, UI dùng chung
│   │   ├── context/       # AuthContext, FeedbackContext (toast & hộp thoại xác nhận)
│   │   ├── hooks/         # useApi, useDebounce
│   │   ├── pages/         # 12 trang chức năng cho Chủ nhà & Người thuê
│   │   └── utils/         # Định dạng tiền tệ, ngày tháng, nhãn trạng thái
│   └── package.json
└── package.json
```

## 3. Hướng dẫn cài đặt và chạy

### Yêu cầu
- Cài đặt **Node.js >= 20** (tải tại https://nodejs.org).
- **PostgreSQL** là tùy chọn:
  - Nếu chưa cài PostgreSQL, hệ thống tự động dùng **PostgreSQL nhúng (PGlite)** và lưu dữ liệu tại `backend/data/pgdata`, tự khởi tạo bảng và dữ liệu mẫu ngay lần chạy đầu tiên.
  - Nếu dùng PostgreSQL Server, sao chép `backend/.env.example` thành `backend/.env` và điền `DATABASE_URL=postgresql://user:pass@localhost:5432/ten_db`.

### Cài đặt thư viện
```powershell
npm run install:all
```

### Chạy môi trường phát triển (2 cửa sổ terminal)
```powershell
# Terminal 1 — Backend API (http://localhost:5000)
npm run dev:backend

# Terminal 2 — Frontend Vite (http://localhost:5173)
npm run dev:frontend
```
Mở trình duyệt tại **http://localhost:5173**.

### Hoặc đóng gói và chạy trên 1 cổng duy nhất
```powershell
npm run build
npm start
# Truy cập http://localhost:5000
```

### Đặt lại dữ liệu mẫu ban đầu
```powershell
npm run db:reset
```

## 4. Tài khoản dùng thử (được tạo sẵn)

| Vai trò | Tên đăng nhập | Mật khẩu | Ghi chú |
| --- | --- | --- | --- |
| Chủ nhà / Quản lý | `admin` | `admin123` | Toàn quyền quản lý |
| Người thuê | `tenant01` .. `tenant10` | `123456` | Đang thuê các phòng P101..P401 |

## 5. Đáp ứng yêu cầu chức năng (FR01 – FR32)

- **Đăng nhập & Phân quyền (FR01–FR04):** Đăng nhập, đăng xuất (hủy hiệu lực token), đổi mật khẩu, cấp tài khoản, khóa tài khoản, phân quyền Chủ nhà / Người thuê (trả về HTTP 403 nếu truy cập trái quyền).
- **Quản lý phòng (FR05–FR09):** Thêm/sửa/xóa phòng, 3 trạng thái (*Phòng trống, Đang cho thuê, Đang sửa chữa*), tự đồng bộ trạng thái theo hợp đồng, chặn xóa phòng đang thuê hoặc đã có lịch sử.
- **Quản lý người thuê (FR10–FR12):** Hồ sơ cư trú, cấp tài khoản đi kèm, lưu trữ lịch sử khi khách chuyển đi.
- **Quản lý hợp đồng (FR13–FR16):** Lập hợp đồng cho phòng trống, sửa điều khoản, gia hạn, thanh lý hợp đồng.
- **Quản lý khoản phí & điện nước (FR17–FR20):** Thiết lập đơn giá điện/nước và phí dịch vụ (theo phòng hoặc theo đầu người), bảng ghi chỉ số điện nước hàng kỳ tự lấy chỉ số cũ từ kỳ trước.
- **Hóa đơn & Thanh toán (FR21–FR24):** Tự động tổng hợp xuất hóa đơn hàng kỳ, xác nhận thanh toán (toàn bộ hoặc từng đợt), theo dõi hạn thanh toán, công nợ và lịch sử giao dịch.
- **Tìm kiếm & Thống kê (FR25–FR27):** Tìm kiếm/lọc trên mọi danh sách; Dashboard biểu đồ doanh thu, tỷ lệ phòng, công nợ và hợp đồng sắp hết hạn.
- **Báo cáo sự cố & Thông báo (FR28–FR32):** Người thuê gửi sự cố, chủ nhà cập nhật tiến độ xử lý; thông báo tự động cho hóa đơn, thanh toán, hợp đồng, khoản phí và sự cố.
