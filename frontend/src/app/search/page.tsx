'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search as SearchIcon, SlidersHorizontal, Grid, Star, X } from 'lucide-react';
import MovieCard3D from '../../components/ui/MovieCard3D';
import { useStore } from '../../hooks/useStore';
import axios from '../../lib/api';
import type { MetaItem, Movie } from '../../types/movie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex-grow flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-4 border-t-red-600 border-slate-800 rounded-full animate-spin" />
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const { favorites, setFavorites, user, showToast } = useStore();

  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<MetaItem[]>([]);
  const [countries, setCountries] = useState<MetaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(Math.max(1, Number(searchParams.get('page')) || 1));
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Filter States
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [selectedGenre, setSelectedGenre] = useState(searchParams.get('genre') || '');
  const [selectedCountry, setSelectedCountry] = useState(searchParams.get('country') || '');
  const [selectedYear, setSelectedYear] = useState(searchParams.get('year') || '');
  const [selectedType, setSelectedType] = useState(searchParams.get('type') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');

  // Keep category navigation working when moving between links on the same page.
  useEffect(() => {
    setQuery(searchParams.get('q') || '');
    setSelectedGenre(searchParams.get('genre') || '');
    setSelectedCountry(searchParams.get('country') || '');
    setSelectedYear(searchParams.get('year') || '');
    setSelectedType(searchParams.get('type') || '');
    setSortBy(searchParams.get('sortBy') || 'createdAt');
    setCurrentPage(Math.max(1, Number(searchParams.get('page')) || 1));
  }, [searchParams]);

  // Load Filters Options from KKPhim
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [genresRes, countriesRes] = await Promise.all([
          axios.get(`${API_URL}/genres`),
          axios.get(`${API_URL}/countries`),
        ]);
        setGenres(genresRes.data || []);
        setCountries(countriesRes.data || []);
      } catch (e) {
        console.warn('Failed to load genres/countries.', e);
        setGenres([]);
        setCountries([]);
      }
    };
    loadFilters();
  }, []);

  // Fetch filtered movies
  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        const params: any = { page: currentPage, limit: 24 };
        if (query) params.search = query;
        if (selectedGenre) params.genre = selectedGenre;
        if (selectedCountry) params.country = selectedCountry;
        if (selectedYear) params.year = selectedYear;
        if (selectedType) params.type = selectedType;
        if (sortBy) params.sortBy = sortBy;

        const res = await axios.get(`${API_URL}/movies`, { params });
        setMovies(res.data.movies || []);
        setTotalResults(Number(res.data.total) || 0);
        setTotalPages(Math.max(1, Number(res.data.totalPages) || 1));
      } catch (error) {
        console.warn('Search query failed.', error);
        setMovies([]);
      } finally {
        setLoading(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      fetchMovies();
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [query, selectedGenre, selectedCountry, selectedYear, selectedType, sortBy, currentPage]);

  const paginationItems = (): (number | 'ellipsis-left' | 'ellipsis-right')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

    const items: (number | 'ellipsis-left' | 'ellipsis-right')[] = [1];
    if (currentPage > 4) items.push('ellipsis-left');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let page = start; page <= end; page += 1) items.push(page);
    if (currentPage < totalPages - 3) items.push('ellipsis-right');
    items.push(totalPages);
    return items;
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) params.delete('page');
    else params.set('page', String(page));
    router.replace(`/search${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleFavorite = async (movieId: string) => {
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
        setFavorites([...currentFavs, { id: movieId }]);
      } else {
        setFavorites(currentFavs.filter(f => f.id !== movieId));
      }
    } catch (e) {
      const isAlready = favorites.some(f => f.id === movieId);
      if (isAlready) {
        setFavorites(favorites.filter(f => f.id !== movieId));
      } else {
        setFavorites([...favorites, { id: movieId }]);
      }
    }
  };

  const clearAllFilters = () => {
    setQuery('');
    setSelectedGenre('');
    setSelectedCountry('');
    setSelectedYear('');
    setSelectedType('');
    setSortBy('createdAt');
    router.push('/search');
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-10 flex flex-col space-y-6 text-slate-100 select-none">
      
      {/* Search Bar Header */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-2xl">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Tìm kiếm phim, đạo diễn, diễn viên..."
            className="w-full bg-slate-900/60 border border-white/10 focus:border-red-500 rounded-full pl-6 pr-12 py-3 text-sm md:text-base outline-none text-white backdrop-blur-sm"
          />
          <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-1.5 px-5 py-3 rounded-full border text-xs md:text-sm font-bold transition-all active:scale-95 ${
              showFilters || selectedGenre || selectedCountry || selectedYear || selectedType
                ? 'bg-red-600 border-transparent text-white'
                : 'border-white/10 bg-slate-950/40 text-slate-300 hover:bg-white/5'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Bộ Lọc</span>
          </button>

          {(selectedGenre || selectedCountry || selectedYear || selectedType || query) && (
            <button
              onClick={clearAllFilters}
              className="p-3 rounded-full border border-white/10 bg-slate-950/40 hover:bg-red-600/20 text-slate-400 hover:text-red-500 transition-all"
              title="Xóa bộ lọc"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filters Drawer */}
      {showFilters && (
        <div className="glass-panel p-6 rounded-3xl grid grid-cols-2 md:grid-cols-5 gap-4 text-left animate-slide-down">
          
          {/* Genre */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Thể loại:</span>
            <select
              value={selectedGenre}
              onChange={(e) => { setSelectedGenre(e.target.value); setCurrentPage(1); }}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs md:text-sm outline-none text-white"
            >
              <option value="">Tất cả thể loại</option>
              {genres.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Country */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Quốc gia:</span>
            <select
              value={selectedCountry}
              onChange={(e) => { setSelectedCountry(e.target.value); setCurrentPage(1); }}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs md:text-sm outline-none text-white"
            >
              <option value="">Tất cả quốc gia</option>
              {countries.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Release Year */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Năm phát hành:</span>
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setCurrentPage(1); }}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs md:text-sm outline-none text-white"
            >
              <option value="">Tất cả năm</option>
              {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2015, 2010].map((yr) => (
                <option key={yr} value={yr}>
                  Năm {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Type / Format */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Định dạng:</span>
            <select
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs md:text-sm outline-none text-white"
            >
              <option value="">Tất cả định dạng</option>
              <option value="movie">Phim Lẻ</option>
              <option value="series">Phim Bộ</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Sắp xếp theo:</span>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs md:text-sm outline-none text-white"
            >
              <option value="createdAt">Mới cập nhật</option>
              <option value="views">Lượt xem nhiều</option>
              <option value="ratingAvg">Đánh giá cao</option>
            </select>
          </div>

        </div>
      )}

      {/* Movies Grid */}
      {loading ? (
        <div className="flex-1 flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-t-red-600 border-slate-800 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-slate-400 text-xs font-semibold text-left">
            Đang hiển thị <span className="text-white font-bold">{movies.length}</span>
            {totalResults > 0 && <> / <span className="text-white font-bold">{totalResults}</span></>} phim.
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {movies.map((movie) => (
              <div key={movie.id}>
                <MovieCard3D
                  movie={movie}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorited={favorites.map(f => f.id).includes(movie.id)}
                />
              </div>
            ))}
          </div>

          {movies.length > 0 && totalPages > 1 && (
            <nav aria-label="Phân trang phim" className="flex flex-wrap items-center justify-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 transition hover:border-red-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                Trước
              </button>

              {paginationItems().map((item) =>
                typeof item === 'number' ? (
                <button
                  key={item}
                  type="button"
                  onClick={() => goToPage(item)}
                  aria-current={item === currentPage ? 'page' : undefined}
                  className={`h-10 min-w-10 rounded-xl border px-3 text-sm font-black transition ${
                    item === currentPage
                      ? 'border-red-500 bg-red-600 text-white shadow-[0_0_18px_rgba(220,38,38,0.35)]'
                      : 'border-white/10 text-slate-300 hover:border-red-500/50 hover:text-white'
                  }`}
                >
                  {item}
                </button>
                ) : (
                  <span key={item} className="px-1 text-slate-500">…</span>
                )
              )}

              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 transition hover:border-red-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                Sau
              </button>
            </nav>
          )}

          {movies.length === 0 && (
            <div className="py-20 text-center space-y-2">
              <Grid className="w-12 h-12 text-slate-700 mx-auto" />
              <h4 className="text-slate-400 font-bold">Không tìm thấy phim phù hợp</h4>
              <p className="text-xs text-slate-500">Hãy thử nhập từ khóa khác hoặc điều chỉnh bộ lọc của bạn.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
