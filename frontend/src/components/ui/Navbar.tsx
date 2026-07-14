'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ArrowRight, Search, SearchX, Film, LogOut, ShieldAlert, Sparkles, Menu, X, Bell, Crown, History, Trash2, Home, User } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import axios from '../../lib/api';
import type { Movie } from '../../types/movie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const RECENT_SEARCHES_KEY = 'cine3d-recent-searches';
const MAX_RECENT_SEARCHES = 5;

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  url?: string | null;
  createdAt: string;
};

export default function Navbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user, logout, hasHydrated, authReady, accessToken } = useStore();

  const isTabActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname?.startsWith(path);
  };

  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Movie[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Notification states
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notiOpen, setNotiOpen] = useState(false);
  const notiRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLFormElement>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const suggestionCacheRef = useRef<Map<string, Movie[]>>(new Map());

  // Monitor scrolling to alter glass background intensity
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) {
        setNotiOpen(false);
      }
      const target = e.target as HTMLElement;
      if (!target.closest('[data-search-form]')) {
        setSuggestionsOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Update query state if search param changes
  useEffect(() => {
    queueMicrotask(() => setSearchQuery(searchParams.get('q') || ''));
  }, [searchParams]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
      if (Array.isArray(saved)) {
        const recent = saved.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_SEARCHES);
        queueMicrotask(() => setRecentSearches(recent));
      }
    } catch {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    }
  }, []);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setSuggestionsOpen(true);

      if (window.matchMedia('(min-width: 768px)').matches) {
        desktopSearchInputRef.current?.focus();
      } else {
        setMobileMenuOpen(true);
        window.setTimeout(() => mobileSearchInputRef.current?.focus(), 0);
      }
    };

    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  // Lightweight debounced typeahead search. It only starts after two characters.
  useEffect(() => {
    const keyword = searchQuery.trim();
    if (keyword.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const cacheKey = keyword.toLocaleLowerCase('vi');
      const cachedSuggestions = suggestionCacheRef.current.get(cacheKey);
      if (cachedSuggestions) {
        setSuggestions(cachedSuggestions);
        setSuggestionsLoading(false);
        setActiveSuggestionIndex(-1);
        return;
      }

      setSuggestionsLoading(true);
      try {
        const response = await axios.get(`${API_URL}/movies`, {
          params: { search: keyword, page: 1, limit: 6 },
          signal: controller.signal,
        });
        const movies = Array.isArray(response.data?.movies) ? response.data.movies : [];
        suggestionCacheRef.current.set(cacheKey, movies);
        setSuggestions(movies);
        setSuggestionsOpen(true);
        setActiveSuggestionIndex(-1);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const saveRecentSearch = useCallback((rawKeyword: string) => {
    const keyword = rawKeyword.trim().replace(/\s+/g, ' ');
    if (!keyword) return;

    setRecentSearches((current) => {
      const next = [keyword, ...current.filter((item) => item.toLocaleLowerCase('vi') !== keyword.toLocaleLowerCase('vi'))]
        .slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  // Fetch notifications
  useEffect(() => {
    if (user && hasHydrated && authReady && accessToken) {
      const fetchNotis = async () => {
        try {
          const res = await axios.get(`${API_URL}/user/notifications`, {
            headers: { Authorization: `Bearer ${useStore.getState().accessToken}` }
          });
          setNotifications(res.data);
          setUnreadCount(res.data.filter((notification: NotificationItem) => !notification.isRead).length);
        } catch {
          // ignore or mock
        }
      };
      const fetchWhenVisible = () => {
        if (document.visibilityState === 'visible') void fetchNotis();
      };
      void fetchNotis();
      const interval = window.setInterval(fetchWhenVisible, 60000);
      window.addEventListener('focus', fetchWhenVisible);
      return () => {
        window.clearInterval(interval);
        window.removeEventListener('focus', fetchWhenVisible);
      };
    }
  }, [accessToken, authReady, user, hasHydrated]);

  const handleMarkAsRead = async (id: string, url?: string | null) => {
    setNotiOpen(false);
    try {
      await axios.put(`${API_URL}/user/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${useStore.getState().accessToken}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      if (url) {
        router.push(url);
      }
    } catch {
      if (url) {
        router.push(url);
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const keyword = searchQuery.trim();
    if (keyword) {
      saveRecentSearch(keyword);
      setSuggestionsOpen(false);
      setMobileMenuOpen(false);
      router.push(`/search?q=${encodeURIComponent(keyword)}`);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);
    setSuggestionsOpen(true);
    setActiveSuggestionIndex(-1);

    if (value.trim().length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
    }
  };

  const handleRecentSearch = (keyword: string) => {
    setSearchQuery(keyword);
    saveRecentSearch(keyword);
    setSuggestionsOpen(false);
    setMobileMenuOpen(false);
    router.push(`/search?q=${encodeURIComponent(keyword)}`);
  };

  const handleSuggestionSelect = (movie: Movie) => {
    saveRecentSearch(searchQuery || movie.title);
    setSuggestionsOpen(false);
    setMobileMenuOpen(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
    setSuggestionsLoading(false);
    setActiveSuggestionIndex(-1);
    setSuggestionsOpen(true);
    (window.matchMedia('(min-width: 768px)').matches ? desktopSearchInputRef : mobileSearchInputRef).current?.focus();
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setSuggestionsOpen(false);
      setActiveSuggestionIndex(-1);
      return;
    }
    if (!suggestionsOpen || suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      const movie = suggestions[activeSuggestionIndex];
      saveRecentSearch(searchQuery || movie.title);
      setSuggestionsOpen(false);
      setMobileMenuOpen(false);
      router.push(`/movies/${movie.slug}`);
    }
  };

  const renderSearchDropdown = (mobile = false) => {
    if (!suggestionsOpen) return null;

    const keyword = searchQuery.trim();
    const dropdownClass = mobile
      ? 'absolute left-0 right-0 top-full z-[60] mt-2'
      : 'absolute right-0 top-full z-[60] mt-3 w-96';

    return (
      <div id={mobile ? 'mobile-search-suggestions' : 'desktop-search-suggestions'} role="listbox" className={`${dropdownClass} overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl`}>
        {keyword.length < 2 ? (
          <div className="p-1">
            <div className="flex items-center justify-between px-2 py-2">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                <History className="h-3.5 w-3.5" /> Tìm kiếm gần đây
              </span>
              {recentSearches.length > 0 && (
                <button type="button" onClick={clearRecentSearches} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 transition hover:text-red-400">
                  <Trash2 className="h-3 w-3" /> Xóa
                </button>
              )}
            </div>
            {recentSearches.length > 0 ? (
              <div className="space-y-0.5">
                {recentSearches.map((keywordItem) => (
                  <button key={keywordItem} type="button" onClick={() => handleRecentSearch(keywordItem)} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-white/[0.07] hover:text-white">
                    <Search className="h-3.5 w-3.5 text-slate-500" />
                    <span className="truncate">{keywordItem}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-5 text-center">
                <Search className="mx-auto h-6 w-6 text-slate-700" />
                <p className="mt-2 text-xs font-bold text-slate-400">Nhập ít nhất 2 ký tự để tìm phim</p>
                <p className="mt-1 text-[10px] text-slate-600">Tên phim, tên gốc hoặc từ khóa liên quan</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-2.5 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
              <span>Gợi ý phim</span>
              {!mobile && <span>Dùng ↑ ↓ để chọn</span>}
            </div>
            {suggestionsLoading ? (
              <div className="space-y-1 px-1 pb-1" aria-label="Đang tìm phim">
                {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-white/5" />)}
              </div>
            ) : suggestions.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <SearchX className="mx-auto h-7 w-7 text-slate-700" />
                <p className="mt-2 text-xs font-bold text-slate-400">Không tìm thấy phim phù hợp</p>
                <p className="mt-1 text-[10px] text-slate-600">Thử tên ngắn hơn hoặc kiểm tra lại chính tả</p>
              </div>
            ) : suggestions.map((movie, index) => (
              <Link
                key={movie.id}
                href={`/movies/${movie.slug}`}
                onMouseEnter={() => setActiveSuggestionIndex(index)}
                onClick={() => handleSuggestionSelect(movie)}
                className={`flex items-center gap-3 rounded-xl p-2 text-left transition ${activeSuggestionIndex === index ? 'bg-white/10' : 'hover:bg-white/[0.07]'}`}
              >
                <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-slate-900"><Image src={movie.posterUrl} alt="" fill sizes="40px" className="object-cover" /></span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs text-white">{movie.title}</strong>
                  {movie.englishTitle && <small className="mt-0.5 block truncate text-[10px] text-slate-500">{movie.englishTitle}</small>}
                  <small className="mt-1 block text-[10px] text-slate-400">{movie.releaseYear || 'Đang cập nhật'} · {movie.isSeries ? 'Phim bộ' : 'Phim lẻ'}</small>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              </Link>
            ))}
            {!suggestionsLoading && (
              <button type="submit" className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border-t border-white/5 px-3 py-2.5 text-[11px] font-bold text-yellow-400 transition hover:bg-yellow-400/10">
                Xem tất cả kết quả <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-black/75 backdrop-blur-md border-b border-white/5 py-3'
          : 'bg-gradient-to-b from-black/80 to-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between">
        
        {/* LOGO */}
        <Link href="/" className="flex items-center space-x-2 group">
          <div className="relative w-8 h-8 rounded-lg bg-gradient-to-tr from-yellow-500 to-red-600 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all">
            <Film className="w-4.5 h-4.5 text-black" />
          </div>
          <span className="text-xl font-black tracking-tighter bg-gradient-to-r from-white via-slate-100 to-yellow-500 bg-clip-text text-transparent">
            CINE<span className="text-yellow-500">3D</span>
          </span>
        </Link>

        {/* NAVIGATION LINKS - DESKTOP */}
        <div className="hidden lg:flex items-center space-x-6 text-sm font-semibold text-slate-300">
          <Link href="/" className="hover:text-yellow-500 transition-colors">Trang Chủ</Link>
          <Link href="/search?type=series" className="hover:text-yellow-500 transition-colors">Phim Bộ</Link>
          <Link href="/search?type=movie" className="hover:text-yellow-500 transition-colors">Phim Lẻ</Link>
          <Link href="/search" className="hover:text-yellow-500 transition-colors flex items-center">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 mr-1 animate-pulse" /> Khám Phá
          </Link>
          <Link href="/vip" className="flex items-center text-amber-400 transition-colors hover:text-amber-300">
            <Crown className="mr-1 h-3.5 w-3.5" /> VIP
          </Link>
        </div>

        {/* SEARCH & USER ACTIONS - DESKTOP */}
        <div className="hidden md:flex items-center space-x-4">
          {/* Search Form */}
          <form ref={searchRef} data-search-form onSubmit={handleSearchSubmit} className="relative">
            <input
              ref={desktopSearchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => setSuggestionsOpen(true)}
              onKeyDown={handleSearchKeyDown}
              aria-label="Tìm phim"
              role="combobox"
              aria-expanded={suggestionsOpen}
              aria-controls="desktop-search-suggestions"
              autoComplete="off"
              placeholder="Tìm nhanh tên phim..."
              className="bg-slate-900/60 border border-white/10 hover:border-white/20 focus:border-yellow-500 text-white rounded-full pl-4 pr-20 py-2 text-xs w-52 focus:w-72 transition-all duration-300 outline-none backdrop-blur-sm"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {searchQuery ? (
                <button type="button" onClick={clearSearch} aria-label="Xóa nội dung tìm kiếm" className="rounded-full p-1 text-slate-500 transition hover:bg-white/10 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="hidden rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 xl:block">⌘K</kbd>
              )}
              <button type="submit" aria-label="Tìm kiếm" className="rounded-full p-1 text-slate-400 transition-colors hover:bg-yellow-500/10 hover:text-yellow-400 cursor-pointer">
                <Search className="w-4 h-4" />
              </button>
            </div>
            {renderSearchDropdown()}
          </form>

          {/* User Section */}
          {!hasHydrated || !authReady ? (
            <div className="h-9 w-28 animate-pulse rounded-full bg-white/5" />
          ) : user ? (
            <div className="flex items-center space-x-3">
              {user.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  title="Admin Dashboard"
                  className="p-2 rounded-full border border-purple-500/20 bg-purple-950/20 text-purple-400 hover:bg-purple-950/40 hover:text-white transition-all"
                >
                  <ShieldAlert className="w-4 h-4" />
                </Link>
              )}

              {/* Notifications Dropdown Bell */}
              <div className="relative" ref={notiRef}>
                <button
                  onClick={() => setNotiOpen(!notiOpen)}
                  className="relative p-2 rounded-full border border-white/10 bg-slate-950/40 hover:bg-white/5 text-slate-300 hover:text-white transition-all cursor-pointer"
                  title="Thông báo"
                >
                  <Bell className="w-4.5 h-4.5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white ring-2 ring-black">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notiOpen && (
                  <div className="absolute right-0 top-full mt-3 w-80 rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl flex flex-col z-50">
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <span className="font-black uppercase tracking-wider text-slate-300 text-xs">Thông báo</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] text-yellow-500 font-bold bg-yellow-500/10 px-2 py-0.5 rounded-full">
                          {unreadCount} mới
                        </span>
                      )}
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto mt-2 space-y-2.5 pr-0.5 scrollbar-thin">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleMarkAsRead(n.id, n.url)}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                            n.isRead
                              ? 'bg-slate-900/20 border-white/5 text-slate-400 hover:bg-white/5'
                              : 'bg-yellow-500/5 border-yellow-500/20 text-slate-200 hover:bg-yellow-500/10'
                          }`}
                        >
                          <h4 className="font-bold text-xs leading-tight mb-0.5">{n.title}</h4>
                          <p className="text-[10px] text-slate-400 leading-normal line-clamp-2">{n.message}</p>
                          <span className="text-[8px] text-slate-500 font-medium mt-1 block">
                            {new Date(n.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      ))}
                      {notifications.length === 0 && (
                        <p className="text-slate-500 text-xs text-center py-6">Chưa có thông báo nào.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Link */}
              <Link
                href="/account"
                className="flex items-center space-x-2 border border-white/10 bg-slate-950/40 px-3 py-1.5 rounded-full hover:bg-white/5 transition-all"
              >
                <Image
                  src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&q=80'}
                  alt={user.username}
                  width={20}
                  height={20}
                  className="w-5 h-5 rounded-full object-cover border border-white/20"
                />
                <span className="text-xs font-bold text-white max-w-[80px] truncate">{user.username}</span>
              </Link>

              {/* Logout Button */}
              <button
                onClick={() => {
                  logout();
                  router.push('/account');
                }}
                title="Đăng xuất"
                className="p-2 rounded-full border border-white/10 hover:bg-red-600/20 hover:text-red-500 text-slate-400 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/account"
              className="bg-yellow-500 text-black text-xs font-black px-5 py-2 rounded-full hover:bg-white hover:text-black transition-all active:scale-95 shadow-[0_0_15px_rgba(234,179,8,0.2)]"
            >
              Đăng Nhập
            </Link>
          )}
        </div>

        {/* MOBILE MENU TOGGLE */}
        <div className="flex md:hidden items-center space-x-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg border border-white/10 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-black/95 border-b border-white/10 p-5 flex flex-col space-y-4 animate-fade-in backdrop-blur-xl">
          {/* Mobile Search */}
          <form data-search-form onSubmit={handleSearchSubmit} className="relative w-full">
            <input
              ref={mobileSearchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => setSuggestionsOpen(true)}
              onKeyDown={handleSearchKeyDown}
              aria-label="Tìm phim"
              role="combobox"
              aria-expanded={suggestionsOpen}
              aria-controls="mobile-search-suggestions"
              autoComplete="off"
              placeholder="Tìm nhanh tên phim..."
              className="bg-slate-900 border border-white/10 focus:border-yellow-500 text-white rounded-full pl-4 pr-20 py-2 text-sm w-full outline-none"
            />
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
              {searchQuery && (
                <button type="button" onClick={clearSearch} aria-label="Xóa nội dung tìm kiếm" className="text-slate-500 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
              <button type="submit" aria-label="Tìm kiếm" className="text-slate-400 hover:text-white cursor-pointer">
                <Search className="w-5 h-5" />
              </button>
            </div>
            {renderSearchDropdown(true)}
          </form>

          {/* Links */}
          <div className="flex flex-col space-y-3 font-semibold text-slate-300 text-center">
            <Link href="/" onClick={() => setMobileMenuOpen(false)} className="hover:text-yellow-500 py-1 border-b border-white/5">Trang Chủ</Link>
            <Link href="/search?type=series" onClick={() => setMobileMenuOpen(false)} className="hover:text-yellow-500 py-1 border-b border-white/5">Phim Bộ</Link>
            <Link href="/search?type=movie" onClick={() => setMobileMenuOpen(false)} className="hover:text-yellow-500 py-1 border-b border-white/5">Phim Lẻ</Link>
            <Link href="/search" onClick={() => setMobileMenuOpen(false)} className="hover:text-yellow-500 py-1 border-b border-white/5 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-400 mr-1 animate-pulse" /> Khám Phá
            </Link>
            <Link href="/vip" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center border-b border-white/5 py-1 text-amber-400 hover:text-amber-300">
              <Crown className="mr-1 h-4 w-4" /> Nâng cấp VIP
            </Link>

            {!hasHydrated || !authReady ? (
              <div className="mx-auto h-10 w-32 animate-pulse rounded-full bg-white/5" />
            ) : user ? (
              <>
                <Link href="/account" onClick={() => setMobileMenuOpen(false)} className="hover:text-yellow-500 py-1 border-b border-white/5">Tài Khoản</Link>
                {user.role === 'ADMIN' && (
                  <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="text-purple-400 hover:text-purple-300 py-1 border-b border-white/5">Admin Dashboard</Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                    router.push('/account');
                  }}
                  className="text-red-500 flex items-center justify-center space-x-1.5 py-2 cursor-pointer"
                >
                  <LogOut className="w-4.5 h-4.5" /> <span>Đăng xuất</span>
                </button>
              </>
            ) : (
              <Link
                href="/account"
                onClick={() => setMobileMenuOpen(false)}
                className="bg-yellow-500 text-black font-black py-2.5 rounded-full hover:bg-white transition-all text-center w-full block shadow cursor-pointer"
              >
                Đăng Nhập
              </Link>
            )}
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#020205]/95 border-t border-white/10 backdrop-blur-xl flex justify-around items-center py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <Link href="/" className={`flex flex-col items-center gap-0.5 active:scale-95 transition-all ${isTabActive('/') ? 'text-yellow-500 font-bold' : 'text-slate-400 hover:text-white'}`}>
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Trang chủ</span>
        </Link>
        <Link href="/search" className={`flex flex-col items-center gap-0.5 active:scale-95 transition-all ${isTabActive('/search') ? 'text-yellow-500 font-bold' : 'text-slate-400 hover:text-white'}`}>
          <Search className="w-5 h-5" />
          <span className="text-[10px] font-medium">Tìm kiếm</span>
        </Link>
        <Link href="/vip" className={`flex flex-col items-center gap-0.5 active:scale-95 transition-all ${isTabActive('/vip') ? 'text-amber-500 font-bold' : 'text-slate-400 hover:text-amber-400'}`}>
          <Crown className="w-5 h-5" />
          <span className="text-[10px] font-medium">VIP</span>
        </Link>
        <Link href="/account" className={`flex flex-col items-center gap-0.5 active:scale-95 transition-all ${isTabActive('/account') ? 'text-yellow-500 font-bold' : 'text-slate-400 hover:text-white'}`}>
          {user ? (
            <Image
              src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=40&q=80'}
              alt={user.username}
              width={20}
              height={20}
              className={`w-5 h-5 rounded-full object-cover border ${isTabActive('/account') ? 'border-yellow-500' : 'border-white/20'}`}
            />
          ) : (
            <User className="w-5 h-5" />
          )}
          <span className="text-[10px] font-medium">Cá nhân</span>
        </Link>
      </div>
    </nav>
  );
}
