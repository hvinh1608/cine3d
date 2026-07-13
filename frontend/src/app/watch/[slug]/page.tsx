'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, ChevronRight, ListVideo, Server, LightbulbOff, ArrowLeft, Subtitles, Gauge, Tv } from 'lucide-react';
import { useStore } from '../../../hooks/useStore';
import axios from '../../../lib/api';
import Hls from 'hls.js';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const activeEpOrder = parseInt(searchParams.get('ep') || '1', 10);

  const { user, accessToken, showToast } = useStore();
  const [movie, setMovie] = useState<any>(null);
  const [activeEpisode, setActiveEpisode] = useState<any>(null);
  const [activeSource, setActiveSource] = useState<any>(null);
  
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
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  
  // Ambilight dynamic glow state
  const [ambilightColor, setAmbilightColor] = useState<string>('rgba(99, 102, 241, 0.18)');

  // HLS Qualities & Casting states
  const [qualities, setQualities] = useState<any[]>([]);
  const [currentQualityIndex, setCurrentQualityIndex] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Fetch Movie details
  useEffect(() => {
    const fetchMovie = async () => {
      try {
        const res = await axios.get(`${API_URL}/movies/${slug}`);
        setMovie(res.data);
        
        // Find corresponding episode
        const episodes = res.data.episodes || [];
        const ep = episodes.find((e: any) => e.episodeOrder === activeEpOrder) || episodes[0];
        setActiveEpisode(ep);

        if (ep && ep.videoSources && ep.videoSources.length > 0) {
          setActiveSource(ep.videoSources[0]);
        }
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
  }, [slug, activeEpOrder]);

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

    if (activeSource.type === 'hls') {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(activeSource.url);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const loadedLevels = hls.levels.map((lvl: any, index: number) => ({
            index,
            height: lvl.height,
            bitrate: lvl.bitrate,
            name: lvl.name || (lvl.height ? `${lvl.height}p` : `Level ${index + 1}`)
          }));
          setQualities(loadedLevels);
        });

        hlsRef.current = hls;
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
          const record = res.data.find((h: any) => h.movieId === movie.id && h.episodeId === activeEpisode?.id);
          if (record && record.watchedTime > 5) {
            video.currentTime = record.watchedTime;
          }
        } catch (e) {
          // ignore
        }
      }
    };
    fetchHistoryAndResume();

    setPlaying(false);
    setActiveSubTrack('none');
    setPlaybackRate(1);
  }, [activeSource, movie, activeEpisode, user, accessToken]);

  // Save progress helper
  const saveProgress = useCallback(() => {
    if (!user || !accessToken || !movie || !activeEpisode || !videoRef.current) return;
    const time = Math.floor(videoRef.current.currentTime);
    const dur = Math.floor(videoRef.current.duration || 0);
    if (time <= 2) return; // avoid saving if practically at start

    axios.post(`${API_URL}/user/history`, {
      movieId: movie.id,
      episodeId: activeEpisode.id,
      watchedTime: time,
      duration: dur,
    }, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).catch(() => {});
  }, [user, accessToken, movie?.id, activeEpisode?.id]);

  // Periodic Save History (every 10 seconds of play) and immediate save on pause/unload
  useEffect(() => {
    if (!playing) {
      saveProgress();
      return;
    }

    const interval = setInterval(saveProgress, 10000);

    return () => {
      clearInterval(interval);
      saveProgress(); // save immediately when pausing or switching episodes
    };
  }, [playing, saveProgress]);

  // Tab unload / reload tab save backup
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveProgress();
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

    let intervalId: any;

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
      } catch (e) {
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

    intervalId = setInterval(analyzeFrame, 400);
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
    setShowQualityMenu(false);
  };

  const handleCast = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Remote Playback API
    const vAny = video as any;
    if (vAny.remotePlayback) {
      vAny.remotePlayback.prompt()
        .then(() => showToast('Đang kết nối thiết bị trình chiếu...', 'info'))
        .catch((e: any) => {
          if (e.name !== 'NotAllowedError') {
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
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newTime = parseFloat(e.target.value);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
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
    setShowSubMenu(false);
  };

  const handleSpeedChange = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  // Skip buttons
  const skipForward = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime += 10;
  };

  const skipBackward = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime -= 10;
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
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 flex items-center justify-between text-xs md:text-sm font-semibold text-slate-400">
        <Link href={`/movies/${movie.slug}`} className="flex items-center hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Trở lại chi tiết phim
        </Link>
        <span className="text-slate-300">
          Đang xem: <span className="text-white font-bold">{movie.title}</span> - {activeEpisode.title}
        </span>
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

            {/* Video core */}
            <video
              key={activeEpisode?.id || 'default'}
              ref={videoRef}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onClick={togglePlay}
              className="w-full h-full object-contain cursor-pointer"
            >
              {activeEpisode.subtitles?.map((sub: any) => (
                <track
                  key={sub.id}
                  src={sub.url}
                  kind="subtitles"
                  srcLang={sub.language === 'Vietnamese' ? 'vi' : 'en'}
                  label={sub.language}
                  default={sub.language === 'Vietnamese'}
                />
              ))}
            </video>

            {/* Custom Control Overlay (appears on hover) */}
            <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col space-y-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30">
              
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
                  <button onClick={togglePlay} className="text-white hover:text-red-500 transition-colors cursor-pointer">
                    {playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                  </button>
                  <button onClick={skipBackward} className="text-slate-300 hover:text-white transition-colors cursor-pointer" title="-10 giây">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button onClick={skipForward} className="text-slate-300 hover:text-white transition-colors cursor-pointer" title="+10 giây">
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

                {/* Subtitles, Speed, Theater & Screen Modes */}
                <div className="flex items-center space-x-3.5">
                  {/* Playback speed selector */}
                  <div className="relative">
                    <button
                      onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowSubMenu(false); }}
                      className="text-xs md:text-sm font-semibold px-2 py-0.5 rounded border border-white/20 text-slate-300 hover:bg-white/10 flex items-center gap-1 cursor-pointer"
                      title="Tốc độ phát"
                    >
                      <Gauge className="w-3.5 h-3.5" /> {playbackRate}x
                    </button>
                    {showSpeedMenu && (
                      <div className="absolute bottom-full right-0 mb-2 w-24 bg-slate-950/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col z-40 text-xs">
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => handleSpeedChange(rate)}
                            className={`py-2 px-3 hover:bg-white/10 text-left transition-colors font-bold cursor-pointer ${
                              playbackRate === rate ? 'text-yellow-500' : 'text-slate-300'
                            }`}
                          >
                            {rate === 1 ? 'Chuẩn' : `${rate}x`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Subtitle Selector */}
                  {activeEpisode.subtitles && activeEpisode.subtitles.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => { setShowSubMenu(!showSubMenu); setShowSpeedMenu(false); }}
                        className="text-xs md:text-sm font-semibold px-2 py-0.5 rounded border border-white/20 text-slate-300 hover:bg-white/10 flex items-center gap-1 cursor-pointer"
                        title="Phụ đề"
                      >
                        <Subtitles className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Phụ đề</span>
                      </button>
                      {showSubMenu && (
                        <div className="absolute bottom-full right-0 mb-2 w-32 bg-slate-950/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col z-40 text-xs">
                          <button
                            onClick={() => handleSubtitleChange('none')}
                            className={`py-2 px-3 hover:bg-white/10 text-left transition-colors font-bold cursor-pointer ${
                              activeSubTrack === 'none' ? 'text-yellow-500' : 'text-slate-300'
                            }`}
                          >
                            Tắt
                          </button>
                          {activeEpisode.subtitles.map((sub: any) => (
                            <button
                              key={sub.id}
                              onClick={() => handleSubtitleChange(sub.language)}
                              className={`py-2 px-3 hover:bg-white/10 text-left transition-colors font-bold cursor-pointer ${
                                activeSubTrack === sub.language ? 'text-yellow-500' : 'text-slate-300'
                              }`}
                            >
                              {sub.language}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quality Selector */}
                  {qualities.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => { setShowQualityMenu(!showQualityMenu); setShowSubMenu(false); setShowSpeedMenu(false); }}
                        className="text-xs md:text-sm font-semibold px-2 py-0.5 rounded border border-white/20 text-slate-300 hover:bg-white/10 flex items-center gap-1 cursor-pointer"
                        title="Chất lượng"
                      >
                        <span className="text-[10px] uppercase font-bold tracking-wider">
                          {currentQualityIndex === -1 ? 'Auto' : qualities[currentQualityIndex]?.name || `${qualities[currentQualityIndex]?.height}p`}
                        </span>
                      </button>
                      {showQualityMenu && (
                        <div className="absolute bottom-full right-0 mb-2 w-24 bg-slate-950/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col z-40 text-xs">
                          <button
                            onClick={() => handleQualityChange(-1)}
                            className={`py-2 px-3 hover:bg-white/10 text-left transition-colors font-bold cursor-pointer ${
                              currentQualityIndex === -1 ? 'text-yellow-500' : 'text-slate-300'
                            }`}
                          >
                            Auto
                          </button>
                          {qualities.map((lvl) => (
                            <button
                              key={lvl.index}
                              onClick={() => handleQualityChange(lvl.index)}
                              className={`py-2 px-3 hover:bg-white/10 text-left transition-colors font-bold cursor-pointer ${
                                currentQualityIndex === lvl.index ? 'text-yellow-500' : 'text-slate-300'
                              }`}
                            >
                              {lvl.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

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
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SIDE BAR: EPISODES & SERVER SELECT */}
        {!theaterMode && (
          <div className="lg:col-span-1 flex flex-col space-y-6 text-left">
            
            {/* Server Select */}
            <div className="glass-panel p-5 rounded-2xl space-y-3">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center">
                <Server className="w-4.5 h-4.5 text-cyan-400 mr-2" /> Chọn Server Phát
              </h4>
              <div className="flex flex-col space-y-1.5">
                {activeEpisode.videoSources?.map((src: any) => (
                  <button
                    key={src.id}
                    onClick={() => setActiveSource(src)}
                    className={`w-full py-2.5 px-4 text-xs font-bold rounded-lg border text-left transition-all cursor-pointer ${
                      activeSource?.id === src.id
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                        : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    {src.server} ({src.quality})
                  </button>
                )) || <p className="text-slate-500 text-xs">Đang tải server...</p>}
              </div>
            </div>

            {/* Episodes List */}
            <div className="glass-panel p-5 rounded-2xl space-y-3 flex-1">
              <h4 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center">
                <ListVideo className="w-4.5 h-4.5 text-purple-400 mr-2" /> Danh Sách Tập
              </h4>
              <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[300px] pr-1">
                {movie.episodes?.map((ep: any) => (
                  <Link
                    key={ep.id}
                    href={`/watch/${movie.slug}?ep=${ep.episodeOrder}`}
                    className={`py-2 px-1 text-center text-xs font-bold rounded-lg border transition-all ${
                      activeEpOrder === ep.episodeOrder
                        ? 'bg-red-600 border-transparent text-white'
                        : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    {ep.title}
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
