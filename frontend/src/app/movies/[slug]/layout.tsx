import type { Metadata } from 'next';

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const response = await fetch(`${API_URL}/movies/${encodeURIComponent(slug)}`, {
      next: { revalidate: 900 },
    });
    if (!response.ok) return { title: 'Không tìm thấy phim | CINE3D' };
    const movie = await response.json();
    const description = (movie.description || `Xem ${movie.title} chất lượng cao tại CINE3D`).slice(0, 160);
    return {
      title: `${movie.title} (${movie.releaseYear || 'Mới'}) | CINE3D`,
      description,
      alternates: { canonical: `/movies/${slug}` },
      openGraph: {
        title: movie.title,
        description,
        type: 'video.movie',
        images: movie.backdropUrl || movie.posterUrl ? [{ url: movie.backdropUrl || movie.posterUrl }] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title: movie.title,
        description,
        images: movie.backdropUrl || movie.posterUrl ? [movie.backdropUrl || movie.posterUrl] : [],
      },
    };
  } catch {
    return { title: 'Xem phim | CINE3D' };
  }
}

export default function MovieLayout({ children }: { children: React.ReactNode }) {
  return children;
}
