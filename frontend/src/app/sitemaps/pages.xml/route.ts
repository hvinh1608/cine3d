import { getSiteUrl } from '../../../lib/site';
import { urlSetXml, xmlResponse } from '../../../lib/movie-sitemap';

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://api.cine3d.id.vn/api' : 'http://localhost:5000/api');
const API_URL = process.env.INTERNAL_API_URL || PUBLIC_API_URL;

export const revalidate = 3600;

export async function GET() {
  const siteUrl = getSiteUrl();
  const urls = [siteUrl, `${siteUrl}/search`, `${siteUrl}/schedule`, `${siteUrl}/cinema`, `${siteUrl}/vip`];
  try {
    const load = async (path: string) => {
      const response = await fetch(`${API_URL}${path}`, { next: { revalidate: 3600 } });
      if (!response.ok) throw new Error(`Metadata API returned ${response.status}`);
      return response.json() as Promise<Array<{ slug?: string }>>;
    };
    const [genres, countries] = await Promise.all([load('/genres'), load('/countries')]);
    urls.push(
      ...genres.filter((item) => item.slug).map((item) => `${siteUrl}/the-loai/${encodeURIComponent(item.slug!)}`),
      ...countries.filter((item) => item.slug).map((item) => `${siteUrl}/quoc-gia/${encodeURIComponent(item.slug!)}`),
      ...Array.from({ length: new Date().getFullYear() - 1979 }, (_, index) => `${siteUrl}/nam/${new Date().getFullYear() - index}`),
    );
  } catch {
    // Keep the core sitemap available if the catalog metadata API is temporarily unavailable.
  }
  return xmlResponse(urlSetXml(urls));
}
