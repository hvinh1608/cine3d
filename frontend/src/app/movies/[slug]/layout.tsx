import type { Metadata } from 'next';
import { cache } from 'react';
import { getSiteUrl } from '../../../lib/site';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const siteUrl = getSiteUrl();

type SeoMovie = {
  title: string;
  englishTitle?: string | null;
  description?: string | null;
  releaseYear?: number;
  duration?: number | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  ratingAvg?: number;
  isSeries?: boolean;
  movieGenres?: { genre: { name: string } }[];
  movieActors?: { actor: { name: string } }[];
  movieDirectors?: { director: { name: string } }[];
};

const getMovie = cache(async (slug: string): Promise<SeoMovie | null> => {
  try {
    const response = await fetch(`${API_URL}/movies/${encodeURIComponent(slug)}`, { next: { revalidate: 900 } });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const movie = await getMovie(slug);
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
  const movie = await getMovie(slug);
  if (!movie) return children;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': movie.isSeries ? 'TVSeries' : 'Movie',
    name: movie.title,
    alternateName: movie.englishTitle || undefined,
    description: movie.description || undefined,
    image: [movie.backdropUrl, movie.posterUrl].filter(Boolean),
    url: `${siteUrl}/movies/${slug}`,
    datePublished: movie.releaseYear ? String(movie.releaseYear) : undefined,
    duration: movie.duration ? `PT${movie.duration}M` : undefined,
    genre: movie.movieGenres?.map((item) => item.genre.name),
    actor: movie.movieActors?.slice(0, 20).map((item) => ({ '@type': 'Person', name: item.actor.name })),
    director: movie.movieDirectors?.map((item) => ({ '@type': 'Person', name: item.director.name })),
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />{children}</>;
}
