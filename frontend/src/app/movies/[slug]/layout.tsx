import type { Metadata } from 'next';
import { fetchMovieBySlug } from '@/lib/movie-detail-server';
import { movieImageUrl } from '@/lib/movie-image';
import { getSiteUrl } from '../../../lib/site';

const siteUrl = getSiteUrl();

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const movie = await fetchMovieBySlug(slug);
  if (!movie) return { title: 'Không tìm thấy phim | CINE3D', robots: { index: false, follow: false } };
  const description = (movie.description || `Xem ${movie.title} chất lượng cao tại CINE3D`).slice(0, 160);
  const image = movie.backdropUrl || movie.posterUrl;
  return {
    title: `${movie.title} (${movie.releaseYear || 'Mới'}) | CINE3D`,
    description,
    alternates: { canonical: `${siteUrl}/movies/${slug}` },
    openGraph: {
      title: movie.title,
      description,
      type: 'video.movie',
      url: `${siteUrl}/movies/${slug}`,
      images: image ? [{ url: image }] : [],
    },
    twitter: { card: 'summary_large_image', title: movie.title, description, images: image ? [image] : [] },
  };
}

export default async function MovieLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const movie = await fetchMovieBySlug(slug);
  if (!movie) return children;
  const movieUrl = `${siteUrl}/movies/${slug}`;
  const lcpSrc = movie.backdropUrl || movie.posterUrl;
  const lcpPreload = lcpSrc ? movieImageUrl(lcpSrc, 1600, 85) : null;
  const movieSchema = {
    '@id': `${movieUrl}#movie`,
    '@type': movie.isSeries ? 'TVSeries' : 'Movie',
    name: movie.title,
    alternateName: movie.englishTitle || undefined,
    description: movie.description || undefined,
    image: [movie.backdropUrl, movie.posterUrl].filter(Boolean),
    url: movieUrl,
    dateCreated: movie.releaseYear ? String(movie.releaseYear) : undefined,
    duration: movie.duration ? `PT${movie.duration}M` : undefined,
    genre: movie.movieGenres?.map((item) => item.genre.name),
    actor: movie.movieActors?.slice(0, 20).map((item) => ({ '@type': 'Person', name: item.actor.name })),
    director: movie.movieDirectors?.map((item) => ({ '@type': 'Person', name: item.director.name })),
  };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      movieSchema,
      {
        '@type': 'BreadcrumbList',
        '@id': `${movieUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Phim', item: `${siteUrl}/search` },
          { '@type': 'ListItem', position: 3, name: movie.title, item: movieUrl },
        ],
      },
    ],
  };
  return (
    <>
      {lcpPreload && (
        <link rel="preload" as="image" href={lcpPreload} fetchPriority="high" />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      {children}
    </>
  );
}
