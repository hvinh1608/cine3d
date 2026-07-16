import { getSiteUrl } from './site';

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://api.cine3d.id.vn/api' : 'http://localhost:5000/api');
const API_URL = process.env.INTERNAL_API_URL || PUBLIC_API_URL;

// Keep cold sitemap generation within one small upstream batch so crawlers do not time out.
export const MOVIE_PAGES_PER_SITEMAP = 8;

type MovieListResponse = {
  total?: number;
  totalPages?: number;
  movies?: Array<{ slug?: string }>;
};

export function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  })[character]!);
}

export async function fetchMoviePage(page: number): Promise<MovieListResponse> {
  const load = async (baseUrl: string) => {
    const response = await fetch(`${baseUrl}/movies?page=${page}&limit=64`, { next: { revalidate: 3600 } });
    if (!response.ok) throw new Error(`Movie sitemap API returned ${response.status}`);
    return response.json() as Promise<MovieListResponse>;
  };

  try {
    return await load(API_URL);
  } catch (error) {
    if (API_URL === PUBLIC_API_URL) throw error;
    return load(PUBLIC_API_URL);
  }
}

export function sitemapIndexXml(movieSitemapCount: number) {
  const siteUrl = getSiteUrl();
  const locations = [
    `${siteUrl}/sitemaps/pages.xml`,
    ...Array.from({ length: movieSitemapCount }, (_, index) => `${siteUrl}/sitemaps/movies/${index}.xml`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations.map((url) => `  <sitemap><loc>${escapeXml(url)}</loc></sitemap>`).join('\n')}\n</sitemapindex>`;
}

export function urlSetXml(urls: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}\n</urlset>`;
}

export function xmlResponse(xml: string, revalidateSeconds = 3600) {
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, s-maxage=${revalidateSeconds}, stale-while-revalidate=86400`,
    },
  });
}
