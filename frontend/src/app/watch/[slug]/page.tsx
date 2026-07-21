'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from '@/components/ui/ResilientImage';
import dynamic from 'next/dynamic';
import { Play, Pause, Volume2, VolumeX, Maximize, Maximize2, RotateCcw, ChevronRight, ChevronLeft, ListVideo, LightbulbOff, ArrowLeft, Subtitles, Gauge, Tv, Settings, Lock, Crown, Download, Users } from 'lucide-react';
import { useStore } from '../../../hooks/useStore';
import axios from '../../../lib/api';
import type { Episode, Movie, VideoSource } from '../../../types/movie';

const MovieComments = dynamic(() => import('../../../components/community/MovieComments'), {
  loading: () => <div className="mt-8 h-48 animate-pulse rounded-3xl bg-white/5" />,
});
const WatchMovieInfo = dynamic(() => import('../../../components/watch/WatchMovieInfo'), {
  loading: () => <div className="mt-3 h-64 animate-pulse rounded-2xl bg-white/5" />,
});
const WatchSidebar = dynamic(() => import('../../../components/watch/WatchSidebar'), {
  loading: () => <div className="h-48 animate-pulse rounded-2xl bg-white/5" />,
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type PlaybackEpisode = Episode & { premiumSourcesLocked?: number };
type PlaybackMovie = Movie & { requiresVip?: boolean; isEarlyAccess?: boolean; episodes: PlaybackEpisode[] };
type HlsQuality = { index: number; height: number; bitrate: number; name: string };
type HistoryRecord = { movieId: string; episodeId: string | null; watchedTime: number };
type VideoWithRemotePlayback = HTMLVideoElement & { remote?: { prompt: () => Promise<void> } };
type TimelinePreview = { visible: boolean; time: number; position: number; image: string | null };

export default function WatchPage() {
  return (
    <Suspense fallback={
      <div className="flex-grow flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-4 border-t-red-500 border-slate-900 rounded-full animate-spin" />
      </div>
    }>
      <WatchPageContent />
    </Suspense>
  );
}

const MAX_TIMELINE_PREVIEW_FRAMES = 36;

function getTimelinePreviewInterval(duration: number): number {
  if (duration > 5400) return 30;
  if (duration > 2400) return 20;
  return 15;
}

function getTimelinePreviewBucket(time: number, duration: number): number {
  const interval = getTimelinePreviewInterval(duration);
  return Math.round(time / interval) * interval;
}

function WatchPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const activeEpOrder = parseInt(searchParams.get('ep') || '1', 10);

  const { user, accessToken, showToast, selectedProfileId, reduceMotion } = useStore();
  const [movie, setMovie] = useState<PlaybackMovie | null>(null);
  const [activeEpisode, setActiveEpisode] = useState<PlaybackEpisode | null>(null);
  const [activeSource, setActiveSource] = useState<VideoSource | null>(null);
  
  // Custom Player States
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [theaterMode, setTheaterMode] = useState(false);
  const [lightsOff, setLightsOff] = useState(false);

  // Subtitles & Speed control states
  const [activeSubTrack, setActiveSubTrack] = useState<string>('none');
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  
  // Ambilight dynamic glow state
  const [ambilightColor, setAmbilightColor] = useState<string>('rgba(99, 102, 241, 0.18)');

  // HLS Qualities & Casting states
  const [qualities, setQualities] = useState<HlsQuality[]>([]);
  const [currentQualityIndex, setCurrentQualityIndex] = useState<number>(-1);

  // Mobile & UX Optimization States
  const [showControls, setShowControls] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'main' | 'quality' | 'speed' | 'subtitle' | 'ratio'>('main');
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<'forward' | 'backward' | null>(null);
  const [autoNext, setAutoNext] = useState(true);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState<number | null>(null);
  const [subtitleStyle, setSubtitleStyle] = useState({ fontSize: 100, color: '#ffffff', background: 65, offset: 0, position: 85 });
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [dataSaver, setDataSaver] = useState(false);
  const [timelinePreview, setTimelinePreview] = useState<TimelinePreview>({ visible: false, time: 0, position: 0, image: null });
  const [richTimelinePreviewEnabled, setRichTimelinePreviewEnabled] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<import('hls.js').default | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playTrackedEpisodeRef = useRef<string | null>(null);
  const loadStartedAtRef = useRef(0);
  const bufferingStartedAtRef = useRef<number | null>(null);
  const originalCueTimesRef = useRef(new WeakMap<TextTrackCue, { start: number; end: number }>());
  const timelineFramesRef = useRef(new Map<number, string>());
  const lastCapturedFrameRef = useRef(-1);
  const settingsWasOpenRef = useRef(false);
  const pendingSourceResumeRef = useRef<{ episodeId: string; time: number; shouldPlay: boolean } | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('cine3d-player-preferences') || '{}');
      queueMicrotask(() => {
        if (typeof saved.autoNext === 'boolean') setAutoNext(saved.autoNext);
        if (saved.subtitleStyle && typeof saved.subtitleStyle === 'object') {
          setSubtitleStyle((current) => ({ ...current, ...saved.subtitleStyle }));
        }
      });
    } catch { /* use defaults */ }
    if (!user) queueMicrotask(() => setPreferencesReady(true));
  }, [user]);

  useEffect(() => {
    if (!user || !accessToken) return;
    let active = true;
    axios.get(`${API_URL}/user/player-preferences`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((response) => {
      if (!active) return;
      if (typeof response.data?.autoNext === 'boolean') setAutoNext(response.data.autoNext);
      if (response.data?.subtitleStyle) setSubtitleStyle((current) => ({ ...current, ...response.data.subtitleStyle }));
    }).catch(() => {}).finally(() => { if (active) setPreferencesReady(true); });
    return () => { active = false; };
  }, [accessToken, user]);

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const shouldSave = Boolean(connection?.saveData || connection?.effectiveType?.includes('2g'));
    queueMicrotask(() => setDataSaver(shouldSave));
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const update = () => setRichTimelinePreviewEnabled(mediaQuery.matches && !dataSaver && !reduceMotion);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, [dataSaver, reduceMotion]);

  useEffect(() => {
    if (!preferencesReady) return;
    localStorage.setItem('cine3d-player-preferences', JSON.stringify({ autoNext, subtitleStyle }));
    if (!user || !accessToken) return;
    const timer = window.setTimeout(() => {
      void axios.put(`${API_URL}/user/player-preferences`, { autoNext, subtitleStyle }, { headers: { Authorization: `Bearer ${accessToken}` } });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [accessToken, autoNext, preferencesReady, subtitleStyle, user]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const applyCuePreferences = () => {
      for (let trackIndex = 0; trackIndex < video.textTracks.length; trackIndex++) {
        const cues = video.textTracks[trackIndex].cues;
        if (!cues) continue;
        for (const cue of Array.from(cues)) {
          const original = originalCueTimesRef.current.get(cue) || { start: cue.startTime, end: cue.endTime };
          originalCueTimesRef.current.set(cue, original);
          cue.startTime = Math.max(0, original.start + subtitleStyle.offset);
          cue.endTime = Math.max(cue.startTime + 0.1, original.end + subtitleStyle.offset);
          if ('line' in cue) (cue as VTTCue).line = subtitleStyle.position;
        }
      }
    };
    applyCuePreferences();
    const timer = window.setTimeout(applyCuePreferences, 300);
    return () => window.clearTimeout(timer);
  }, [activeEpisode, activeSubTrack, subtitleStyle.offset, subtitleStyle.position]);

  useEffect(() => {
    timelineFramesRef.current.clear();
    lastCapturedFrameRef.current = -1;
    queueMicrotask(() => setTimelinePreview({ visible: false, time: 0, position: 0, image: null }));
  }, [activeEpisode?.id]);

  useEffect(() => {
    if (showControls && showSettings) {
      settingsWasOpenRef.current = true;
      settingsPanelRef.current?.focus();
      return;
    }
    if (settingsWasOpenRef.current) {
      settingsWasOpenRef.current = false;
      settingsButtonRef.current?.focus();
    }
  }, [showControls, showSettings]);

  // Close settings with Escape (accessibility polish).
  useEffect(() => {
    if (!showControls || !showSettings) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setShowSettings(false);
      setSettingsTab('main');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showControls, showSettings]);

  // Helper to trigger controls visibility and reset auto-hide timer
  const triggerControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      // Only auto-hide if video is playing and settings menu is closed
      if (videoRef.current && !videoRef.current.paused && !showSettings) {
        setShowControls(false);
      }
    }, 3500);
  }, [showSettings]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Update controls visibility timer when playing state changes
  useEffect(() => {
    queueMicrotask(() => {
      if (playing) {
        triggerControls();
      } else {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
      }
    });
  }, [playing, triggerControls]);

  // Fetch Movie details (do not refetch when accessToken rotates after refresh).
  useEffect(() => {
    const fetchMovie = async () => {
      try {
        const res = await axios.get(`${API_URL}/movies/${slug}`);
        setMovie(res.data as PlaybackMovie);
      } catch (error) {
        console.warn('Failed to load movie for playback.', error);
        setMovie(null);
        setActiveEpisode(null);
        setActiveSource(null);
      }
    };

    if (slug) {
      fetchMovie();
    }
  }, [slug]);

  // Selecting another episode must not refetch and resync the entire movie.
  useEffect(() => {
    const episodes = movie?.episodes || [];
    const episode = episodes.find((item) => item.episodeOrder === activeEpOrder) || episodes[0] || null;
    queueMicrotask(() => {
      setActiveEpisode(episode);
      setActiveSource(episode?.videoSources?.[0] || null);
    });
  }, [movie, activeEpOrder]);

  const changePlaybackSource = useCallback((source: VideoSource) => {
    if (source.id === activeSource?.id) return;
    const video = videoRef.current;
    if (video && activeEpisode) {
      pendingSourceResumeRef.current = {
        episodeId: activeEpisode.id,
        time: video.currentTime,
        shouldPlay: !video.paused && !video.ended,
      };
    }
    setActiveSource(source);
  }, [activeEpisode, activeSource?.id]);

  // Load Video source HLS / MP4
  useEffect(() => {
    if (!videoRef.current || !activeSource) return;

    const video = videoRef.current;

    const isServerSwitch = pendingSourceResumeRef.current?.episodeId === activeEpisode?.id;
    // Every episode has its own timeline; only a server switch carries time over.
    if (!isServerSwitch) {
      video.currentTime = 0;
      setCurrentTime(0);
    }

    // Clear previous Hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setQualities([]);
    setCurrentQualityIndex(-1);

    let disposed = false;
    let hls: import('hls.js').default | null = null;
    if (activeSource.type === 'hls') {
      void import('hls.js').then(({ default: Hls }) => {
        if (disposed) return;
        if (Hls.isSupported()) {
          const instance = new Hls({ maxBufferLength: dataSaver ? 15 : 30, maxMaxBufferLength: dataSaver ? 30 : 60, capLevelToPlayerSize: true });
          if (disposed) { instance.destroy(); return; }
          hls = instance;
          instance.loadSource(activeSource.url);
          instance.attachMedia(video);
        
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          const loadedLevels = instance.levels.map((level, index) => ({
            index,
            height: level.height,
            bitrate: level.bitrate,
            name: level.name || (level.height ? `${level.height}p` : `Level ${index + 1}`)
          }));
          setQualities(loadedLevels);
          if (dataSaver && loadedLevels.length) {
            const lowest = loadedLevels.reduce((best, level) => level.bitrate < best.bitrate ? level : best, loadedLevels[0]);
            instance.currentLevel = lowest.index;
            setCurrentQualityIndex(lowest.index);
          }
        });
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          void axios.post('/analytics/events', {
            name: 'player_error', path: window.location.pathname, movieId: movie?.id,
            metadata: { source: activeSource.server, type: data.type, details: data.details },
          }).catch(() => undefined);
          const sources = activeEpisode?.videoSources || [];
          const currentIndex = sources.findIndex((source) => source.id === activeSource.id);
          const fallback = sources.slice(currentIndex + 1).find((source) => source.url !== activeSource.url);
          if (fallback) {
            showToast(`Server ${activeSource.server} lỗi, đang chuyển sang ${fallback.server}.`, 'info');
            void axios.post('/analytics/events', { name: 'server_fallback', path: window.location.pathname, movieId: movie?.id, metadata: { from: activeSource.server, to: fallback.server, details: data.details } }).catch(() => undefined);
            pendingSourceResumeRef.current = {
              episodeId: activeEpisode?.id || '',
              time: video.currentTime,
              shouldPlay: !video.paused && !video.ended,
            };
            setActiveSource(fallback);
          }
        });
          hlsRef.current = instance;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = activeSource.url;
        } else {
          showToast('Trình duyệt không hỗ trợ nguồn phát HLS này.', 'error');
        }
      }).catch(() => showToast('Không thể tải bộ phát HLS.', 'error'));
    } else {
      // Direct MP4
      video.src = activeSource.url;
    }

    // Auto-resume from watch history if logged in
    const fetchHistoryAndResume = async () => {
      if (!isServerSwitch && user && accessToken && movie) {
        try {
          const res = await axios.get(`${API_URL}/user/history`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          const record = (res.data as HistoryRecord[]).find((history) => history.movieId === movie.id && history.episodeId === activeEpisode?.id);
          if (record && record.watchedTime > 5) {
            video.currentTime = record.watchedTime;
          }
        } catch {
          // ignore
        }
      }
    };
    fetchHistoryAndResume();

    setPlaying(false);
    setActiveSubTrack('none');
    setPlaybackRate(1);

    return () => {
      disposed = true;
      if (hls) {
        hls.destroy();
        if (hlsRef.current === hls) hlsRef.current = null;
      }
    };
  }, [activeSource, movie, activeEpisode, user, accessToken, dataSaver, showToast]);

  const nextEpisode = movie?.episodes
    ?.filter((episode) => episode.episodeOrder > (activeEpisode?.episodeOrder || 0))
    .sort((first, second) => first.episodeOrder - second.episodeOrder)[0] || null;

  const playNextEpisode = useCallback(() => {
    if (!movie || !nextEpisode) return;
    setNextEpisodeCountdown(null);
    router.push(`/watch/${movie.slug}?ep=${nextEpisode.episodeOrder}`);
  }, [movie, nextEpisode, router]);

  useEffect(() => {
    if (nextEpisodeCountdown === null) return;
    const timer = window.setTimeout(() => {
      if (nextEpisodeCountdown <= 0) playNextEpisode();
      else setNextEpisodeCountdown((current) => current === null ? null : current - 1);
    }, nextEpisodeCountdown <= 0 ? 0 : 1000);
    return () => window.clearTimeout(timer);
  }, [nextEpisodeCountdown, playNextEpisode]);

  const handleEnded = () => {
    setPlaying(false);
    saveProgress();
    if (movie) void axios.post('/analytics/events', { name: 'movie_complete', path: window.location.pathname, movieId: movie.id, metadata: { episode: activeEpisode?.episodeOrder } }).catch(() => undefined);
    if (autoNext && nextEpisode) setNextEpisodeCountdown(5);
  };

  // Save progress helper
  const saveProgress = useCallback((keepalive = false) => {
    if (!user || !accessToken || !movie || !activeEpisode || !videoRef.current) return;
    const time = Math.floor(videoRef.current.currentTime);
    const dur = Math.floor(videoRef.current.duration || 0);
    if (time <= 2) return; // avoid saving if practically at start

    const payload = {
      movieId: movie.id,
      episodeId: activeEpisode.id,
      watchedTime: time,
      duration: dur,
    };
    if (keepalive) {
      void fetch(`${API_URL}/user/history`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...(selectedProfileId ? { 'X-Profile-Id': selectedProfileId } : {}),
        },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
      return;
    }
    axios.post(`${API_URL}/user/history`, payload).catch(() => {});
  }, [user, accessToken, movie, activeEpisode, selectedProfileId]);

  // Periodic Save History (every 10 seconds of play) and immediate save on pause/unload
  useEffect(() => {
    if (!playing) {
      saveProgress();
      return;
    }

    const interval = window.setInterval(() => saveProgress(), 30_000);

    return () => {
      window.clearInterval(interval);
      saveProgress(); // save immediately when pausing or switching episodes
    };
  }, [playing, saveProgress]);

  // Tab unload / reload tab save backup
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveProgress(true);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveProgress]);

  // Real-time Ambilight color analysis from canvas
  useEffect(() => {
    if (!playing || !videoRef.current || !activeSource || dataSaver || reduceMotion) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyzeFrame = () => {
      if (document.visibilityState !== 'visible') return;
      try {
        ctx.drawImage(video, 0, 0, 10, 10);
        const data = ctx.getImageData(0, 0, 10, 10).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i+1];
          b += data[i+2];
        }
        const count = data.length / 4;
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        // Blend with minimum background color to keep it cinematic
        setAmbilightColor(`rgba(${r}, ${g}, ${b}, 0.28)`);
      } catch {
        // Fallback for CORS security restrictions on external domains
        const colors = [
          'rgba(99, 102, 241, 0.15)', // indigo
          'rgba(239, 68, 68, 0.15)',   // red
          'rgba(168, 85, 247, 0.15)',  // purple
          'rgba(6, 182, 212, 0.15)',   // cyan
        ];
        const time = Date.now() / 4000;
        const colorIndex = Math.floor(time) % colors.length;
        setAmbilightColor(colors[colorIndex]);
      }
    };

    const intervalId = setInterval(analyzeFrame, 1000);
    return () => clearInterval(intervalId);
  }, [playing, activeSource, dataSaver, reduceMotion]);

  // Player controls handlings
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleQualityChange = (index: number) => {
    setCurrentQualityIndex(index);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
    }
    setShowSettings(false);
    setSettingsTab('main');
  };

  const handleCast = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Remote Playback API
    const videoWithRemote = video as VideoWithRemotePlayback;
    if (videoWithRemote.remote) {
      videoWithRemote.remote.prompt()
        .then(() => showToast('Đang kết nối thiết bị trình chiếu...', 'info'))
        .catch((error: unknown) => {
          if (!(error instanceof DOMException) || error.name !== 'NotAllowedError') {
            showToast('Không tìm thấy thiết bị trình chiếu khả dụng.', 'error');
          }
        });
    } else {
      showToast('Trình duyệt của bạn không hỗ trợ truyền màn hình từ web.', 'info');
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    setCurrentTime(video.currentTime);

    if (!richTimelinePreviewEnabled) return;

    // Keep lightweight local snapshots for timeline previews. Cross-origin
    // sources may disallow canvas reads; playback still works in that case.
    const interval = getTimelinePreviewInterval(duration || video.duration || 0);
    const bucket = Math.floor(video.currentTime / interval) * interval;
    if (bucket === lastCapturedFrameRef.current || video.readyState < 2 || !video.videoWidth) return;
    lastCapturedFrameRef.current = bucket;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 192;
      canvas.height = 108;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      timelineFramesRef.current.set(bucket, canvas.toDataURL('image/jpeg', 0.62));
      if (timelineFramesRef.current.size > MAX_TIMELINE_PREVIEW_FRAMES) {
        const oldest = timelineFramesRef.current.keys().next().value;
        if (oldest !== undefined) timelineFramesRef.current.delete(oldest);
      }
    } catch {
      // The CDN did not grant canvas access (CORS); retain the time-only preview.
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    setDuration(video.duration);
    const pendingResume = pendingSourceResumeRef.current;
    if (pendingResume && pendingResume.episodeId === activeEpisode?.id) {
      const safeTime = Number.isFinite(video.duration)
        ? Math.min(pendingResume.time, Math.max(0, video.duration - 0.25))
        : pendingResume.time;
      video.currentTime = safeTime;
      setCurrentTime(safeTime);
      pendingSourceResumeRef.current = null;
      if (pendingResume.shouldPlay) {
        void video.play().catch(() => setPlaying(false));
      }
    }
  };

  const handleVideoPlay = () => {
    setPlaying(true);
    if (movie && activeEpisode && playTrackedEpisodeRef.current !== activeEpisode.id) {
      playTrackedEpisodeRef.current = activeEpisode.id;
      void axios.post('/analytics/events', {
        name: 'movie_play', path: window.location.pathname, movieId: movie.id,
        metadata: { episode: activeEpisode.episodeOrder },
      }).catch(() => undefined);
    }
  };

  const handleVideoError = () => {
    setPlaying(false);
    if (movie) void axios.post('/analytics/events', {
      name: 'player_error', path: window.location.pathname, movieId: movie.id,
      metadata: { source: activeSource?.server, code: videoRef.current?.error?.code || 0 },
    }).catch(() => undefined);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const vol = parseFloat(e.target.value);
    videoRef.current.volume = vol;
    setVolume(vol);
    setMuted(vol === 0);
    triggerControls();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
    triggerControls();
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newTime = parseFloat(e.target.value);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    triggerControls();
  };

  const updateTimelinePreview = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const time = ratio * duration;
    const bucket = getTimelinePreviewBucket(time, duration);
    setTimelinePreview({
      visible: true,
      time,
      position: Math.min(92, Math.max(8, ratio * 100)),
      image: timelineFramesRef.current.get(bucket) || null,
    });
  };

  const handleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      playerContainerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const handleSubtitleChange = (lang: string) => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].label === lang) {
        tracks[i].mode = 'showing';
      } else {
        tracks[i].mode = 'disabled';
      }
    }
    setActiveSubTrack(lang);
    setShowSettings(false);
    setSettingsTab('main');
  };

  const handleSpeedChange = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
    setSettingsTab('main');
  };

  // Skip buttons
  const skipForward = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + 10);
    triggerControls();
  }, [triggerControls]);

  const skipBackward = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    triggerControls();
  }, [triggerControls]);

  // Desktop keyboard seeking: left/right arrows move 10 seconds.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!videoRef.current || !activeSource) return;
      const activeElement = document.activeElement as HTMLElement | null;
      const playerActive = Boolean(
        playerContainerRef.current?.contains(activeElement) ||
        document.fullscreenElement === playerContainerRef.current
      );
      if (!playerActive) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.code === 'Space' || ['f', 'm', 'p'].includes(event.key.toLowerCase())) event.preventDefault();
      if (event.key === 'ArrowLeft') skipBackward();
      else if (event.key === 'ArrowRight') skipForward();
      else if (event.code === 'Space') void (videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause());
      else if (event.key.toLowerCase() === 'f') void handleFullscreen();
      else if (event.key.toLowerCase() === 'm') setMuted((current) => { videoRef.current!.muted = !current; return !current; });
      else if (event.key.toLowerCase() === 'p' && document.pictureInPictureEnabled) {
        if (!user) { showToast('Đăng nhập để sử dụng cửa sổ nổi.', 'info'); router.push('/account'); }
        else if (!user.isVip) { showToast('Picture-in-Picture dành cho thành viên VIP.', 'info'); router.push('/vip'); }
        else void (document.pictureInPictureElement ? document.exitPictureInPicture() : videoRef.current.requestPictureInPicture());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSource, router, showToast, skipBackward, skipForward, user]);

  const handlePictureInPicture = async () => {
    if (!user) { showToast('Đăng nhập để sử dụng cửa sổ nổi.', 'info'); router.push('/account'); return; }
    if (!user.isVip) { showToast('Picture-in-Picture dành cho thành viên VIP.', 'info'); router.push('/vip'); return; }
    if (!videoRef.current || !document.pictureInPictureEnabled) return showToast('Trình duyệt không hỗ trợ Picture-in-Picture.', 'info');
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await videoRef.current.requestPictureInPicture(); } catch { showToast('Không thể bật cửa sổ nổi.', 'error'); }
  };

  const reportPlayback = async () => {
    if (!user) return showToast('Vui lòng đăng nhập để báo lỗi nguồn phát.', 'info');
    try {
      await axios.post('/reports', { movieId: movie?.id, type: 'stream_error', content: JSON.stringify({ episode: activeEpisode?.episodeOrder, source: activeSource?.server, quality: activeSource?.quality, currentTime: Math.floor(currentTime), url: window.location.href }) });
      showToast('Đã gửi báo lỗi nguồn phát cho quản trị viên.', 'success');
    } catch { showToast('Không thể gửi báo lỗi lúc này.', 'error'); }
  };

  // Double tap feedback helper
  const lastClickTimeRef = useRef<number>(0);

  const showDoubleTapFeedback = (direction: 'forward' | 'backward') => {
    setDoubleTapFeedback(direction);
    setTimeout(() => {
      setDoubleTapFeedback(null);
    }, 750);
  };

  // Tap gesture overlay handler
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const clickDelay = now - lastClickTimeRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isRight = x > rect.width / 2;

    if (clickDelay < 300) {
      // Double tap -> Seek
      if (isRight) {
        skipForward();
        showDoubleTapFeedback('forward');
      } else {
        skipBackward();
        showDoubleTapFeedback('backward');
      }
    } else {
      // Single tap -> Toggle controls / settings close
      if (showSettings) {
        setShowSettings(false);
        setSettingsTab('main');
      } else {
        setShowControls(prev => !prev);
        if (!showControls) {
          triggerControls();
        }
      }
    }
    lastClickTimeRef.current = now;
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };


  if (!movie || !activeEpisode) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center h-[60vh] space-y-3 text-slate-400 text-sm">
        <div className="w-10 h-10 border-4 border-t-red-500 border-slate-900 rounded-full animate-spin" />
        <p>Đang tải trình phát… Nếu lâu quá, phim có thể không tồn tại.</p>
        <Link href="/" className="text-red-400 hover:text-red-300">Về trang chủ</Link>
      </div>
    );
  }

  return (
    <div className={`flex-1 w-full pb-20 transition-all duration-700 ${lightsOff ? 'bg-black/95 z-40' : 'bg-[#191a22]'}`}>
      <style>{`video::cue { color: ${subtitleStyle.color}; font-size: ${subtitleStyle.fontSize}%; background: rgba(0, 0, 0, ${subtitleStyle.background / 100}); text-shadow: 0 2px 4px #000; }`}</style>
      
      {/* Return to Info Bar */}
      <div className="mx-auto flex max-w-[1500px] flex-col justify-between gap-3 px-4 pt-6 text-xs font-semibold text-slate-400 md:px-8 md:text-sm sm:flex-row sm:items-center">
        <Link href={`/movies/${movie.slug}`} className="flex items-center hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Trở lại chi tiết phim
        </Link>
        <span className="text-slate-300 text-left sm:text-right truncate max-w-full">
          Đang xem: <span className="text-white font-bold">{movie.title}</span> {activeEpisode.title && ` - ${activeEpisode.title}`}
        </span>
        <Link href={`/watch-together?slug=${encodeURIComponent(movie.slug)}&ep=${activeEpisode.episodeOrder}`} className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-300 hover:text-slate-950">
          <Users className="h-3.5 w-3.5" /> Xem chung
        </Link>
      </div>

      <div className={`mx-auto mt-5 grid max-w-[1500px] grid-cols-1 gap-6 px-4 md:px-8 ${theaterMode ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_350px]'}`}>
        
        {/* PLAYER AREA */}
        <div className="min-w-0">
          <div
            className="group relative flex aspect-video w-full flex-col overflow-hidden rounded-[24px] border border-white/10 bg-black shadow-[0_28px_80px_rgba(0,0,0,.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#191a22]"
            ref={playerContainerRef}
            tabIndex={0}
            role="region"
            aria-label={`Trình phát phim ${movie.title}`}
          >
            
            {/* Dynamic Real-time Ambilight glow behind the player */}
            {playing && (
              <div
                style={{
                  background: `radial-gradient(circle, ${ambilightColor} 0%, rgba(0,0,0,0) 80%)`,
                  transition: 'background 0.8s ease-out',
                }}
                className="absolute inset-0 -z-10 blur-3xl pointer-events-none opacity-80"
              />
            )}

            {movie.requiresVip || (!activeSource && (activeEpisode.premiumSourcesLocked || 0) > 0) ? (
              <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-4 z-20">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)] animate-pulse">
                  <Lock className="w-7 h-7 text-amber-400" />
                </div>
                
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-lg md:text-xl font-black text-amber-400 uppercase tracking-widest">{movie.isEarlyAccess ? 'Suất chiếu sớm VIP' : 'Nội dung giới hạn VIP'}</h3>
                  <p className="text-xs md:text-sm text-slate-300">
                    Bộ phim <span className="text-white font-bold">“{movie.title}”</span> hiện chỉ dành riêng cho thành viên Premium VIP. Vui lòng đăng nhập tài khoản VIP hoặc liên hệ Quản trị viên để nâng cấp.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {!user ? (
                    <Link
                      href="/account"
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs md:text-sm px-6 py-2.5 rounded-full hover:scale-105 transition-transform active:scale-95 shadow-lg"
                    >
                      Đăng nhập ngay
                    </Link>
                  ) : (
                    <Link
                      href="/vip"
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs md:text-sm px-6 py-2.5 rounded-full hover:scale-105 transition-transform active:scale-95 shadow-lg cursor-pointer"
                    >
                      Nâng cấp VIP ngay
                    </Link>
                  )}
                  
                  <Link
                    href={`/movies/${movie.slug}`}
                    className="bg-slate-900 border border-white/10 text-slate-300 font-bold text-xs md:text-sm px-6 py-2.5 rounded-full hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Xem thông tin phim
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Video core */}
                <video
                  key={activeEpisode?.id || 'default'}
                  ref={videoRef}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={handleVideoPlay}
                  onLoadStart={() => { loadStartedAtRef.current = Date.now(); }}
                  onCanPlay={() => { const startupMs = Date.now() - loadStartedAtRef.current; if (startupMs > 0) void axios.post('/analytics/events', { name: 'player_startup', path: window.location.pathname, movieId: movie.id, metadata: { startupMs, source: activeSource?.server } }).catch(() => undefined); }}
                  onWaiting={() => { bufferingStartedAtRef.current = Date.now(); }}
                  onPlaying={() => { if (bufferingStartedAtRef.current) { const bufferingMs = Date.now() - bufferingStartedAtRef.current; bufferingStartedAtRef.current = null; void axios.post('/analytics/events', { name: 'player_buffer', path: window.location.pathname, movieId: movie.id, metadata: { bufferingMs, source: activeSource?.server, quality: activeSource?.quality } }).catch(() => undefined); } }}
                  onPause={() => setPlaying(false)}
                  onEnded={handleEnded}
                  onError={handleVideoError}
                  className={`w-full h-full object-contain cursor-pointer object-${aspectRatio}`}
                >
                  {activeEpisode.subtitles?.map((subtitle) => (
                    <track
                      key={subtitle.id}
                      src={subtitle.url}
                      kind="subtitles"
                      srcLang={subtitle.language === 'Vietnamese' ? 'vi' : 'en'}
                      label={subtitle.language}
                      default={subtitle.language === 'Vietnamese'}
                    />
                  ))}
                </video>

                {activeEpisode.introEndSeconds && currentTime > 0 && currentTime < activeEpisode.introEndSeconds && (
                  <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = activeEpisode.introEndSeconds || 0; }} className="absolute right-4 top-4 z-40 rounded-lg border border-white/20 bg-black/75 px-4 py-2 text-xs font-black text-white backdrop-blur hover:bg-white hover:text-black">
                    Bỏ qua mở đầu
                  </button>
                )}
                {nextEpisode && activeEpisode.outroStartSeconds && currentTime >= activeEpisode.outroStartSeconds && (
                  <button onClick={playNextEpisode} className="absolute right-4 top-4 z-40 rounded-lg bg-red-600 px-4 py-2 text-xs font-black text-white shadow-lg hover:bg-red-500">
                    Tập tiếp theo <ChevronRight className="ml-1 inline h-4 w-4" />
                  </button>
                )}
                {nextEpisodeCountdown !== null && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-6 text-center backdrop-blur-sm">
                    <div className="space-y-4"><p className="text-xs font-bold uppercase tracking-widest text-red-400">Tự động phát tập tiếp theo</p><h3 className="text-xl font-black">{nextEpisode?.title} sau {nextEpisodeCountdown}s</h3><div className="flex justify-center gap-3"><button onClick={playNextEpisode} className="rounded-full bg-red-600 px-5 py-2 text-xs font-black">Xem ngay</button><button onClick={() => setNextEpisodeCountdown(null)} className="rounded-full border border-white/20 px-5 py-2 text-xs font-bold">Hủy</button></div></div>
                  </div>
                )}

                {/* Tap gesture overlay */}
                <div onClick={(event) => { playerContainerRef.current?.focus(); handleOverlayClick(event); }} className="absolute inset-0 z-10 cursor-pointer" />

                {/* Double Tap Ripple/Indicator Feedback */}
                {doubleTapFeedback === 'backward' && (
                  <div className="absolute inset-y-0 left-0 w-1/3 flex items-center justify-center bg-gradient-to-r from-black/50 to-transparent pointer-events-none z-20 rounded-l-2xl">
                    <div className="flex flex-col items-center space-y-1 text-white animate-seek-left">
                      <div className="p-3 bg-black/40 rounded-full">
                        <RotateCcw className="w-8 h-8 text-red-500 fill-current" />
                      </div>
                      <span className="text-xs font-extrabold tracking-wider text-red-500 text-glow-red">-10 giây</span>
                    </div>
                  </div>
                )}
                {doubleTapFeedback === 'forward' && (
                  <div className="absolute inset-y-0 right-0 w-1/3 flex items-center justify-center bg-gradient-to-l from-black/50 to-transparent pointer-events-none z-20 rounded-r-2xl">
                    <div className="flex flex-col items-center space-y-1 text-white animate-seek-right">
                      <div className="p-3 bg-black/40 rounded-full">
                        <RotateCcw className="w-8 h-8 text-red-500 fill-current transform rotate-180" />
                      </div>
                      <span className="text-xs font-extrabold tracking-wider text-red-500 text-glow-red">+10 giây</span>
                    </div>
                  </div>
                )}

                {/* Large Central Controls Overlay (for easy mobile touch) */}
                {showControls && (
                  <div className="absolute inset-0 flex items-center justify-center space-x-6 pointer-events-none z-20">
                    <button 
                      onClick={skipBackward} 
                      type="button"
                      aria-label="Tua lùi 10 giây"
                      className="p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all pointer-events-auto hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer border border-white/5"
                      title="-10 giây"
                    >
                      <RotateCcw className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={togglePlay} 
                      type="button"
                      aria-label={playing ? 'Tạm dừng video' : 'Phát video'}
                      className="p-4 rounded-full bg-red-600/90 text-white hover:bg-red-700 transition-all pointer-events-auto hover:scale-110 active:scale-95 flex items-center justify-center shadow-lg cursor-pointer border border-white/10"
                    >
                      {playing ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                    </button>
                    <button 
                      onClick={skipForward} 
                      type="button"
                      aria-label="Tua tới 10 giây"
                      className="p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all pointer-events-auto hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer border border-white/5"
                      title="+10 giây"
                    >
                      <RotateCcw className="w-6 h-6 transform rotate-180" />
                    </button>
                  </div>
                )}

                {/* Unified Settings Panel Menu */}
                {showControls && showSettings && (
                  <div
                    ref={settingsPanelRef}
                    id="watch-player-settings"
                    className="fixed sm:absolute bottom-20 sm:bottom-16 right-2 sm:right-4 w-[calc(100vw-1rem)] sm:w-72 max-h-[70vh] overflow-y-auto bg-slate-950/95 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-3 flex flex-col z-[60] text-sm animate-fade-in focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/60"
                    role="dialog"
                    aria-modal="false"
                    aria-label="Cài đặt trình phát"
                    tabIndex={-1}
                  >
                    
                    {/* Tab: Main Menu */}
                    {settingsTab === 'main' && (
                      <div className="flex flex-col space-y-1 text-left">
                        <div className="text-xs font-bold text-slate-500 px-3 py-1 border-b border-white/5 uppercase tracking-wider mb-1">
                          Cài đặt trình phát
                        </div>
                        
                        {/* Quality Row */}
                        <button
                          onClick={() => setSettingsTab('quality')}
                          className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-left w-full"
                        >
                          <span className="flex items-center text-slate-300">
                            <Tv className="w-4 h-4 mr-2 text-cyan-400" />
                            Nguồn phát / Phân giải
                          </span>
                          <span className="text-xs font-bold text-yellow-500 flex items-center">
                            {currentQualityIndex === -1 
                              ? (qualities.length > 0 ? 'Tự động' : activeSource?.quality || 'Mặc định') 
                              : qualities[currentQualityIndex]?.name || `${qualities[currentQualityIndex]?.height}p`
                            }
                            <ChevronRight className="w-3.5 h-3.5 ml-1 text-slate-500" />
                          </span>
                        </button>

                        {/* Playback Speed Row */}
                        <button
                          onClick={() => setSettingsTab('speed')}
                          className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-left w-full"
                        >
                          <span className="flex items-center text-slate-300">
                            <Gauge className="w-4 h-4 mr-2 text-purple-400" />
                            Tốc độ phát
                          </span>
                          <span className="text-xs font-bold text-yellow-500 flex items-center">
                            {playbackRate === 1 ? 'Chuẩn' : `${playbackRate}x`}
                            <ChevronRight className="w-3.5 h-3.5 ml-1 text-slate-500" />
                          </span>
                        </button>

                        {/* Subtitle Row */}
                        {activeEpisode.subtitles && activeEpisode.subtitles.length > 0 && (
                          <button
                            onClick={() => setSettingsTab('subtitle')}
                            className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-left w-full"
                          >
                            <span className="flex items-center text-slate-300">
                              <Subtitles className="w-4 h-4 mr-2 text-green-400" />
                              Phụ đề
                            </span>
                            <span className="text-xs font-bold text-yellow-500 flex items-center">
                              {activeSubTrack === 'none' ? 'Tắt' : activeSubTrack}
                              <ChevronRight className="w-3.5 h-3.5 ml-1 text-slate-500" />
                            </span>
                          </button>
                        )}

                        {/* Aspect Ratio Row */}
                        <button
                          onClick={() => setSettingsTab('ratio')}
                          className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-left w-full"
                        >
                          <span className="flex items-center text-slate-300">
                            <Maximize2 className="w-4 h-4 mr-2 text-amber-400" />
                            Thu phóng màn hình
                          </span>
                          <span className="text-xs font-bold text-yellow-500 flex items-center">
                            {aspectRatio === 'contain' ? 'Gốc (Contain)' : aspectRatio === 'cover' ? 'Đầy (Cover)' : 'Giãn (Fill)'}
                            <ChevronRight className="w-3.5 h-3.5 ml-1 text-slate-500" />
                          </span>
                        </button>

                        <button
                          onClick={() => setAutoNext((current) => !current)}
                          className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-left w-full"
                        >
                          <span className="flex items-center text-slate-300"><ListVideo className="w-4 h-4 mr-2 text-red-400" /> Tự động phát tập tiếp</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${autoNext ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>{autoNext ? 'BẬT' : 'TẮT'}</span>
                        </button>
                      </div>
                    )}

                    {/* Tab: Quality Selection */}
                    {settingsTab === 'quality' && (
                      <div className="flex flex-col space-y-1 text-left">
                        <button
                          onClick={() => setSettingsTab('main')}
                          className="flex items-center text-xs font-bold text-slate-400 hover:text-white px-2 py-1.5 border-b border-white/5 mb-1 cursor-pointer w-full text-left"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" /> Trở lại cài đặt
                        </button>
                        
                        {qualities.length > 0 ? (
                          <>
                            <button
                              onClick={() => handleQualityChange(-1)}
                              className={`py-2 px-3 rounded-lg hover:bg-white/5 text-left transition-colors font-semibold cursor-pointer w-full ${
                                currentQualityIndex === -1 ? 'text-yellow-500 bg-white/5' : 'text-slate-300'
                              }`}
                            >
                              Tự động (HLS)
                            </button>
                            {qualities.map((lvl) => (
                              <button
                                key={lvl.index}
                                onClick={() => handleQualityChange(lvl.index)}
                                className={`py-2 px-3 rounded-lg hover:bg-white/5 text-left transition-colors font-semibold cursor-pointer w-full ${
                                  currentQualityIndex === lvl.index ? 'text-yellow-500 bg-white/5' : 'text-slate-300'
                                }`}
                              >
                                {lvl.name}
                              </button>
                            ))}
                          </>
                        ) : (
                          <>
                            <div className="text-[10px] text-slate-500 px-3 py-1 font-bold">CHỌN SERVER / PHÂN GIẢI</div>
                            {activeEpisode.videoSources?.map((source) => (
                              <button
                                key={source.id}
                                onClick={() => {
                                  changePlaybackSource(source);
                                  setShowSettings(false);
                                  setSettingsTab('main');
                                }}
                                className={`py-2 px-3 rounded-lg hover:bg-white/5 text-left transition-colors font-semibold cursor-pointer flex justify-between items-center w-full ${
                                  activeSource?.id === source.id ? 'text-yellow-500 bg-white/5' : 'text-slate-300'
                                }`}
                              >
                                <span>{source.server}</span>
                                <span className="text-xs text-slate-500 font-bold">{source.quality}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}

                    {/* Tab: Playback Speed Selection */}
                    {settingsTab === 'speed' && (
                      <div className="flex flex-col space-y-1 text-left">
                        <button
                          onClick={() => setSettingsTab('main')}
                          className="flex items-center text-xs font-bold text-slate-400 hover:text-white px-2 py-1.5 border-b border-white/5 mb-1 cursor-pointer w-full text-left"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" /> Trở lại cài đặt
                        </button>
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => handleSpeedChange(rate)}
                            className={`py-2 px-3 rounded-lg hover:bg-white/5 text-left transition-colors font-semibold cursor-pointer w-full ${
                              playbackRate === rate ? 'text-yellow-500 bg-white/5' : 'text-slate-300'
                            }`}
                          >
                            {rate === 1 ? 'Bình thường (1.0x)' : `${rate}x`}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Tab: Subtitle Selection */}
                    {settingsTab === 'subtitle' && (
                      <div className="flex flex-col space-y-1 text-left">
                        <button
                          onClick={() => setSettingsTab('main')}
                          className="flex items-center text-xs font-bold text-slate-400 hover:text-white px-2 py-1.5 border-b border-white/5 mb-1 cursor-pointer w-full text-left"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" /> Trở lại cài đặt
                        </button>
                        <button
                          onClick={() => handleSubtitleChange('none')}
                          className={`py-2 px-3 rounded-lg hover:bg-white/5 text-left transition-colors font-semibold cursor-pointer w-full ${
                            activeSubTrack === 'none' ? 'text-yellow-500 bg-white/5' : 'text-slate-300'
                          }`}
                        >
                          Tắt phụ đề
                        </button>
                        {activeEpisode.subtitles?.map((subtitle) => (
                          <button
                            key={subtitle.id}
                            onClick={() => handleSubtitleChange(subtitle.language)}
                            className={`py-2 px-3 rounded-lg hover:bg-white/5 text-left transition-colors font-semibold cursor-pointer w-full ${
                              activeSubTrack === subtitle.language ? 'text-yellow-500 bg-white/5' : 'text-slate-300'
                            }`}
                          >
                            {subtitle.language}
                          </button>
                        ))}
                        <div className="mt-2 border-t border-white/10 px-3 pt-3 space-y-3">
                          <label className="block text-[10px] font-bold uppercase text-slate-500">Cỡ chữ: {subtitleStyle.fontSize}%<input type="range" min="75" max="160" step="5" value={subtitleStyle.fontSize} onChange={(event) => setSubtitleStyle((current) => ({ ...current, fontSize: Number(event.target.value) }))} className="mt-2 w-full accent-red-500" /></label>
                          <label className="flex items-center justify-between text-xs text-slate-300">Màu chữ<input type="color" value={subtitleStyle.color} onChange={(event) => setSubtitleStyle((current) => ({ ...current, color: event.target.value }))} className="h-7 w-12 rounded border-0 bg-transparent" /></label>
                          <label className="block text-[10px] font-bold uppercase text-slate-500">Nền phụ đề: {subtitleStyle.background}%<input type="range" min="0" max="100" step="5" value={subtitleStyle.background} onChange={(event) => setSubtitleStyle((current) => ({ ...current, background: Number(event.target.value) }))} className="mt-2 w-full accent-red-500" /></label>
                          <label className="block text-[10px] font-bold uppercase text-slate-500">Độ trễ: {subtitleStyle.offset > 0 ? '+' : ''}{subtitleStyle.offset.toFixed(1)} giây<input type="range" min="-10" max="10" step="0.5" value={subtitleStyle.offset} onChange={(event) => setSubtitleStyle((current) => ({ ...current, offset: Number(event.target.value) }))} className="mt-2 w-full accent-cyan-500" /></label>
                          <label className="block text-[10px] font-bold uppercase text-slate-500">Vị trí: {subtitleStyle.position}%<input type="range" min="50" max="95" step="5" value={subtitleStyle.position} onChange={(event) => setSubtitleStyle((current) => ({ ...current, position: Number(event.target.value) }))} className="mt-2 w-full accent-purple-500" /></label>
                        </div>
                      </div>
                    )}

                    {/* Tab: Aspect Ratio Selection */}
                    {settingsTab === 'ratio' && (
                      <div className="flex flex-col space-y-1 text-left">
                        <button
                          onClick={() => setSettingsTab('main')}
                          className="flex items-center text-xs font-bold text-slate-400 hover:text-white px-2 py-1.5 border-b border-white/5 mb-1 cursor-pointer w-full text-left"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" /> Trở lại cài đặt
                        </button>
                        {([
                          { key: 'contain', name: 'Tự nhiên / Gốc (Fit)', desc: 'Hiện đầy đủ khung hình gốc' },
                          { key: 'cover', name: 'Đầy màn hình (Zoom/Cover)', desc: 'Phóng to lấp đầy màn hình, cắt nhẹ' },
                          { key: 'fill', name: 'Giãn màn hình (Stretch/Fill)', desc: 'Co giãn video vừa khít màn hình' }
                        ] satisfies { key: 'contain' | 'cover' | 'fill'; name: string; desc: string }[]).map((item) => (
                          <button
                            key={item.key}
                            onClick={() => {
                              setAspectRatio(item.key);
                              setShowSettings(false);
                              setSettingsTab('main');
                            }}
                            className={`py-2 px-3 rounded-lg hover:bg-white/5 text-left transition-colors cursor-pointer flex flex-col w-full ${
                              aspectRatio === item.key ? 'text-yellow-500 bg-white/5' : 'text-slate-300'
                            }`}
                          >
                            <span className="font-semibold">{item.name}</span>
                            <span className="text-[10px] text-slate-500">{item.desc}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Custom Control Overlay */}
                <div className={`absolute bottom-0 left-0 w-full px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col space-y-3 z-30 transition-opacity duration-300 ${
                  showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`} aria-hidden={!showControls}>
                  
                  {/* Progress Slider */}
                  <div
                    className="relative flex w-full items-center space-x-3"
                    onPointerMove={updateTimelinePreview}
                    onPointerLeave={() => setTimelinePreview((preview) => ({ ...preview, visible: false }))}
                  >
                    {timelinePreview.visible && (
                      <div
                        className="pointer-events-none absolute bottom-5 z-50 -translate-x-1/2 overflow-hidden rounded-lg border border-white/20 bg-black/90 shadow-2xl"
                        style={{ left: `${timelinePreview.position}%` }}
                      >
                        {timelinePreview.image ? (
                          <Image src={timelinePreview.image} alt="" width={160} height={90} unoptimized className="h-[90px] w-40 object-cover" />
                        ) : (
                          <div className="flex h-14 w-28 items-center justify-center bg-slate-950 text-[10px] font-bold text-slate-500">
                            Xem trước
                          </div>
                        )}
                        <div className="px-2 py-1 text-center text-[10px] font-black tabular-nums text-white">
                          {formatTime(timelinePreview.time)}
                        </div>
                      </div>
                    )}
                    <span className="text-[10px] md:text-xs font-semibold text-slate-300">{formatTime(currentTime)}</span>
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleProgressChange}
                      aria-label="Tua video"
                      className="flex-grow accent-red-600 h-1.5 bg-slate-700/60 rounded-full cursor-pointer hover:scale-y-125 transition-transform"
                    />
                    <span className="text-[10px] md:text-xs font-semibold text-slate-300">{formatTime(duration)}</span>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button onClick={togglePlay} className="text-white hover:text-red-500 transition-colors cursor-pointer sm:hidden">
                        {playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                      </button>
                      <button onClick={skipBackward} className="text-slate-300 hover:text-white transition-colors cursor-pointer sm:hidden" title="-10 giây">
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button onClick={skipForward} className="text-slate-300 hover:text-white transition-colors cursor-pointer sm:hidden" title="+10 giây">
                        <RotateCcw className="w-4 h-4 transform rotate-180" />
                      </button>

                      {/* Volume Control */}
                      <div className="flex items-center space-x-1.5">
                        <button onClick={toggleMute} className="text-slate-300 hover:text-white transition-colors cursor-pointer">
                          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={volume}
                          onChange={handleVolumeChange}
                          className="hidden sm:block w-16 accent-white h-1 bg-slate-700 rounded-full cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Settings & Screen Modes */}
                    <div className="flex items-center space-x-3.5">
                      {/* Settings gear button toggling showSettings */}
                      <button
                          ref={settingsButtonRef}
                        onClick={() => {
                          setShowSettings(!showSettings);
                          setSettingsTab('main');
                          triggerControls();
                        }}
                        type="button"
                        className={`p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer ${
                          showSettings ? 'text-yellow-500' : 'text-slate-300 hover:text-white'
                        }`}
                        aria-label="Mở cài đặt trình phát"
                        aria-haspopup="dialog"
                        aria-expanded={showSettings}
                        aria-controls="watch-player-settings"
                        title="Cài đặt"
                      >
                        <Settings className={`w-4.5 h-4.5 ${showSettings ? 'animate-spin' : ''}`} />
                      </button>

                      <button
                        onClick={() => setLightsOff(!lightsOff)}
                        type="button"
                        className={`transition-colors cursor-pointer ${lightsOff ? 'text-red-500' : 'text-slate-300 hover:text-white'}`}
                        aria-label={lightsOff ? 'Bật đèn nền trang xem' : 'Tắt đèn nền trang xem'}
                        title="Chế độ rạp chiếu (Tắt đèn)"
                      >
                        <LightbulbOff className="w-4.5 h-4.5" />
                      </button>

                      <button
                        onClick={() => setTheaterMode(!theaterMode)}
                        className={`hidden sm:inline-block text-xs md:text-sm font-semibold px-2 py-0.5 rounded border border-white/20 transition-all cursor-pointer ${
                          theaterMode ? 'bg-red-600 border-transparent text-white' : 'text-slate-300 hover:bg-white/10'
                        }`}
                        title="Chế độ Rạp phim lớn"
                      >
                        Rạp phim
                      </button>

                      <button
                        onClick={handleCast}
                        type="button"
                        className="text-slate-300 hover:text-white transition-colors cursor-pointer"
                        aria-label="Truyền video lên TV"
                        title="Truyền lên TV (Cast)"
                      >
                        <Tv className="w-4.5 h-4.5" />
                      </button>

                      <button onClick={handleFullscreen} type="button" className="text-slate-300 hover:text-white transition-colors cursor-pointer" aria-label="Chuyển toàn màn hình" title="Toàn màn hình">
                        <Maximize className="w-4.5 h-4.5" />
                      </button>
                      {user?.isVip && activeSource?.type === 'mp4' && (
                        <a
                          href={activeSource.url}
                          download={`${movie.slug}-tap-${activeEpisode?.episodeOrder || 1}.mp4`}
                          className="text-amber-300 transition-colors hover:text-amber-200"
                          title="Tải MP4 dành cho VIP"
                        >
                          <Download className="w-4.5 h-4.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <WatchMovieInfo
            movie={movie}
            activeEpisode={activeEpisode}
            activeEpOrder={activeEpOrder}
            user={user}
            lightsOff={lightsOff}
            dataSaver={dataSaver}
            onToggleLights={() => setLightsOff((current) => !current)}
            onToggleDataSaver={() => setDataSaver((current) => !current)}
            onPictureInPicture={() => void handlePictureInPicture()}
            onReportPlayback={() => void reportPlayback()}
            onCopyLink={() => { void navigator.clipboard.writeText(window.location.href); showToast('Đã sao chép liên kết xem phim.', 'success'); }}
          />
        </div>

        {/* SIDE BAR: EPISODES & SERVER SELECT */}
        {!theaterMode && (
          <WatchSidebar
            movie={movie}
            activeEpisode={activeEpisode}
            activeSource={activeSource}
            user={user}
            onSourceChange={changePlaybackSource}
          />
        )}
      </div>
      <div className="mx-auto max-w-[1500px] px-4 md:px-8"><MovieComments movieId={movie.id} currentTime={currentTime} onSeek={(seconds) => { if (videoRef.current) videoRef.current.currentTime = seconds; }} /></div>
    </div>
  );
}
