'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, ChevronRight, ChevronLeft, ListVideo, Server, LightbulbOff, ArrowLeft, Subtitles, Gauge, Tv, Settings, Maximize2, Lock, Crown, Download, Users } from 'lucide-react';
import { useStore } from '../../../hooks/useStore';
import axios from '../../../lib/api';
import Hls from 'hls.js';
import type { Episode, Movie, VideoSource } from '../../../types/movie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type PlaybackEpisode = Episode & { premiumSourcesLocked?: number };
type PlaybackMovie = Movie & { requiresVip?: boolean; isEarlyAccess?: boolean; episodes: PlaybackEpisode[] };
type HlsQuality = { index: number; height: number; bitrate: number; name: string };
type HistoryRecord = { movieId: string; episodeId: string | null; watchedTime: number };
type VideoWithRemotePlayback = HTMLVideoElement & { remote?: { prompt: () => Promise<void> } };

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

function WatchPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const activeEpOrder = parseInt(searchParams.get('ep') || '1', 10);

  const { user, accessToken, showToast } = useStore();
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Fetch Movie details
  useEffect(() => {
    const fetchMovie = async () => {
      try {
        const headers: Record<string, string> = {};
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }
        const res = await axios.get(`${API_URL}/movies/${slug}`, { headers });
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
  }, [slug, accessToken]);

  // Selecting another episode must not refetch and resync the entire movie.
  useEffect(() => {
    const episodes = movie?.episodes || [];
    const episode = episodes.find((item) => item.episodeOrder === activeEpOrder) || episodes[0] || null;
    queueMicrotask(() => {
      setActiveEpisode(episode);
      setActiveSource(episode?.videoSources?.[0] || null);
    });
  }, [movie, activeEpOrder]);

  // Load Video source HLS / MP4
  useEffect(() => {
    if (!videoRef.current || !activeSource) return;

    const video = videoRef.current;

    // Every episode has its own timeline; never carry the previous episode's time over.
    video.currentTime = 0;
    setCurrentTime(0);

    // Clear previous Hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setQualities([]);
    setCurrentQualityIndex(-1);

    let hls: Hls | null = null;
    if (activeSource.type === 'hls') {
      if (Hls.isSupported()) {
        const instance = new Hls();
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
        });

        hlsRef.current = instance;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = activeSource.url;
      }
    } else {
      // Direct MP4
      video.src = activeSource.url;
    }

    // Auto-resume from watch history if logged in
    const fetchHistoryAndResume = async () => {
      if (user && accessToken && movie) {
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
      if (hls) {
        hls.destroy();
        if (hlsRef.current === hls) hlsRef.current = null;
      }
    };
  }, [activeSource, movie, activeEpisode, user, accessToken]);

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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      }).catch(() => undefined);
      return;
    }
    axios.post(`${API_URL}/user/history`, payload).catch(() => {});
  }, [user, accessToken, movie, activeEpisode]);

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
    if (!playing || !videoRef.current || !activeSource) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyzeFrame = () => {
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
  }, [playing, activeSource]);

  // Player controls handlings
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    setPlaying(!playing);
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
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
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
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!videoRef.current || !activeSource) return;

      event.preventDefault();
      if (event.key === 'ArrowLeft') skipBackward();
      else skipForward();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSource, skipBackward, skipForward]);

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
    <div className={`flex-1 w-full pb-20 transition-all duration-700 ${lightsOff ? 'bg-black/95 z-40' : 'bg-transparent'}`}>
      
      {/* Return to Info Bar */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs md:text-sm font-semibold text-slate-400">
        <Link href={`/movies/${movie.slug}`} className="flex items-center hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Trở lại chi tiết phim
        </Link>
        <span className="text-slate-300 text-left sm:text-right truncate max-w-full">
          Đang xem: <span className="text-white font-bold">{movie.title}</span> {activeEpisode.title && ` - ${activeEpisode.title}`}
        </span>
        <Link href={`/watch-together?slug=${encodeURIComponent(movie.slug)}&ep=${activeEpisode.episodeOrder}`} className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/10">
          <Users className="h-3.5 w-3.5" /> Xem chung
        </Link>
      </div>

      <div className={`max-w-7xl mx-auto px-4 md:px-8 mt-6 grid grid-cols-1 ${theaterMode ? 'lg:grid-cols-1' : 'lg:grid-cols-4'} gap-6`}>
        
        {/* PLAYER AREA */}
        <div className={theaterMode ? 'lg:col-span-1' : 'lg:col-span-3'}>
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-white/5 shadow-2xl flex flex-col group" ref={playerContainerRef}>
            
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

                {/* Tap gesture overlay */}
                <div onClick={handleOverlayClick} className="absolute inset-0 z-10 cursor-pointer" />

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
                      className="p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all pointer-events-auto hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer border border-white/5"
                      title="-10 giây"
                    >
                      <RotateCcw className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={togglePlay} 
                      className="p-4 rounded-full bg-red-600/90 text-white hover:bg-red-700 transition-all pointer-events-auto hover:scale-110 active:scale-95 flex items-center justify-center shadow-lg cursor-pointer border border-white/10"
                    >
                      {playing ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                    </button>
                    <button 
                      onClick={skipForward} 
                      className="p-3 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all pointer-events-auto hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer border border-white/5"
                      title="+10 giây"
                    >
                      <RotateCcw className="w-6 h-6 transform rotate-180" />
                    </button>
                  </div>
                )}

                {/* Unified Settings Panel Menu */}
                {showControls && showSettings && (
                  <div className="fixed sm:absolute bottom-20 sm:bottom-16 right-2 sm:right-4 w-[calc(100vw-1rem)] sm:w-72 max-h-[70vh] overflow-y-auto bg-slate-950/95 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-3 flex flex-col z-[60] text-sm animate-fade-in">
                    
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
                                  setActiveSource(source);
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
                }`}>
                  
                  {/* Progress Slider */}
                  <div className="flex items-center space-x-3 w-full">
                    <span className="text-[10px] md:text-xs font-semibold text-slate-300">{formatTime(currentTime)}</span>
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleProgressChange}
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
                        onClick={() => {
                          setShowSettings(!showSettings);
                          setSettingsTab('main');
                          triggerControls();
                        }}
                        className={`p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer ${
                          showSettings ? 'text-yellow-500' : 'text-slate-300 hover:text-white'
                        }`}
                        title="Cài đặt"
                      >
                        <Settings className={`w-4.5 h-4.5 ${showSettings ? 'animate-spin' : ''}`} />
                      </button>

                      <button
                        onClick={() => setLightsOff(!lightsOff)}
                        className={`transition-colors cursor-pointer ${lightsOff ? 'text-red-500' : 'text-slate-300 hover:text-white'}`}
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
                        className="text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Truyền lên TV (Cast)"
                      >
                        <Tv className="w-4.5 h-4.5" />
                      </button>

                      <button onClick={handleFullscreen} className="text-slate-300 hover:text-white transition-colors cursor-pointer" title="Toàn màn hình">
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
        </div>

        {/* SIDE BAR: EPISODES & SERVER SELECT */}
        {!theaterMode && (
          <div className="lg:col-span-1 flex flex-col space-y-6 text-left">
            
            {/* Server Select */}
            <div className="glass-panel p-4 md:p-5 rounded-2xl space-y-3">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center">
                <Server className="w-4.5 h-4.5 text-cyan-400 mr-2" /> Chọn Server Phát
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2">
                {movie.requiresVip ? (
                  <p className="text-amber-400 text-xs font-bold py-2">Nguồn phát bị khóa (Yêu cầu VIP)</p>
                ) : (
                  activeEpisode.videoSources?.map((source) => (
                    <button
                      key={source.id}
                      onClick={() => setActiveSource(source)}
                      className={`w-full py-2.5 px-4 text-xs font-bold rounded-lg border text-left transition-all cursor-pointer ${
                        activeSource?.id === source.id
                          ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                          : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-white/5'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span>{source.server} ({source.quality})</span>
                        {source.isPremium && <span className="inline-flex items-center gap-1 rounded bg-amber-400/15 px-1.5 py-0.5 text-[8px] uppercase text-amber-300"><Crown className="h-2.5 w-2.5" /> VIP</span>}
                      </span>
                    </button>
                  )) || <p className="text-slate-500 text-xs">Đang tải server...</p>
                )}
                {!movie.requiresVip && (activeEpisode.premiumSourcesLocked || 0) > 0 && !user?.isVip && (
                  <Link href="/vip" className="col-span-full flex items-center justify-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-xs font-bold text-amber-300 hover:bg-amber-400/10">
                    <Lock className="h-3.5 w-3.5" /> Mở khóa {activeEpisode.premiumSourcesLocked} nguồn Premium/4K
                  </Link>
                )}
              </div>
            </div>

            {/* Episodes List */}
            <div className="glass-panel p-4 md:p-5 rounded-2xl space-y-3 flex-1">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center">
                <ListVideo className="w-4.5 h-4.5 text-purple-400 mr-2" /> Danh Sách Tập
              </h4>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-3 gap-2 overflow-y-auto max-h-[300px] pr-1">
                {movie.episodes?.map((episode) => (
                  <Link
                    key={episode.id}
                    href={`/watch/${movie.slug}?ep=${episode.episodeOrder}`}
                    className={`py-2 px-1 text-center text-xs font-bold rounded-lg border transition-all ${
                      activeEpOrder === episode.episodeOrder
                        ? 'bg-red-600 border-transparent text-white'
                        : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    {episode.title}
                  </Link>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
