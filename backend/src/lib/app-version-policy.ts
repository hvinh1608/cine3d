import { prisma } from './prisma';

const VERSION_RE = /^\d+(?:\.\d+){0,3}$/;

export function isValidAppVersion(value: string): boolean {
  return VERSION_RE.test(value);
}

export function defaultDownloadUrl(platform: 'android' | 'ios'): string | null {
  const configured = process.env.ANDROID_DOWNLOAD_URL?.trim()
    || process.env.MOBILE_DOWNLOAD_URL?.trim();
  if (configured) return configured;
  const clientUrl = (process.env.CLIENT_URL || 'https://cine3d.id.vn').replace(/\/$/, '');
  if (platform === 'android') return `${clientUrl}/download`;
  return null;
}

/** Create missing platform rows only — never overwrite admin updates. */
export async function ensureAppVersionPolicies() {
  const defaults: Array<{
    platform: 'android' | 'ios';
    minVersion: string;
    latestVersion: string;
    forceUpdate: boolean;
    message: string;
    storeUrl: string | null;
  }> = [
    {
      platform: 'android',
      minVersion: process.env.APP_ANDROID_MIN_VERSION?.trim() || '1.0.0',
      latestVersion: process.env.APP_ANDROID_LATEST_VERSION?.trim() || '1.0.13',
      forceUpdate: false,
      message: 'Đã có bản CINE3D mới. Cập nhật để trải nghiệm ổn định hơn.',
      storeUrl: defaultDownloadUrl('android'),
    },
    {
      platform: 'ios',
      minVersion: process.env.APP_IOS_MIN_VERSION?.trim() || '1.0.0',
      latestVersion: process.env.APP_IOS_LATEST_VERSION?.trim() || '1.0.13',
      forceUpdate: false,
      message: 'Đã có bản CINE3D mới. Cập nhật để trải nghiệm ổn định hơn.',
      storeUrl: defaultDownloadUrl('ios'),
    },
  ];

  for (const policy of defaults) {
    await prisma.appVersionPolicy.upsert({
      where: { platform: policy.platform },
      create: policy,
      update: {},
    });
  }
}
