import type { Episode, VideoSource } from '@/domain/models';

export type DownloadStatus = 'idle' | 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type DownloadAction = 'queue' | 'start' | 'pause' | 'resume' | 'complete' | 'fail' | 'cancel' | 'retry';

const DOWNLOAD_TRANSITIONS: Record<DownloadStatus, Partial<Record<DownloadAction, DownloadStatus>>> = {
  idle: { queue: 'queued', start: 'downloading' },
  queued: { start: 'downloading', cancel: 'cancelled' },
  downloading: { pause: 'paused', complete: 'completed', fail: 'failed', cancel: 'cancelled' },
  paused: { resume: 'downloading', cancel: 'cancelled', fail: 'failed' },
  completed: { cancel: 'cancelled' },
  failed: { retry: 'queued', cancel: 'cancelled' },
  cancelled: { retry: 'queued' },
};

export function transitionDownload(status: DownloadStatus, action: DownloadAction): DownloadStatus {
  const next = DOWNLOAD_TRANSITIONS[status][action];
  if (!next) throw new Error(`Invalid download transition: ${status} -> ${action}`);
  return next;
}

export function resolveEpisode(episodes: Episode[], requested?: number): Episode | null {
  if (!episodes.length) return null;
  const episodeNumber = Number.isFinite(requested) ? Math.max(1, Math.floor(requested!)) : 1;
  const ordered = [...episodes].sort((a, b) => a.episodeOrder - b.episodeOrder);
  return episodes.find((episode) => episode.episodeOrder === episodeNumber)
    ?? ordered[episodeNumber - 1]
    ?? ordered[0]
    ?? null;
}

export function orderSources(sources: VideoSource[], dataSaver: boolean): VideoSource[] {
  const qualityScore = (quality: string) => Number(quality.match(/\d+/)?.[0] ?? 0);
  return [...sources].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'hls' ? -1 : 1;
    const delta = qualityScore(a.quality) - qualityScore(b.quality);
    return dataSaver ? delta : -delta;
  });
}

export function nextSource(sources: VideoSource[], currentId: string): VideoSource | null {
  const index = sources.findIndex((source) => source.id === currentId);
  return index >= 0 ? sources[index + 1] ?? null : sources[0] ?? null;
}

export function shouldSaveProgress(lastSavedAt: number, now: number, intervalMs = 30_000): boolean {
  return now - lastSavedAt >= intervalMs;
}

export function shouldAutoNext(
  currentTime: number,
  duration: number,
  hasNextEpisode: boolean,
  autoNext: boolean,
  thresholdSeconds = 3,
): boolean {
  return autoNext && hasNextEpisode && duration > 0 && currentTime >= duration - thresholdSeconds;
}

export function getNextEpisode(episodes: Episode[], currentId: string): Episode | null {
  const ordered = [...episodes].sort((a, b) => a.episodeOrder - b.episodeOrder);
  const index = ordered.findIndex((episode) => episode.id === currentId);
  return index >= 0 ? ordered[index + 1] ?? null : null;
}
