'use client';

import React, { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Grid2X2,
  RotateCcw,
  Search as SearchIcon,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import MovieCard3D from '../ui/MovieCard3D';
import { useStore } from '../../hooks/useStore';
import api from '../../lib/api';
import type { MetaItem, Movie } from '../../types/movie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type FilterKey = 'genre' | 'country' | 'year' | 'type' | 'sortBy';
type PaginationItem = number | 'ellipsis-left' | 'ellipsis-right';

const sortLabels: Record<string, string> = {
  createdAt: 'Mới cập nhật',
  views: 'Xem nhiều nhất',
  ratingAvg: 'Đánh giá cao',
};

const typeLabels: Record<string, string> = {
  movie: 'Phim lẻ',
  series: 'Phim bộ',
  hoathinh: 'Hoạt hình',
  tvshows: 'TV Shows',
};

function SearchFallback() {
  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-7xl px-4 py-12 md:px-8">
      <div className="h-44 animate-pulse rounded-[2rem] border border-white/5 bg-white/[0.03]" />
      <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="aspect-[2/3] animate-pulse rounded-2xl bg-white/[0.05]" />
        ))}
      </div>
    </main>
  );
}

export type SearchInitialData = {
  movies: Movie[];
  genres: MetaItem[];
  countries: MetaItem[];
  totalPages: number;
  totalResults: number;
  loadError?: string;
};

export default function SearchClient({ initialData }: { initialData: SearchInitialData }) {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchPageRoute initialData={initialData} />
    </Suspense>
  );
}

function SearchPageRoute({ initialData }: { initialData: SearchInitialData }) {
  const searchParams = useSearchParams();
  return <SearchPageContent key={searchParams.toString()} initialData={initialData} />;
}

function SearchPageContent({ initialData }: { initialData: SearchInitialData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { favorites, setFavorites, user, showToast } = useStore();

  const initialQuery = searchParams.get('q') || '';
  const [draftQuery, setDraftQuery] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [selectedGenre, setSelectedGenre] = useState(searchParams.get('genre') || '');
  const [selectedCountry, setSelectedCountry] = useState(searchParams.get('country') || '');
  const [selectedYear, setSelectedYear] = useState(searchParams.get('year') || '');
  const [selectedType, setSelectedType] = useState(searchParams.get('type') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [currentPage, setCurrentPage] = useState(Math.max(1, Number(searchParams.get('page')) || 1));

  const [movies, setMovies] = useState<Movie[]>(initialData.movies);
  const [genres, setGenres] = useState<MetaItem[]>(initialData.genres);
  const [countries, setCountries] = useState<MetaItem[]>(initialData.countries);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [totalResults, setTotalResults] = useState(initialData.totalResults);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(initialData.loadError || '');
  const [reloadKey, setReloadKey] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const initialMoviesReadyRef = useRef(true);

  const favoriteIds = useMemo(() => new Set(favorites.map((movie) => movie.id)), [favorites]);
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: currentYear - 1979 }, (_, index) => currentYear - index);
  }, []);

  const updateUrl = useCallback((updates: Partial<Record<'q' | FilterKey | 'page', string>>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || (key === 'sortBy' && value === 'createdAt')) params.delete(key);
      else params.set(key, value);
    });
    const nextUrl = `/search${params.size ? `?${params.toString()}` : ''}`;
    router.replace(nextUrl, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (initialData.genres.length > 0 && initialData.countries.length > 0) return;
    const controller = new AbortController();
    const loadFilters = async () => {
      try {
        const [genresResponse, countriesResponse] = await Promise.all([
          api.get(`${API_URL}/genres`, { signal: controller.signal }),
          api.get(`${API_URL}/countries`, { signal: controller.signal }),
        ]);
        setGenres(Array.isArray(genresResponse.data) ? genresResponse.data : []);
        setCountries(Array.isArray(countriesResponse.data) ? countriesResponse.data : []);
      } catch {
        if (!controller.signal.aborted) {
          setGenres([]);
          setCountries([]);
        }
      }
    };
    void loadFilters();
    return () => controller.abort();
  }, [initialData.countries.length, initialData.genres.length]);

  useEffect(() => {
    if (initialMoviesReadyRef.current && reloadKey === 0) {
      initialMoviesReadyRef.current = false;
      return;
    }
    const controller = new AbortController();
    const fetchMovies = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const params: Record<string, string | number> = { page: currentPage, limit: 24 };
        if (query) params.search = query;
        if (selectedGenre) params.genre = selectedGenre;
        if (selectedCountry) params.country = selectedCountry;
        if (selectedYear) params.year = selectedYear;
        if (selectedType) params.type = selectedType;
        if (sortBy) params.sortBy = sortBy;

        const response = await api.get(`${API_URL}/movies`, { params, signal: controller.signal });
        const nextMovies = Array.isArray(response.data?.movies) ? response.data.movies : [];
        setMovies(nextMovies);
        setTotalResults(Number(response.data?.total) || nextMovies.length);
        setTotalPages(Math.max(1, Number(response.data?.totalPages) || 1));
      } catch {
        if (!controller.signal.aborted) {
          setMovies([]);
          setTotalResults(0);
          setTotalPages(1);
          setLoadError('Không thể tải kết quả lúc này. Vui lòng kiểm tra kết nối và thử lại.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void fetchMovies();
    return () => controller.abort();
  }, [query, selectedGenre, selectedCountry, selectedYear, selectedType, sortBy, currentPage, reloadKey]);

  const activeFilters = useMemo(() => {
    const items: { key: FilterKey; label: string }[] = [];
    if (selectedGenre) items.push({ key: 'genre', label: genres.find((item) => item.slug === selectedGenre)?.name || selectedGenre });
    if (selectedCountry) items.push({ key: 'country', label: countries.find((item) => item.slug === selectedCountry)?.name || selectedCountry });
    if (selectedYear) items.push({ key: 'year', label: `Năm ${selectedYear}` });
    if (selectedType) items.push({ key: 'type', label: typeLabels[selectedType] || selectedType });
    if (sortBy !== 'createdAt') items.push({ key: 'sortBy', label: sortLabels[sortBy] || sortBy });
    return items;
  }, [countries, genres, selectedCountry, selectedGenre, selectedType, selectedYear, sortBy]);

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = draftQuery.trim().replace(/\s+/g, ' ');
    setDraftQuery(normalized);
    setQuery(normalized);
    setCurrentPage(1);
    updateUrl({ q: normalized, page: '' });
  };

  const changeFilter = (key: FilterKey, value: string) => {
    if (key === 'genre') setSelectedGenre(value);
    if (key === 'country') setSelectedCountry(value);
    if (key === 'year') setSelectedYear(value);
    if (key === 'type') setSelectedType(value);
    if (key === 'sortBy') setSortBy(value || 'createdAt');
    setCurrentPage(1);
    updateUrl({ [key]: value, page: '' });
  };

  const clearAllFilters = () => {
    setDraftQuery('');
    setQuery('');
    setSelectedGenre('');
    setSelectedCountry('');
    setSelectedYear('');
    setSelectedType('');
    setSortBy('createdAt');
    setCurrentPage(1);
    router.replace('/search', { scroll: false });
  };

  const paginationItems = useMemo<PaginationItem[]>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const items: PaginationItem[] = [1];
    if (currentPage > 4) items.push('ellipsis-left');
    for (let page = Math.max(2, currentPage - 1); page <= Math.min(totalPages - 1, currentPage + 1); page += 1) items.push(page);
    if (currentPage < totalPages - 3) items.push('ellipsis-right');
    items.push(totalPages);
    return items;
  }, [currentPage, totalPages]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    updateUrl({ page: page === 1 ? '' : String(page) });
    window.scrollTo({ top: 100, behavior: 'smooth' });
  };

  const handleToggleFavorite = async (movieId: string) => {
    if (!user) {
      showToast('Vui lòng đăng nhập để lưu phim yêu thích!', 'info');
      return;
    }
    try {
      const response = await api.post(`${API_URL}/user/favorites/${movieId}`);
      if (response.data.favorited) {
        const movie = movies.find((item) => item.id === movieId);
        if (movie && !favoriteIds.has(movieId)) setFavorites([...favorites, movie]);
      } else {
        setFavorites(favorites.filter((movie) => movie.id !== movieId));
      }
      showToast(response.data.favorited ? 'Đã thêm phim vào yêu thích.' : 'Đã xóa phim khỏi yêu thích.', 'success');
    } catch {
      showToast('Không thể cập nhật danh sách yêu thích.', 'error');
    }
  };

  const resultStart = totalResults ? (currentPage - 1) * 24 + 1 : 0;
  const resultEnd = Math.min(currentPage * 24, totalResults);
  const hasSearchContext = Boolean(query || activeFilters.length);

  return (
    <main className="relative mx-auto min-h-[75vh] w-full max-w-7xl px-4 pb-16 pt-8 text-slate-100 md:px-8 md:pt-12">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-80 w-[80%] -translate-x-1/2 rounded-full bg-red-600/10 blur-[120px]" />

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl backdrop-blur-xl md:p-8">
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-red-400">
                <Sparkles className="h-4 w-4" /> Khám phá CINE3D
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white md:text-4xl">Tìm bộ phim dành cho bạn</h1>
              <p className="mt-2 max-w-2xl text-xs leading-6 text-slate-400 md:text-sm">Tìm theo tên phim, sau đó tinh chỉnh bằng thể loại, quốc gia, năm phát hành và định dạng.</p>
            </div>
            <Film className="hidden h-14 w-14 text-white/5 sm:block" />
          </div>

          <form onSubmit={applySearch} role="search" className="flex flex-col gap-3 sm:flex-row">
            <label className="group relative flex-1">
              <span className="sr-only">Tên phim cần tìm</span>
              <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500 transition group-focus-within:text-red-400" />
              <input
                type="search"
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder="Nhập tên phim hoặc tên gốc..."
                autoComplete="off"
                className="h-13 w-full rounded-2xl border border-white/10 bg-black/40 pl-12 pr-11 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-red-500/70 focus:bg-black/60 focus:ring-4 focus:ring-red-500/10 md:text-base"
              />
              {draftQuery && (
                <button type="button" onClick={() => setDraftQuery('')} aria-label="Xóa từ khóa" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
            <button type="submit" className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-7 text-sm font-black text-white shadow-[0_10px_30px_rgba(220,38,38,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(220,38,38,0.35)] active:translate-y-0">
              <SearchIcon className="h-4 w-4" /> Tìm kiếm
            </button>
            <button type="button" onClick={() => setShowFilters((open) => !open)} aria-expanded={showFilters} className={`flex h-13 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-bold transition ${showFilters || activeFilters.length ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'}`}>
              <SlidersHorizontal className="h-4 w-4" /> Bộ lọc
              {activeFilters.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] text-white">{activeFilters.length}</span>}
            </button>
          </form>

          {showFilters && (
            <div className="mt-5 grid grid-cols-1 gap-4 border-t border-white/10 pt-5 sm:grid-cols-2 lg:grid-cols-5">
              <FilterSelect label="Thể loại" value={selectedGenre} onChange={(value) => changeFilter('genre', value)} options={genres.map((item) => ({ value: item.slug, label: item.name }))} placeholder="Tất cả thể loại" />
              <FilterSelect label="Quốc gia" value={selectedCountry} onChange={(value) => changeFilter('country', value)} options={countries.map((item) => ({ value: item.slug, label: item.name }))} placeholder="Tất cả quốc gia" />
              <FilterSelect label="Năm phát hành" value={selectedYear} onChange={(value) => changeFilter('year', value)} options={years.map((year) => ({ value: String(year), label: String(year) }))} placeholder="Tất cả các năm" />
              <FilterSelect label="Định dạng" value={selectedType} onChange={(value) => changeFilter('type', value)} options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} placeholder="Tất cả định dạng" />
              <FilterSelect label="Sắp xếp" value={sortBy} onChange={(value) => changeFilter('sortBy', value)} options={Object.entries(sortLabels).map(([value, label]) => ({ value, label }))} />
            </div>
          )}
        </div>
      </section>

      {(query || activeFilters.length > 0) && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {query && <FilterChip label={`“${query}”`} onRemove={() => { setDraftQuery(''); setQuery(''); setCurrentPage(1); updateUrl({ q: '', page: '' }); }} />}
          {activeFilters.map((filter) => <FilterChip key={filter.key} label={filter.label} onRemove={() => changeFilter(filter.key, filter.key === 'sortBy' ? 'createdAt' : '')} />)}
          <button type="button" onClick={clearAllFilters} className="ml-1 inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-slate-500 transition hover:text-red-400"><RotateCcw className="h-3.5 w-3.5" /> Xóa tất cả</button>
        </div>
      )}

      <section className="mt-8" aria-live="polite" aria-busy={loading}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-white/5 pb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Kết quả tìm kiếm</p>
            <h2 className="mt-1 text-xl font-black text-white md:text-2xl">{query ? `Phim phù hợp với “${query}”` : hasSearchContext ? 'Phim theo bộ lọc' : 'Phim mới cập nhật'}</h2>
          </div>
          {!loading && !loadError && (
            <p className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-400">
              {totalResults > 0 ? `${resultStart}–${resultEnd} trong ${totalResults.toLocaleString('vi-VN')} phim` : '0 phim'}
            </p>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 md:gap-x-5">
            {Array.from({ length: 10 }, (_, index) => <MovieSkeleton key={index} />)}
          </div>
        ) : loadError ? (
          <div className="rounded-3xl border border-red-500/15 bg-red-500/[0.04] px-6 py-16 text-center">
            <SearchX className="mx-auto h-12 w-12 text-red-400/70" />
            <h3 className="mt-4 text-lg font-black text-white">Không tải được kết quả</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{loadError}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-red-500 hover:text-white"><RotateCcw className="h-4 w-4" /> Thử lại</button>
          </div>
        ) : movies.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <SearchX className="mx-auto h-14 w-14 text-slate-700" />
            <h3 className="mt-4 text-lg font-black text-white">Không tìm thấy phim phù hợp</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Hãy kiểm tra chính tả, dùng từ khóa ngắn hơn hoặc bỏ bớt một vài bộ lọc.</p>
            <button type="button" onClick={clearAllFilters} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-bold text-slate-300 transition hover:border-red-500/40 hover:text-white"><Grid2X2 className="h-4 w-4" /> Xem tất cả phim</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 md:gap-x-5">
              {movies.map((movie) => (
                <article key={movie.id} className="min-w-0">
                  <MovieCard3D movie={movie} onToggleFavorite={handleToggleFavorite} isFavorited={favoriteIds.has(movie.id)} />
                  <div className="mt-3 min-w-0 px-1">
                    <h3 className="truncate text-sm font-bold text-white" title={movie.title}>{movie.title}</h3>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>{movie.releaseYear || 'Đang cập nhật'}</span>
                      <span className="truncate">{movie.isSeries ? `${movie.episodeCount || 1} tập` : movie.quality || 'HD'}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <nav aria-label="Phân trang phim" className="mt-12 flex flex-wrap items-center justify-center gap-2">
                <PageButton label="Trang trước" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Trước</span></PageButton>
                {paginationItems.map((item) => typeof item === 'number' ? (
                  <button key={item} type="button" onClick={() => goToPage(item)} aria-current={item === currentPage ? 'page' : undefined} className={`grid h-10 min-w-10 place-items-center rounded-xl border px-3 text-sm font-black transition ${item === currentPage ? 'border-red-500 bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]' : 'border-white/10 bg-white/[0.02] text-slate-400 hover:border-red-500/40 hover:text-white'}`}>{item}</button>
                ) : <span key={item} className="px-1 text-slate-600">…</span>)}
                <PageButton label="Trang sau" disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)}><span className="hidden sm:inline">Sau</span><ChevronRight className="h-4 w-4" /></PageButton>
              </nav>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function FilterSelect({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-slate-900 px-3 text-xs font-semibold text-slate-200 outline-none transition focus:border-red-500/60">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/[0.08] py-1.5 pl-3 pr-2 text-xs font-bold text-red-200">{label}<button type="button" onClick={onRemove} aria-label={`Xóa bộ lọc ${label}`} className="rounded-full p-0.5 text-red-300/60 transition hover:bg-red-500/20 hover:text-white"><X className="h-3.5 w-3.5" /></button></span>;
}

function MovieSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] rounded-2xl border border-white/5 bg-white/[0.05]" />
      <div className="mt-3 h-4 w-4/5 rounded bg-white/[0.06]" />
      <div className="mt-2 h-3 w-2/5 rounded bg-white/[0.04]" />
    </div>
  );
}

function PageButton({ children, label, disabled, onClick }: { children: React.ReactNode; label: string; disabled: boolean; onClick: () => void }) {
  return <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="flex h-10 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.02] px-3 text-sm font-bold text-slate-400 transition hover:border-red-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">{children}</button>;
}
