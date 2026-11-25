# Mitsui Cold Chain Control Tower (CCT)

## 1. Giới thiệu nhanh & Link truy cập trực tuyến

**Mitsui Cold Chain Control Tower (CCT)** là hệ thống điều phối chuỗi lạnh rau củ quả tươi theo mô hình *asset-light* trên hành lang **ĐBSCL – Bến Lức – TP.HCM** (quy mô thí điểm 500–600 tấn/tháng). Hệ thống quản lý xuyên suốt **6 bước vận hành** và **5 điểm bàn giao điện tử ePOD (BG1–BG5)** gắn theo từng mã lô và dữ liệu nhiệt độ liên tục từ logger, giúp phân định trách nhiệm minh bạch, tính cước *Take-or-Pay*, theo dõi 8 KPI thí điểm và truy xuất nguồn gốc QR công khai.

- **Link truy cập trực tuyến (Vercel Production):** `{{VERCEL_PRODUCTION_URL}}`
- **Cơ sở dữ liệu:** Neon PostgreSQL Serverless (`cct_store`) tự động khởi tạo bảng và seed dữ liệu mẫu ngay lần chạy đầu tiên.

---

## 2. Bản đồ đường dẫn truy cập (URL)

| Cổng / Chức năng | Đường dẫn | Đối tượng sử dụng | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Cổng Khách hàng B2B (Trang chính)** | `/` và `/customer` | Khách hàng B2B (BHX, Saigon Co.op, WinCommerce) | Truy cập link gốc `/` tự động vào thẳng `/customer`. Ẩn hoàn toàn menu Admin. |
| **Đăng nhập / Đăng ký Khách hàng B2B** | `/customer/login` | Khách hàng B2B mới hoặc đã có tài khoản | Nền *Two Horizons* (`:: Viola`), đăng ký lưu thẳng vào Neon PostgreSQL. |
| **Cổng đăng nhập Quản trị & Nội bộ** | `/admin` | Điều phối viên, Quản lý/QC, Quản trị hệ thống Mitsui | Nền *Two Horizons* (`:: Aurum`), giữ phiên đăng nhập 7 ngày và tự chuyển vào `/control-tower/admin`. |
| **Web Điều Phối Mitsui (Control Tower)** | `/control-tower/*` | Nội bộ Mitsui đã đăng nhập qua `/admin` | Bảo vệ bởi phiên cookie ký HMAC 7 ngày; chưa đăng nhập tự chuyển về `/admin`. |
| **App Hiện trường (Mobile-first)** | `/field-app` | HTX, Cơ sở sơ chế, Kho lạnh, Tài xế | Thiết kế nút lớn ngoài trời, có chế độ mất sóng **Offline Mode 24h**. |
| **Trang Truy xuất QR Công khai** | `/qr/[token]` | Người tiêu dùng (không cần đăng nhập) | Lọc sạch toàn bộ thông tin nội bộ (giá, biển số, tên kho, khiếu nại theo FR-49). |

### Các đường dẫn QR công khai mẫu

| Mã QR Token | Lô hàng | Kết quả hiển thị trên `/qr/[token]` | Ý nghĩa kiểm thử |
| :--- | :--- | :--- | :--- |
| `qr-tg-clean-001` | `MT01-261124-001` | **Đạt chuỗi lạnh** | Đủ 5/5 BG, nhiệt độ ổn định 0–4°C, **hiển thị tên HTX Tiền Giang** (`allowPublicName: true`). |
| `qr-dt-hidden-002` | `MT01-261124-002` | **Đạt chuỗi lạnh** | Đủ 5/5 BG, nhiệt độ ổn định 10–13°C, **ẩn tên HTX Đồng Tháp** theo BR-15 (`allowPublicName: false`). |
| `qr-excursion-003` | `MT01-261124-003` | **Không đạt chuỗi lạnh** | Xe trung chuyển vọt nhiệt 9.5°C trong 25 phút (cảnh báo BR-07). |
| `qr-intransit-009` | `CG02-261125-001` | **Đang vận chuyển** | Lô chưa hoàn tất bàn giao BG5 (FR-50). |

---

## 3. Danh sách tài khoản & mật khẩu đăng nhập

### Nhóm 1: Admin & Nội bộ Mitsui (Đăng nhập tại `/admin`)

| Vai trò | Họ tên | Email | Mật khẩu | OTP 2FA |
| :--- | :--- | :--- | :--- | :--- |
| **Quản trị hệ thống 02** | Quản trị viên Hệ thống 02 | `admin2@mitsui-cct.vn` | `Admin@2026` | `123456` |
| **Quản trị hệ thống** | Lê Hoàng Nam | `nam.le@mitsui-cct.vn` | `Admin@2026` | `123456` |
| **Điều phối viên** | Nguyễn Minh Tuấn | `tuan.nguyen@mitsui-cct.vn` | `Mitsui@2026` | `123456` |
| **Quản lý / QC** | Trần Thị Lan Anh | `lananh.tran@mitsui-cct.vn` | `Mitsui@2026` | `123456` |

### Nhóm 2: Khách hàng B2B (Đăng nhập tại `/customer/login` hoặc chuyển nhanh trên `/customer`)

| Doanh nghiệp | Họ tên | Email | Mật khẩu |
| :--- | :--- | :--- | :--- |
| **Bách Hóa Xanh (BHX)** | Phạm Quốc Bảo (BHX) | `bao.pham@bachhoaxanh.com` | `Customer@2026` |
| **Saigon Co.op** | Võ Thị Thu Hà (Saigon Co.op) | `ha.vo@saigoncoop.vn` | `Customer@2026` |
| **WinCommerce** | Đặng Văn Hùng (WinCommerce) | `hung.dang@wincommerce.vn` | `Customer@2026` |

### Nhóm 3: Nhân sự hiện trường (Thao tác tại `/field-app`)

| Vai trò | Tổ chức | Họ tên | SĐT đăng nhập | OTP |
| :--- | :--- | :--- | :--- | :--- |
| **Nhà cung cấp (HTX)** | HTX Rau An Toàn Tiền Giang | Nguyễn Văn Hai | `0913000001` | `123456` |
| **Nhà cung cấp (HTX)** | HTX Nông Sản Đồng Tháp | Lê Thị Ba | `0913000002` | `123456` |
| **Nhân viên sơ chế** | Cơ sở sơ chế Mỹ Tho (`MT01`) | Nguyễn Văn Bình | `0914000001` | `123456` |
| **Nhân viên sơ chế** | Cơ sở sơ chế Cần Giuộc (`CG02`) | Trần Thị Cúc | `0914000002` | `123456` |
| **Nhân viên kho lạnh** | Kho lạnh NECS – Bến Lức | Lý Minh Hải | `0915000001` | `123456` |
| **Tài xế / Vận tải** | ABA Cooltrans | Võ Tấn Phát | `0916000001` | `123456` |

---

## 4. Hướng dẫn sử dụng nhanh từng nhóm chức năng

- **Khách hàng B2B (`/customer` & `/customer/login`):**
  - Đăng ký doanh nghiệp mới hoặc đăng nhập tài khoản có sẵn.
  - Tạo đơn ngày mới (chặn mặt hàng ngoài hợp đồng khung; đơn gửi sau `14:00` ngày D-1 tự gắn nhãn **Phát sinh**).
  - Theo dõi thanh tiến độ sản lượng lũy kế so với cam kết *Take-or-Pay*.
  - Ký bàn giao `BG5` (nhập kg đạt / không đạt / lý do), gửi khiếu nại trong cửa sổ `24h`, xác nhận bảng kê tháng và xuất file CSV/Excel.
- **Admin / Điều phối / QC (`/admin` → `/control-tower/*`):**
  - Duyệt hoặc từ chối đơn phát sinh kèm lý do; tổng hợp nhu cầu cộng hệ số hao hụt và phát hành kế hoạch ngày D.
  - Quản lý tồn kho buồng lạnh (`>= 80%` cảnh báo hạn lưu, xuất theo FEFO) và xếp chuyến thủ công (chặn cứng theo **BR-05** nếu trộn lô khác nhóm nhiệt vào cùng khoang hoặc vượt tải trọng).
  - Giả lập IoT 5 phút/lần hoặc upload CSV logger, xử lý cảnh báo vượt ngưỡng `> 15` phút / mất tín hiệu `> 30` phút.
  - Xem hồ sơ lô, đường nhiệt độ liên tục BG1–BG5, tách lô con, tạo biên bản điều chỉnh (NFR-06) và ra phán quyết khiếu nại theo gợi ý BR-10.
  - Tính cước *Take-or-Pay*, xem báo cáo hòa vốn `400 tấn/tháng`, theo dõi 8 KPI & chấm điểm đối tác hàng tháng, chỉnh tham số hệ thống và bấm **Khôi phục dữ liệu mẫu (Reset Demo)** tại `/control-tower/admin`.
- **Lực lượng hiện trường (`/field-app`):**
  - Xác nhận kế hoạch thu hoạch & khai báo VietGAP (HTX); ghi phân loại đạt/loại, tạo lô và in tem QR (Sơ chế); nhập/xuất kho FEFO (Kho); nhận chuyến & Check-in GPS (Tài xế).
  - Bật công tắc **Giả lập mất sóng (FR-33)** để ký ePOD ngoại tuyến lưu vào hàng đợi trên thiết bị, sau đó tắt chế độ mất sóng để hệ thống tự đồng bộ lên Neon PostgreSQL mà không trùng lặp.
- **Tương tác nền *Two Horizons* (`/admin` & `/customer/login`):**
  - Bấm `:: Aurum` hoặc `:: Viola` ở giữa đáy màn hình để chuyển cảnh hố đen + tiền cảnh điện ảnh (có hiệu ứng chớp chuyển cảnh).
  - Bấm `SOUND: OFF / ON` ở góc trên bên phải để bật/tắt âm thanh ambient không lời và tiếng click UI.

---

## 5. Hướng dẫn chạy Local (PC & Điện thoại cùng Wi-Fi)

```bash
# 1. Cài đặt thư viện
npm install

# 2. Khởi chạy (file .env kết nối Neon PostgreSQL đã có sẵn trong repo)
npm run dev
```

- **Trên máy tính:** mở `http://localhost:3000` (tự động vào `/customer`), hoặc `http://localhost:3000/admin` cho cổng quản trị.
- **Trên điện thoại cùng mạng Wi-Fi:** mở `http://<LAN-IP-MAY-TINH>:3000/field-app` để quét QR và ký bàn giao ePOD đồng bộ trực tiếp lên Control Tower.
