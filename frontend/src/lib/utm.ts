/** Build absolute or path URLs with UTM query params for share / acquisition tracking. */
export function withUtm(
  href: string,
  params: { source?: string; medium?: string; campaign?: string } = {}
): string {
  const {
    source = 'share',
    medium = 'user',
    campaign = 'movie_share',
  } = params;
  try {
    const isAbsolute = /^https?:\/\//i.test(href);
    const url = isAbsolute
      ? new URL(href)
      : new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://cine3d.id.vn');
    url.searchParams.set('utm_source', source);
    url.searchParams.set('utm_medium', medium);
    url.searchParams.set('utm_campaign', campaign);
    if (isAbsolute) return url.toString();
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const join = href.includes('?') ? '&' : '?';
    return `${href}${join}utm_source=${encodeURIComponent(source)}&utm_medium=${encodeURIComponent(medium)}&utm_campaign=${encodeURIComponent(campaign)}`;
  }
}

export function readUtmFromSearch(search: string): Record<string, string> {
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    const out: Record<string, string> = {};
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const) {
      const value = params.get(key);
      if (value) out[key] = value.slice(0, 120);
    }
    return out;
  } catch {
    return {};
  }
}
