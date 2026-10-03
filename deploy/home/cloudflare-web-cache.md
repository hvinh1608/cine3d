# Cloudflare — tăng tốc trang web (HTML)

Hiện origin là máy nhà qua Tunnel. Cloudflare mặc định **không cache HTML**
(`cf-cache-status: DYNAMIC`) → mỗi lần mở trang vẫn đợi máy nhà.

## Cách 1 (khuyến nghị, Free): Cache Rule

1. Cloudflare Dashboard → domain `cine3d.id.vn` → **Caching** → **Cache Rules**
2. **Create rule**
3. If:
   - Hostname equals `cine3d.id.vn`
   - AND URI Path does not start with `/account`
   - AND URI Path does not start with `/admin`
   - AND URI Path does not start with `/watch`
   - AND URI Path does not start with `/api`
   - AND URI Path does not start with `/apk`
4. Then:
   - **Eligible for cache**: Yes / Cache eligibility → Eligible
   - **Edge TTL**: Override → 2 minutes (hoặc Respect origin)
5. Deploy

Sau vài request, `curl -sI https://cine3d.id.vn/` sẽ thấy `cf-cache-status: HIT`.

## Cách 2: Origin headers (đã có trong code)

Frontend gửi `CDN-Cache-Control: s-maxage=120` cho trang công khai.
Một số gói CF cần thêm Cache Rule (cách 1) mới thực sự HIT.

## Không đụng

- Ảnh phim: đã qua **Cloudinary** CDN — đúng chỗ.
- Tài khoản / xem phim: không cache HTML (riêng tư).
