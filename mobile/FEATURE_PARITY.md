# Cine3D mobile feature parity

Audited against `frontend/src/app`, `frontend/src/lib/api.ts`, and
`backend/src/routes/api.ts` on 2026-07-18. “Implemented” means a native route
and contract exist; it does not mean provider credentials or device E2E have
been validated.

## Web route mapping

- `/` → `/(tabs)/index` + `HomeScreen`: banners, home rails, recommendations,
  continue watching, category links, refresh/offline cache. Implemented.
- `/search` → `/search` and `/(tabs)/explore` + `ExploreScreen`: debounced
  search, genre/country/year/type/sort filters, paging, recent searches.
  Implemented.
- `/movies/[slug]` → `/movies/[slug]` (canonical) and `/movie/[slug]`
  (compatibility) + `MovieDetailScreen`: metadata, episodes, cast/directors,
  favorite/watchlist/follow, ratings, comments, reports, playlists. Implemented.
- `/watch/[slug]` → `/watch/[slug]` + `NativePlayerScreen`: HLS/MP4, source and
  episode selection, progress, subtitles/audio tracks, gestures, fullscreen,
  PiP, fallback, autoplay-next, entitlement-based MP4 downloads. Implemented.
- `/the-loai/[slug]`, `/quoc-gia/[slug]`, `/nam/[year]` → matching native
  routes + `BrowseScreen`. Implemented.
- `/schedule` → `/schedule` + `ScheduleScreen`. Implemented.
- `/actors/[slug]`, `/directors/[slug]` → matching native routes +
  `PersonScreen`, including authenticated follows. Implemented.
- `/playlists/[id]` → `/playlists/[id]` + `PlaylistDetailScreen`, respecting
  public/private backend access. Implemented.
- `/watch-together` → `/(tabs)/watch-together`: room list/create/join,
  public/private rooms, VIP private-room gate. Implemented.
- `/watch-together/rooms` → `/watch-together/rooms` + `WatchRoomScreen`:
  authenticated direct-route gate, synchronized playback, reconnect/rejoin,
  host controls, chat, reactions, kick/close/leave. Implemented.
- `/account` → `/(tabs)/account` plus `/account/auth`, `/profile`, `/profiles`,
  `/sessions`, `/notifications`, `/settings`, `/feedback`, `/vip`. Implemented
  as native task-focused screens.
- `/vip` → `/account/vip`: hướng dẫn mua VIP trên website (`https://cine3d.id.vn/vip`),
  làm mới trạng thái và lịch sử đơn. Không bán in-app qua Google Play.
- `/feedback` → `/account/feedback`. Implemented.
- `/privacy`, `/terms` → `/account/legal/[document]`. Implemented as bundled
  native legal copy; release owners must keep it synchronized with the public
  policy URLs.
- `/data-deletion` → account legal/deletion request flow. Implemented: authenticated
  clients call `DELETE /user/account` with confirmation `DELETE_MY_ACCOUNT` (password
  required for email/password accounts). Public web page remains at `/data-deletion`
  for users without app access. Admin self-delete is blocked server-side.
- `/admin` → `/admin` + `AdminScreen`: client role guard and server 401/403
  enforcement. Implemented.
- Sitemap, robots, manifest, and XML routes are web-only and not applicable to
  a native client.

## Backend API mapping

- Auth: register/login/native Google/refresh/logout/me/password reset/email
  verification/sessions → `accountApi`, token storage, Axios refresh
  single-flight, auth/profile/session screens. Implemented. Native password
  auth requires the configured interim attestation contract; Play Integrity is
  still required before treating attestation as a security boundary.
- Catalog: movies/home/trending/proposed/banners/recommendations/schedule/detail/
  view count/genres/countries/people → movie and discovery repositories plus
  native screens. Implemented.
- User: profile/avatar, favorites, watchlist, history/bulk delete, follows,
  notifications/read-all, viewer profiles/PIN, player preferences → account,
  movie, settings, and player features. Implemented.
- Community: comments/sort/create/like/pin/delete, ratings, reports → movie
  detail and player report UI. Implemented; pin remains admin-only.
- Playlists: list/get/create/update/delete/add/remove → library, detail, and
  movie-detail sheets. Implemented.
- Analytics: accepted event names and admin seven-day summary → performance,
  player/watch-room tracking and admin dashboard. Implemented.
- Feedback: create/list mine/admin list/admin reply/status → account and admin
  screens. Implemented.
- Push: native FCM register/delete/preferences → `push-service`; channels
  `general` and `new-releases` are created before the Android permission
  request. Firebase project files and credentials remain external.
- Version policy → root `VersionGate`. Implemented; production policy rows and
  store URL must be configured server-side.
- Downloads: create/resolve short-lived entitlement → player/download
  repositories and offline screens. Implemented only for backend-approved MP4
  sources. HLS and DRM/offline license support are intentionally not claimed.
- VIP: plans/order history + website purchase guidance → native VIP screen.
  PayOS/manual checkout happens on the website; Android does not start Play Billing.
- Admin: stats/analytics/movies/episodes/bulk import/users/roles/VIP/reports/
  orders/feedback/source health/countries/genres → `adminRepository` and
  `AdminScreen`. Implemented. Countries and genres are read-only because no
  mutation endpoint exists.
- Watch together uses authenticated Socket.IO events rather than REST:
  list/create/join/control/episode/chat/reaction/kick/leave/close and reconnect
  are implemented.

## External and platform limitations

- Android App Links cannot verify until
  `https://cine3d.id.vn/.well-known/assetlinks.json` contains the final Play App
  Signing SHA-256 certificate fingerprint. Never guess this value.
- Firebase `google-services.json`, FCM server credentials, OAuth IDs, Play
  service-account JSON, Play products/base plans, RTDN relay secret, and EAS
  remote signing credentials are not repository material.
- Google OAuth, billing, push, PiP, biometric lock, downloads, and
  Maestro flows require a development/release build and, where noted, a
  physical/licensed device.
- No device Maestro run is claimed by this audit.
- Streaming assumes HTTPS sources. Cleartext traffic is disabled for release;
  any HTTP-only upstream source must be fixed or proxied over HTTPS, not opened
  globally in Android network security.
- Play Store readiness remains blocked until credentials, hosted policies,
  account deletion, content rights declarations, listing assets, and tester
  track validation are supplied.
