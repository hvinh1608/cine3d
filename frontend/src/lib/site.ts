const PRODUCTION_SITE_URL = 'https://cine3d.id.vn';

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (configured && !configured.includes('.vercel.app')) return configured;
  return process.env.NODE_ENV === 'production' ? PRODUCTION_SITE_URL : (configured || 'http://localhost:3000');
}
