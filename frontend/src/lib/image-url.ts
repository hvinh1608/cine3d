const PROXIED_HOSTS = ['phimimg.com', 'img.phimapi.com'];
const USE_IMAGE_PROXY = process.env.NEXT_PUBLIC_USE_IMAGE_PROXY === 'true';

/**
 * Prefer the source CDN because it is already backed by Cloudflare and avoids
 * an extra Vercel -> Render -> source round trip. The allow-listed backend
 * proxy remains available as an environment-controlled hotlink fallback.
 */
export function proxyImageUrl(src: string): string {
  if (!src || !USE_IMAGE_PROXY) return src;
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
