import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { fetchMovieDetail } from './kkphim.client';
import { mapMovieDetail, AppMovie } from './kkphim.mapper';

const MOVIE_SYNC_TTL_MS = Number(process.env.MOVIE_SYNC_TTL_MS) || 15 * 60 * 1000;
const pendingSyncs = new Map<string, Promise<AppMovie>>();
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

export function mapStoredMovie(movie: any): AppMovie {
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
      subtitles: episode.subtitles.map((subtitle: any) => ({
        id: subtitle.id,
        language: subtitle.language,
        url: subtitle.url,
      })),
    })),
  };
}

async function upsertCountry(db: Prisma.TransactionClient, country: { name: string; slug: string } | null) {
  if (!country?.slug) {
    return db.country.upsert({
      where: { slug: 'quoc-gia-khac' },
      update: {},
      create: { name: 'Quốc Gia Khác', slug: 'quoc-gia-khac' },
    });
  }

  return db.country.upsert({
    where: { slug: country.slug },
    update: { name: country.name },
    create: { name: country.name, slug: country.slug },
  });
}

async function syncGenres(db: Prisma.TransactionClient, movieId: string, genres: { genre: { name: string; slug: string } }[]) {
  for (const item of genres) {
    const genre = await db.genre.upsert({
      where: { slug: item.genre.slug },
      update: { name: item.genre.name },
      create: { name: item.genre.name, slug: item.genre.slug },
    });

    await db.movieGenre.upsert({
      where: { movieId_genreId: { movieId, genreId: genre.id } },
      update: {},
      create: { movieId, genreId: genre.id },
    });
  }
}

async function syncEpisodes(db: Prisma.TransactionClient, movieId: string, episodes: AppMovie['episodes']) {
  // Merge upstream episodes and sources. Never delete admin-managed playback data.
  for (const ep of episodes) {
    const stored = await db.episode.upsert({
      where: { movieId_episodeOrder: { movieId, episodeOrder: ep.episodeOrder } },
      update: { title: ep.title },
      create: {
        movieId,
        title: ep.title,
        episodeOrder: ep.episodeOrder,
      },
    });

    if (ep.videoSources.length) {
      const existingSources = await db.videoSource.findMany({
        where: { episodeId: stored.id },
        select: { url: true },
      });
      const existingUrls = new Set(existingSources.map((source) => source.url));
      const newSources = ep.videoSources.filter((source) => !existingUrls.has(source.url));
      if (newSources.length) await db.videoSource.createMany({
        data: newSources.map((src) => ({
          episodeId: stored.id,
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
async function syncMovie(slug: string): Promise<AppMovie> {
  const existing = await prisma.movie.findUnique({ where: { slug }, include: movieInclude });
  if (existing && Date.now() - existing.updatedAt.getTime() < MOVIE_SYNC_TTL_MS) {
    return mapStoredMovie(existing);
  }

  const raw = await fetchMovieDetail(slug);
  if (!raw?.status || !raw?.movie) {
    throw new Error(`Movie not found on KKPhim: ${slug}`);
  }

  const mapped = mapMovieDetail(raw);
  const movieId = await prisma.$transaction(async (tx) => {
    const country = await upsertCountry(tx, mapped.country);
    const movie = await tx.movie.upsert({
      where: { slug: mapped.slug },
      // Preserve metadata explicitly edited by an administrator. Upstream sync
      // only advances the episode count and merges new playback data below.
      update: {
        episodeCount: Math.max(existing?.episodeCount || 1, mapped.episodeCount || 1),
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

    await syncGenres(tx, movie.id, mapped.movieGenres);
    await syncEpisodes(tx, movie.id, mapped.episodes);
    return movie.id;
  }, { timeout: 20_000 });

  // Reload with relations for response consistency
  const full = await prisma.movie.findUnique({
    where: { id: movieId },
    include: movieInclude,
  });

  if (!full) {
    throw new Error(`Movie disappeared after synchronization: ${slug}`);
  }

  return mapStoredMovie(full);
}

export async function ensureMovieInDb(slug: string): Promise<AppMovie> {
  const existing = pendingSyncs.get(slug);
  if (existing) return existing;

  const request = syncMovie(slug).finally(() => pendingSyncs.delete(slug));
  pendingSyncs.set(slug, request);
  return request;
}
