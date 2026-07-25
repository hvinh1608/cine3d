-- Ensure Android APK update policy points at the public download page.
INSERT INTO "AppVersionPolicy" (
  "platform",
  "minVersion",
  "latestVersion",
  "forceUpdate",
  "message",
  "storeUrl",
  "createdAt",
  "updatedAt"
) VALUES (
  'android',
  '1.0.0',
  '1.0.13',
  false,
  'Đã có bản CINE3D 1.0.13. Cập nhật để nhận thông báo bản mới và cải tiến ổn định.',
  'https://cine3d.id.vn/download',
  NOW(),
  NOW()
)
ON CONFLICT ("platform") DO UPDATE SET
  "latestVersion" = EXCLUDED."latestVersion",
  "message" = EXCLUDED."message",
  "storeUrl" = COALESCE(NULLIF("AppVersionPolicy"."storeUrl", ''), EXCLUDED."storeUrl"),
  "updatedAt" = NOW();

INSERT INTO "AppVersionPolicy" (
  "platform",
  "minVersion",
  "latestVersion",
  "forceUpdate",
  "message",
  "storeUrl",
  "createdAt",
  "updatedAt"
) VALUES (
  'ios',
  '1.0.0',
  '1.0.13',
  false,
  'Đã có bản CINE3D mới. Cập nhật để trải nghiệm ổn định hơn.',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("platform") DO UPDATE SET
  "latestVersion" = EXCLUDED."latestVersion",
  "updatedAt" = NOW();
