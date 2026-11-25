# Phần mềm Quản lý Nhà cho thuê (Nhà 57 Giảng Võ) — 

> Ứng dụng web quản lý nhà trọ / chung cư mini tập trung giúp chủ nhà vận hành phòng, người thuê, hợp đồng bản Word, điện nước, hóa đơn, công nợ và hỗ trợ người thuê tra cứu minh bạch, gửi báo cáo sự cố trực tuyến.

## 1. Giới thiệu sản phẩm
- **Bài toán / người dùng đích:** Thay thế việc quản lý nhà trọ thủ công bằng sổ sách/Excel vốn dễ phân tán và nhầm lẫn khi tính tiền phòng, điện nước, công nợ. Hệ thống phục vụ 2 nhóm người dùng chính:
  - **Chủ nhà / Người quản lý (Admin):** Quản lý toàn bộ phòng, người thuê, hợp đồng, đơn giá dịch vụ, chỉ số điện nước, xuất hóa đơn, xác nhận thanh toán, xử lý sự cố và xem thống kê doanh thu/công nợ.
  - **Người thuê (Tenant):** Xem thông tin phòng, hợp đồng bản Word, theo dõi chỉ số điện nước, hóa đơn, lịch sử thanh toán và gửi/theo dõi báo cáo sự cố.
- **Tính năng chính của MVP:**
  1. **Xác thực & Phân quyền (FR01–FR04):** Đăng nhập/đăng xuất (hủy phiên token), đổi mật khẩu, cấp tài khoản và phân quyền chặt chẽ giữa Chủ nhà và Người thuê (trả về HTTP 403 khi truy cập trái quyền).
  2. **Quản lý Phòng, Người thuê & Hợp đồng bản Word (FR05–FR16):** Quản lý 3 trạng thái phòng (*Phòng trống, Đang cho thuê, Đang sửa chữa*) tự động đồng bộ theo hợp đồng; xem hợp đồng định dạng văn bản Word (`.doc`), in ấn và **cập nhật, gia hạn, thanh lý trực tiếp trên bản Word**.
  3. **Quản lý Điện nước, Phí dịch vụ, Hóa đơn & Thanh toán (FR17–FR24):** Thiết lập đơn giá điện/nước và dịch vụ (theo phòng/đầu người), ghi chỉ số công tơ hàng kỳ, tự động tổng hợp xuất hóa đơn, xác nhận thanh toán (toàn bộ hoặc từng đợt) và theo dõi công nợ.
  4. **Báo cáo sự cố, Thông báo & Thống kê (FR25–FR32):** Người thuê gửi sự cố, chủ nhà cập nhật tiến độ xử lý kèm thông báo tự động; Dashboard biểu đồ doanh thu, tỷ lệ lấp đầy phòng, công nợ và hợp đồng sắp hết hạn.
- **Demo:**  · **Ảnh chụp:** 

## 2. Phạm vi MVP
| Trạng thái | Nội dung |
|---|---|
| ✅ Đã làm | Đăng nhập, đăng xuất, đổi mật khẩu, quản lý tài khoản & phân quyền; CRUD phòng, người thuê (lưu lịch sử khi chuyển đi); Lập/xem/cập nhật/gia hạn/thanh lý hợp đồng trực tiếp trên bản Word & tải file `.doc`; Thiết lập đơn giá & phí dịch vụ; Bảng ghi chỉ số điện nước; Xuất hóa đơn hàng kỳ, in hóa đơn, xác nhận thanh toán & lịch sử giao dịch; Báo cáo sự cố & thông báo tự động; Tìm kiếm, lọc dữ liệu và Dashboard thống kê biểu đồ. |
| 🚧 Đang làm | Kiểm thử tự động (unit/integration test) cho API và hoàn thiện tài liệu kiểm thử nghiệm thu. |
| ⬜ Chưa làm | Xuất báo cáo doanh thu/công nợ ra file Excel/PDF; nhắc hạn thanh toán và sắp hết hạn hợp đồng tự động qua email/Zalo. |
| 🚫 Ngoài phạm vi | Quản lý chuỗi nhiều tòa nhà phức tạp, kế toán doanh nghiệp chuyên sâu, tích hợp cổng thanh toán trực tuyến bên thứ ba (VNPay/MoMo). |

## 3. Kiến trúc & công nghệ
```mermaid
flowchart LR
  User["Chủ nhà / Người thuê"] --> UI["Frontend (ReactJS + Vite + Tailwind CSS)"]
  UI -->|"REST API (JSON / JWT)"| API["Backend (Node.js + Express)"]
  API -->|"SQL"| DB[("PostgreSQL / PGlite")]
```
- **Ngôn ngữ / framework:**
  - Frontend: React `19.1`, Vite `6.3`, Tailwind CSS `4.1`, React Router `7.6`, Recharts `2.15`, Lucide React `0.511`.
  - Backend: Node.js `>= 20`, Express `5.1`, `jsonwebtoken 9.0`, `bcryptjs 3.0`.
  - Cơ sở dữ liệu: PostgreSQL (`pg 8.13`), hỗ trợ chạy ngay bằng PostgreSQL nhúng `@electric-sql/pglite 0.3` khi chưa cài PostgreSQL Server.
- **Cấu trúc thư mục:**
  - `frontend/`: Mã nguồn giao diện (`src/pages`, `src/components`, `src/context`, `src/hooks`, `src/utils`).
  - `backend/`: Mã nguồn REST API (`src/routes`, `src/middleware`, `src/services`, `src/db`, `src/utils`).
  - `.github/workflows/`: Cấu hình triển khai tự động.

## 4. Cài đặt & cách sử dụng
**Yêu cầu:** Node.js `>= 20` (PostgreSQL Server là tùy chọn; nếu để trống `DATABASE_URL`, hệ thống tự chạy PostgreSQL nhúng PGlite).

```bash
git clone <fork-url> && cd <project-dir>
cp backend/.env.example backend/.env     # KHÔNG commit .env thật
npm run install:all

# Terminal 1 — Chạy Backend API (http://localhost:5000)
npm run dev:backend

# Terminal 2 — Chạy Frontend (http://localhost:5173)
npm run dev:frontend
```
*(Hoặc đóng gói và chạy 1 cổng duy nhất tại `http://localhost:5000` bằng lệnh `npm run build && npm start`; đặt lại dữ liệu mẫu bằng `npm run db:reset`.)*

**Dữ liệu / tài khoản mẫu (synthetic):** Hệ thống tự khởi tạo dữ liệu giả lập Nhà 57 Giảng Võ gồm 14 phòng (`P101`–`P402`), 11 người thuê, 10 hợp đồng đang hiệu lực + 1 hợp đồng lịch sử, 3 kỳ điện nước, hóa đơn, giao dịch thanh toán và sự cố.
- Chủ nhà / Quản lý: `admin` / `admin123`
- Người thuê: `tenant01` .. `tenant10` / `123456`

**Kịch bản sử dụng:**
1. *Kịch bản 1 — Quản lý hợp đồng trên bản Word (Chủ nhà):* Đăng nhập `admin` → vào **Hợp đồng thuê** → bấm **Xem / Cập nhật / Gia hạn / Kết thúc** → chỉnh sửa trực tiếp trên văn bản Word (A4) và lưu (hoặc tải file `.doc`) → trạng thái hợp đồng, phòng và thông báo cho người thuê tự động cập nhật.
2. *Kịch bản 2 — Ghi điện nước, xuất hóa đơn & xác nhận thanh toán (Chủ nhà):* Vào **Chỉ số điện nước** chọn kỳ và nhập chỉ số mới → bấm **Xuất hóa đơn** → vào **Hóa đơn** mở chi tiết, bấm **Xác nhận thanh toán** → hóa đơn chuyển *Đã thanh toán*, ghi nhận lịch sử giao dịch và cập nhật doanh thu trên **Tổng quan & Thống kê**.
3. *Kịch bản 3 — Tra cứu hóa đơn & báo cáo sự cố (Người thuê):* Đăng nhập `tenant01` → xem phòng & bản Word hợp đồng tại **Phòng & Hợp đồng** → kiểm tra hóa đơn, điện nước → vào **Báo cáo sự cố** gửi yêu cầu sửa chữa → chủ nhà nhận thông báo, cập nhật trạng thái xử lý và người thuê theo dõi tiến độ trực tiếp.

## 5. Hướng phát triển Tuần 11–15
| Tuần | Mục tiêu | Đầu việc chính | Phụ trách (MSSV) | Tiêu chí hoàn thành | Trạng thái |
|:---:|---|---|---|---|:---:|
| 11 | Hoàn thiện & rà soát nghiệp vụ | Rà soát đầy đủ FR01–FR32, bổ sung validate biên và xử lý lỗi API/UI |  | 100% chức năng chạy ổn định không lỗi console | ⬜ |
| 12 | Kiểm thử tự động | Viết test API (auth, phân quyền 403, ràng buộc xóa phòng/người thuê, tính hóa đơn) |  | Toàn bộ test case pass, độ phủ luồng chính đạt yêu cầu | ⬜ |
| 13 | Nâng cao báo cáo & xuất dữ liệu | Bổ sung xuất bảng thống kê doanh thu/công nợ (Excel/CSV), tối ưu truy vấn dashboard |  | Xuất file đúng số liệu, thời gian tải dashboard ≤ 2s | ⬜ |
| 14 | Kiểm thử hiệu năng & bảo mật | Đo tải NFR01–NFR08 với dữ liệu lớn, kiểm tra băm mật khẩu và phân quyền (NFR09–NFR10) |  | Đạt chỉ tiêu phản hồi API và không rò rỉ quyền truy cập | ⬜ |
| 15 | Đóng gói, triển khai & báo cáo | Hoàn thiện bản triển khai, quay video demo, chụp ảnh màn hình và hoàn tất báo cáo cuối kỳ |  | Có bản demo chạy online, tài liệu và slide bảo vệ đầy đủ | ⬜ |

## 6. Nhóm & tuân thủ
- Mã nhóm:  · Thành viên: 
- ✅ Zero PII/PHI: toàn bộ dữ liệu là synthetic.
- Công cụ AI đã dùng & phạm vi: Sử dụng trợ lý AI hỗ trợ sinh khung mã nguồn frontend/backend, tối ưu giao diện Tailwind CSS và soạn thảo tài liệu; nhóm tự rà soát, kiểm thử và điều chỉnh logic nghiệp vụ theo đặc tả môn học.
- Dữ liệu lớn (>10MB): 
