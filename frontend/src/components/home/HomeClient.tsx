'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Play, Star, Plus, Sparkles, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import MovieCard3D from '../ui/MovieCard3D';
import { useStore } from '../../hooks/useStore';
import axios from '../../lib/api';
import type { Banner, Movie } from '../../types/movie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export type HomeInitialData = {
  banners: Banner[];
  trending: Movie[];
  proposed: Movie[];
  movies: Movie[];
  anime: Movie[];
  loadError?: string;
};

export default function HomeClient({ initialData }: { initialData: HomeInitialData }) {
  const { user, accessToken, favorites, setFavorites, watchHistory, setWatchHistory, reduceMotion, showToast } = useStore();

  const [banners, setBanners] = useState<Banner[]>(initialData.banners);
  const [trending, setTrending] = useState<Movie[]>(initialData.trending);
  const [proposed, setProposed] = useState<Movie[]>(initialData.proposed);
  const [allMovies, setAllMovies] = useState<Movie[]>(initialData.movies);
  const [animeList, setAnimeList] = useState<Movie[]>(initialData.anime);
  const [personalized, setPersonalized] = useState<Movie[]>([]);
  const [hasPersonalizedRecommendations, setHasPersonalizedRecommendations] = useState(false);
  const [activeAnimeIndex, setActiveAnimeIndex] = useState(0);

  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(initialData.loadError || '');
  const [reloadKey, setReloadKey] = useState(0);

  const recommendedRowRef = useRef<HTMLDivElement>(null);
  const latestRowRef = useRef<HTMLDivElement>(null);
  const trendingRowRef = useRef<HTMLDivElement>(null);
  const animeRowRef = useRef<HTMLDivElement>(null);

  const favoriteIds = useMemo(() => new Set(favorites.map((favorite) => favorite.id)), [favorites]);

  const scrollMovieRow = (ref: React.RefObject<HTMLDivElement | null>, direction: -1 | 1) => {
    const row = ref.current;
    if (!row) return;
    row.scrollBy({
      left: direction * Math.max(320, row.clientWidth * 0.85),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  // Fetch data from backend
  useEffect(() => {
    if (reloadKey === 0) return;
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setLoadError('');
      const [homeResult, animeResult] = await Promise.allSettled([
        axios.get(`${API_URL}/movies/home`, { signal: controller.signal, timeout: 35_000 }),
        axios.get(`${API_URL}/movies`, { params: { type: 'hoathinh', limit: 12 }, signal: controller.signal, timeout: 30_000 }),
      ]);

      if (controller.signal.aborted) return;

      if (homeResult.status === 'fulfilled') {
        const data = homeResult.value.data;
        setBanners(Array.isArray(data?.banners) ? data.banners : []);
        setTrending(Array.isArray(data?.trending) ? data.trending : []);
        setProposed(Array.isArray(data?.proposed) ? data.proposed : []);
        setAllMovies(Array.isArray(data?.movies) ? data.movies : []);
      }

      if (animeResult.status === 'fulfilled') {
        const animeData = animeResult.value.data;
        const nextAnime = Array.isArray(animeData?.movies) ? animeData.movies : [];
        setAnimeList(nextAnime);
        setActiveAnimeIndex((index) => nextAnime.length ? Math.min(index, nextAnime.length - 1) : 0);
      }

      const failedSections = [homeResult, animeResult].filter((result) => result.status === 'rejected').length;
      if (failedSections === 2) setLoadError('Không tải được danh sách phim. Backend có thể đang khởi động, vui lòng thử lại.');
      else if (failedSections === 1) setLoadError('Một phần nội dung tải chậm và đang tạm thời không hiển thị.');
      setLoading(false);
    };

    void fetchData();
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    // Watch history must not force the public movie catalog to refetch after login.
    if (user && accessToken) {
      axios.get(`${API_URL}/user/history`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      }).then(res => {
        setWatchHistory(res.data);
      }).catch((e) => {
        console.warn('Failed to fetch watch history.', e);
      });
    }
  }, [user, accessToken, setWatchHistory]);

  useEffect(() => {
    if (!user) {
      queueMicrotask(() => {
        setPersonalized([]);
        setHasPersonalizedRecommendations(false);
      });
      return;
    }
    const controller = new AbortController();
    axios.get(`${API_URL}/movies/recommendations/me`, { signal: controller.signal })
      .then((response) => {
        setPersonalized(Array.isArray(response.data?.movies) ? response.data.movies : []);
        setHasPersonalizedRecommendations(response.data?.personalized === true);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPersonalized([]);
          setHasPersonalizedRecommendations(false);
        }
      });
    return () => controller.abort();
  }, [accessToken, user, watchHistory.length]);

  // Parallax backdrop tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = (clientX - innerWidth / 2) / (innerWidth / 2);
    const y = (clientY - innerHeight / 2) / (innerHeight / 2);
    setParallaxOffset({ x, y });
  };

  const handleToggleFavorite = async (movieId: string, movie?: Movie) => {
    if (!user) {
      showToast('Vui lòng đăng nhập để lưu phim yêu thích!', 'info');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/user/favorites/${movieId}`, {}, {
        headers: { Authorization: `Bearer ${useStore.getState().accessToken}` }
      });
      const currentFavs = [...favorites];
      if (res.data.favorited) {
        if (movie) setFavorites([...currentFavs, movie]);
      } else {
        setFavorites(currentFavs.filter(f => f.id !== movieId));
      }
      showToast(res.data.favorited ? 'Đã thêm phim vào yêu thích.' : 'Đã xóa phim khỏi yêu thích.', 'success');
    } catch {
      showToast('Không thể cập nhật danh sách yêu thích.', 'error');
    }
  };

  const handleRemoveHistory = async (historyId: string) => {
    if (!user || !accessToken) return;
    try {
      await axios.delete(`${API_URL}/user/history/${historyId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setWatchHistory(watchHistory.filter((item) => item.id !== historyId));
      showToast('Đã xóa phim khỏi danh sách tiếp tục xem!', 'success');
    } catch {
      setWatchHistory(watchHistory.filter((item) => item.id !== historyId));
    }
  };

  const fallbackMovie = allMovies[0] || proposed[0] || trending[0];
  const activeBanner = banners[currentBannerIndex] || (fallbackMovie ? {
    id: `fallback-banner-${fallbackMovie.id}`,
    title: fallbackMovie.title,
    description: fallbackMovie.description || fallbackMovie.englishTitle || fallbackMovie.title,
    imageUrl: fallbackMovie.backdropUrl || fallbackMovie.posterUrl,
    movie: fallbackMovie,
  } : undefined);

  // Rotate banner index every 12s
  useEffect(() => {
    const bannerCount = Math.min(banners.length, 6);
    if (bannerCount <= 1) return;
    const timer = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev >= bannerCount - 1 ? 0 : prev + 1));
    }, 12000);
    return () => clearInterval(timer);
  }, [banners]);

  // Rotate active anime showcase index every 8s
  useEffect(() => {
    if (animeList.length <= 1) return;
    const timer = setInterval(() => {
      setActiveAnimeIndex((prev) => (prev === animeList.length - 1 ? 0 : prev + 1));
    }, 8000);
    return () => clearInterval(timer);
  }, [animeList, activeAnimeIndex]);

  // Auto-scroll active anime poster into view in the bottom strip without pulling the page scroll position!
  useEffect(() => {
    const row = animeRowRef.current;
    if (!row) return;
    const activeChild = row.children[activeAnimeIndex] as HTMLElement;
    if (activeChild) {
      const containerWidth = row.clientWidth;
      const childOffsetLeft = activeChild.offsetLeft;
      const childWidth = activeChild.clientWidth;

      const targetScrollLeft = childOffsetLeft - (containerWidth / 2) + (childWidth / 2);

      row.scrollTo({
        left: targetScrollLeft,
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    }
  }, [activeAnimeIndex, reduceMotion]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-[70vh]">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-slate-900 border-t-red-600 animate-spin" />
          <div className="absolute inset-2 rounded-full border-4 border-slate-900 border-t-purple-600 animate-spin animate-reverse" />
        </div>
      </div>
    );
  }

  // 6 gradient categories config
  const categories = [
    { name: 'Viễn Tưởng', query: 'vien-tuong', gradient: 'from-purple-600 to-indigo-900' },
    { name: 'Tình Cảm', query: 'tinh-cam', gradient: 'from-pink-500 to-rose-900' },
    { name: 'Hành Động', query: 'hanh-dong', gradient: 'from-orange-500 to-amber-700' },
    { name: 'Kinh Dị', query: 'kinh-di', gradient: 'from-red-950 to-rose-800' },
    { name: 'Cổ Trang', query: 'co-trang', gradient: 'from-cyan-600 to-blue-900' },
    { name: 'Hài Hước', query: 'hai-huoc', gradient: 'from-slate-700 to-neutral-900' },
  ];

  return (
    <div className="flex-1 w-full pb-20 flex flex-col text-slate-100 bg-transparent">
      {loadError && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 w-full mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            <span>{loadError}</span>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="rounded-lg border border-amber-400/20 px-3 py-1.5 text-xs font-black transition hover:bg-amber-400/10">
              Thử tải lại
            </button>
          </div>
        </div>
      )}

      {/* HERO BANNER SECTION (ROPHIM STYLE) */}
      {activeBanner && (
        <div
          onMouseMove={handleMouseMove}
          className="relative w-full h-[65vh] md:h-[80vh] overflow-hidden bg-slate-950 flex items-center select-none border-b border-white/5"
        >
          {/* Backdrop Image Layer */}
          <div
            style={{
              transform: reduceMotion
                ? 'scale(1)'
                : `scale(1.06) translate3d(${parallaxOffset.x * -8}px, ${parallaxOffset.y * -8}px, 0px)`,
              transition: 'transform 0.2s ease-out',
            }}
            className="absolute inset-0 w-full h-full bg-cover bg-center"
          >
            <Image
              src={activeBanner.imageUrl}
              alt={activeBanner.title}
              fill
              priority
              sizes="100vw"
              className="w-full h-full object-cover"
            />
            {/* Visual shadows/gradients */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#06060c] via-transparent to-black/30" />
          </div>

          {/* Details Overlay */}
          <div
            style={{
              transform: reduceMotion
                ? 'none'
                : `translate3d(${parallaxOffset.x * 10}px, ${parallaxOffset.y * 10}px, 20px)`,
              transition: 'transform 0.2s ease-out',
            }}
            className="relative max-w-7xl mx-auto px-4 md:px-8 w-full z-20 flex flex-col items-start space-y-4 pt-12 text-left"
          >
            <div className="flex items-center space-x-2 bg-yellow-500 text-black text-[9px] md:text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded shadow-lg">
              <Sparkles className="w-3.5 h-3.5 mr-0.5 fill-current" /> NỔI BẬT
            </div>

            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] max-w-2xl">
              {activeBanner.title}
            </h1>

            <p className="text-slate-300 text-xs md:text-sm max-w-xl line-clamp-3 drop-shadow-md leading-relaxed">
              {activeBanner.description}
            </p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-semibold text-slate-200">
              <span className="flex items-center text-yellow-400 bg-black/50 px-2 py-0.5 rounded border border-white/5">
                <Star className="w-3.5 h-3.5 fill-current mr-1" />
                {activeBanner.movie?.ratingAvg?.toFixed(1) || '8.5'}
              </span>
              <span className="bg-black/50 px-2 py-0.5 rounded border border-white/5">
                {activeBanner.movie?.releaseYear || '2025'}
              </span>
              <span className="bg-black/50 px-2 py-0.5 rounded border border-white/5">
                {activeBanner.movie?.quality || 'HD'}
              </span>
              <span className="bg-black/50 px-2 py-0.5 rounded border border-white/5">
                {activeBanner.movie?.isSeries ? 'Phim Bộ' : 'Phim Lẻ'}
              </span>
            </div>

            <div className="flex items-center space-x-3 pt-1">
              <Link
                href={`/movies/${activeBanner.movie?.slug}`}
                className="flex items-center bg-yellow-500 text-black text-xs md:text-sm font-black px-6 py-2.5 rounded-full hover:bg-white hover:text-black transition-all shadow-xl active:scale-95"
              >
                <Play className="w-4 h-4 fill-current mr-1.5" /> Xem Ngay
              </Link>
              <button
                onClick={() => handleToggleFavorite(activeBanner.movie?.id, activeBanner.movie)}
                className="flex items-center bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs md:text-sm font-bold px-5 py-2.5 rounded-full transition-all active:scale-95"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Danh Sách
              </button>
            </div>
          </div>

          {/* Banner Quick Select Strip at the Bottom (Rophim Style overlay) */}
          <div className="absolute bottom-6 left-0 right-0 z-30 max-w-7xl mx-auto px-4 md:px-8 w-full">
            <div
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              className="flex items-center space-x-3 overflow-x-auto pl-8 pr-4 md:pl-[34%] md:pr-8 py-2 justify-start [&::-webkit-scrollbar]:hidden"
            >
              {banners.slice(0, 6).map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentBannerIndex(idx)}
                    className={`relative w-16 md:w-24 aspect-video rounded-lg overflow-hidden border-2 transition-all hover:scale-105 shrink-0 ${
                    currentBannerIndex === idx ? 'border-yellow-500 shadow-lg scale-105' : 'border-white/10 opacity-60'
                  }`}
                >
                  <Image src={item.imageUrl} alt={item.title} fill sizes="96px" className="object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-end p-1 md:p-1.5">
                    <span className="text-[8px] md:text-[9px] font-bold text-white truncate w-full text-left">
                      {item.title}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY / GENRE BUTTONS (6 COLUMNS) */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 w-full mt-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat, i) => (
            <Link
              key={i}
              href={`/the-loai/${encodeURIComponent(cat.query)}`}
              className={`relative rounded-2xl overflow-hidden py-5 md:py-6 flex flex-col items-center justify-center bg-gradient-to-tr ${cat.gradient} shadow-lg hover:shadow-glow transition-all duration-300 transform hover:-translate-y-1 hover:scale-103 group border border-white/5`}
            >
              <span className="text-white text-base md:text-lg font-black tracking-wide drop-shadow-md">
                {cat.name}
              </span>
              <span className="text-[10px] text-white/60 font-semibold uppercase tracking-widest mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                Khám Phá
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ROW: CONTINUE WATCHING (TIEP TUC XEM) */}
      {user && watchHistory && watchHistory.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-8 w-full mt-14 text-left">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center space-x-2">
              <div className="w-1 h-5 bg-gradient-to-r from-red-500 to-yellow-500 rounded-full" />
              <h2 className="text-lg md:text-xl font-black uppercase tracking-wider text-white">
                Tiếp Tục Xem
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {watchHistory.slice(0, 4).map((item) => {
              const percent = Math.min(100, Math.floor((item.watchedTime / (item.duration || 1)) * 100));
              const displayImage = item.movie?.backdropUrl || item.movie?.posterUrl;
              return (
                <div
                  key={item.id}
                  className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-900 border border-white/5 shadow-lg group select-none flex flex-col justify-end"
                >
                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveHistory(item.id)}
                    className="absolute top-2 right-2 z-30 p-1 rounded-full bg-black/60 hover:bg-red-600 text-slate-300 hover:text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100 duration-200"
                    title="Xóa khỏi danh sách"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <Image src={displayImage} alt={item.movie?.title || 'Phim đang xem'} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />

                  {/* Content details */}
                  <div className="relative z-10 p-3 flex flex-col space-y-1.5 w-full">
                    <span className="self-start bg-yellow-500 text-black text-[9px] uppercase font-black px-1.5 py-0.5 rounded shadow">
                      {percent}% Đã Xem
                    </span>
                    <h3 className="text-white font-bold text-xs md:text-sm leading-tight truncate text-left">
                      {item.movie?.title}
                    </h3>

                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-medium">
                      <span className="truncate max-w-[70%]">
                        {(() => {
                          const matchedEp = item.movie?.episodes?.find((episode) => episode.id === item.episodeId);
                          return matchedEp ? `${matchedEp.title} • ` : '';
                        })()}
                        Đã xem {Math.floor(item.watchedTime / 60)} phút
                      </span>

                      <Link
                        href={`/watch/${item.movie?.slug}?ep=${(() => {
                          const matchedEp = item.movie?.episodes?.find((episode) => episode.id === item.episodeId);
                          return matchedEp?.episodeOrder || 1;
                        })()}`}
                        className="bg-white text-black hover:bg-yellow-500 rounded-full p-1 transition-colors cursor-pointer shrink-0"
                        title="Xem tiếp"
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </Link>
                    </div>
                  </div>

                  {/* Playback progress bar */}
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-800 z-20">
                    <div
                      style={{ width: `${percent}%` }}
                      className="h-full bg-gradient-to-r from-red-500 to-yellow-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}


      {/* ROW 1: RECOMMENDED MOVIES (PORTRAIT CARDS LIKE TOP 5) */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 w-full mt-14">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-2">
            <div className="w-1 h-5 bg-red-600 rounded-full" />
            <h2 className="text-lg md:text-xl font-black uppercase tracking-wider text-white">
              {hasPersonalizedRecommendations ? 'Dành Riêng Cho Bạn' : 'Phim Đề Xuất Cho Bạn'}
            </h2>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => scrollMovieRow(recommendedRowRef, -1)}
              className="p-1.5 rounded-full border border-white/10 bg-slate-900/60 hover:bg-red-600 text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollMovieRow(recommendedRowRef, 1)}
              className="p-1.5 rounded-full border border-white/10 bg-slate-900/60 hover:bg-red-600 text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={recommendedRowRef}
          className="movie-row flex space-x-8 overflow-x-auto pb-4 scroll-smooth"
        >
          {(hasPersonalizedRecommendations && personalized.length ? personalized : proposed).map((movie) => (
            <div key={movie.id} className="w-[160px] sm:w-[200px] shrink-0 relative pt-2">
              <MovieCard3D
                movie={movie}
                onToggleFavorite={handleToggleFavorite}
                isFavorited={favoriteIds.has(movie.id)}
              />
            </div>
          ))}
          {!personalized.length && proposed.length === 0 && (
            <p className="text-slate-500 text-sm py-4 w-full text-center">Chưa có phim đề xuất.</p>
          )}
        </div>
      </section>

      {/* ROW 2: NEWLY UPDATED MOVIES (PORTRAIT CARDS LIKE TOP 5) */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 w-full mt-12">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-2">
            <div className="w-1 h-5 bg-purple-600 rounded-full" />
            <h2 className="text-lg md:text-xl font-black uppercase tracking-wider text-white">
              Mới Cập Nhật
            </h2>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => scrollMovieRow(latestRowRef, -1)}
              className="p-1.5 rounded-full border border-white/10 bg-slate-900/60 hover:bg-purple-600 text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollMovieRow(latestRowRef, 1)}
              className="p-1.5 rounded-full border border-white/10 bg-slate-900/60 hover:bg-purple-600 text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={latestRowRef}
          className="movie-row flex space-x-8 overflow-x-auto pb-4 scroll-smooth"
        >
          {allMovies.map((movie) => (
            <div key={movie.id} className="w-[160px] sm:w-[200px] shrink-0 relative pt-2">
              <MovieCard3D
                movie={movie}
                onToggleFavorite={handleToggleFavorite}
                isFavorited={favoriteIds.has(movie.id)}
              />
            </div>
          ))}
          {allMovies.length === 0 && (
            <p className="text-slate-500 text-sm py-4 w-full text-center">Chưa có phim cập nhật.</p>
          )}
        </div>
      </section>

      {/* ROW 3: TOP 5 TODAY (PORTRAIT RANKED OVERLAY - ROPHIM STYLE) */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 w-full mt-14 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="w-1 h-5 bg-yellow-500 rounded-full" />
            <h2 className="text-lg md:text-xl font-black uppercase tracking-wider text-white">
              Top 5 Thịnh Hành
            </h2>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => scrollMovieRow(trendingRowRef, -1)}
              className="p-1.5 rounded-full border border-white/10 bg-slate-900/60 hover:bg-yellow-500 hover:text-black text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollMovieRow(trendingRowRef, 1)}
              className="p-1.5 rounded-full border border-white/10 bg-slate-900/60 hover:bg-yellow-500 hover:text-black text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={trendingRowRef}
          className="movie-row flex space-x-8 overflow-x-auto pb-4 scroll-smooth"
        >
          {trending.slice(0, 5).map((movie, index) => (
            <div
              key={movie.id}
              className="w-[160px] sm:w-[200px] shrink-0 relative pt-2"
            >
              {/* Giant Rank Number in the background/overlay */}
              <span className="text-yellow-500 font-extrabold text-7xl md:text-8xl italic absolute bottom-4 -left-3 z-30 select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
                {index + 1}
              </span>

              <div className="z-10 relative">
                <MovieCard3D
                  movie={movie}
                  onToggleFavorite={handleToggleFavorite}
                isFavorited={favoriteIds.has(movie.id)}
                />
              </div>
            </div>
          ))}
          {trending.length === 0 && (
            <p className="text-slate-500 text-sm py-4 w-full text-center">Chưa có phim thịnh hành.</p>
          )}
        </div>
      </section>

      {/* ROW: ANIME SHOWCASE SECTION (KHO TÀNG ANIME MỚI NHẤT) */}
      {animeList.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-8 w-full mt-14 mb-16">
          <div className="flex items-center space-x-2 mb-5">
            <div className="w-1 h-5 bg-yellow-500 rounded-full" />
            <h2 className="text-lg md:text-xl font-black uppercase tracking-wider text-white flex items-center">
              Kho Tàng Anime Mới Nhất
              <Link
                href="/search?type=hoathinh"
                aria-label="Xem tất cả anime"
                className="ml-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/30 text-slate-300 transition-colors hover:bg-white hover:text-black"
              >
                <ChevronRight className="w-5 h-5" />
              </Link>
            </h2>
          </div>

          {/* Active Anime showcase box */}
          {(() => {
            const activeAnime = animeList[activeAnimeIndex];
            if (!activeAnime) return null;
            return (
              <div className="relative w-full rounded-3xl bg-slate-900/40 border border-white/5 flex flex-col md:flex-row md:h-[400px] shadow-2xl transition-all duration-500">

                {/* Left content panel */}
                <div className="relative z-10 w-full md:w-[45%] p-6 md:p-10 md:pb-28 xl:pb-36 flex flex-col justify-center space-y-3.5 bg-gradient-to-r from-[#0d0f1a] via-[#0d0f1a]/95 to-transparent text-left">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-black text-white leading-tight drop-shadow-md">
                      {activeAnime.title}
                    </h3>
                    {activeAnime.englishTitle && (
                      <p className="text-slate-400 text-sm font-semibold mt-1">
                        {activeAnime.englishTitle}
                      </p>
                    )}
                  </div>

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-200">
                    <span className="bg-yellow-500 text-black px-1.5 py-0.5 rounded text-[10px] font-black">
                      IMDb {activeAnime.ratingAvg?.toFixed(1) || '8.0'}
                    </span>
                    <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] border border-white/5 font-bold">
                      T16
                    </span>
                    <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] border border-white/5 font-bold">
                      {activeAnime.releaseYear}
                    </span>
                    <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] border border-white/5 font-bold">
                      {activeAnime.isSeries ? 'Phần 1' : 'Movie'}
                    </span>
                    <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] border border-white/5 font-bold">
                      {activeAnime.isSeries ? `Tập ${activeAnime.episodeCount}` : 'Full'}
                    </span>
                  </div>

                  {/* Genre tag */}
                  <div>
                    <span className="bg-white/5 text-slate-400 border border-white/10 px-3 py-1 rounded-full text-[11px] font-bold">
                      Hoạt hình
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-slate-300 text-xs md:text-sm line-clamp-3 md:line-clamp-4 leading-relaxed">
                    {activeAnime.description || 'Thông tin chi tiết về bộ phim hoạt hình hấp dẫn đang được cập nhật.'}
                  </p>

                  {/* Buttons */}
                  <div className="flex items-center space-x-3 pt-2">
                    {/* Play circular yellow */}
                    <Link
                      href={`/movies/${activeAnime.slug}`}
                      className="flex items-center justify-center bg-yellow-500 text-black w-12 h-12 rounded-full transition-all shadow-lg hover:shadow-yellow-500/20 active:scale-95"
                    >
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </Link>

                    {/* Heart button */}
                    <button
                      onClick={() => handleToggleFavorite(activeAnime.id, activeAnime)}
                      className="flex items-center justify-center w-12 h-12 rounded-full border border-white/10 bg-slate-950/40 hover:bg-white/10 text-white transition-all active:scale-90 shadow"
                    >
                      {favorites.some(f => f.id === activeAnime.id) ? (
                        <Check className="w-5 h-5 text-green-400" />
                      ) : (
                        <Plus className="w-5 h-5" />
                      )}
                    </button>

                    {/* Info/Alert button */}
                    <Link
                      href={`/movies/${activeAnime.slug}`}
                      className="flex items-center justify-center w-12 h-12 rounded-full border border-white/10 bg-slate-950/40 hover:bg-white/10 text-slate-300 hover:text-white transition-all shadow"
                    >
                      <Sparkles className="w-5 h-5" />
                    </Link>
                  </div>
                </div>

                {/* Right backdrop layer */}
                <div className="relative w-full md:w-[65%] h-[200px] md:h-full overflow-hidden rounded-b-3xl md:rounded-b-none md:rounded-r-3xl">
                  <Image
                    src={activeAnime.backdropUrl || activeAnime.posterUrl}
                    alt={activeAnime.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 800px"
                    className="object-cover"
                  />
                  {/* Fades to blend image with left panel */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0d0f1a] via-[#0d0f1a]/30 to-transparent hidden md:block" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f1a] via-transparent to-transparent md:hidden" />
                </div>

                {/* Overlaid Bottom list of posters sitting at the bottom edge (-bottom-10) */}
                <div ref={animeRowRef} className="movie-row absolute -bottom-10 left-0 right-0 mx-auto w-fit max-w-[95%] z-20 flex justify-start gap-2 overflow-x-auto scroll-smooth px-4 py-1.5 md:translate-x-6 md:gap-3 no-scrollbar">
                  {animeList.map((anime, idx) => (
                    <button
                      key={anime.id}
                      onClick={() => setActiveAnimeIndex(idx)}
                      title={anime.title}
                      className={`group relative h-[72px] w-[48px] shrink-0 overflow-hidden rounded-xl border-2 bg-slate-900 shadow-lg transition duration-300 hover:-translate-y-1 md:h-[86px] md:w-[58px] xl:h-[100px] xl:w-[68px] ${
                        activeAnimeIndex === idx
                          ? 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)] scale-103'
                          : 'border-white/10 opacity-75'
                      }`}
                    >
                      <Image
                        src={anime.posterUrl}
                        alt={anime.title}
                        fill
                        sizes="80px"
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-left text-[9px] font-bold text-white">
                        {anime.title}
                      </div>
                    </button>
                  ))}
                </div>

              </div>
            );
          })()}

        </section>
      )}
    </div>
  );
}
