# CINE3D - Premium 3D Cinematic Movie Streaming Platform

## Quản lý nâng cấp VIP

Luồng VIP mặc định sử dụng xác nhận giao dịch thủ công:

1. Người dùng đăng nhập, mở `/vip`, chọn gói và tạo đơn.
2. Admin mở Dashboard → **Đơn thanh toán VIP**.
3. Admin bấm **Xác nhận đã trả** để cộng dồn thời hạn VIP.

Đặt `VIP_PAYMENT_MODE=disabled` trên backend để tắt tạo/xác nhận đơn. Các gói mặc định được tạo bởi Prisma seed và không bị ghi đè nếu đã tồn tại trong database.

Website xem phim trực tuyến với thiết kế giao diện không gian 3D, chiều sâu điện ảnh cao cấp và mượt mà. 

Dự án được xây dựng trọn vẹn cả Frontend, Backend, Database PostgreSQL và tích hợp Docker Compose để dễ dàng triển khai.

---

## 🛠 Công Nghệ Sử Dụng

### Frontend
- **Framework**: Next.js 15+ (App Router) & React & TypeScript
- **CSS / Styling**: Tailwind CSS (v4)
- **3D Graphics & Animations**: Three.js, React Three Fiber (R3F), @react-three/drei, Framer Motion
- **Streaming Client**: HLS.js (cho các nguồn phát HLS `.m3u8`)
- **State Store**: Zustand (quản lý Auth, Favorites, History)

### Backend
- **Framework**: Node.js & Express.js & TypeScript
- **Database ORM**: Prisma ORM & PostgreSQL
- **Security**: JWT Access/Refresh tokens, bcrypt password hashing, Helmet, CORS, Rate limiting

---

## 📦 Yêu Cầu Cài Đặt Hệ Thống

Bạn cần cài đặt các phần mềm sau trước khi khởi chạy dự án:
1. **Node.js** (Phiên bản v18 hoặc cao hơn)
2. **Docker & Docker Desktop** (Khuyên dùng để khởi chạy PostgreSQL và Nginx tự động)

---

## 🚀 Hướng Dẫn Chạy Dự Án

### Cách 1: Khởi chạy bằng Docker Compose (Khuyên dùng)

1. Mở **Docker Desktop** trên máy tính.
2. Tại thư mục gốc của dự án, mở Terminal (PowerShell/CMD) và chạy lệnh:
   ```bash
   docker compose up -d
   ```
3. Lệnh này sẽ tự động tải các Image, tạo các container cho Database (PostgreSQL), API Backend và Next.js Frontend.
4. Sau khi khởi chạy thành công:
   - **Frontend Client**: Truy cập [http://localhost:3000](http://localhost:3000)
   - **Backend API**: Truy cập [http://localhost:5000](http://localhost:5000)
   
*Lưu ý: Quá trình đẩy cơ sở dữ liệu (`npx prisma db push`) và khởi tạo bảng được thiết lập chạy tự động trong Dockerfile của backend.*

---

### Cách 2: Khởi chạy thủ công (Development Mode)

Nếu bạn không chạy Docker, bạn có thể khởi chạy riêng lẻ backend và frontend:

#### 1. Khởi chạy Database & Backend API
1. Đảm bảo bạn đang có một máy chủ **PostgreSQL** chạy trên localhost (cổng 5432).
2. Tạo database tên là `webxemphim`.
3. Kiểm tra file `.env` tại thư mục `/backend/.env` xem các thông số kết nối đúng chưa:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/webxemphim?schema=public"
   PORT=5000
   JWT_ACCESS_SECRET="webxemphim_super_access_token_secret_998877"
   JWT_REFRESH_SECRET="webxemphim_super_refresh_token_secret_998877"
   CLIENT_URL="http://localhost:3000"
   ```
4. Di chuyển vào thư mục backend và cài đặt dependencies:
   ```bash
   cd backend
   npm install
   ```
5. Đẩy database schema và khởi tạo dữ liệu mẫu (seeding):
   ```bash
   npx prisma db push
   npx prisma db seed
   ```
6. Khởi chạy máy chủ API:
   ```bash
   npm run dev
   ```

#### 2. Khởi chạy Next.js Frontend
1. Di chuyển vào thư mục frontend:
   ```bash
   cd ../frontend
   ```
2. Cài đặt dependencies:
   ```bash
   npm install
   ```
3. Khởi chạy Next.js dev server:
   ```bash
   npm run dev
   ```
4. Mở trình duyệt tại địa chỉ [http://localhost:3000](http://localhost:3000).

---

## 🔑 Khởi tạo tài khoản quản trị

Production không tạo tài khoản hoặc mật khẩu mẫu. Nếu cần khởi tạo admin lần đầu, đặt
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (tối thiểu 12 ký tự) và tùy chọn
`SEED_ADMIN_USERNAME` trước khi chạy seed. Sau khi tài khoản đã được tạo, nên xóa hai
biến chứa email/mật khẩu khỏi môi trường deploy.

---

## 🎨 Điểm Nhấn Thiết Kế 3D Không Gian Chiều Sâu

- **Ambient Background**: Nền 3D vẽ bằng canvas Three.js chứa hàng ngàn hạt bụi neon chuyển động sóng sánh và một nguồn sáng đuổi theo con trỏ chuột.
- **3D Card Hover**: Nghiêng card phim theo 3D perspective khi rê chuột (`rotateX`, `rotateY`, `translateZ`).
- **Autoplay Video Preview**: Tự động phát trailer mini khi rê chuột vào card phim (chỉ kích hoạt trên Desktop để tối ưu hiệu năng).
- **Theater Light Control**: Cho phép bật/tắt đèn chiếu sáng xung quanh trình phát phim (Watch Page) tăng cảm giác tập trung.
- **Ambience Color Projector**: Phát sáng vùng nền xung quanh khung video theo dải màu rạp phim sống động.
