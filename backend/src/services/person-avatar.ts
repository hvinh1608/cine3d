const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w185';
const TMDB_API_BASE = (process.env.TMDB_API_BASE || 'https://api.tmdb.org/3').replace(/\/$/, '');
const avatarCache = new Map<string, string | null>();

function cleanImageUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    parsed.search = '';
    return parsed.toString();
  } catch {
    return url.split('?')[0] || null;
  }
}

/** Convert media.themoviedb.org /t/p/.../file.jpg paths to the reachable image CDN. */
function toTmdbImageUrl(urlOrPath: string): string | null {
  const match = urlOrPath.match(/\/([a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp))(?:\?|$)/i);
  if (!match?.[1]) return null;
  return `${TMDB_IMAGE}/${match[1]}`;
}

async function fetchWikipediaAvatar(name: string): Promise<string | null> {
  const title = name.trim().replace(/\s+/g, '_');
  if (!title) return null;

  for (const lang of ['en', 'vi']) {
    try {
      const response = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'CINE3D/1.0 (https://cine3d.id.vn; cast-avatar-enrichment)',
          },
          signal: AbortSignal.timeout(8_000),
        }
      );
      if (!response.ok) continue;
      const data = await response.json() as {
        type?: string;
        thumbnail?: { source?: string };
        originalimage?: { source?: string };
      };
      if (data.type === 'disambiguation') continue;
      const image = cleanImageUrl(data.thumbnail?.source || data.originalimage?.source);
      if (image) return image;
    } catch {
      // try next language / fallback
    }
  }
  return null;
}

async function fetchTvmazeAvatar(name: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.tvmaze.com/search/people?q=${encodeURIComponent(name.trim())}`,
      {
        headers: { Accept: 'application/json', 'User-Agent': 'CINE3D/1.0' },
        signal: AbortSignal.timeout(8_000),
      }
    );
    if (!response.ok) return null;
    const results = await response.json() as {
      person?: { name?: string; image?: { medium?: string; original?: string } | null };
    }[];
    const needle = name.trim().toLowerCase();
    const exact = results.find((item) => item.person?.name?.trim().toLowerCase() === needle) || results[0];
    return cleanImageUrl(exact?.person?.image?.medium || exact?.person?.image?.original || null);
  } catch {
    return null;
  }
}

async function fetchTmdbCreditsAvatars(
  tmdb: { id?: string | number | null; type?: string | null } | null | undefined
): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  const apiKey = process.env.TMDB_API_KEY?.trim();
  const readToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  const id = String(tmdb?.id || '').trim();
  if ((!apiKey && !readToken) || !id) return byName;

  const mediaType = String(tmdb?.type || 'movie').toLowerCase() === 'tv' ? 'tv' : 'movie';
  const url = apiKey
    ? `${TMDB_API_BASE}/${mediaType}/${encodeURIComponent(id)}/credits?api_key=${encodeURIComponent(apiKey)}`
    : `${TMDB_API_BASE}/${mediaType}/${encodeURIComponent(id)}/credits`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (readToken) headers.Authorization = `Bearer ${readToken}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers,
    });
    if (!response.ok) return byName;
    const data = await response.json() as {
      cast?: { name?: string; profile_path?: string | null }[];
      crew?: { name?: string; job?: string; profile_path?: string | null }[];
    };
    for (const person of [...(data.cast || []), ...(data.crew || [])]) {
      const name = person.name?.trim();
      if (!name || !person.profile_path || byName.has(name.toLowerCase())) continue;
      byName.set(name.toLowerCase(), `${TMDB_IMAGE}${person.profile_path}`);
    }
  } catch {
    // api.themoviedb.org is blocked on some home networks; html scrape / TVMaze remain.
  }
  return byName;
}

/**
 * Scrape TMDB cast HTML via a public reader proxy when the API host is blocked
 * or TMDB_API_KEY is missing. Images are rewritten to image.tmdb.org.
 */
async function fetchTmdbCastPageAvatars(
  tmdb: { id?: string | number | null; type?: string | null } | null | undefined
): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  const id = String(tmdb?.id || '').trim();
  if (!id) return byName;

  const mediaType = String(tmdb?.type || 'movie').toLowerCase() === 'tv' ? 'tv' : 'movie';
  const target = `https://www.themoviedb.org/${mediaType}/${encodeURIComponent(id)}/cast`;
  const proxyUrl = `https://r.jina.ai/${target}`;

  try {
    const response = await fetch(proxyUrl, {
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'CINE3D/1.0 (https://cine3d.id.vn; cast-avatar-enrichment)',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return byName;
    const markdown = await response.text();

    const loose =
      /!\[[^\]]*:\s*([^\]]+)\]\((https?:\/\/(?:media\.themoviedb\.org|image\.tmdb\.org)\/t\/p\/[^)]+\.(?:jpg|jpeg|png|webp))\)/gi;
    let match: RegExpExecArray | null;
    while ((match = loose.exec(markdown)) !== null) {
      const name = match[1]?.trim();
      const normalized = toTmdbImageUrl(match[2] || '');
      if (!name || !normalized) continue;
      const key = name.toLowerCase();
      if (!byName.has(key)) byName.set(key, normalized);
    }
  } catch {
    // Reader proxy / TMDB site may be temporarily unavailable.
  }
  return byName;
}

async function fetchTvmazeShowAvatars(imdbId?: string | null): Promise<Map<string, string>> {
  const byName = new Map<string, string>();
  const id = String(imdbId || '').trim();
  if (!id) return byName;
  try {
    const showResponse = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'CINE3D/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!showResponse.ok) return byName;
    const show = await showResponse.json() as { id?: number };
    if (!show?.id) return byName;

    const castResponse = await fetch(`https://api.tvmaze.com/shows/${show.id}/cast`, {
      headers: { Accept: 'application/json', 'User-Agent': 'CINE3D/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!castResponse.ok) return byName;
    const cast = await castResponse.json() as {
      person?: { name?: string; image?: { medium?: string; original?: string } | null };
    }[];
    for (const entry of cast) {
      const name = entry.person?.name?.trim();
      const image = cleanImageUrl(entry.person?.image?.medium || entry.person?.image?.original || null);
      if (!name || !image) continue;
      byName.set(name.toLowerCase(), image);
    }
  } catch {
    // optional enrichment
  }
  return byName;
}

export async function resolvePersonAvatar(
  name: string,
  tmdbAvatars?: Map<string, string>
): Promise<string | null> {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  if (avatarCache.has(key)) return avatarCache.get(key) || null;

  const fromIndex = tmdbAvatars?.get(key) || null;
  const image =
    fromIndex
    || (await fetchTvmazeAvatar(name))
    || (await fetchWikipediaAvatar(name));
  avatarCache.set(key, image);
  return image;
}

export async function loadTmdbAvatarIndex(
  tmdb: { id?: string | number | null; type?: string | null } | null | undefined,
  imdb?: { id?: string | number | null } | null | undefined
) {
  const fromApi = await fetchTmdbCreditsAvatars(tmdb);
  if (fromApi.size > 0) return fromApi;

  const fromPage = await fetchTmdbCastPageAvatars(tmdb);
  if (fromPage.size > 0) return fromPage;

  return fetchTvmazeShowAvatars(imdb?.id != null ? String(imdb.id) : null);
}
