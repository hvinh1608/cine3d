import { prisma } from '../lib/prisma';
import { fetchMovieDetail } from './kkphim.client';
import { mapMovieDetail, AppMovie } from './kkphim.mapper';

const MOVIE_SYNC_TTL_MS = Number(process.env.MOVIE_SYNC_TTL_MS) || 15 * 60 * 1000;
const movieInclude = {
  country: true,
  movieGenres: { include: { genre: true } },
  movieActors: { include: { actor: true } },
  movieDirectors: { include: { director: true } },
  episodes: {
    orderBy: { episodeOrder: 'asc' as const },
    include: { videoSources: true, subtitles: true },
  },
};

function mapStoredMovie(movie: any): AppMovie {
  return {
    ...movie,
    episodeCount: movie.episodes?.length || movie.episodeCount || 1,
    country: movie.country ? { name: movie.country.name, slug: movie.country.slug } : null,
    movieGenres: movie.movieGenres.map((item: any) => ({
      genre: { name: item.genre.name, slug: item.genre.slug },
    })),
    movieActors: movie.movieActors.map((item: any) => ({ actor: { name: item.actor.name } })),
    movieDirectors: movie.movieDirectors.map((item: any) => ({ director: { name: item.director.name } })),
    episodes: movie.episodes.map((episode: any) => ({
      id: episode.id,
      title: episode.title,
      episodeOrder: episode.episodeOrder,
      videoSources: episode.videoSources.map((source: any) => ({
        id: source.id,
        server: source.server,
        quality: source.quality,
        url: source.url,
        type: source.type === 'mp4' ? 'mp4' : 'hls',
      })),
    })),
  };
}


async function upsertCountry(country: { name: string; slug: string } | null) {
  if (!country?.slug) {
    return prisma.country.upsert({
      where: { slug: 'quoc-gia-khac' },
      update: {},
      create: { name: 'Quốc Gia Khác', slug: 'quoc-gia-khac' },
    });
  }

  return prisma.country.upsert({
    where: { slug: country.slug },
    update: { name: country.name },
    create: { name: country.name, slug: country.slug },
  });
}

async function syncGenres(movieId: string, genres: { genre: { name: string; slug: string } }[]) {
  await prisma.movieGenre.deleteMany({ where: { movieId } });

  for (const item of genres) {
    const genre = await prisma.genre.upsert({
      where: { slug: item.genre.slug },
      update: { name: item.genre.name },
      create: { name: item.genre.name, slug: item.genre.slug },
    });

    await prisma.movieGenre.create({
      data: { movieId, genreId: genre.id },
    });
  }
}

async function syncEpisodes(movieId: string, episodes: AppMovie['episodes']) {
  // Replace episode sources for this movie to stay in sync with KKPhim
  const existing = await prisma.episode.findMany({ where: { movieId }, select: { id: true } });
  if (existing.length) {
    await prisma.videoSource.deleteMany({
      where: { episodeId: { in: existing.map((e) => e.id) } },
    });
    await prisma.episode.deleteMany({ where: { movieId } });
  }

  for (const ep of episodes) {
    const created = await prisma.episode.create({
      data: {
        movieId,
        title: ep.title,
        episodeOrder: ep.episodeOrder,
      },
    });

    if (ep.videoSources.length) {
      await prisma.videoSource.createMany({
        data: ep.videoSources.map((src) => ({
          episodeId: created.id,
          server: src.server,
          quality: src.quality,
          url: src.url,
          type: src.type,
        })),
      });
    }
  }
}

/**
 * Fetch KKPhim detail and upsert Movie + related rows into PostgreSQL.
 * Returns mapped app movie with real DB UUID as `id`.
 */
export async function ensureMovieInDb(slug: string): Promise<AppMovie> {
  const existing = await prisma.movie.findUnique({ where: { slug }, include: movieInclude });
  if (existing && Date.now() - existing.updatedAt.getTime() < MOVIE_SYNC_TTL_MS) {
    return mapStoredMovie(existing);
  }

  const raw = await fetchMovieDetail(slug);
  if (!raw?.status || !raw?.movie) {
    throw new Error(`Movie not found on KKPhim: ${slug}`);
  }

  const mapped = mapMovieDetail(raw);
  const country = await upsertCountry(mapped.country);

  const movie = await prisma.movie.upsert({
    where: { slug: mapped.slug },
    update: {
      title: mapped.title,
      englishTitle: mapped.englishTitle,
      description: mapped.description || mapped.title,
      backdropUrl: mapped.backdropUrl || mapped.posterUrl,
      posterUrl: mapped.posterUrl || mapped.backdropUrl,
      trailerUrl: mapped.trailerUrl,
      releaseYear: mapped.releaseYear || new Date().getFullYear(),
      duration: mapped.duration || 0,
      quality: mapped.quality || 'HD',
      episodeCount: mapped.episodeCount || 1,
      isSeries: mapped.isSeries,
      status: mapped.status,
      countryId: country.id,
    },
    create: {
      title: mapped.title,
      englishTitle: mapped.englishTitle,
      slug: mapped.slug,
      description: mapped.description || mapped.title,
      backdropUrl: mapped.backdropUrl || mapped.posterUrl || '',
      posterUrl: mapped.posterUrl || mapped.backdropUrl || '',
      trailerUrl: mapped.trailerUrl,
      releaseYear: mapped.releaseYear || new Date().getFullYear(),
      duration: mapped.duration || 0,
      quality: mapped.quality || 'HD',
      episodeCount: mapped.episodeCount || 1,
      isSeries: mapped.isSeries,
      status: mapped.status,
      countryId: country.id,
    },
  });

  await syncGenres(movie.id, mapped.movieGenres);
  await syncEpisodes(movie.id, mapped.episodes);

  // Reload with relations for response consistency
  const full = await prisma.movie.findUnique({
    where: { id: movie.id },
    include: movieInclude,
  });

  if (!full) {
    return { ...mapped, id: movie.id };
  }

  // Prefer live m3u8 from KKPhim map (fresher) but keep DB id
  return {
    ...mapped,
    id: full.id,
    views: full.views,
    ratingAvg: full.ratingAvg,
    country: full.country
      ? { name: full.country.name, slug: full.country.slug }
      : mapped.country,
    movieGenres: full.movieGenres.map((mg) => ({
      genre: { name: mg.genre.name, slug: mg.genre.slug },
    })),
    episodes: mapped.episodes.map((ep, idx) => ({
      ...ep,
      id: full.episodes[idx]?.id || ep.id,
      videoSources: ep.videoSources.map((src, sIdx) => ({
        ...src,
        id: full.episodes[idx]?.videoSources[sIdx]?.id || src.id,
      })),
    })),
  };
}
