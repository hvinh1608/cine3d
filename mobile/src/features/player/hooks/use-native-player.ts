import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useVideoPlayer, type AudioTrack, type SubtitleTrack, type VideoContentFit } from 'expo-video';
import type { Episode, Movie, VideoSource } from '@/domain/models';
import { movieRepository } from '@/features/movies/data/http-movie-repository';
import { movieKeys } from '@/features/movies/domain/movie-repository';
import { useAppStore } from '@/state/app-store';
import { checkpointRepository } from '../data/player-storage';
import { playerApi } from '../data/player-api';
import { getNextEpisode, nextSource, orderSources, resolveEpisode, shouldSaveProgress } from '../domain/player-utils';
import { recordPerformance } from '@/core/performance';
import { redactErrorMessage } from '@/core/reliability';

export function useNativePlayer(movie: Movie, requestedEpisode?: number) {
  const queryClient = useQueryClient();
  const authenticated = useAppStore((state) => Boolean(state.session.tokens.accessToken));
  const profileId = useAppStore((state) => state.session.activeProfile?.id);
  const dataSaver = useAppStore((state) => state.preferences.dataSaver);
  const autoNext = useAppStore((state) => state.preferences.autoplay);
  const episodes = movie.episodes ?? [];
  const initialEpisode = useMemo(() => resolveEpisode(episodes, requestedEpisode), [episodes, requestedEpisode]);
  const [episode, setEpisodeState] = useState<Episode | null>(initialEpisode);
  const sources = useMemo(() => orderSources(episode?.videoSources ?? [], dataSaver), [episode, dataSaver]);
  const [source, setSource] = useState<VideoSource | null>(sources[0] ?? null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contentFit, setContentFit] = useState<VideoContentFit>('contain');
  const [tracks, setTracks] = useState<{ subtitles: SubtitleTrack[]; audio: AudioTrack[] }>({ subtitles: [], audio: [] });
  const [countdown, setCountdown] = useState<number | null>(null);
  const startedAt = useRef(Date.now());
  const firstReady = useRef(false);
  const lastSavedAt = useRef(0);
  const lastCheckpointAt = useRef(0);
  const wasReady = useRef(false);
  const hasRestoredRef = useRef(false);
  const pendingSourceResumeRef = useRef<{ time: number; shouldPlay: boolean } | null>(null);

  const player = useVideoPlayer(null, (instance) => {
    instance.timeUpdateEventInterval = 1;
    instance.showNowPlayingNotification = true;
    instance.staysActiveInBackground = true;
    instance.audioMixingMode = 'doNotMix';
    instance.keepScreenOnWhilePlaying = true;
    instance.bufferOptions = dataSaver
      ? { preferredForwardBufferDuration: 10, maxBufferBytes: 20 * 1024 * 1024, prioritizeTimeOverSizeThreshold: false }
      : { preferredForwardBufferDuration: 30, minBufferForPlayback: 2 };
  });

  const userId = useAppStore((state) => state.session.user?.id);
  const profileKey = userId ? `${userId}:${profileId ?? 'account'}` : 'guest';
  const saveProgress = useCallback(async (force = false) => {
    const latestPosition = player.currentTime;
    const latestDuration = player.duration;
    if (!episode || latestDuration <= 0) return;
    const now = Date.now();
    const checkpoint = {
      profileKey, movieId: movie.id, episodeId: episode.id,
      position: latestPosition, duration: latestDuration, updatedAt: now,
    };
    if (force || now - lastCheckpointAt.current >= 5_000) {
      lastCheckpointAt.current = now;
      await checkpointRepository.save(checkpoint);
    }
    if (authenticated && (force || shouldSaveProgress(lastSavedAt.current, now))) {
      lastSavedAt.current = now;
      await playerApi.saveProgress(movie.id, episode.id, latestPosition, latestDuration).catch(() => undefined);
      if (force) {
        void queryClient.invalidateQueries({ queryKey: movieKeys.history() });
      }
    }
  }, [authenticated, episode, movie.id, player, profileKey, queryClient]);

  useEffect(() => {
    const next = sources[0] ?? null;
    setSource(next);
    setError(next ? null : 'Tập này chưa có nguồn phát khả dụng.');
  }, [episode?.id, sources]);

  useEffect(() => {
    if (!source || !episode) return;
    setBuffering(true);
    setError(null);
    setCountdown(null);
    startedAt.current = Date.now();
    firstReady.current = false;
    wasReady.current = false;
    const resume = pendingSourceResumeRef.current;
    pendingSourceResumeRef.current = null;
    let active = true;
    void player.replaceAsync({
      uri: source.url,
      contentType: source.type === 'hls' ? 'hls' : 'progressive',
      useCaching: source.type === 'mp4',
      metadata: { title: `${movie.title} · ${episode.title}`, artist: 'Cine3D', artwork: movie.posterUrl },
    }).then(() => {
      if (!active) return;
      if (resume && resume.time > 5) {
        player.currentTime = resume.time;
        setPosition(resume.time);
      }
      if (!resume || resume.shouldPlay) player.play();
    }).catch((reason) => {
      if (active) setError(redactErrorMessage(reason));
    });
    void playerApi.track('movie_play', movie.id, { episodeId: episode.id, sourceId: source.id, server: source.server }).catch(() => undefined);
    return () => { active = false; };
  }, [episode, movie.id, movie.posterUrl, movie.title, player, source]);

  useEffect(() => {
    hasRestoredRef.current = false;
  }, [movie.id, episode?.id]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (hasRestoredRef.current || !episode) return;
      const [checkpoint, history] = await Promise.all([
        checkpointRepository.get(profileKey, movie.id),
        authenticated ? movieRepository.getHistory().catch(() => []) : Promise.resolve([]),
      ]);
      if (!active || hasRestoredRef.current) return;
      hasRestoredRef.current = true;
      const remote = history.find((item) => item.movieId === movie.id);
      const remoteUpdatedAt = remote?.updatedAt ? Date.parse(remote.updatedAt) : 0;
      const preferCheckpoint = Boolean(
        checkpoint && (!remote || !Number.isFinite(remoteUpdatedAt) || checkpoint.updatedAt >= remoteUpdatedAt),
      );
      const restoredEpisodeId = (preferCheckpoint ? checkpoint?.episodeId : remote?.episodeId)
        ?? remote?.episodeId
        ?? checkpoint?.episodeId;
      if (!requestedEpisode && restoredEpisodeId && restoredEpisodeId !== episode.id) {
        const restoredEpisode = episodes.find((item) => item.id === restoredEpisodeId);
        if (restoredEpisode) {
          setEpisodeState(restoredEpisode);
          return;
        }
      }
      const restoredPosition = (preferCheckpoint ? checkpoint?.position : undefined)
        ?? remote?.watchedTime
        ?? remote?.progressSeconds
        ?? checkpoint?.position
        ?? 0;
      const checkpointDuration = (preferCheckpoint ? checkpoint?.duration : undefined)
        ?? remote?.duration
        ?? remote?.durationSeconds
        ?? checkpoint?.duration
        ?? 0;
      const nearlyFinished = remote?.completed
        || (checkpointDuration > 0 && restoredPosition / checkpointDuration >= 0.9);
      if (restoredPosition > 15 && !nearlyFinished && player.currentTime < 5) {
        player.currentTime = restoredPosition;
        setPosition(restoredPosition);
      }
    })();
    return () => { active = false; };
  }, [authenticated, episode?.id, movie.id, player, profileKey, requestedEpisode, episodes, episode]);

  useEffect(() => {
    const subscriptions = [
      player.addListener('playingChange', ({ isPlaying }) => {
        setPlaying(isPlaying);
        if (!isPlaying) void saveProgress(true);
      }),
      player.addListener('timeUpdate', ({ currentTime }) => {
        setPosition(currentTime);
        void saveProgress(false);
      }),
      player.addListener('sourceLoad', ({ duration: nextDuration, availableSubtitleTracks, availableAudioTracks }) => {
        setDuration(nextDuration);
        setTracks({ subtitles: availableSubtitleTracks, audio: availableAudioTracks });
      }),
      player.addListener('statusChange', ({ status, oldStatus, error: playerError }) => {
        const isBuffering = status === 'loading';
        setBuffering(isBuffering);
        if (isBuffering && wasReady.current) {
          recordPerformance('player_buffer', 0, { movieId: movie.id, episodeId: episode?.id ?? '' });
          void playerApi.track('player_buffer', movie.id, { episodeId: episode?.id, position: player.currentTime }).catch(() => undefined);
        }
        if (status === 'readyToPlay') {
          wasReady.current = true;
          if (!firstReady.current) {
            firstReady.current = true;
            recordPerformance('player_startup', Date.now() - startedAt.current, {
              movieId: movie.id,
              episodeId: episode?.id ?? '',
            });
            void playerApi.track('player_startup', movie.id, {
              episodeId: episode?.id, sourceId: source?.id, startupMs: Date.now() - startedAt.current,
            }).catch(() => undefined);
          }
        }
        if (status === 'error') {
          const message = playerError?.message ?? 'Nguồn phát gặp lỗi.';
          void playerApi.track('player_error', movie.id, { episodeId: episode?.id, sourceId: source?.id, message }).catch(() => undefined);
          const fallback = source ? nextSource(sources, source.id) : sources[0] ?? null;
          if (fallback) {
            void playerApi.track('server_fallback', movie.id, {
              episodeId: episode?.id, from: source?.id, to: fallback.id, reason: message, oldStatus,
            }).catch(() => undefined);
            pendingSourceResumeRef.current = {
              time: player.currentTime,
              shouldPlay: player.playing,
            };
            setSource(fallback);
          } else setError(message);
        }
      }),
      player.addListener('playToEnd', () => {
        void saveProgress(true);
        void playerApi.track('movie_complete', movie.id, { episodeId: episode?.id }).catch(() => undefined);
        const latestDuration = player.duration;
        const latestPosition = player.currentTime;
        // Guard against spurious playToEnd events during source swaps / early load.
        const nearEnd = latestDuration > 30
          && latestPosition >= Math.max(latestDuration * 0.85, latestDuration - 45);
        if (autoNext && nearEnd && episode && getNextEpisode(episodes, episode.id)) {
          setCountdown(8);
        }
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [autoNext, episode, episodes, movie.id, player, saveProgress, source, sources]);

  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) {
      setCountdown(null);
      const next = episode ? getNextEpisode(episodes, episode.id) : null;
      if (next) setEpisodeState(next);
      return;
    }
    const timer = setTimeout(() => setCountdown((value) => value == null ? null : value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, episode, episodes]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void saveProgress(true);
    });
    return () => {
      subscription.remove();
      void saveProgress(true);
    };
  }, [saveProgress]);

  const setEpisode = useCallback((next: Episode) => {
    void saveProgress(true);
    setCountdown(null);
    setPosition(0);
    setDuration(0);
    setEpisodeState(next);
  }, [saveProgress]);

  return {
    player, episode, episodes, source, sources, position, duration, playing, buffering, error,
    contentFit, tracks, countdown, dataSaver, autoNext,
    setContentFit, setSource, setEpisode, setCountdown,
    retry: () => source && setSource({ ...source }),
    togglePlay: () => playing ? player.pause() : player.play(),
    seek: (seconds: number) => { player.currentTime = Math.max(0, Math.min(duration, seconds)); setPosition(seconds); },
    seekBy: (seconds: number) => player.seekBy(seconds),
    nextEpisode: () => {
      const next = episode ? getNextEpisode(episodes, episode.id) : null;
      if (next) setEpisode(next);
    },
    saveProgress,
  };
}
