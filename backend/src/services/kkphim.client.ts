const BASE_URL = (process.env.KKPHIM_API_URL || 'https://phimapi.com').replace(/\/$/, '');
const DEFAULT_CDN = 'https://phimimg.com';
const TIMEOUT_MS = Number(process.env.KKPHIM_TIMEOUT_MS) || 10000;
const CACHE_TTL_MS = Number(process.env.KKPHIM_CACHE_TTL_MS) || 60_000;
const META_CACHE_TTL_MS = Number(process.env.KKPHIM_META_CACHE_TTL_MS) || 3_600_000;
const MAX_CACHE_ENTRIES = 200;

type CacheEntry = { value: unknown; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<unknown>>();

export class KkphimError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'KkphimError';
    this.status = status;
  }
}

function cacheTtl(path: string): number {
  return path.includes('/the-loai') || path.includes('/quoc-gia')
    ? META_CACHE_TTL_MS
    : CACHE_TTL_MS;
}

function pruneCache(now: number) {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

async function requestJson<T>(url: URL): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new KkphimError(`KKPhim request failed (${res.status}): ${url.pathname}`, res.status);
    }

    return (await res.json()) as T;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new KkphimError('KKPhim request timed out.');
    }
    if (error instanceof KkphimError) throw error;
    throw new KkphimError(error.message || 'KKPhim request failed.');
  } finally {
    clearTimeout(timer);
  }
}

async function kkFetch<T = any>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const key = url.toString();
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value as T;

  const inFlight = pending.get(key);
  if (inFlight) return inFlight as Promise<T>;

  const request = (async () => {
    try {
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const value = await requestJson<T>(url);
          pruneCache(Date.now());
          cache.set(key, { value, expiresAt: Date.now() + cacheTtl(path) });
          return value;
        } catch (error) {
          lastError = error;
          const status = error instanceof KkphimError ? error.status : 500;
          if (attempt === 1 || (status < 500 && status !== 429)) throw error;
        }
      }
      throw lastError;
    } finally {
      pending.delete(key);
    }
  })();

  pending.set(key, request);
  return request;
}

export function absoluteImageUrl(url?: string | null, cdn = DEFAULT_CDN): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${cdn.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

/** Newly updated movies (flat pagination). */
export async function fetchNewMovies(page = 1) {
  return kkFetch('/danh-sach/phim-moi-cap-nhat', { page });
}

/** Filtered catalog: phim-le | phim-bo | hoat-hinh | tv-shows | ... */
export async function fetchMovieList(
  typeList: string,
  opts: {
    page?: number;
    limit?: number;
    category?: string;
    country?: string;
    year?: string | number;
    sort_field?: string;
    sort_type?: string;
  } = {}
) {
  return kkFetch(`/v1/api/danh-sach/${typeList}`, {
    page: opts.page ?? 1,
    limit: opts.limit ?? 24,
    category: opts.category,
    country: opts.country,
    year: opts.year,
    sort_field: opts.sort_field,
    sort_type: opts.sort_type,
  });
}

export async function searchMovies(keyword: string, page = 1, limit = 24) {
  return kkFetch('/v1/api/tim-kiem', { keyword, page, limit });
}

export async function fetchMovieDetail(slug: string) {
  return kkFetch(`/phim/${encodeURIComponent(slug)}`);
}

export async function fetchGenres() {
  return kkFetch('/v1/api/the-loai');
}

export async function fetchCountries() {
  return kkFetch('/v1/api/quoc-gia');
}

export { BASE_URL, DEFAULT_CDN };
