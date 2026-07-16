import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SearchClient, { type SearchInitialData } from '../components/search/SearchClient';
import type { MetaItem } from '../types/movie';
import { getSiteUrl } from './site';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
export type CatalogKind = 'genre' | 'country' | 'year';

const paths: Record<CatalogKind, string> = { genre: 'the-loai', country: 'quoc-gia', year: 'nam' };

async function fetchJson(path: string, revalidate = 300) {
  const response = await fetch(`${API_URL}${path}`, { next: { revalidate } });
  if (!response.ok) throw new Error(`Catalog API returned ${response.status}`);
  return response.json();
}

async function resolveLabel(kind: CatalogKind, value: string) {
  if (kind === 'year') {
    const year = Number(value);
    const maxYear = new Date().getFullYear() + 1;
    return Number.isInteger(year) && year >= 1900 && year <= maxYear ? `Năm ${year}` : null;
  }
  const items = await fetchJson(kind === 'genre' ? '/genres' : '/countries', 3600) as MetaItem[];
  return items.find((item) => item.slug === value)?.name || null;
}

export async function catalogMetadata(kind: CatalogKind, value: string, page: number): Promise<Metadata> {
  const label = await resolveLabel(kind, value).catch(() => null);
  if (!label) return { title: 'Không tìm thấy danh mục | CINE3D', robots: { index: false, follow: false } };
  const subject = kind === 'genre' ? `Phim ${label}` : kind === 'country' ? `Phim ${label}` : `Phim phát hành ${label.toLowerCase()}`;
  const suffix = page > 1 ? ` - Trang ${page}` : '';
  const canonical = `${getSiteUrl()}/${paths[kind]}/${encodeURIComponent(value)}${page > 1 ? `?page=${page}` : ''}`;
  return {
    title: `${subject}${suffix} | CINE3D`,
    description: `Khám phá ${subject.toLowerCase()} mới nhất, tuyển chọn phim chất lượng cao và cập nhật liên tục tại CINE3D.`,
    alternates: { canonical },
    openGraph: { title: `${subject}${suffix} | CINE3D`, description: `Danh sách ${subject.toLowerCase()} được cập nhật liên tục.`, url: canonical },
  };
}

export async function SeoCatalogPage({ kind, value, page }: { kind: CatalogKind; value: string; page: number }) {
  const label = await resolveLabel(kind, value).catch(() => null);
  if (!label) notFound();
  const filter = { [kind]: value, page: String(page), limit: '24' };
  const [movieResult, genreResult, countryResult] = await Promise.allSettled([
    fetchJson(`/movies?${new URLSearchParams(filter)}`, 60),
    fetchJson('/genres', 3600),
    fetchJson('/countries', 3600),
  ]);
  const movieData = movieResult.status === 'fulfilled' ? movieResult.value : {};
  const movies = Array.isArray(movieData.movies) ? movieData.movies : [];
  const initialData: SearchInitialData = {
    movies,
    genres: genreResult.status === 'fulfilled' && Array.isArray(genreResult.value) ? genreResult.value : [],
    countries: countryResult.status === 'fulfilled' && Array.isArray(countryResult.value) ? countryResult.value : [],
    totalPages: Math.max(1, Number(movieData.totalPages) || 1),
    totalResults: Number(movieData.total) || movies.length,
    loadError: movieResult.status === 'rejected' ? 'Không thể tải danh sách phim lúc này.' : '',
    initialFilters: { [kind]: value, page },
    seoBasePath: `/${paths[kind]}/${encodeURIComponent(value)}`,
  };
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/${paths[kind]}/${encodeURIComponent(value)}${page > 1 ? `?page=${page}` : ''}`;
  const title = kind === 'year' ? `Phim phát hành ${label.toLowerCase()}` : `Phim ${label}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: title, item: pageUrl },
        ],
      },
      {
        '@type': 'ItemList',
        name: title,
        url: pageUrl,
        numberOfItems: movies.length,
        itemListElement: movies.map((movie: { title: string; slug: string }, index: number) => ({
          '@type': 'ListItem', position: (page - 1) * 24 + index + 1, name: movie.title, url: `${siteUrl}/movies/${encodeURIComponent(movie.slug)}`,
        })),
      },
    ],
  };
  return <>
    <section className="mx-auto w-full max-w-7xl px-4 pt-10 md:px-8">
      <p className="text-xs font-black uppercase tracking-[0.28em] text-red-400">Danh mục phim CINE3D</p>
      <h1 className="mt-2 text-3xl font-black text-white md:text-5xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Khám phá {title.toLowerCase()} chất lượng cao, cập nhật thường xuyên và xem thuận tiện trên mọi thiết bị.</p>
    </section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <SearchClient initialData={initialData} />
  </>;
}
