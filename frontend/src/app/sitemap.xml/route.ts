import { MOVIE_PAGES_PER_SITEMAP, fetchMoviePage, sitemapIndexXml, xmlResponse } from '../../lib/movie-sitemap';

export const revalidate = 3600;

export async function GET() {
  try {
    const firstPage = await fetchMoviePage(1);
    const totalPages = Math.max(1, Number(firstPage.totalPages) || Math.ceil((Number(firstPage.total) || 1) / 24));
    return xmlResponse(sitemapIndexXml(Math.ceil(totalPages / MOVIE_PAGES_PER_SITEMAP)));
  } catch {
    return xmlResponse(sitemapIndexXml(1), 300);
  }
}
