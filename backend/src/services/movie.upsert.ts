import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { fetchMovieDetail } from './kkphim.client';
import { mapMovieDetail, inferSeasonNumber, AppMovie } from './kkphim.mapper';
import { loadTmdbAvatarIndex } from './person-avatar';

const MOVIE_SYNC_TTL_MS = Number(process.env.MOVIE_SYNC_TTL_MS) || 15 * 60 * 1000;
const pendingSyncs = new Map<string, Promise<AppMovie>>();
const pendingAvatarJobs = new Set<string>();
let backgroundSyncChain: Promise<unknown> = Promise.resolve();
let lastStoredFallbackWarningAt = 0;
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
  const movieGenres = movie.movieGenres || [];
  const movieActors = movie.movieActors || [];
  const movieDirectors = movie.movieDirectors || [];
  const episodes = movie.episodes || [];
  const inferredSeasonNumber = inferSeasonNumber(movie.slug, movie.title, movie.englishTitle);
  return {
    ...movie,
    episodeCount: episodes.length || movie.episodeCount || 1,
    country: movie.country ? { name: movie.country.name, slug: movie.country.slug } : null,
    movieGenres: movieGenres.map((item: any) => ({
      genre: { name: item.genre.name, slug: item.genre.slug },
    })),
    movieActors: movieActors.map((item: any) => ({
      actor: { name: item.actor.name, slug: item.actor.slug, avatarUrl: item.actor.avatarUrl || null },
    })),
    movieDirectors: movieDirectors.map((item: any) => ({
      director: { name: item.director.name, slug: item.director.slug, avatarUrl: item.director.avatarUrl || null },
    })),
    episodes: episodes.map((episode: any) => ({
      id: episode.id,
      title: episode.title,
      episodeOrder: episode.episodeOrder,
      seasonNumber: episode.seasonNumber > 1 ? episode.seasonNumber : inferredSeasonNumber,
      videoSources: episode.videoSources.map((source: any) => ({
        id: source.id,
        server: source.server,
        quality: source.quality,
        url: source.url,
        type: source.type === 'mp4' ? 'mp4' : 'hls',
        isPremium: source.isPremium,
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

function personSlug(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'unknown';
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

async function syncActors(
  db: Prisma.TransactionClient,
  movieId: string,
  actors: { actor: { name: string } }[],
  tmdbAvatars?: Map<string, string>
) {
  const names = [...new Set(actors.map((item) => item.actor.name.trim()).filter(Boolean))];
  for (const name of names) {
    const slug = personSlug(name);
    const existing = await db.actor.findUnique({ where: { slug }, select: { id: true, avatarUrl: true } });
    // Critical path: only apply an already-loaded avatar index. Network avatar
    // lookups run in the background so movie detail stays fast.
    const fromTmdb = tmdbAvatars?.get(name.trim().toLowerCase()) || null;
    const avatarUrl = fromTmdb || existing?.avatarUrl || null;
    const actor = await db.actor.upsert({
      where: { slug },
      update: {
        name,
        ...(avatarUrl && avatarUrl !== existing?.avatarUrl ? { avatarUrl } : {}),
      },
      create: { name, slug, avatarUrl },
    });
    await db.movieActor.upsert({
      where: { movieId_actorId: { movieId, actorId: actor.id } },
      update: {},
      create: { movieId, actorId: actor.id },
    });
  }
}

async function syncDirectors(
  db: Prisma.TransactionClient,
  movieId: string,
  directors: { director: { name: string } }[],
  tmdbAvatars?: Map<string, string>
) {
  const names = [...new Set(directors.map((item) => item.director.name.trim()).filter(Boolean))];
  for (const name of names) {
    const slug = personSlug(name);
    const existing = await db.director.findUnique({ where: { slug }, select: { id: true, avatarUrl: true } });
    const fromTmdb = tmdbAvatars?.get(name.trim().toLowerCase()) || null;
    const avatarUrl = fromTmdb || existing?.avatarUrl || null;
    const director = await db.director.upsert({
      where: { slug },
      update: {
        name,
        ...(avatarUrl && avatarUrl !== existing?.avatarUrl ? { avatarUrl } : {}),
      },
      create: { name, slug, avatarUrl },
    });
    await db.movieDirector.upsert({
      where: { movieId_directorId: { movieId, directorId: director.id } },
      update: {},
      create: { movieId, directorId: director.id },
    });
  }
}

function isViewableMovie(movie: {
  description?: string | null;
  title?: string | null;
  movieActors?: unknown[];
  episodes?: unknown[];
}) {
  return Boolean(
    movie
    && (movie.description || '').trim()
    && movie.description !== movie.title
    && (movie.movieActors?.length || 0) > 0
    && (movie.episodes?.length || 0) > 0
  );
}

function needsAvatarBackfill(movie: {
  movieActors?: { actor?: { avatarUrl?: string | null } }[];
  movieDirectors?: { director?: { avatarUrl?: string | null } }[];
}) {
  return Boolean(
    movie.movieActors?.some((row) => !row.actor?.avatarUrl)
    || movie.movieDirectors?.some((row) => !row.director?.avatarUrl)
  );
}

function scheduleAvatarEnrichment(
  slug: string,
  tmdb?: { id?: string | number | null; type?: string | null } | null,
  imdb?: { id?: string | number | null } | null
) {
  if (pendingAvatarJobs.has(slug)) return;
  pendingAvatarJobs.add(slug);
  void (async () => {
    try {
      const avatars = await loadTmdbAvatarIndex(tmdb, imdb);
      if (!avatars.size) return;
      const movie = await prisma.movie.findUnique({
        where: { slug },
        select: {
          id: true,
          movieActors: { include: { actor: { select: { id: true, name: true, avatarUrl: true } } } },
          movieDirectors: { include: { director: { select: { id: true, name: true, avatarUrl: true } } } },
        },
      });
      if (!movie) return;
      for (const row of movie.movieActors) {
        const next = avatars.get(row.actor.name.trim().toLowerCase());
        if (!next || next === row.actor.avatarUrl) continue;
        await prisma.actor.update({ where: { id: row.actor.id }, data: { avatarUrl: next } });
      }
      for (const row of movie.movieDirectors) {
        const next = avatars.get(row.director.name.trim().toLowerCase());
        if (!next || next === row.director.avatarUrl) continue;
        await prisma.director.update({ where: { id: row.director.id }, data: { avatarUrl: next } });
      }
    } catch (error) {
      console.warn(`Avatar enrichment failed for ${slug}:`, error instanceof Error ? error.message : error);
    } finally {
      pendingAvatarJobs.delete(slug);
    }
  })();
}

async function syncEpisodes(db: Prisma.TransactionClient, movieId: string, episodes: AppMovie['episodes']) {
  // Merge upstream episodes and sources. Never delete admin-managed playback data.
  for (const ep of episodes) {
    const stored = await db.episode.upsert({
      where: { movieId_episodeOrder: { movieId, episodeOrder: ep.episodeOrder } },
      update: { title: ep.title, seasonNumber: ep.seasonNumber || 1 },
      create: {
        movieId,
        title: ep.title,
        episodeOrder: ep.episodeOrder,
        seasonNumber: ep.seasonNumber || 1,
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
 * Persist a mapped KKPhim detail into Postgres. Safe to run in the background
 * after the API has already returned the mapped payload to the client.
 */
async function persistMappedMovie(slug: string, raw: any, mapped: AppMovie): Promise<AppMovie | null> {
  const existing = await prisma.movie.findUnique({
    where: { slug },
    include: { ...movieInclude, _count: { select: { ratings: true } } },
  });

  const movieId = await prisma.$transaction(async (tx) => {
    const country = await upsertCountry(tx, mapped.country);
    const canSyncRating = mapped.ratingAvg > 0 && (!existing || existing._count.ratings === 0);
    const movie = await tx.movie.upsert({
      where: { slug: mapped.slug },
      update: {
        episodeCount: Math.max(existing?.episodeCount || 1, mapped.episodeCount || 1),
        ...(canSyncRating ? { ratingAvg: mapped.ratingAvg } : {}),
        ...(!Number(existing?.duration) && mapped.duration > 0 ? { duration: mapped.duration } : {}),
        ...(mapped.description
          && (!existing?.description || existing.description === existing.title)
          ? { description: mapped.description }
          : {}),
        ...(mapped.status ? { status: mapped.status } : {}),
        ...(mapped.quality ? { quality: mapped.quality } : {}),
        ...(mapped.posterUrl ? { posterUrl: mapped.posterUrl } : {}),
        ...(mapped.backdropUrl ? { backdropUrl: mapped.backdropUrl } : {}),
        ...(mapped.trailerUrl ? { trailerUrl: mapped.trailerUrl } : {}),
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
        ratingAvg: mapped.ratingAvg || 0,
        countryId: country.id,
      },
    });

    await syncGenres(tx, movie.id, mapped.movieGenres);
    await syncActors(tx, movie.id, mapped.movieActors);
    await syncDirectors(tx, movie.id, mapped.movieDirectors);
    await syncEpisodes(tx, movie.id, mapped.episodes);
    return movie.id;
  }, { timeout: 60_000 });

  scheduleAvatarEnrichment(slug, raw?.movie?.tmdb, raw?.movie?.imdb);

  const full = await prisma.movie.findUnique({
    where: { id: movieId },
    include: movieInclude,
  });
  return full ? mapStoredMovie(full) : null;
}

function queuePersistMappedMovie(slug: string, raw: any, mapped: AppMovie) {
  const key = `bg:${slug}`;
  if (pendingSyncs.has(key)) return;
  const queuedBackground = [...pendingSyncs.keys()].filter((item) => item.startsWith('bg:')).length;
  // Cold opens may need to create the row; allow one extra slot beyond refresh syncs.
  if (queuedBackground >= 3) return;

  const request = backgroundSyncChain
    .catch(() => undefined)
    .then(async () => {
      try {
        return await persistMappedMovie(slug, raw, mapped);
      } catch (error) {
        console.warn(`Background movie persist failed for ${slug}:`, error instanceof Error ? error.message : error);
        return null;
      }
    })
    .finally(() => pendingSyncs.delete(key));

  backgroundSyncChain = request.then(() => undefined, () => undefined);
  pendingSyncs.set(key, request as Promise<AppMovie>);
}

function queueBackgroundMovieSync(slug: string) {
  const key = `bg:${slug}`;
  if (pendingSyncs.has(key)) return;
  const queuedBackground = [...pendingSyncs.keys()].filter((item) => item.startsWith('bg:')).length;
  if (queuedBackground >= 2) return;

  const request = backgroundSyncChain
    .catch(() => undefined)
    .then(async () => {
      try {
        const raw = await fetchMovieDetail(slug);
        if (!raw?.status || !raw?.movie) {
          const fallback = await prisma.movie.findUnique({ where: { slug }, include: movieInclude });
          return fallback ? mapStoredMovie(fallback) : null;
        }
        const mapped = mapMovieDetail(raw);
        return await persistMappedMovie(slug, raw, mapped);
      } catch (error) {
        console.warn(`Background movie sync failed for ${slug}:`, error instanceof Error ? error.message : error);
        const full = await prisma.movie.findUnique({ where: { slug }, include: movieInclude });
        return full ? mapStoredMovie(full) : null;
      }
    })
    .finally(() => pendingSyncs.delete(key));

  backgroundSyncChain = request.then(() => undefined, () => undefined);
  pendingSyncs.set(key, request as Promise<AppMovie>);
}

/**
 * Return movie details as fast as possible.
 * - Warm DB rows: instant
 * - Cold / incomplete rows: fetch KKPhim once, respond immediately, persist in background
 */
export async function ensureMovieInDb(slug: string): Promise<AppMovie> {
  const inflight = pendingSyncs.get(slug);
  if (inflight) return inflight;

  const stored = await prisma.movie.findUnique({ where: { slug }, include: movieInclude });
  if (stored && isViewableMovie(stored)) {
    const stale = Date.now() - stored.updatedAt.getTime() >= MOVIE_SYNC_TTL_MS;
    if (stale || needsAvatarBackfill(stored)) {
      queueBackgroundMovieSync(slug);
    }
    return mapStoredMovie(stored);
  }

  const request = (async () => {
    let raw;
    try {
      raw = await fetchMovieDetail(slug);
    } catch (error) {
      if (stored) {
        const now = Date.now();
        if (now - lastStoredFallbackWarningAt >= 60_000) {
          lastStoredFallbackWarningAt = now;
          console.warn('KKPhim sync unavailable; serving stored movie details.');
        }
        return mapStoredMovie(stored);
      }
      throw error;
    }
    if (!raw?.status || !raw?.movie) {
      if (stored) return mapStoredMovie(stored);
      throw new Error(`Movie not found on KKPhim: ${slug}`);
    }

    const mapped = mapMovieDetail(raw);
    // Do not block the first open on Neon writes (episodes/actors/genres).
    queuePersistMappedMovie(slug, raw, mapped);
    return mapped;
  })().finally(() => pendingSyncs.delete(slug));

  pendingSyncs.set(slug, request);
  return request;
}
