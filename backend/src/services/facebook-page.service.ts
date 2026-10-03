const graphVersion = process.env.FACEBOOK_GRAPH_VERSION?.trim() || 'v21.0';
const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
const siteUrl = (process.env.CANONICAL_WEB_URL || process.env.CLIENT_URLS?.split(',')[0] || 'https://cine3d.id.vn').trim().replace(/\/$/, '');

export function facebookPageConfigured() {
  return Boolean(pageId && pageToken);
}

function toAbsoluteLink(pathOrUrl: string): string {
  const raw = pathOrUrl.trim() || '/';
  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      if (!url.searchParams.get('utm_source')) url.searchParams.set('utm_source', 'facebook');
      if (!url.searchParams.get('utm_medium')) url.searchParams.set('utm_medium', 'social');
      if (!url.searchParams.get('utm_campaign')) url.searchParams.set('utm_campaign', 'fb_page');
      return url.toString();
    }
    const url = new URL(raw.startsWith('/') ? raw : `/${raw}`, siteUrl);
    if (!url.searchParams.get('utm_source')) url.searchParams.set('utm_source', 'facebook');
    if (!url.searchParams.get('utm_medium')) url.searchParams.set('utm_medium', 'social');
    if (!url.searchParams.get('utm_campaign')) url.searchParams.set('utm_campaign', 'fb_page');
    return url.toString();
  } catch {
    return `${siteUrl}/`;
  }
}

export async function postToFacebookPage(input: {
  message: string;
  link?: string;
}) {
  if (!pageId || !pageToken) {
    throw new Error('Facebook Page chưa cấu hình (FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN).');
  }

  const message = input.message.trim().slice(0, 2000);
  if (!message) throw new Error('Nội dung bài đăng trống.');

  const body = new URLSearchParams();
  body.set('message', message);
  body.set('access_token', pageToken);
  if (input.link?.trim()) body.set('link', toAbsoluteLink(input.link));

  const endpoint = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/feed`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Facebook API ${response.status}`);
  }
  if (!data.id) throw new Error('Facebook không trả về id bài đăng.');

  return { postId: data.id, pageId, link: input.link?.trim() ? toAbsoluteLink(input.link) : null };
}
