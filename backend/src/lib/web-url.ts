const DEFAULT_PRODUCTION_WEB_URL = 'https://cine3d.id.vn';
const LEGACY_PRODUCTION_HOSTS = new Set(['cine3d.vercel.app']);

function withoutTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function canonicalWebUrl(env: NodeJS.ProcessEnv = process.env): string {
  const fallback = env.NODE_ENV === 'production'
    ? DEFAULT_PRODUCTION_WEB_URL
    : (env.CLIENT_URLS || env.CLIENT_URL || 'http://localhost:3000').split(',')[0];
  return withoutTrailingSlash(env.CANONICAL_WEB_URL || fallback);
}

export function passwordResetPageUrl(env: NodeJS.ProcessEnv = process.env): string {
  const canonicalAccountUrl = `${canonicalWebUrl(env)}/account`;
  const configured = withoutTrailingSlash(env.PASSWORD_RESET_URL || canonicalAccountUrl);

  if (env.NODE_ENV !== 'production') return configured;

  try {
    const configuredUrl = new URL(configured);
    if (LEGACY_PRODUCTION_HOSTS.has(configuredUrl.hostname)) return canonicalAccountUrl;
    return configured;
  } catch {
    return canonicalAccountUrl;
  }
}
