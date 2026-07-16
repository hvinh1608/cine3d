import { getSiteUrl } from '../../../../lib/site';
import { MOVIE_PAGES_PER_SITEMAP, fetchMoviePage, urlSetXml, xmlResponse } from '../../../../lib/movie-sitemap';

export const revalidate = 3600;

export async function GET(_request: Request, context: { params: Promise<{ segment: string }> }) {
  const { segment } = await context.params;
  const segmentIndex = Number(segment.replace(/\.xml$/, ''));
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0) return new Response('Not found', { status: 404 });

  const firstPage = segmentIndex * MOVIE_PAGES_PER_SITEMAP + 1;
  const pageNumbers = Array.from({ length: MOVIE_PAGES_PER_SITEMAP }, (_, index) => firstPage + index);
  const pages = [];

  // One small batch keeps cold sitemap responses fast enough for search crawlers.
  for (let index = 0; index < pageNumbers.length; index += 8) {
    const batch = await Promise.all(pageNumbers.slice(index, index + 8).map((page) => fetchMoviePage(page).catch(() => null)));
    pages.push(...batch);
  }

  const siteUrl = getSiteUrl();
  const slugs = new Set(pages.flatMap((page) => page?.movies || []).map((movie) => movie.slug).filter((slug): slug is string => Boolean(slug)));
  if (!slugs.size) return new Response('Not found', { status: 404 });
  return xmlResponse(urlSetXml([...slugs].map((slug) => `${siteUrl}/movies/${encodeURIComponent(slug)}`)));
}
