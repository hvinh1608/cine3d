# Chạy CINE3D trên máy nhà (Cloudflare Tunnel)

Frontend + API chạy trên máy này. Tắt máy = web và API chết.

## Một lần duy nhất

1. Cài [Docker Desktop](https://www.docker.com/products/docker-desktop/) và bật nó.
2. File `.env.home` đã được điền (Neon + Google + Brevo). Không commit file này.

3. Tạo tunnel (domain phải nằm trên Cloudflare):

```powershell
.\deploy\home\setup-tunnel.ps1
```

Sửa `deploy\home\config.yml`: UUID tunnel + đường dẫn `credentials-file`.

4. Cloudflare → **Network** → bật **WebSockets**.

## Mỗi lần bật máy

1. Bật Docker Desktop (containers `cine3d-*` ideally Restart=unless-stopped đã tự lên).
2. Cloudflare Tunnel **đã đặt tự chạy** qua Task Scheduler: `CINE3D-Cloudflare-Tunnel` (At logon).

Nếu web public 502, chạy lại tunnel:

```powershell
cloudflared tunnel --config "D:\duan\cine3d\deploy\home\config.yml" run
```

Hoặc gộp Docker + tunnel (giữ cửa sổ mở):

```powershell
.\deploy\home\start-home-api.ps1
```

Cài / sửa lại auto-start (Task Scheduler, không cần service):

```powershell
.\deploy\home\install-tunnel-service.ps1
```

(Tuỳ chọn Windows service: cần UAC Admin; Task Scheduler ổn định hơn trên máy nhà.)

## Kiểm tra

- API local: http://127.0.0.1:5000/health
- Web local: http://127.0.0.1:3000
- API public: https://api.cine3d.id.vn/health
- Web: https://cine3d.id.vn

## Backup Postgres

```powershell
docker exec cine3d-db pg_dump -U cine3d webxemphim > backup-cine3d.sql
```

Không expose cổng 3000/5000/5433 ra LAN. Tunnel chỉ nối ra Cloudflare.

## APK CDN (nhanh hơn máy nhà)

Mặc định link tải APK trỏ **GitHub Releases** (miễn phí, không tốn băng thông tunnel nhà).

Tuỳ chọn **Cloudflare R2** (free 10GB, thường $0 nếu không gắn thẻ / không vượt hạn):

1. Cloudflare → R2 → tạo bucket `cine3d-apk` → bật public `r2.dev`
2. Tạo R2 API Token → ghi vào `.env.home` (xem `.env.home.example`)
3. `node deploy/home/upload-apk-r2.js`
4. Set `NEXT_PUBLIC_ANDROID_APK_URL=https://pub-….r2.dev/cine3d.apk` rồi rebuild frontend

## Tốc độ mở trang web

Ảnh đã qua Cloudinary. Việc còn lại: **cache HTML trên Cloudflare** (máy nhà chỉ phục vụ khi cache hết hạn).

Xem: `deploy/home/cloudflare-web-cache.md`
