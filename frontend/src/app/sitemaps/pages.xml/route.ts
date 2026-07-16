import { getSiteUrl } from '../../../lib/site';
import { urlSetXml, xmlResponse } from '../../../lib/movie-sitemap';

export const revalidate = 3600;

export async function GET() {
  const siteUrl = getSiteUrl();
  return xmlResponse(urlSetXml([siteUrl, `${siteUrl}/search`, `${siteUrl}/schedule`, `${siteUrl}/vip`]));
}
