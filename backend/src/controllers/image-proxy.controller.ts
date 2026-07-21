import { Request, Response } from 'express';

const ALLOWED_HOSTS = new Set(['phimimg.com', 'img.phimapi.com']);
const UPSTREAM_TIMEOUT_MS = 8_000;
const CACHE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/**
 * Proxy images from external CDNs that reject Vercel's image optimizer.
 * This lets the Next.js <Image> component optimize them via the backend proxy.
 *
 * GET /api/image-proxy?url=https://phimimg.com/path/to/image.jpg
 */
export async function imageProxy(req: Request, res: Response) {
  const rawUrl = req.query.url;
  if (typeof rawUrl !== 'string' || !rawUrl) {
    return res.status(400).json({ message: 'Missing url query parameter.' });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return res.status(400).json({ message: 'Invalid url.' });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return res.status(403).json({ message: 'Host not allowed.' });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const upstream = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { Accept: 'image/*' },
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      return res.status(upstream.status).json({ message: 'Upstream image request failed.' });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const contentLength = upstream.headers.get('content-length');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', `public, max-age=${CACHE_MAX_AGE}, s-maxage=${CACHE_MAX_AGE}, immutable`);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    // Stream the response body to avoid buffering large images in memory.
    const reader = upstream.body?.getReader();
    if (!reader) return res.status(502).end();

    const pump = async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.write(value)) {
          await new Promise<void>((resolve) => res.once('drain', resolve));
        }
      }
      res.end();
    };

    await pump();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ message: 'Upstream image request timed out.' });
    }
    return res.status(502).json({ message: 'Image proxy error.' });
  }
}
