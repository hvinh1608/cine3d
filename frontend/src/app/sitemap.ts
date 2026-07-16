import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../lib/site';

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://api.cine3d.id.vn/api' : 'http://localhost:5000/api');
const API_URL = process.env.INTERNAL_API_URL || PUBLIC_API_URL;
type SitemapMovie = { slug?: string; posterUrl?: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/search`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteUrl}/vip`, changeFrequency: 'weekly', priority: 0.7 },
  ];

  try {
    const loadPages = async (baseUrl: string) => Promise.all([1, 2, 3, 4].map((page) =>
      fetch(`${baseUrl}/movies?page=${page}&limit=64`, { next: { revalidate: 3600 } })
        .then((response) => {
          if (!response.ok) throw new Error(`Sitemap API returned ${response.status}`);
          return response.json();
        })
    ));
    let pages;
    try {
      pages = await loadPages(API_URL);
    } catch (error) {
      if (API_URL === PUBLIC_API_URL) throw error;
      pages = await loadPages(PUBLIC_API_URL);
    }
    const movies = pages.flatMap((page) => (Array.isArray(page.movies) ? page.movies : []) as SitemapMovie[]);
    const uniqueMovies = Array.from(new Map(movies.filter((movie) => movie.slug).map((movie) => [movie.slug, movie])).values());
    return [...staticPages, ...uniqueMovies.map((movie) => ({
      url: `${siteUrl}/movies/${encodeURIComponent(movie.slug!)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
      images: movie.posterUrl ? [movie.posterUrl] : undefined,
    }))];
  } catch {
    return staticPages;
  }
}
