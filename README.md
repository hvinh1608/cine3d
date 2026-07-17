# CINE3D - Premium 3D Cinematic Movie Streaming Platform

## Quản lý nâng cấp VIP

Luồng VIP mặc định sử dụng xác nhận giao dịch thủ công:

1. Người dùng đăng nhập, mở `/vip`, chọn gói và tạo đơn.
2. Admin mở Dashboard → **Đơn thanh toán VIP**.
3. Admin bấm **Xác nhận đã trả** để cộng dồn thời hạn VIP.

Đặt `VIP_PAYMENT_MODE=disabled` trên backend để tắt tạo/xác nhận đơn. Các gói mặc định được tạo bởi Prisma seed và không bị ghi đè nếu đã tồn tại trong database.

### Thanh toán tự động qua payOS

1. Tạo kênh thanh toán tại `my.payos.vn`, sau đó cấu hình `PAYOS_CLIENT_ID`, `PAYOS_API_KEY` và `PAYOS_CHECKSUM_KEY` chỉ trên backend.
2. Đặt `VIP_PAYMENT_MODE=payos`, `PAYOS_RETURN_URL=https://ten-mien/vip?payment=success` và `PAYOS_CANCEL_URL=https://ten-mien/vip?payment=cancelled`.
3. Trong kênh thanh toán payOS, cấu hình webhook công khai HTTPS là `https://api-ten-mien/api/vip/payos/webhook`.
4. Chạy migration/deploy database rồi khởi động lại backend. Đơn PayOS sẽ tự hết hạn sau 30 phút và chỉ được kích hoạt khi webhook có chữ ký hợp lệ, đúng mã đơn và đúng số tiền.

Không đặt ba khóa PayOS trong biến môi trường frontend hoặc commit chúng vào Git.

Website xem phim trực tuyến với thiết kế giao diện không gian 3D, chiều sâu điện ảnh cao cấp và mượt mà. 

## Database production và email tài khoản

Backend tự chạy `prisma migrate deploy` khi khởi động. Database cũ được đồng bộ và ghi nhận migration nền đúng một lần, vì vậy Render không cần mở Shell. Từ những lần deploy tiếp theo, hãy tạo migration mới thay vì dùng `prisma db push` trực tiếp trên production.

Email tài khoản ưu tiên Brevo HTTPS API qua `BREVO_API_KEY` và `MAIL_FROM`, phù hợp cả khi hosting chặn cổng SMTP. Resend và SMTP vẫn được hỗ trợ làm phương án dự phòng. Đặt `PUBLIC_API_URL`, `PASSWORD_RESET_URL` theo production và bật `REQUIRE_EMAIL_VERIFICATION=true` để yêu cầu đăng ký email/mật khẩu phải xác nhận. Tài khoản Google đã được Google xác minh nên không cần nhận email này.

Đăng nhập/đăng ký Google dùng cùng một OAuth 2.0 Web Client ID: đặt `GOOGLE_CLIENT_ID` ở backend và `NEXT_PUBLIC_GOOGLE_CLIENT_ID` ở frontend. Backend xác minh Google ID token trước khi tạo session CINE3D; người dùng Google không cần mật khẩu hay email xác minh riêng.

## Tính năng trải nghiệm nâng cao

- Hồ sơ người xem riêng (tối đa 5), có PIN; lịch sử, yêu thích và xem sau tách biệt theo hồ sơ.
- Theo dõi phim và nhận thông báo khi admin thêm tập mới.
- Playlist riêng tư/công khai, chia sẻ bằng liên kết.
- Quản lý các thiết bị đã đăng nhập và thu hồi phiên từ xa.
- PWA cài được lên màn hình chính, service worker và Web Push.
- Trình phát tự chuyển tập, bỏ mở đầu/phần kết và lưu kiểu phụ đề.
- Phòng xem chung có mật khẩu, đổi tập đồng bộ, chuyển chủ và mời thành viên ra.
- Analytics nội bộ 7 ngày cùng bảng lỗi phát trong Admin Dashboard.

Để bật Web Push trên production, tại backend chạy `npx web-push generate-vapid-keys`, sau đó thêm `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` và `VAPID_SUBJECT=mailto:email-cua-ban` vào Render rồi deploy lại. Không đưa private key sang Vercel; frontend tự lấy public key qua API.

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
