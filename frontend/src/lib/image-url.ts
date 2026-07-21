const PROXIED_HOSTS = ['phimimg.com', 'img.phimapi.com'];

/**
 * Rewrite phimimg.com image URLs to go through the backend image proxy,
 * enabling Next.js image optimization (WebP/AVIF conversion and resizing).
 * Non-phimimg URLs are returned unchanged.
 */
export function proxyImageUrl(src: string): string {
  if (!src) return src;
  try {
    const url = new URL(src);
    if (PROXIED_HOSTS.includes(url.hostname)) {
      return `/api/image-proxy?url=${encodeURIComponent(src)}`;
    }
  } catch {
    // Not an absolute URL — return as-is.
  }
  return src;
}

/**
 * Recursively rewrite phimimg.com image URLs in a data tree.
 * Only transforms values of keys ending in "Url" or "url" (posterUrl, backdropUrl, imageUrl).
 */
export function rewriteImageUrls<T>(data: T): T {
  if (typeof data === 'string') return data as T;
  if (Array.isArray(data)) return data.map(rewriteImageUrls) as T;
  if (data && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (/url$/i.test(key) && typeof value === 'string') {
        result[key] = proxyImageUrl(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = rewriteImageUrls(value);
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }
  return data;
}
